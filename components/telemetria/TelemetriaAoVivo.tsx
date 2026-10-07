'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import 'leaflet/dist/leaflet.css'

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
    })()
  }, [])

  useEffect(() => {
    if (!mapInstance.current || posicoes.length === 0) return
    ;(async () => {
      const L = (await import('leaflet')).default
      const map = mapInstance.current as ReturnType<typeof L.map>
      for (const pos of posicoes) {
        const cor = COR[pos.maquina] ?? '#888'
        const mins = Math.round((Date.now() - new Date(pos.created_at).getTime()) / 60000)
        const tempo = mins < 2 ? 'agora mesmo' : `${mins} min atrás`
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:36px;height:36px;border-radius:50%;background:${cor};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#111;">${pos.maquina[0].toUpperCase()}</div>`,
          iconSize: [36, 36], iconAnchor: [18, 18],
        })
        const popup = `<b>${LABEL[pos.maquina] ?? pos.maquina}</b><br>${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}<br><small>${tempo}</small>`
        const existing = markers.current.get(pos.maquina) as ReturnType<typeof L.marker> | undefined
        if (existing) { existing.setLatLng([pos.latitude, pos.longitude]); existing.setPopupContent(popup) }
        else { const m = L.marker([pos.latitude, pos.longitude], { icon }).addTo(map); m.bindPopup(popup); markers.current.set(pos.maquina, m) }
      }
    })()
  }, [posicoes])

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
              <span style={{ color: mins < 5 ? '#3fb950' : '#5f7da0', fontSize: 11 }}>{mins < 2 ? 'ao vivo' : `${mins}m atrás`}</span>
            </div>
          )
        })}
        {posicoes.length === 0 && <span style={{ color: '#5f7da0', fontSize: 13 }}>{erro ?? 'Aguardando dados GPS…'}</span>}
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
