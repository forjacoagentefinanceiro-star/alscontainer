'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import 'leaflet/dist/leaflet.css'

type MaquinaPos = {
  maquina: string
  dispositivo: string | null
  latitude: number
  longitude: number
  created_at: string
}

const COR: Record<string, string> = {
  kone:    '#f2c230',
  ferrari: '#f85149',
  linde:   '#3fb950',
}

const LABEL: Record<string, string> = {
  kone:    '🏗 Kone',
  ferrari: '🚜 Ferrari',
  linde:   '🏭 Linde',
}

// Pátio ALS Itajaí — centro e zoom
const CENTER: [number, number] = [-26.9163, -48.7075]
const ZOOM = 18

export function BiTelemetria() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)
  const markers = useRef<Map<string, unknown>>(new Map())
  const [posicoes, setPosicoes] = useState<MaquinaPos[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null)

  async function buscarPosicoes() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('telemetria_maquinas')
      .select('maquina, dispositivo, latitude, longitude, created_at')
      .not('latitude', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) { setErro(error.message); return }

    // Última posição por máquina
    const visto = new Set<string>()
    const ultimas: MaquinaPos[] = []
    for (const row of (data ?? [])) {
      if (!visto.has(row.maquina)) {
        visto.add(row.maquina)
        ultimas.push(row as MaquinaPos)
      }
    }
    setPosicoes(ultimas)
    setUltimaAtualizacao(new Date().toLocaleTimeString('pt-BR'))
    setErro(null)
  }

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    // Carrega Leaflet dinamicamente (evita SSR)
    async function initMap() {
      const L = (await import('leaflet')).default

      const map = L.map(mapRef.current!, {
        center: CENTER,
        zoom: ZOOM,
        zoomControl: true,
        attributionControl: true,
      })

      // Tile satélite Esri (sem API key)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles © Esri' }
      ).addTo(map)

      mapInstance.current = map
    }

    initMap()
  }, [])

  // Atualiza marcadores quando posições mudam
  useEffect(() => {
    if (!mapInstance.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      const map = mapInstance.current as ReturnType<typeof L.map>

      for (const pos of posicoes) {
        const cor = COR[pos.maquina] ?? '#888'
        const mins = Math.round((Date.now() - new Date(pos.created_at).getTime()) / 60000)
        const tempo = mins < 2 ? 'agora mesmo' : `${mins} min atrás`

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:36px;height:36px;border-radius:50%;
            background:${cor};border:3px solid #fff;
            box-shadow:0 2px 8px rgba(0,0,0,.6);
            display:flex;align-items:center;justify-content:center;
            font-size:16px;font-weight:700;color:#111;
          ">${pos.maquina[0].toUpperCase()}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })

        const popup = `<b>${LABEL[pos.maquina] ?? pos.maquina}</b><br>
          ${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}<br>
          <small style="color:#666">${tempo}</small>`

        const existing = markers.current.get(pos.maquina) as ReturnType<typeof L.marker> | undefined
        if (existing) {
          existing.setLatLng([pos.latitude, pos.longitude])
          existing.setPopupContent(popup)
        } else {
          const m = L.marker([pos.latitude, pos.longitude], { icon }).addTo(map)
          m.bindPopup(popup)
          markers.current.set(pos.maquina, m)
        }
      }
    })()
  }, [posicoes])

  // Busca inicial + polling a cada 30s
  useEffect(() => {
    buscarPosicoes()
    const t = setInterval(buscarPosicoes, 30000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ color: '#e6eef7', fontSize: 14, fontWeight: 600, margin: 0 }}>
          Posição das máquinas — tempo real
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {ultimaAtualizacao && (
            <span style={{ color: '#5f7da0', fontSize: 12 }}>atualizado {ultimaAtualizacao}</span>
          )}
          <button
            onClick={buscarPosicoes}
            style={{
              fontSize: 12, padding: '5px 12px', borderRadius: 999,
              background: 'rgba(255,255,255,0.06)', color: '#8ca5c8',
              border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer',
            }}
          >
            ↻ Atualizar
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {posicoes.map(pos => {
          const cor = COR[pos.maquina] ?? '#888'
          const mins = Math.round((Date.now() - new Date(pos.created_at).getTime()) / 60000)
          const fresco = mins < 5
          return (
            <div key={pos.maquina} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.04)', borderRadius: 8,
              padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: cor, flexShrink: 0 }} />
              <span style={{ color: '#cfe0f2', fontSize: 13, fontWeight: 600 }}>{LABEL[pos.maquina] ?? pos.maquina}</span>
              <span style={{ color: fresco ? '#3fb950' : '#5f7da0', fontSize: 11 }}>
                {mins < 2 ? 'ao vivo' : `${mins}m atrás`}
              </span>
            </div>
          )
        })}
        {posicoes.length === 0 && (
          <span style={{ color: '#5f7da0', fontSize: 13 }}>
            {erro ? `Erro: ${erro}` : 'Aguardando dados GPS das máquinas…'}
          </span>
        )}
      </div>

      {/* Mapa */}
      <div
        ref={mapRef}
        style={{
          height: 480, borderRadius: 10, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
      />

      {/* Tabela de posições */}
      {posicoes.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Máquina', 'Latitude', 'Longitude', 'Última posição'].map(h => (
                  <th key={h} style={{ textAlign: 'left', color: '#5f7da0', padding: '4px 8px', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posicoes.map(pos => (
                <tr key={pos.maquina}>
                  <td style={{ padding: '4px 8px', color: COR[pos.maquina] ?? '#cfe0f2', fontWeight: 600 }}>
                    {LABEL[pos.maquina] ?? pos.maquina}
                  </td>
                  <td style={{ padding: '4px 8px', color: '#cfe0f2', fontFamily: 'monospace' }}>
                    {pos.latitude.toFixed(6)}
                  </td>
                  <td style={{ padding: '4px 8px', color: '#cfe0f2', fontFamily: 'monospace' }}>
                    {pos.longitude.toFixed(6)}
                  </td>
                  <td style={{ padding: '4px 8px', color: '#8ca5c8' }}>
                    {new Date(pos.created_at).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
