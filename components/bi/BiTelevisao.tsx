'use client'

import { useEffect, useState, useRef } from 'react'
import { IndicadorBar, TendenciaLinha } from './BiCharts'
import type { Categoria, KpiT } from '@/lib/bi/load'
import type { Ponto } from './BiCharts'
import type { DashboardEquipamentos, CicloHoras, ConfigCiclo, BarraStatus, BarragemPonto } from '@/app/actions'

// ─── Utilitários ────────────────────────────────────────────────────────────

function fmtMin(min: number | null): string {
  if (min == null || min === 0) return '—'
  if (min < 60) return `${Math.round(min)}min`
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return `${h}h${m > 0 ? ` ${m}min` : ''}`
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

// ─── Componentes visuais ────────────────────────────────────────────────────

function Tile({ label, value, sub, accent, cor }: { label: string; value: string | number; sub?: string; accent?: boolean; cor?: string }) {
  return (
    <div style={{ background: '#0f2138', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 'clamp(14px,1.6vw,24px)' }}>
      <div style={{ fontSize: 'clamp(11px,0.9vw,14px)', letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0' }}>{label}</div>
      <div style={{ fontSize: 'clamp(30px,3.6vw,56px)', fontWeight: 700, color: cor ?? (accent ? '#7DC242' : '#e6eef7'), lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 'clamp(11px,0.85vw,13px)', color: '#5f7da0', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Card({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0f2138', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 16 }}>
      <h3 style={{ fontSize: 'clamp(13px,1.1vw,17px)', fontWeight: 600, color: '#cfe0f2', marginBottom: sub ? 2 : 10 }}>{titulo}</h3>
      {sub && <div style={{ fontSize: 'clamp(11px,0.9vw,13px)', color: '#5f7da0', marginBottom: 10 }}>{sub}</div>}
      {children}
    </div>
  )
}

// ─── Slide Clima ────────────────────────────────────────────────────────────

const COR_CLIMA = {
  normal:       { bg: 'rgba(22,163,74,0.15)',  border: '#16a34a', dot: '#22c55e', label: 'Normal',     text: '#4ade80' },
  atencao:      { bg: 'rgba(217,119,6,0.15)',   border: '#d97706', dot: '#f59e0b', label: 'Atenção',    text: '#fbbf24' },
  alerta:       { bg: 'rgba(234,88,12,0.15)',   border: '#ea580c', dot: '#f97316', label: 'Alerta',     text: '#fb923c' },
  emergencia:   { bg: 'rgba(220,38,38,0.15)',   border: '#dc2626', dot: '#ef4444', label: 'Crítica',    text: '#f87171' },
  praticavel:   { bg: 'rgba(22,163,74,0.15)',  border: '#16a34a', dot: '#22c55e', label: 'Praticável', text: '#4ade80' },
  restrito:     { bg: 'rgba(217,119,6,0.15)',   border: '#d97706', dot: '#f59e0b', label: 'Restrito',   text: '#fbbf24' },
  fechado:      { bg: 'rgba(220,38,38,0.15)',   border: '#dc2626', dot: '#ef4444', label: 'Fechado',    text: '#f87171' },
  desconhecido: { bg: 'rgba(156,163,175,0.1)', border: '#374151', dot: '#6b7280', label: 'Sem dados',  text: '#9ca3af' },
} as const

type CorClimaKey = keyof typeof COR_CLIMA
function corClima(s: string | null): typeof COR_CLIMA[CorClimaKey] {
  return COR_CLIMA[(s ?? 'desconhecido') as CorClimaKey] ?? COR_CLIMA.desconhecido
}

function statusBarraClima(profundidade: string): string {
  const s = profundidade.toLowerCase()
  if (s.includes('fechad')) return 'fechado'
  if (s.includes('restri') || s.includes('condicion')) return 'restrito'
  if (s.includes('praticáv') || s.includes('praticav')) return 'praticavel'
  return 'desconhecido'
}

function fmtHoraClima(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function SlideClima({ barra, barragens }: { barra: BarraStatus | null; barragens: BarragemPonto[] }) {
  const rio = barragens.find(p => p.tipo === 'rio')
  const barragensLista = barragens.filter(p => p.tipo === 'barragem')

  const statusBarraChan = barra ? statusBarraClima(barra.profundidade) : 'desconhecido'
  const todosStatus = [
    statusBarraChan,
    ...(rio ? [rio.status ?? 'desconhecido'] : []),
    ...barragensLista.map(p => p.status ?? 'desconhecido'),
  ]
  const ordem = ['emergencia', 'alerta', 'atencao', 'normal', 'desconhecido']
  const piorStatus = ordem.find(s => todosStatus.includes(s)) ?? 'desconhecido'
  const cGeral = corClima(piorStatus)
  const temAlerta = piorStatus === 'alerta' || piorStatus === 'emergencia'

  const cBarra = corClima(statusBarraChan)
  const barraCondicao = barra?.profundidade?.split('·')[0]?.trim() ?? '—'

  const cRio = corClima(rio?.status ?? null)
  const nivelRio = rio?.nivel_m ?? '—'
  const pctRio = rio?.nivel_m
    ? Math.min(100, Math.round((parseFloat(rio.nivel_m.replace(',', '.')) / 9.0) * 100))
    : null

  return (
    <div>
      {temAlerta && (
        <div style={{
          background: cGeral.bg, border: `2px solid ${cGeral.border}`, color: cGeral.text,
          borderRadius: 14, padding: '10px 20px', marginBottom: 'clamp(10px,1.2vw,18px)',
          display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700,
          fontSize: 'clamp(13px,1.1vw,18px)',
        }}>
          <span style={{ fontSize: 24 }}>{piorStatus === 'emergencia' ? '🚨' : '⚠️'}</span>
          {piorStatus === 'emergencia' ? 'SITUAÇÃO DE EMERGÊNCIA ATIVA' : 'ALERTA ATIVO — MONITORAR DE PERTO'}
        </div>
      )}

      {/* Barra + Rio lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'clamp(10px,1.2vw,18px)', marginBottom: 'clamp(10px,1.2vw,18px)' }}>
        <div style={{ background: cBarra.bg, border: `2px solid ${cBarra.border}`, borderRadius: 16, padding: 'clamp(12px,1.4vw,20px)' }}>
          <div style={{ fontSize: 'clamp(10px,0.85vw,13px)', letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0', marginBottom: 6 }}>Barra do Itajaí</div>
          <div style={{ fontSize: 'clamp(20px,2.4vw,34px)', fontWeight: 700, color: cBarra.text }}>{barraCondicao}</div>
          <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 999, border: `1px solid ${cBarra.border}`, color: cBarra.text, fontWeight: 700, fontSize: 'clamp(10px,0.8vw,12px)' }}>
            {cBarra.label}
          </span>
          {barra?.atualizado_em && (
            <div style={{ fontSize: 'clamp(9px,0.75vw,11px)', color: '#5f7da0', marginTop: 6 }}>
              {fmtHoraClima(barra.atualizado_em)}
            </div>
          )}
        </div>

        {rio && (
          <div style={{ background: cRio.bg, border: `2px solid ${cRio.border}`, borderRadius: 16, padding: 'clamp(12px,1.4vw,20px)' }}>
            <div style={{ fontSize: 'clamp(10px,0.85vw,13px)', letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0', marginBottom: 6 }}>Rio Itajaí · Blumenau</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ fontSize: 'clamp(32px,4vw,60px)', fontWeight: 900, color: cRio.text, lineHeight: 1 }}>{nivelRio}</div>
              <div style={{ fontSize: 'clamp(16px,1.8vw,24px)', fontWeight: 700, color: cRio.text, marginBottom: 3 }}>m</div>
            </div>
            {pctRio !== null && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ height: 6, borderRadius: 999, background: cRio.dot, width: `${pctRio}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 'clamp(9px,0.7vw,11px)' }}>
                  <span style={{ color: '#d97706' }}>5.5m atenção</span>
                  <span style={{ color: '#ea580c' }}>7.0m alerta</span>
                  <span style={{ color: '#dc2626' }}>9.0m emergência</span>
                </div>
              </div>
            )}
            <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 999, border: `1px solid ${cRio.border}`, color: cRio.text, fontWeight: 700, fontSize: 'clamp(10px,0.8vw,12px)' }}>
              {cRio.label}
            </span>
          </div>
        )}
      </div>

      {/* Barragens */}
      {barragensLista.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'clamp(8px,1vw,14px)' }}>
          {barragensLista.map(p => {
            const cB = corClima(p.status)
            const pct = p.capacidade_pct ? parseFloat(p.capacidade_pct.replace(',', '.')) : null
            const abertas = p.comportas_abertas ? parseInt(p.comportas_abertas) : 0
            const fechadas = p.comportas_fechadas ? parseInt(p.comportas_fechadas) : 0
            return (
              <div key={p.id} style={{ background: cB.bg, border: `1px solid ${cB.border}`, borderRadius: 14, padding: 'clamp(10px,1.1vw,16px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 'clamp(12px,1vw,15px)', color: '#e6eef7' }}>{p.nome}</div>
                  <span style={{ padding: '2px 8px', borderRadius: 999, border: `1px solid ${cB.border}`, color: cB.text, fontWeight: 700, fontSize: 'clamp(9px,0.75vw,11px)', marginLeft: 6, whiteSpace: 'nowrap' }}>
                    {cB.label}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 'clamp(9px,0.65vw,10px)', textTransform: 'uppercase', color: '#5f7da0' }}>Nível</div>
                    <div style={{ fontSize: 'clamp(14px,1.4vw,20px)', fontWeight: 700, color: cB.text }}>{p.nivel_m ?? '—'}<span style={{ fontSize: '0.6em' }}>m</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'clamp(9px,0.65vw,10px)', textTransform: 'uppercase', color: '#5f7da0' }}>Cap.</div>
                    <div style={{ fontSize: 'clamp(14px,1.4vw,20px)', fontWeight: 700, color: cB.text }}>{p.capacidade_pct ?? '—'}<span style={{ fontSize: '0.6em' }}>%</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'clamp(9px,0.65vw,10px)', textTransform: 'uppercase', color: '#5f7da0' }}>Comportas</div>
                    <div style={{ fontSize: 'clamp(13px,1.2vw,18px)', fontWeight: 700, color: abertas > 0 ? '#f97316' : '#5f7da0' }}>{abertas}A/{fechadas}F</div>
                  </div>
                </div>
                {pct !== null && (
                  <div style={{ marginTop: 6, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div style={{ height: 4, borderRadius: 999, background: cB.dot, width: `${Math.min(100, pct)}%` }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!barra && barragens.length === 0 && (
        <div style={{ color: '#5f7da0', fontSize: 14 }}>Sem dados de monitoramento. Aguardando extração.</div>
      )}
    </div>
  )
}

// ─── Slide 2: Equipamentos ──────────────────────────────────────────────────

const NOMES_MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function SlideEquipamentos({ dash, ciclo, cfg }: { dash: DashboardEquipamentos; ciclo: CicloHoras; cfg: ConfigCiclo }) {
  const t = dash.totais
  const diaFim = cfg.diaInicio - 1
  const now = new Date()
  const mesLabel = `${NOMES_MES[now.getMonth()]} ${now.getFullYear()}`

  // cor do ciclo baseada na meta
  let corCiclo = '#7DC242'
  let badgeCiclo = ''
  if (cfg.metaHoras > 0) {
    const pct = ciclo.horasTrabalhadas / cfg.metaHoras
    if (pct > 1) { corCiclo = '#ef4444'; badgeCiclo = `${Math.round(pct * 100)}% — EXCEDIDO` }
    else if (pct >= 0.8) { corCiclo = '#f59e0b'; badgeCiclo = `${Math.round(pct * 100)}% da meta` }
    else { badgeCiclo = `${Math.round(pct * 100)}% de ${cfg.metaHoras}h` }
  }

  return (
    <div>
      {/* KPIs topo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 'clamp(10px,1.2vw,18px)', marginBottom: 'clamp(12px,1.4vw,20px)' }}>
        {/* Card especial do ciclo */}
        <div style={{ background: '#0f2138', border: `2px solid ${corCiclo}`, borderRadius: 16, padding: 'clamp(14px,1.6vw,24px)' }}>
          <div style={{ fontSize: 'clamp(11px,0.9vw,14px)', letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0' }}>Horas no ciclo</div>
          <div style={{ fontSize: 'clamp(30px,3.6vw,56px)', fontWeight: 700, color: corCiclo, lineHeight: 1.1 }}>{ciclo.horasTrabalhadas}h</div>
          <div style={{ fontSize: 'clamp(11px,0.85vw,13px)', color: '#5f7da0', marginTop: 2 }}>{ciclo.mesLabel} · dia {cfg.diaInicio}→{diaFim}</div>
          {badgeCiclo && <div style={{ fontSize: 'clamp(11px,0.85vw,13px)', color: corCiclo, fontWeight: 700, marginTop: 4 }}>{badgeCiclo}</div>}
          {cfg.metaHoras > 0 && (
            <div style={{ marginTop: 6, borderRadius: 999, overflow: 'hidden', height: 5, background: 'rgba(255,255,255,0.1)' }}>
              <div style={{ height: 5, borderRadius: 999, background: corCiclo, width: `${Math.min(100, (ciclo.horasTrabalhadas / cfg.metaHoras) * 100)}%`, transition: 'width 0.5s' }} />
            </div>
          )}
        </div>

        <Tile label={`Horas trabalhadas — ${mesLabel}`} value={`${t.horasTrabalhadas}h`} sub="todas as máquinas" />
        <Tile label="Consumo médio" value={t.consumoMedio != null ? `${t.consumoMedio} L/h` : '—'} sub="ponderado por abastecimento" cor="#f59e0b" />
        <Tile label="Litros abastecidos" value={`${t.litrosTotal}L`} cor="#f59e0b" />
        <Tile label="Problemas reportados" value={t.problemas}
          sub={t.problemasParado ? `${t.problemasParado} com máquina parada` : 'nenhuma parada'}
          cor={t.problemas ? '#ef4444' : '#7DC242'} />
        <Tile label="Tempo parado (total)" value={fmtMin(t.tempoParadoMin)} cor={t.tempoParadoMin > 0 ? '#ef4444' : '#7DC242'} />
      </div>

      {/* Tabela por máquina */}
      {dash.maquinas.length > 0 && (
        <div style={{ background: '#0f2138', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 'clamp(12px,1vw,15px)', fontWeight: 600, color: '#cfe0f2' }}>
            Por equipamento — {mesLabel}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'clamp(12px,1vw,15px)', color: '#cfe0f2' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['Equipamento', 'Horas trab.', 'Consumo', 'Litros', 'Problemas', 'Tempo parado', 'Resposta'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#5f7da0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dash.maquinas.map((m, i) => (
                  <tr key={m.equipamento} style={{ borderBottom: i < dash.maquinas.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#e6eef7', whiteSpace: 'nowrap' }}>{m.equipamento}</td>
                    <td style={{ padding: '10px 14px', color: '#7DC242', fontWeight: 600 }}>{m.horasTrabalhadas}h</td>
                    <td style={{ padding: '10px 14px', color: '#f59e0b' }}>{m.consumoMedio != null ? `${m.consumoMedio} L/h` : '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#f59e0b' }}>{m.litrosTotal}L</td>
                    <td style={{ padding: '10px 14px', color: m.problemasParado ? '#ef4444' : m.problemas ? '#f59e0b' : '#5f7da0' }}>
                      {m.problemas}{m.problemasParado > 0 ? ` (${m.problemasParado}↓)` : ''}
                    </td>
                    <td style={{ padding: '10px 14px', color: m.tempoParadoMin > 0 ? '#ef4444' : '#5f7da0' }}>{fmtMin(m.tempoParadoMin)}</td>
                    <td style={{ padding: '10px 14px', color: '#5f7da0' }}>{fmtMin(m.tempoRespostaMedioMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────

const SLIDE_DURATION = 20 // segundos por slide

export function BiTelevisao({ ano, atualizado, kpis, trend, categorias, equipamentos, ciclo, configCiclo, barra, barragens }: {
  ano: number; atualizado: string; kpis: KpiT[]; trend: Ponto[]; categorias: Categoria[]
  equipamentos?: DashboardEquipamentos; ciclo?: CicloHoras; configCiclo?: ConfigCiclo
  barra?: BarraStatus | null; barragens?: BarragemPonto[]
}) {
  const [hora, setHora] = useState('')
  const [telaCheia, setTelaCheia] = useState(false)
  const [slide, setSlide] = useState(0)
  const [progresso, setProgresso] = useState(0) // 0..100
  const progressoRef = useRef(0)

  const temEquipamentos = !!(equipamentos && ciclo && configCiclo)
  const temClima = barra !== undefined || (barragens && barragens.length > 0)
  const SLIDES = ['BI Depot', ...(temEquipamentos ? ['Equipamentos'] : []), ...(temClima ? ['Clima'] : [])]
  const totalSlides = SLIDES.length

  useEffect(() => {
    const tick = () => setHora(new Date().toLocaleTimeString('pt-BR'))
    tick()
    const tHora = setInterval(tick, 1000)
    const reload = setInterval(() => window.location.reload(), 15 * 60 * 1000)
    const onFs = () => setTelaCheia(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs); onFs()
    return () => { clearInterval(tHora); clearInterval(reload); document.removeEventListener('fullscreenchange', onFs) }
  }, [])

  // progresso + avanço de slide
  useEffect(() => {
    if (totalSlides < 2) return
    progressoRef.current = 0
    setProgresso(0)
    const step = 100 / (SLIDE_DURATION * 10) // 100ms intervals
    const t = setInterval(() => {
      progressoRef.current += step
      setProgresso(progressoRef.current)
      if (progressoRef.current >= 100) {
        progressoRef.current = 0
        setSlide(s => (s + 1) % totalSlides)
      }
    }, 100)
    return () => clearInterval(t)
  }, [slide, totalSlides])

  // TV: só movimentação por tipo 20'/40' (entrada e saída em QTD containers)
  // Remove TEUs (por armador) e indicadores de tempo
  const movCat = categorias.find(c => c.key === 'movimentacao')
  const destaques = movCat
    ? movCat.grupos.filter(g => !g.medida.startsWith('TEUs'))
    : categorias.map(c => c.grupos[0]).filter(Boolean).slice(0, 4)

  return (
    <main style={{ minHeight: '100vh', background: '#0d1b2e', color: '#e6eef7', padding: 'clamp(14px,1.8vw,28px)', fontFamily: 'inherit' }}>

      {/* Barra de progresso do slide */}
      {totalSlides > 1 && (
        <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.08)', marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ height: 3, borderRadius: 999, background: '#7DC242', width: `${progresso}%`, transition: 'width 0.09s linear' }} />
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 'clamp(14px,1.8vw,24px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.2vw,18px)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ALS Logística" style={{ height: 'clamp(40px,4.5vw,60px)', width: 'auto', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 'clamp(18px,2.2vw,34px)', fontWeight: 700, color: '#7DC242' }}>
              {totalSlides > 1 ? SLIDES[slide] : 'BI Depot'}
            </div>
            <div style={{ color: '#5f7da0', fontSize: 'clamp(11px,0.9vw,14px)', marginTop: 2 }}>
              {SLIDES[slide] === 'BI Depot' ? `e-Professional (websag) · ano ${ano} · atualizado ${atualizado}`
                : SLIDES[slide] === 'Equipamentos' ? 'Indicadores de frota · mês atual'
                : 'Barra do Itajaí · Barragens SC · Rio Itajaí em Blumenau'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* dots de slide */}
          {totalSlides > 1 && (
            <div style={{ display: 'flex', gap: 6 }}>
              {SLIDES.map((_, i) => (
                <button key={i} onClick={() => setSlide(i)}
                  style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', transition: 'background 0.2s',
                    background: i === slide ? '#7DC242' : 'rgba(255,255,255,0.2)' }} />
              ))}
            </div>
          )}
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

      {/* Conteúdo do slide */}
      {SLIDES[slide] === 'BI Depot' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 'clamp(10px,1.2vw,18px)', marginBottom: 'clamp(12px,1.4vw,20px)' }}>
            {kpis.map(k => <Tile key={k.label} label={k.label} value={k.value} sub={k.sub} accent={k.accent} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'clamp(10px,1.2vw,18px)', marginBottom: 'clamp(10px,1.2vw,18px)' }}>
            {trend.length > 0 && (
              <Card titulo="Entradas × Saídas por mês">
                <TendenciaLinha data={trend} series={['Entradas', 'Saídas']} />
              </Card>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,380px),1fr))', gap: 'clamp(10px,1.2vw,18px)' }}>
            {destaques.map(g => (
              <Card key={g.code} titulo={g.titulo} sub={g.medida}>
                <IndicadorBar data={g.data} series={g.series} />
              </Card>
            ))}
          </div>
        </>
      ) : SLIDES[slide] === 'Equipamentos' && temEquipamentos ? (
        <SlideEquipamentos dash={equipamentos!} ciclo={ciclo!} cfg={configCiclo!} />
      ) : SLIDES[slide] === 'Clima' ? (
        <SlideClima barra={barra ?? null} barragens={barragens ?? []} />
      ) : null}
    </main>
  )
}
