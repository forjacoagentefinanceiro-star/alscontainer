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
  if (s.includes('impraticáv') || s.includes('impraticav')) return 'impraticavel'
  if (s.includes('restri') || s.includes('condicion')) return 'restrito'
  if (s.includes('praticáv') || s.includes('praticav')) return 'praticavel'
  return 'desconhecido'
}

const COR = {
  normal:       { bg: 'rgba(22,163,74,0.15)',  border: '#16a34a', dot: '#22c55e', label: 'Normal',       text: '#4ade80' },
  atencao:      { bg: 'rgba(217,119,6,0.15)',  border: '#d97706', dot: '#f59e0b', label: 'Atenção',      text: '#fbbf24' },
  alerta:       { bg: 'rgba(234,88,12,0.15)',  border: '#ea580c', dot: '#f97316', label: 'Alerta',       text: '#fb923c' },
  emergencia:   { bg: 'rgba(220,38,38,0.15)',  border: '#dc2626', dot: '#ef4444', label: 'Crítica',      text: '#f87171' },
  praticavel:   { bg: 'rgba(22,163,74,0.15)',  border: '#16a34a', dot: '#22c55e', label: 'Praticável',   text: '#4ade80' },
  impraticavel: { bg: 'rgba(220,38,38,0.15)',  border: '#dc2626', dot: '#ef4444', label: 'Impraticável', text: '#f87171' },
  restrito:     { bg: 'rgba(217,119,6,0.15)',  border: '#d97706', dot: '#f59e0b', label: 'Restrito',     text: '#fbbf24' },
  fechado:      { bg: 'rgba(220,38,38,0.15)',  border: '#dc2626', dot: '#ef4444', label: 'Fechado',      text: '#f87171' },
  desconhecido: { bg: 'rgba(156,163,175,0.1)', border: '#374151', dot: '#6b7280', label: 'Sem dados',    text: '#9ca3af' },
} as const

type CorKey = keyof typeof COR
function cor(s: string | null): typeof COR[CorKey] {
  return COR[(s ?? 'desconhecido') as CorKey] ?? COR.desconhecido
}

// Configuração de escala e cotas por rio (espelho do MonitoramentoView)
const RIO_CONFIG: Record<string, { max: number; label: string; cotas: { valor: number; cor: string; label: string }[] }> = {
  rio_blumenau: {
    max: 20.0, label: 'Rio Itajaí · Blumenau',
    cotas: [
      { valor: 5.5, cor: '#d97706', label: 'Atenção 5.5m' },
      { valor: 7.0, cor: '#ea580c', label: 'Alerta 7m' },
      { valor: 9.0, cor: '#dc2626', label: 'Emergência 9m' },
    ],
  },
  rio_brusque: {
    max: 12.0, label: 'Rio Itajaí-Mirim · Brusque',
    cotas: [
      { valor: 3.5, cor: '#d97706', label: 'Atenção 3.5m' },
      { valor: 6.0, cor: '#dc2626', label: 'Emergência 6m' },
    ],
  },
  rio_murta: {
    max: 3.0, label: 'Ribeirão da Murta · Itajaí',
    cotas: [
      { valor: 1.22, cor: '#d97706', label: 'Atenção 1.22m' },
      { valor: 1.42, cor: '#ea580c', label: 'Alerta 1.42m' },
      { valor: 1.62, cor: '#dc2626', label: 'Emergência 1.62m' },
    ],
  },
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

  const rios = barragens.filter(p => p.tipo === 'rio')
  const barragensLista = barragens.filter(p => p.tipo === 'barragem')

  const statusBarraChan = barra ? statusBarra(barra.profundidade) : 'desconhecido'
  const todosStatus = [
    statusBarraChan,
    ...rios.map(r => r.status ?? 'desconhecido'),
    ...barragensLista.map(p => p.status ?? 'desconhecido'),
  ]
  const ordem = ['emergencia', 'alerta', 'atencao', 'normal', 'desconhecido']
  const piorStatus = ordem.find(s => todosStatus.includes(s)) ?? 'desconhecido'
  const cGeral = cor(piorStatus)
  const temAlerta = piorStatus === 'alerta' || piorStatus === 'emergencia'

  const cBarra = cor(statusBarraChan)
  const barraCondicao = barra?.profundidade?.split('·')[0]?.trim() ?? '—'

  const S = { fontFamily: 'inherit' } as const

  return (
    <main style={{ ...S, minHeight: '100vh', background: '#0d1b2e', color: '#e6eef7', padding: 'clamp(10px,1.4vw,20px)', display: 'flex', flexDirection: 'column', gap: 'clamp(8px,1vw,14px)' }}>

      {/* Banner de alerta */}
      {temAlerta && (
        <div style={{ background: cGeral.bg, border: `2px solid ${cGeral.border}`, color: cGeral.text, borderRadius: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 'clamp(12px,1vw,16px)' }}>
          <span style={{ fontSize: 20 }}>{piorStatus === 'emergencia' ? '🚨' : '⚠️'}</span>
          {piorStatus === 'emergencia' ? 'SITUAÇÃO DE EMERGÊNCIA ATIVA' : 'ALERTA ATIVO — MONITORAR DE PERTO'}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,1vw,14px)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ALS" style={{ height: 'clamp(36px,3.8vw,52px)', width: 'auto', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 'clamp(16px,1.9vw,30px)', fontWeight: 700, color: '#7DC242' }}>Monitoramento Climático</div>
            <div style={{ color: '#5f7da0', fontSize: 'clamp(10px,0.8vw,13px)', marginTop: 2 }}>
              Barra do Itajaí · Barragens SC · Rios monitorados
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 'clamp(22px,2.4vw,38px)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#cfe0f2' }}>{hora}</div>
          {!telaCheia ? (
            <button onClick={entrarTelaCheia} style={{ fontSize: 12, fontWeight: 600, color: '#0d1b2e', background: '#7DC242', padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer' }}>
              🖥️ Modo TV
            </button>
          ) : (
            <button onClick={sairTelaCheia} style={{ fontSize: 12, color: '#5f7da0', background: 'rgba(255,255,255,0.04)', padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Linha 1: Barra do Itajaí + Rios — grid auto-fill */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'clamp(8px,1vw,14px)' }}>

        {/* Barra do Itajaí */}
        <div style={{ background: cBarra.bg, border: `2px solid ${cBarra.border}`, borderRadius: 14, padding: 'clamp(12px,1.3vw,20px)' }}>
          <div style={{ fontSize: 'clamp(10px,0.8vw,12px)', letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0', marginBottom: 6 }}>
            Barra do Itajaí
          </div>
          <div style={{ fontSize: 'clamp(20px,2.4vw,36px)', fontWeight: 700, color: cBarra.text, lineHeight: 1.2 }}>
            {barraCondicao}
          </div>
          <span style={{ display: 'inline-block', marginTop: 8, padding: '2px 10px', borderRadius: 999, border: `1px solid ${cBarra.border}`, color: cBarra.text, fontWeight: 700, fontSize: 'clamp(10px,0.75vw,12px)' }}>
            {cBarra.label}
          </span>
          {barra?.atualizado_em && (
            <div style={{ fontSize: 'clamp(9px,0.7vw,11px)', color: '#5f7da0', marginTop: 8 }}>
              Atualizado: {fmtHora(barra.atualizado_em)}
            </div>
          )}
        </div>

        {/* Cards de rio */}
        {rios.map(rio => {
          const cfg = RIO_CONFIG[rio.id] ?? RIO_CONFIG.rio_blumenau
          const cRio = cor(rio.status ?? null)
          const nivelNum = rio.nivel_m ? parseFloat(rio.nivel_m.replace(',', '.')) : null
          const pct = nivelNum != null ? Math.min(100, Math.round((nivelNum / cfg.max) * 100)) : null
          return (
            <div key={rio.id} style={{ background: cRio.bg, border: `2px solid ${cRio.border}`, borderRadius: 14, padding: 'clamp(12px,1.3vw,20px)' }}>
              <div style={{ fontSize: 'clamp(10px,0.8vw,12px)', letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0', marginBottom: 4 }}>
                {cfg.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ fontSize: 'clamp(30px,3.8vw,58px)', fontWeight: 900, color: cRio.text, lineHeight: 1 }}>{rio.nivel_m ?? '—'}</div>
                <div style={{ fontSize: 'clamp(14px,1.6vw,22px)', fontWeight: 700, color: cRio.text, marginBottom: 4 }}>m</div>
              </div>
              {pct != null && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ position: 'relative', height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: '0 auto 0 0', borderRadius: 999, background: cRio.dot, width: `${pct}%`, transition: 'width 0.5s' }} />
                    {cfg.cotas.map(c => (
                      <div key={c.valor} style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: c.cor, left: `${Math.round((c.valor / cfg.max) * 100)}%` }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px', marginTop: 5 }}>
                    {cfg.cotas.map(c => (
                      <span key={c.valor} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'clamp(9px,0.65vw,11px)', color: c.cor }}>
                        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: c.cor, flexShrink: 0 }} />
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 999, border: `1px solid ${cRio.border}`, color: cRio.text, fontWeight: 700, fontSize: 'clamp(10px,0.75vw,12px)' }}>
                {cRio.label}
              </span>
              {rio.hora_leitura && (
                <div style={{ fontSize: 'clamp(9px,0.7vw,11px)', color: '#5f7da0', marginTop: 6 }}>
                  Leitura: {fmtHora(rio.hora_leitura)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Barragens */}
      {barragensLista.length > 0 && (
        <>
          <div style={{ fontSize: 'clamp(9px,0.75vw,12px)', letterSpacing: 2, textTransform: 'uppercase', color: '#3a5578' }}>
            Barragens
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'clamp(8px,1vw,14px)' }}>
            {barragensLista.map(p => {
              const cB = cor(p.status)
              const pct = p.capacidade_pct ? parseFloat(p.capacidade_pct.replace(',', '.')) : null
              const abertas = p.comportas_abertas ? parseInt(p.comportas_abertas) : 0
              const fechadas = p.comportas_fechadas ? parseInt(p.comportas_fechadas) : 0
              return (
                <div key={p.id} style={{ background: cB.bg, border: `1px solid ${cB.border}`, borderRadius: 12, padding: 'clamp(10px,1.1vw,16px)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 'clamp(12px,1vw,15px)', color: '#e6eef7', flex: 1, marginRight: 8 }}>{p.nome}</div>
                    <span style={{ padding: '2px 8px', borderRadius: 999, border: `1px solid ${cB.border}`, color: cB.text, fontWeight: 700, fontSize: 'clamp(9px,0.7vw,11px)', whiteSpace: 'nowrap' }}>
                      {cB.label}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 'clamp(8px,0.65vw,10px)', textTransform: 'uppercase', color: '#5f7da0', marginBottom: 2 }}>Nível</div>
                      <div style={{ fontSize: 'clamp(14px,1.4vw,20px)', fontWeight: 700, color: cB.text }}>
                        {p.nivel_m ?? '—'}<span style={{ fontSize: '0.6em', fontWeight: 400 }}>m</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'clamp(8px,0.65vw,10px)', textTransform: 'uppercase', color: '#5f7da0', marginBottom: 2 }}>Capacidade</div>
                      <div style={{ fontSize: 'clamp(14px,1.4vw,20px)', fontWeight: 700, color: cB.text }}>
                        {p.capacidade_pct ?? '—'}<span style={{ fontSize: '0.6em', fontWeight: 400 }}>%</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'clamp(8px,0.65vw,10px)', textTransform: 'uppercase', color: '#5f7da0', marginBottom: 2 }}>Comportas</div>
                      <div style={{ fontSize: 'clamp(12px,1.2vw,18px)', fontWeight: 700, color: abertas > 0 ? '#f97316' : '#5f7da0' }}>
                        {abertas}A/{fechadas}F
                      </div>
                    </div>
                  </div>
                  {pct != null && (
                    <div style={{ marginTop: 6, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div style={{ height: 4, borderRadius: 999, background: cB.dot, width: `${Math.min(100, pct)}%` }} />
                    </div>
                  )}
                  {p.hora_leitura && (
                    <div style={{ fontSize: 'clamp(9px,0.65vw,10px)', color: '#5f7da0', marginTop: 6 }}>
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
      <div style={{ fontSize: 'clamp(9px,0.65vw,11px)', color: '#3a5578', marginTop: 'auto' }}>
        Refresh a cada 5 min · Defesa Civil SC · Práticos Itajaí · Defesa Civil Itajaí
      </div>
    </main>
  )
}
