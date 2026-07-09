'use client'

import { useEffect, useState } from 'react'
import type { BarraStatus, BarragemPonto } from '@/app/actions'

function fmtHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function statusBarra(profundidade: string): string {
  const s = profundidade.toLowerCase()
  if (s.includes('fechad')) return 'fechado'
  if (s.includes('restri') || s.includes('condicion')) return 'restrito'
  if (s.includes('praticáv') || s.includes('praticav')) return 'praticavel'
  return 'desconhecido'
}

const COR = {
  normal:       { bg: 'rgba(22,163,74,0.15)',   border: '#16a34a', dot: '#22c55e', label: 'Normal',      text: '#4ade80' },
  atencao:      { bg: 'rgba(217,119,6,0.15)',    border: '#d97706', dot: '#f59e0b', label: 'Atenção',     text: '#fbbf24' },
  alerta:       { bg: 'rgba(234,88,12,0.15)',    border: '#ea580c', dot: '#f97316', label: 'Alerta',      text: '#fb923c' },
  emergencia:   { bg: 'rgba(220,38,38,0.15)',    border: '#dc2626', dot: '#ef4444', label: 'Crítica',     text: '#f87171' },
  praticavel:   { bg: 'rgba(22,163,74,0.15)',   border: '#16a34a', dot: '#22c55e', label: 'Praticável',  text: '#4ade80' },
  restrito:     { bg: 'rgba(217,119,6,0.15)',    border: '#d97706', dot: '#f59e0b', label: 'Restrito',    text: '#fbbf24' },
  fechado:      { bg: 'rgba(220,38,38,0.15)',    border: '#dc2626', dot: '#ef4444', label: 'Fechado',     text: '#f87171' },
  desconhecido: { bg: 'rgba(156,163,175,0.1)',  border: '#374151', dot: '#6b7280', label: 'Sem dados',   text: '#9ca3af' },
} as const

type CorKey = keyof typeof COR

function cor(s: string | null): typeof COR[CorKey] {
  return COR[(s ?? 'desconhecido') as CorKey] ?? COR.desconhecido
}

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

export function MonitoramentoTv({ barra, barragens }: {
  barra: BarraStatus | null
  barragens: BarragemPonto[]
}) {
  const [hora, setHora] = useState('')
  const [telaCheia, setTelaCheia] = useState(false)

  useEffect(() => {
    const tick = () => setHora(new Date().toLocaleTimeString('pt-BR'))
    tick()
    const tHora = setInterval(tick, 1000)
    const reload = setInterval(() => window.location.reload(), 5 * 60 * 1000)
    const onFs = () => setTelaCheia(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs); onFs()
    return () => { clearInterval(tHora); clearInterval(reload); document.removeEventListener('fullscreenchange', onFs) }
  }, [])

  const rio = barragens.find(p => p.tipo === 'rio')
  const barragensLista = barragens.filter(p => p.tipo === 'barragem')

  const statusBarraChan = barra ? statusBarra(barra.profundidade) : 'desconhecido'
  const todosStatus = [
    statusBarraChan,
    ...(rio ? [rio.status ?? 'desconhecido'] : []),
    ...barragensLista.map(p => p.status ?? 'desconhecido'),
  ]
  const ordem = ['emergencia', 'alerta', 'atencao', 'normal', 'desconhecido']
  const piorStatus = ordem.find(s => todosStatus.includes(s)) ?? 'desconhecido'
  const cGeral = cor(piorStatus)
  const temAlerta = piorStatus === 'alerta' || piorStatus === 'emergencia'

  const cBarra = cor(statusBarraChan)
  const barraCondicao = barra?.profundidade?.split('·')[0]?.trim() ?? '—'

  const cRio = cor(rio?.status ?? null)
  const nivelRio = rio?.nivel_m ?? '—'
  const pctRio = rio?.nivel_m
    ? Math.min(100, Math.round((parseFloat(rio.nivel_m.replace(',', '.')) / 9.0) * 100))
    : null

  return (
    <main style={{ minHeight: '100vh', background: '#0d1b2e', color: '#e6eef7', padding: 'clamp(14px,1.8vw,28px)', fontFamily: 'inherit' }}>

      {/* Banner de alerta */}
      {temAlerta && (
        <div style={{
          background: cGeral.bg, border: `2px solid ${cGeral.border}`, color: cGeral.text,
          borderRadius: 14, padding: '10px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
          fontWeight: 700, fontSize: 'clamp(13px,1.1vw,18px)',
        }}>
          <span style={{ fontSize: 24 }}>{piorStatus === 'emergencia' ? '🚨' : '⚠️'}</span>
          {piorStatus === 'emergencia' ? 'SITUAÇÃO DE EMERGÊNCIA ATIVA' : 'ALERTA ATIVO — MONITORAR DE PERTO'}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 'clamp(14px,1.8vw,24px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.2vw,18px)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ALS Logística" style={{ height: 'clamp(40px,4.5vw,60px)', width: 'auto', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 'clamp(18px,2.2vw,34px)', fontWeight: 700, color: '#7DC242' }}>
              Monitoramento Climático
            </div>
            <div style={{ color: '#5f7da0', fontSize: 'clamp(11px,0.9vw,14px)', marginTop: 2 }}>
              Barra do Itajaí · Barragens SC · Rio Itajaí em Blumenau
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 'clamp(24px,2.8vw,44px)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#cfe0f2' }}>{hora}</div>
          {!telaCheia ? (
            <button onClick={entrarTelaCheia} style={{ fontSize: 12, fontWeight: 600, color: '#0d1b2e', background: '#7DC242', padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer' }}>
              🖥️ Modo TV
            </button>
          ) : (
            <button onClick={sairTelaCheia} style={{ fontSize: 12, color: '#5f7da0', background: 'rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Cards superiores: Barra + Rio */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'clamp(10px,1.2vw,18px)', marginBottom: 'clamp(12px,1.4vw,20px)' }}>

        {/* Barra do Itajaí */}
        <div style={{ background: cBarra.bg, border: `2px solid ${cBarra.border}`, borderRadius: 16, padding: 'clamp(14px,1.6vw,24px)' }}>
          <div style={{ fontSize: 'clamp(11px,0.9vw,14px)', letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0', marginBottom: 6 }}>
            Barra do Itajaí
          </div>
          <div style={{ fontSize: 'clamp(22px,2.8vw,40px)', fontWeight: 700, color: cBarra.text, lineHeight: 1.15 }}>
            {barraCondicao}
          </div>
          <span style={{ display: 'inline-block', marginTop: 8, padding: '3px 10px', borderRadius: 999, border: `1px solid ${cBarra.border}`, color: cBarra.text, fontWeight: 700, fontSize: 'clamp(11px,0.85vw,13px)' }}>
            {cBarra.label}
          </span>
          {barra?.atualizado_em && (
            <div style={{ fontSize: 'clamp(10px,0.8vw,12px)', color: '#5f7da0', marginTop: 8 }}>
              Atualizado: {fmtHora(barra.atualizado_em)}
            </div>
          )}
        </div>

        {/* Rio Itajaí em Blumenau */}
        {rio && (
          <div style={{ background: cRio.bg, border: `2px solid ${cRio.border}`, borderRadius: 16, padding: 'clamp(14px,1.6vw,24px)' }}>
            <div style={{ fontSize: 'clamp(11px,0.9vw,14px)', letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0', marginBottom: 6 }}>
              Rio Itajaí · Blumenau
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ fontSize: 'clamp(36px,4.5vw,68px)', fontWeight: 900, color: cRio.text, lineHeight: 1 }}>{nivelRio}</div>
              <div style={{ fontSize: 'clamp(18px,2vw,28px)', fontWeight: 700, color: cRio.text, marginBottom: 4 }}>m</div>
            </div>
            {pctRio !== null && (
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ height: 8, borderRadius: 999, background: cRio.dot, width: `${pctRio}%`, transition: 'width 0.5s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 'clamp(10px,0.7vw,11px)' }}>
                  <span style={{ color: '#d97706' }}>Atenção 5.5m</span>
                  <span style={{ color: '#ea580c' }}>Alerta 7.0m</span>
                  <span style={{ color: '#dc2626' }}>Emergência 9.0m</span>
                </div>
              </div>
            )}
            <span style={{ display: 'inline-block', marginTop: 8, padding: '3px 10px', borderRadius: 999, border: `1px solid ${cRio.border}`, color: cRio.text, fontWeight: 700, fontSize: 'clamp(11px,0.85vw,13px)' }}>
              {cRio.label}
            </span>
            {rio.hora_leitura && (
              <div style={{ fontSize: 'clamp(10px,0.8vw,12px)', color: '#5f7da0', marginTop: 8 }}>
                Leitura: {fmtHora(rio.hora_leitura)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barragens */}
      {barragensLista.length > 0 && (
        <>
          <div style={{ fontSize: 'clamp(10px,0.85vw,13px)', letterSpacing: 2, textTransform: 'uppercase', color: '#3a5578', marginBottom: 10 }}>
            Barragens
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'clamp(8px,1vw,14px)' }}>
            {barragensLista.map(p => {
              const cB = cor(p.status)
              const pct = p.capacidade_pct ? parseFloat(p.capacidade_pct.replace(',', '.')) : null
              const abertas = p.comportas_abertas ? parseInt(p.comportas_abertas) : 0
              const fechadas = p.comportas_fechadas ? parseInt(p.comportas_fechadas) : 0
              return (
                <div key={p.id} style={{ background: cB.bg, border: `1px solid ${cB.border}`, borderRadius: 14, padding: 'clamp(10px,1.2vw,18px)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 'clamp(13px,1.1vw,17px)', color: '#e6eef7' }}>{p.nome}</div>
                    <span style={{ padding: '3px 10px', borderRadius: 999, border: `1px solid ${cB.border}`, color: cB.text, fontWeight: 700, fontSize: 'clamp(10px,0.8vw,12px)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                      {cB.label}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 'clamp(9px,0.7vw,11px)', textTransform: 'uppercase', color: '#5f7da0', marginBottom: 2 }}>Nível</div>
                      <div style={{ fontSize: 'clamp(16px,1.6vw,24px)', fontWeight: 700, color: cB.text }}>
                        {p.nivel_m ?? '—'}<span style={{ fontSize: '0.6em', fontWeight: 400 }}>m</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'clamp(9px,0.7vw,11px)', textTransform: 'uppercase', color: '#5f7da0', marginBottom: 2 }}>Capacidade</div>
                      <div style={{ fontSize: 'clamp(16px,1.6vw,24px)', fontWeight: 700, color: cB.text }}>
                        {p.capacidade_pct ?? '—'}<span style={{ fontSize: '0.6em', fontWeight: 400 }}>%</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'clamp(9px,0.7vw,11px)', textTransform: 'uppercase', color: '#5f7da0', marginBottom: 2 }}>Comportas</div>
                      <div style={{ fontSize: 'clamp(14px,1.4vw,20px)', fontWeight: 700, color: abertas > 0 ? '#f97316' : '#5f7da0' }}>
                        {abertas}A/{fechadas}F
                      </div>
                    </div>
                  </div>
                  {pct !== null && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                        <div style={{ height: 5, borderRadius: 999, background: cB.dot, width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                  )}
                  {p.hora_leitura && (
                    <div style={{ fontSize: 'clamp(10px,0.75vw,11px)', color: '#5f7da0', marginTop: 8 }}>
                      Leitura: {fmtHora(p.hora_leitura)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Rodapé */}
      <div style={{ marginTop: 24, fontSize: 'clamp(10px,0.75vw,12px)', color: '#3a5578' }}>
        Refresh automático a cada 5 min · Defesa Civil SC · Práticos Itajaí
      </div>
    </main>
  )
}
