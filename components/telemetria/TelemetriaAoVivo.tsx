'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import 'leaflet/dist/leaflet.css'
import { ajustarAoLimite, LIMITE_PATIO, type Ponto } from '@/lib/telemetria/limitePatio'

type MaquinaPos = {
  maquina: string
  latitude: number
  longitude: number
  created_at: string
}

type AbastInfo = {
  horimetroAtual: number | null
  horasDesde: number | null
  nomeEmp: string | null
  operador: string | null
}

const COR: Record<string, string> = { kone: '#f2c230', ferrari: '#f85149', linde: '#3fb950' }
const LABEL: Record<string, string> = { kone: '🏗 Kone', ferrari: '🚜 Ferrari', linde: '🏭 Linde' }

const CSS_TELEMETRIA = `
.maq-wrap .maq-tip { display:none; }
.maq-wrap:hover .maq-tip { display:block !important; }
@keyframes maq-ring { 0%,100%{box-shadow:0 0 0 0 rgba(248,81,73,0);} 50%{box-shadow:0 0 0 10px rgba(248,81,73,0.55);} }
.maq-pulsar { animation: maq-ring 1.3s ease-in-out infinite; border-color:#f85149 !important; }
`
const CENTER: [number, number] = [-26.9163, -48.7075]

export function TelemetriaAoVivo() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)
  const markers = useRef<Map<string, unknown>>(new Map())
  const [posicoes, setPosicoes] = useState<MaquinaPos[]>([])
  const [abastInfo, setAbastInfo] = useState<Map<string, AbastInfo>>(new Map())
  const [atualizado, setAtualizado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mapaPronto, setMapaPronto] = useState(false)
  const [limite, setLimite] = useState<Ponto[]>(LIMITE_PATIO)
  const [desenhando, setDesenhando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [msgLimite, setMsgLimite] = useState<{ ok: boolean; texto: string } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const poligono = useRef<unknown>(null)

  // injeta CSS de animação uma vez
  useEffect(() => {
    if (document.getElementById('maq-telemetria-css')) return
    const el = document.createElement('style'); el.id = 'maq-telemetria-css'; el.textContent = CSS_TELEMETRIA
    document.head.appendChild(el)
  }, [])

  useEffect(() => {
    createClient().from('telemetria_config').select('valor').eq('chave', 'limite_patio').maybeSingle()
      .then(({ data }) => {
        const v = data?.valor
        if (Array.isArray(v) && v.length >= 3) setLimite(v as Ponto[])
      })
  }, [])

  async function buscarAbastInfo() {
    const sb = createClient()
    const { data: emps } = await sb.from('empilhadeiras').select('nome, horimetro_atual').neq('ativo', false)
    if (!emps?.length) return
    const nomes = emps.map(e => e.nome as string)
    const { data: cks } = await sb.from('checklists').select('id, equipamento').in('equipamento', nomes)
    const allIds = (cks ?? []).map(c => c.id as string)
    const ckEqMap = new Map((cks ?? []).map(c => [c.id as string, c.equipamento as string]))
    const lastAbastMap = new Map<string, number>()
    if (allIds.length) {
      const { data: evAbast } = await sb.from('operacao_eventos')
        .select('checklist_id, horimetro').in('checklist_id', allIds)
        .not('litros', 'is', null).order('horimetro', { ascending: false })
      for (const ev of evAbast ?? []) {
        const eq = ckEqMap.get(ev.checklist_id)
        if (eq && !lastAbastMap.has(eq) && ev.horimetro != null) lastAbastMap.set(eq, Number(ev.horimetro))
      }
    }
    const { data: cksAbertas } = await sb.from('checklists')
      .select('equipamento, operador').in('equipamento', nomes).eq('status', 'aberta')
    const operadorMap = new Map<string, string>()
    for (const ck of cksAbertas ?? []) {
      if (!operadorMap.has(ck.equipamento as string) && ck.operador)
        operadorMap.set(ck.equipamento as string, ck.operador as string)
    }
    const result = new Map<string, AbastInfo>()
    for (const emp of emps) {
      const key = Object.keys(COR).find(k => (emp.nome as string).toLowerCase().includes(k))
      if (!key) continue
      const horAtual = emp.horimetro_atual != null ? Number(emp.horimetro_atual) : null
      const lastH = lastAbastMap.get(emp.nome as string) ?? null
      const horasDesde = (horAtual != null && lastH != null && horAtual >= lastH)
        ? Math.round((horAtual - lastH) * 10) / 10 : null
      result.set(key, { horimetroAtual: horAtual, horasDesde, nomeEmp: emp.nome as string, operador: operadorMap.get(emp.nome as string) ?? null })
    }
    setAbastInfo(result)
  }

  async function salvarLimite() {
    setSalvando(true); setMsgLimite(null)
    const sb = createClient()
    const { data: u } = await sb.auth.getUser()
    const valor = limite.map(p => [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))])
    const { error } = await sb.from('telemetria_config').upsert({
      chave: 'limite_patio', valor, atualizado_por: u.user?.id ?? null, atualizado_em: new Date().toISOString(),
    })
    setSalvando(false)
    setMsgLimite(error
      ? { ok: false, texto: `Não salvou: ${error.message}` }
      : { ok: true, texto: 'Limite salvo para todos os usuários.' })
    if (!error) setDesenhando(false)
  }

  async function buscar() {
    const sb = createClient()
    // uma query por máquina para garantir que a última posição conhecida sempre aparece,
    // independente de quantos registros as outras máquinas geraram desde então
    const novas: MaquinaPos[] = []
    let erroMsg: string | null = null
    await Promise.all(Object.keys(COR).map(async (maquina) => {
      const { data, error } = await sb
        .from('telemetria_maquinas')
        .select('maquina, latitude, longitude, created_at')
        .eq('maquina', maquina)
        .not('latitude', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) { erroMsg = error.message; return }
      if (data) novas.push(data as MaquinaPos)
    }))
    if (erroMsg) { setErro(erroMsg); return }
    setPosicoes(prev => {
      const mapa = new Map(prev.map(p => [p.maquina, p]))
      for (const p of novas) mapa.set(p.maquina, p)
      return [...mapa.values()]
    })
    setAtualizado(new Date().toLocaleTimeString('pt-BR'))
    setErro(null)
  }

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      const map = L.map(mapRef.current!, { center: CENTER, zoom: 18 })
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri' }).addTo(map)
      mapInstance.current = map
      setMapaPronto(true)
    })()
  }, [])

  useEffect(() => {
    if (!mapaPronto) return
    ;(async () => {
      const L = (await import('leaflet')).default
      const map = mapInstance.current as ReturnType<typeof L.map>
      if (poligono.current) (poligono.current as ReturnType<typeof L.polygon>).remove()
      poligono.current = null
      if (limite.length >= 2) {
        const opts = { color: '#58a6ff', weight: 2, fillOpacity: 0.05, dashArray: '6 4' }
        poligono.current = (limite.length >= 3 ? L.polygon(limite, opts) : L.polyline(limite, opts)).addTo(map)
      }
    })()
  }, [limite, mapaPronto])

  useEffect(() => {
    if (!mapaPronto || !desenhando) return
    let cancelado = false
    let remover = () => {}
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelado) return
      const map = mapInstance.current as ReturnType<typeof L.map>
      const onClick = (e: { latlng: { lat: number; lng: number } }) =>
        setLimite(l => [...l, [e.latlng.lat, e.latlng.lng] as Ponto])
      map.on('click', onClick)
      map.getContainer().style.cursor = 'crosshair'
      remover = () => { map.off('click', onClick); map.getContainer().style.cursor = '' }
    })()
    return () => { cancelado = true; remover() }
  }, [desenhando, mapaPronto])

  function copiarLimite() {
    const json = JSON.stringify(limite.map(p => [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))]))
    navigator.clipboard.writeText(json).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2500) })
  }

  useEffect(() => {
    if (!mapInstance.current || posicoes.length === 0) return
    ;(async () => {
      const L = (await import('leaflet')).default
      const map = mapInstance.current as ReturnType<typeof L.map>
      for (const pos of posicoes) {
        const mins = Math.round((Date.now() - new Date(pos.created_at).getTime()) / 60000)
        const offline = mins >= 10
        const corBase = COR[pos.maquina] ?? '#888'
        const cor = offline ? '#6b7280' : corBase
        const tempo = mins < 2 ? 'agora mesmo' : mins < 60 ? `${mins} min atrás` : `${Math.round(mins / 60)}h atrás`
        const nome = pos.maquina.charAt(0).toUpperCase() + pos.maquina.slice(1)
        const info = abastInfo.get(pos.maquina)
        const horasDesde = info?.horasDesde ?? null
        const horAtual = info?.horimetroAtual ?? null
        const operador = info?.operador ?? null
        const pulsando = !offline && horasDesde != null && horasDesde >= 18
        const corHoras = horasDesde == null ? '#8ca5c8' : horasDesde >= 18 ? '#f85149' : horasDesde >= 12 ? '#e3b341' : '#3fb950'

        const tooltipHtml = `
          <div style="font-weight:700;color:${offline ? '#9ca3af' : corBase};margin-bottom:3px;">${LABEL[pos.maquina] ?? nome}${offline ? ' · <span style="color:#f85149">sem sinal</span>' : ''}</div>
          <div style="color:#cfe0f2;">⏱ Horímetro: <b>${horAtual != null ? horAtual + 'h' : '—'}</b></div>
          <div style="color:${offline ? '#6b7280' : corHoras};">⛽ ${horasDesde != null ? horasDesde + 'h sem abastecer' : 'sem registro'}${pulsando ? ' ⚠️' : ''}</div>
          <div style="color:#8ca5c8;">👤 ${operador ?? 'sem operador'}</div>
          <div style="color:${offline ? '#f85149' : '#5f7da0'};font-size:10px;margin-top:4px;">${offline ? '📡 Última posição · ' : ''}${tempo}</div>`

        const filtroImg = offline ? 'grayscale(100%) opacity(0.55)' : 'none'
        const icon = L.divIcon({
          className: '',
          html: `<div class="maq-wrap" style="width:80px;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 4px rgba(0,0,0,.65));position:relative;cursor:pointer;">
            <div class="maq-tip" style="position:absolute;bottom:90px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(10,18,34,0.97);border:1.5px solid ${cor};border-radius:10px;padding:8px 12px;font-size:12px;color:#e6eef7;pointer-events:none;z-index:2000;min-width:160px;">
              ${tooltipHtml}
            </div>
            <div class="${pulsando ? 'maq-pulsar' : ''}" style="width:64px;height:64px;border-radius:50%;background:${offline ? '#1f2937' : '#fff'};border:5px solid ${cor};box-sizing:border-box;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;">
              <img src="/telemetria/maquina.png" alt="${nome}" style="width:100%;height:100%;object-fit:contain;display:block;filter:${filtroImg}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
              <svg style="display:none;filter:${filtroImg}" width="58" height="38" viewBox="0 0 80 52" stroke="#0b1220" stroke-width="1.6" stroke-linejoin="round">
                <rect x="44" y="2" width="34" height="14" rx="1.5" fill="${cor}"/>
                <path d="M30 28 L50 14" stroke="#0b1220" stroke-width="6" stroke-linecap="round"/>
                <path d="M6 30h10v-9a3 3 0 0 1 3-3h9v12h30v10H6z" fill="${cor}"/>
                <circle cx="20" cy="42" r="7" fill="#0b1220"/><circle cx="52" cy="42" r="7" fill="#0b1220"/>
              </svg>
              ${offline ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:18px;">📡</div>` : ''}
            </div>
            <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid ${pulsando ? '#f85149' : cor};margin-top:-2px"></div>
          </div>`,
          iconSize: [80, 78], iconAnchor: [40, 78],
        })
        const popup = `<b>${LABEL[pos.maquina] ?? pos.maquina}</b><br>${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}<br><small>${tempo}</small>`
        const [lat, lon] = ajustarAoLimite([pos.latitude, pos.longitude], limite)
        const existing = markers.current.get(pos.maquina) as ReturnType<typeof L.marker> | undefined
        if (existing) { existing.setLatLng([lat, lon]); existing.setPopupContent(popup); existing.setIcon(icon) }
        else { const m = L.marker([lat, lon], { icon }).addTo(map); m.bindPopup(popup); markers.current.set(pos.maquina, m) }
      }
    })()
  }, [posicoes, abastInfo, limite, mapaPronto])

  useEffect(() => {
    buscar(); buscarAbastInfo()
    const t = setInterval(() => { buscar(); buscarAbastInfo() }, 30000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ color: '#e6eef7', fontSize: 15, fontWeight: 600, margin: 0 }}>Posição atual — tempo real</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {atualizado && <span style={{ color: '#5f7da0', fontSize: 12 }}>atualizado {atualizado}</span>}
          <button onClick={buscar} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#8ca5c8', border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer' }}>↻ Atualizar</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {posicoes.map(pos => {
          const mins = Math.round((Date.now() - new Date(pos.created_at).getTime()) / 60000)
          const offline = mins >= 10
          const cor = offline ? '#6b7280' : (COR[pos.maquina] ?? '#888')
          const tempoLabel = mins < 2 ? 'agora' : mins < 60 ? `${mins}m atrás` : `${Math.round(mins / 60)}h atrás`
          return (
            <div key={pos.maquina} style={{ display: 'flex', alignItems: 'center', gap: 8, background: offline ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 12px', border: `1px solid ${offline ? 'rgba(107,114,128,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: cor }} />
              <span style={{ color: offline ? '#6b7280' : '#cfe0f2', fontSize: 13, fontWeight: 600 }}>{LABEL[pos.maquina] ?? pos.maquina}</span>
              <span style={{ color: offline ? '#f85149' : mins < 5 ? '#3fb950' : '#5f7da0', fontSize: 11 }}>{offline ? `📡 ${tempoLabel}` : tempoLabel}</span>
            </div>
          )
        })}
        {posicoes.length === 0 && <span style={{ color: '#5f7da0', fontSize: 13 }}>{erro ?? 'Aguardando dados GPS…'}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {(() => {
          const btn = (ativo = false) => ({ fontSize: 12, padding: '5px 12px', borderRadius: 999, background: ativo ? '#1f6feb' : 'rgba(255,255,255,0.06)', color: ativo ? '#fff' : '#8ca5c8', border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer' })
          return (<>
            <button onClick={() => setDesenhando(d => !d)} style={btn(desenhando)}>{desenhando ? '✔ Terminar desenho' : '✎ Desenhar limite do pátio'}</button>
            {limite.length > 0 && <button onClick={() => setLimite(l => l.slice(0, -1))} style={btn()}>↶ Desfazer ponto</button>}
            {limite.length > 0 && <button onClick={() => setLimite([])} style={btn()}>Limpar</button>}
            {limite.length >= 3 && <button onClick={salvarLimite} disabled={salvando} style={{ ...btn(), background: '#238636', color: '#fff' }}>{salvando ? 'Salvando…' : '💾 Salvar limite'}</button>}
            {limite.length >= 3 && <button onClick={copiarLimite} style={btn()}>{copiado ? 'Copiado!' : 'Copiar JSON'}</button>}
            <span style={{ color: msgLimite ? (msgLimite.ok ? '#3fb950' : '#f85149') : '#5f7da0', fontSize: 12 }}>
              {msgLimite ? msgLimite.texto : desenhando ? 'Clique nos cantos do terreno, em ordem, contornando as margens. Depois toque em Salvar limite.' : limite.length >= 3 ? `Limite com ${limite.length} pontos — máquinas fora são mostradas na borda.` : 'Sem limite definido.'}
            </span>
          </>)
        })()}
      </div>
      <div ref={mapRef} style={{ height: 500, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.10)' }} />
      {posicoes.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
          <thead><tr>{['Máquina','Latitude','Longitude','Última posição'].map(h => <th key={h} style={{ textAlign: 'left', color: '#5f7da0', padding: '8px 10px', fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>{posicoes.map(pos => (
            <tr key={pos.maquina}>
              <td style={{ padding: '6px 10px', color: COR[pos.maquina] ?? '#cfe0f2', fontWeight: 600 }}>{LABEL[pos.maquina] ?? pos.maquina}</td>
              <td style={{ padding: '6px 10px', color: '#cfe0f2', fontFamily: 'monospace' }}>{pos.latitude.toFixed(6)}</td>
              <td style={{ padding: '6px 10px', color: '#cfe0f2', fontFamily: 'monospace' }}>{pos.longitude.toFixed(6)}</td>
              <td style={{ padding: '6px 10px', color: '#8ca5c8' }}>{new Date(pos.created_at).toLocaleString('pt-BR')}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
