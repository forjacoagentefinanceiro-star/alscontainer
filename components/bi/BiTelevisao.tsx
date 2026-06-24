'use client'

import { useEffect, useState } from 'react'
import { IndicadorBar, TendenciaLinha } from './BiCharts'
import type { Categoria, KpiT } from '@/lib/bi/load'
import type { Ponto } from './BiCharts'

function Tile({ k }: { k: KpiT }) {
  return (
    <div style={{ background: '#0f2138', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 'clamp(14px, 1.6vw, 24px)' }}>
      <div style={{ fontSize: 'clamp(12px, 1vw, 15px)', letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0' }}>{k.label}</div>
      <div style={{ fontSize: 'clamp(34px, 4vw, 60px)', fontWeight: 700, color: k.accent ? '#7DC242' : '#e6eef7', lineHeight: 1.1 }}>{k.value}</div>
      {k.sub && <div style={{ fontSize: 'clamp(11px, 0.9vw, 14px)', color: '#5f7da0', marginTop: 2 }}>{k.sub}</div>}
    </div>
  )
}

function Card({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0f2138', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 16 }}>
      <h3 style={{ fontSize: 'clamp(13px, 1.1vw, 17px)', fontWeight: 600, color: '#cfe0f2', marginBottom: sub ? 2 : 10 }}>{titulo}</h3>
      {sub && <div style={{ fontSize: 'clamp(11px, 0.9vw, 13px)', color: '#5f7da0', marginBottom: 10 }}>{sub}</div>}
      {children}
    </div>
  )
}

// navegadores só liberam tela cheia em resposta a um clique do usuário, daí o botão "Modo TV"
function entrarTelaCheia() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
}

function sairTelaCheia() {
  const doc = document as Document & { webkitExitFullscreen?: () => void }
  if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
  else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen()
}

export function BiTelevisao({ ano, atualizado, kpis, trend, categorias }: {
  ano: number; atualizado: string; kpis: KpiT[]; trend: Ponto[]; categorias: Categoria[]
}) {
  const [hora, setHora] = useState('')
  const [telaCheia, setTelaCheia] = useState(false)

  useEffect(() => {
    const tick = () => setHora(new Date().toLocaleTimeString('pt-BR'))
    tick()
    const t = setInterval(tick, 1000)
    const reload = setInterval(() => window.location.reload(), 15 * 60 * 1000) // 15 min
    const onFsChange = () => setTelaCheia(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    onFsChange()
    return () => { clearInterval(t); clearInterval(reload); document.removeEventListener('fullscreenchange', onFsChange) }
  }, [])

  // um gráfico de destaque por categoria (até 4)
  const destaques = categorias.map(c => c.grupos[0]).filter(Boolean).slice(0, 4)

  return (
    <main style={{ minHeight: '100vh', background: '#0d1b2e', color: '#e6eef7', padding: 'clamp(16px, 2vw, 32px)', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 'clamp(16px, 2vw, 28px)' }}>
        <div>
          <div style={{ fontSize: 'clamp(22px, 2.6vw, 40px)', fontWeight: 700 }}>
            ALS · <span style={{ color: '#7DC242' }}>BI Depot</span>
          </div>
          <div style={{ color: '#5f7da0', fontSize: 'clamp(12px, 1vw, 15px)' }}>e-Professional (websag) · ano {ano} · atualizado {atualizado}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 'clamp(26px, 3vw, 48px)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#cfe0f2' }}>{hora}</div>
          {!telaCheia ? (
            <button onClick={entrarTelaCheia} style={{ fontSize: 13, fontWeight: 600, color: '#0d1b2e', background: '#7DC242', padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer' }}>
              🖥️ Modo TV (tela cheia)
            </button>
          ) : (
            <button onClick={sairTelaCheia} title="Sair da tela cheia" style={{ fontSize: 12, color: '#5f7da0', background: 'rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* KPIs grandes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'clamp(12px, 1.4vw, 20px)', marginBottom: 'clamp(14px, 1.6vw, 22px)' }}>
        {kpis.map(k => <Tile key={k.label} k={k} />)}
      </div>

      {/* Tendência + destaques */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'clamp(12px, 1.4vw, 20px)', marginBottom: 'clamp(12px, 1.4vw, 20px)' }}>
        {trend.length > 0 && (
          <Card titulo="Entradas × Saídas por mês">
            <TendenciaLinha data={trend} series={['Entradas', 'Saídas']} />
          </Card>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 'clamp(12px, 1.4vw, 20px)' }}>
        {destaques.map(g => (
          <Card key={g.code} titulo={g.titulo} sub={g.medida}>
            <IndicadorBar data={g.data} series={g.series} />
          </Card>
        ))}
      </div>
    </main>
  )
}
