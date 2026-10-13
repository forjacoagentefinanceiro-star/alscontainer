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

const COR: Record<string, string> = { kone: '#f2c230', ferrari: '#f85149', linde: '#3fb950' }
const LABEL: Record<string, string> = { kone: '🏗 Kone', ferrari: '🚜 Ferrari', linde: '🏭 Linde' }
const CENTER: [number, number] = [-26.9163, -48.7075]

export function TelemetriaAoVivo() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)
  const markers = useRef<Map<string, unknown>>(new Map())
  const [posicoes, setPosicoes] = useState<MaquinaPos[]>([])
  const [atualizado, setAtualizado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mapaPronto, setMapaPronto] = useState(false)
  const [limite, setLimite] = useState<Ponto[]>(LIMITE_PATIO)
  const [desenhando, setDesenhando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const poligono = useRef<unknown>(null)

  async function buscar() {
    const sb = createClient()
    const { data, error } = await sb
      .from('telemetria_maquinas')
      .select('maquina, latitude, longitude, created_at')
      .not('latitude', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) { setErro(error.message); return }
    const visto = new Set<string>(); const ultimas: MaquinaPos[] = []
    for (const r of data ?? []) {
      if (!visto.has(r.maquina)) { visto.add(r.maquina); ultimas.push(r as MaquinaPos) }
    }
    setPosicoes(ultimas)
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
        const cor = COR[pos.maquina] ?? '#888'
        const mins = Math.round((Date.now() - new Date(pos.created_at).getTime()) / 60000)
        const tempo = mins < 2 ? 'agora mesmo' : `${mins} min atrás`
        const nome = pos.maquina.charAt(0).toUpperCase() + pos.maquina.slice(1)
        const icon = L.divIcon({
          className: '',
          html: `<div title="${nome}" style="width:64px;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 4px rgba(0,0,0,.65));">
            <div style="position:relative;width:64px;height:64px;border-radius:50%;background:#fff;border:5px solid ${cor};box-sizing:border-box;overflow:hidden;display:flex;align-items:center;justify-content:center;">
              <img src="/telemetria/maquina.png" alt="${nome}" style="width:100%;height:100%;object-fit:contain;display:block" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
              <svg style="display:none" width="58" height="38" viewBox="0 0 80 52" stroke="#0b1220" stroke-width="1.6" stroke-linejoin="round">
                <rect x="44" y="2" width="34" height="14" rx="1.5" fill="${cor}"/>
                <path d="M30 28 L50 14" stroke="#0b1220" stroke-width="6" stroke-linecap="round"/>
                <path d="M6 30h10v-9a3 3 0 0 1 3-3h9v12h30v10H6z" fill="${cor}"/>
                <circle cx="20" cy="42" r="7" fill="#0b1220"/><circle cx="52" cy="42" r="7" fill="#0b1220"/>
              </svg>
            </div>
            <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid ${cor};margin-top:-2px"></div>
          </div>`,
          iconSize: [64, 76], iconAnchor: [32, 76],
        })
        const popup = `<b>${LABEL[pos.maquina] ?? pos.maquina}</b><br>${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}<br><small>${tempo}</small>`
        const [lat, lon] = ajustarAoLimite([pos.latitude, pos.longitude], limite)
        const existing = markers.current.get(pos.maquina) as ReturnType<typeof L.marker> | undefined
        if (existing) { existing.setLatLng([lat, lon]); existing.setPopupContent(popup) }
        else { const m = L.marker([lat, lon], { icon }).addTo(map); m.bindPopup(popup); markers.current.set(pos.maquina, m) }
      }
    })()
  }, [posicoes, limite, mapaPronto])

  useEffect(() => { buscar(); const t = setInterval(buscar, 30000); return () => clearInterval(t) }, [])

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
          return (
            <div key={pos.maquina} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: COR[pos.maquina] ?? '#888' }} />
              <span style={{ color: '#cfe0f2', fontSize: 13, fontWeight: 600 }}>{LABEL[pos.maquina] ?? pos.maquina}</span>
              <span style={{ color: mins < 5 ? '#3fb950' : '#5f7da0', fontSize: 11 }}>{mins < 2 ? 'agora' : `${mins}m atrás`}</span>
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
            {limite.length >= 3 && <button onClick={copiarLimite} style={btn()}>{copiado ? 'Copiado!' : 'Copiar JSON do limite'}</button>}
            <span style={{ color: '#5f7da0', fontSize: 12 }}>
              {desenhando ? 'Clique nos cantos do terreno, em ordem, contornando as margens.' : limite.length >= 3 ? `Limite com ${limite.length} pontos — máquinas fora são mostradas na borda.` : 'Sem limite definido.'}
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
