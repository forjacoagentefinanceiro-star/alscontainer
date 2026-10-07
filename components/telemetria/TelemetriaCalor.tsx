'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import 'leaflet/dist/leaflet.css'

type Ponto = { latitude: number; longitude: number }

const COR: Record<string, string> = { kone: '#f2c230', ferrari: '#f85149', linde: '#3fb950' }
const LABEL: Record<string, string> = { kone: '🏗 Kone', ferrari: '🚜 Ferrari', linde: '🏭 Linde' }
const MAQUINAS = ['kone', 'ferrari', 'linde']
const CENTER: [number, number] = [-26.9163, -48.7075]

function mesAnterior() { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10) }
function hoje() { return new Date().toISOString().slice(0, 10) }

export function TelemetriaCalor() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)
  const heatRef = useRef<unknown>(null)

  const [maquinas, setMaquinas] = useState<string[]>(['kone', 'ferrari', 'linde'])
  const [dataInicio, setDataInicio] = useState(mesAnterior())
  const [dataFim, setDataFim] = useState(hoje())
  const [total, setTotal] = useState<number | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      const map = L.map(mapRef.current!, { center: CENTER, zoom: 18 })
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri' }).addTo(map)
      mapInstance.current = map
    })()
  }, [])

  async function buscar() {
    setCarregando(true); setErro(null)
    const sb = createClient()
    const { data, error } = await sb
      .from('telemetria_maquinas')
      .select('latitude, longitude')
      .in('maquina', maquinas)
      .not('latitude', 'is', null)
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`)
      .limit(5000)
    setCarregando(false)
    if (error) { setErro(error.message); return }
    const pts = (data ?? []) as Ponto[]
    setTotal(pts.length)
    desenharCalor(pts)
  }

  async function desenharCalor(pontos: Ponto[]) {
    if (!mapInstance.current) return
    const L = (await import('leaflet')).default
    const map = mapInstance.current as ReturnType<typeof L.map>

    // Remove camada anterior
    if (heatRef.current) {
      (heatRef.current as { remove: () => void }).remove()
      heatRef.current = null
    }
    if (pontos.length === 0) return

    // Carrega leaflet.heat via CDN e cria camada
    await new Promise<void>((resolve) => {
      if ((window as unknown as Record<string,unknown>).HeatmapOverlay || document.querySelector('script[src*="leaflet.heat"]')) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js'
      s.onload = () => resolve()
      document.head.appendChild(s)
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heat = (L as unknown as any).heatLayer(
      pontos.map(p => [p.latitude, p.longitude, 1]),
      { radius: 20, blur: 15, maxZoom: 20, max: 5, gradient: { 0.2: '#3fb950', 0.5: '#f2c230', 0.8: '#f85149', 1.0: '#ff0000' } }
    ).addTo(map)
    heatRef.current = heat

    if (pontos.length > 0) {
      const latlngs = pontos.map(p => [p.latitude, p.longitude] as [number, number])
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] })
    }
  }

  const toggleMaquina = (m: string) =>
    setMaquinas(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, color: '#e6eef7', padding: '7px 10px', fontSize: 13,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ color: '#e6eef7', fontSize: 15, fontWeight: 600, margin: 0 }}>Mapa de calor — densidade de posições</h2>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Seleção de máquinas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: '#5f7da0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Máquinas</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {MAQUINAS.map(m => {
              const ativo = maquinas.includes(m)
              return (
                <button
                  key={m}
                  onClick={() => toggleMaquina(m)}
                  style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: ativo ? COR[m] : 'rgba(255,255,255,0.06)',
                    color: ativo ? '#111' : '#8ca5c8',
                    border: `1px solid ${ativo ? COR[m] : 'rgba(255,255,255,0.12)'}`,
                  }}
                >
                  {LABEL[m]}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: '#5f7da0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>De</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: '#5f7da0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Até</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
        </div>
        <button
          onClick={buscar}
          disabled={carregando || maquinas.length === 0}
          style={{ padding: '7px 20px', borderRadius: 6, background: '#7DC242', color: '#111', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', opacity: (carregando || maquinas.length === 0) ? 0.6 : 1 }}
        >
          {carregando ? 'Buscando…' : 'Gerar mapa de calor'}
        </button>
      </div>

      {erro && <p style={{ color: '#f85149', fontSize: 13 }}>{erro}</p>}
      {total !== null && (
        <p style={{ color: '#8ca5c8', fontSize: 13 }}>
          <b style={{ color: '#cfe0f2' }}>{total.toLocaleString('pt-BR')}</b> posições · vermelho = alta densidade · verde = baixa
        </p>
      )}
      {total === 0 && <p style={{ color: '#5f7da0', fontSize: 13 }}>Nenhuma posição encontrada no período.</p>}

      {/* Legenda gradiente */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#5f7da0', fontSize: 11 }}>Pouco</span>
        <div style={{ height: 8, width: 120, borderRadius: 4, background: 'linear-gradient(to right, #3fb950, #f2c230, #f85149)' }} />
        <span style={{ color: '#5f7da0', fontSize: 11 }}>Muito</span>
      </div>

      <div ref={mapRef} style={{ height: 500, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.10)' }} />
    </div>
  )
}
