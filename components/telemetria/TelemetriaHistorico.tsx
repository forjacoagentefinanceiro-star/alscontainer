'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import 'leaflet/dist/leaflet.css'

type Ponto = { latitude: number; longitude: number; created_at: string }

const COR: Record<string, string> = { kone: '#f2c230', ferrari: '#f85149', linde: '#3fb950' }
const LABEL: Record<string, string> = { kone: '🏗 Kone', ferrari: '🚜 Ferrari', linde: '🏭 Linde' }
const CENTER: [number, number] = [-26.9163, -48.7075]
const MAQUINAS = ['kone', 'ferrari', 'linde']

function hoje() { return new Date().toISOString().slice(0, 10) }
function ontem() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }

export function TelemetriaHistorico() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)
  const layerRef = useRef<unknown>(null)

  const [maquina, setMaquina] = useState('kone')
  const [dataInicio, setDataInicio] = useState(ontem())
  const [dataFim, setDataFim] = useState(hoje())
  const [pontos, setPontos] = useState<Ponto[]>([])
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
      .select('latitude, longitude, created_at')
      .eq('maquina', maquina)
      .not('latitude', 'is', null)
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`)
      .order('created_at', { ascending: true })
      .limit(2000)
    setCarregando(false)
    if (error) { setErro(error.message); return }
    setPontos((data ?? []) as Ponto[])
  }

  // Desenha trilha no mapa quando pontos mudam
  useEffect(() => {
    if (!mapInstance.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      const map = mapInstance.current as ReturnType<typeof L.map>

      // Remove layer anterior
      if (layerRef.current) {
        (layerRef.current as ReturnType<typeof L.layerGroup>).remove()
        layerRef.current = null
      }
      if (pontos.length === 0) return

      const cor = COR[maquina] ?? '#888'
      const group = L.layerGroup()

      // Polyline da trilha
      const latlngs = pontos.map(p => [p.latitude, p.longitude] as [number, number])
      L.polyline(latlngs, { color: cor, weight: 3, opacity: 0.8 }).addTo(group)

      // Marcador de início (verde)
      const iconStart = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#3fb950;border:2px solid #fff;"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      })
      // Marcador de fim (vermelho)
      const iconEnd = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#f85149;border:2px solid #fff;"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      })

      const primeiro = pontos[0]
      const ultimo = pontos[pontos.length - 1]
      L.marker([primeiro.latitude, primeiro.longitude], { icon: iconStart })
        .bindPopup(`Início: ${new Date(primeiro.created_at).toLocaleString('pt-BR')}`).addTo(group)
      if (pontos.length > 1) {
        L.marker([ultimo.latitude, ultimo.longitude], { icon: iconEnd })
          .bindPopup(`Fim: ${new Date(ultimo.created_at).toLocaleString('pt-BR')}`).addTo(group)
      }

      group.addTo(map)
      layerRef.current = group
      map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30] })
    })()
  }, [pontos, maquina])

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, color: '#e6eef7', padding: '7px 10px', fontSize: 13,
  }
  const selStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ color: '#e6eef7', fontSize: 15, fontWeight: 600, margin: 0 }}>Histórico de movimentação</h2>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: '#5f7da0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Máquina</label>
          <select value={maquina} onChange={e => setMaquina(e.target.value)} style={selStyle}>
            {MAQUINAS.map(m => <option key={m} value={m}>{LABEL[m]}</option>)}
          </select>
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
          disabled={carregando}
          style={{ padding: '7px 20px', borderRadius: 6, background: COR[maquina] ?? '#888', color: '#111', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', opacity: carregando ? 0.6 : 1 }}
        >
          {carregando ? 'Buscando…' : 'Ver trilha'}
        </button>
      </div>

      {erro && <p style={{ color: '#f85149', fontSize: 13 }}>{erro}</p>}

      {/* Resumo */}
      {pontos.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ color: '#8ca5c8', fontSize: 13 }}><b style={{ color: '#cfe0f2' }}>{pontos.length}</b> posições registradas</span>
          <span style={{ color: '#8ca5c8', fontSize: 13 }}>● início <span style={{ color: '#3fb950' }}>verde</span> · fim <span style={{ color: '#f85149' }}>vermelho</span></span>
        </div>
      )}
      {pontos.length === 0 && !carregando && (
        <p style={{ color: '#5f7da0', fontSize: 13 }}>Selecione a máquina e o período, depois clique em "Ver trilha".</p>
      )}

      {/* Mapa */}
      <div ref={mapRef} style={{ height: 500, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.10)' }} />

      {/* Tabela resumo (últimas e primeiras posições) */}
      {pontos.length > 0 && (
        <details style={{ color: '#8ca5c8', fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', color: '#5f7da0', marginBottom: 8 }}>Ver {pontos.length} posições registradas</summary>
          <div style={{ maxHeight: 260, overflowY: 'auto', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['#','Data/Hora','Latitude','Longitude'].map(h => <th key={h} style={{ textAlign: 'left', color: '#5f7da0', padding: '6px 10px', fontWeight: 600, position: 'sticky', top: 0, background: '#0d1b2e' }}>{h}</th>)}</tr></thead>
              <tbody>{pontos.map((p, i) => (
                <tr key={i}>
                  <td style={{ padding: '4px 10px', color: '#5f7da0' }}>{i + 1}</td>
                  <td style={{ padding: '4px 10px', color: '#cfe0f2' }}>{new Date(p.created_at).toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '4px 10px', color: '#cfe0f2', fontFamily: 'monospace' }}>{p.latitude.toFixed(6)}</td>
                  <td style={{ padding: '4px 10px', color: '#cfe0f2', fontFamily: 'monospace' }}>{p.longitude.toFixed(6)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
