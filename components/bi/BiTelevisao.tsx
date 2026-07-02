'use client'

import { useEffect, useState, useRef } from 'react'
import { IndicadorBar, TendenciaLinha } from './BiCharts'
import type { Categoria, KpiT } from '@/lib/bi/load'
import type { Ponto } from './BiCharts'
import type { DashboardEquipamentos, CicloHoras, ConfigCiclo } from '@/app/actions'

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

export function BiTelevisao({ ano, atualizado, kpis, trend, categorias, equipamentos, ciclo, configCiclo }: {
  ano: number; atualizado: string; kpis: KpiT[]; trend: Ponto[]; categorias: Categoria[]
  equipamentos?: DashboardEquipamentos; ciclo?: CicloHoras; configCiclo?: ConfigCiclo
}) {
  const [hora, setHora] = useState('')
  const [telaCheia, setTelaCheia] = useState(false)
  const [slide, setSlide] = useState(0)
  const [progresso, setProgresso] = useState(0) // 0..100
  const progressoRef = useRef(0)

  const temEquipamentos = !!(equipamentos && ciclo && configCiclo)
  const totalSlides = temEquipamentos ? 2 : 1
  const SLIDES = ['BI Depot', 'Equipamentos']

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

  const destaques = categorias.map(c => c.grupos[0]).filter(Boolean).slice(0, 4)

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
        <div>
          <div style={{ fontSize: 'clamp(20px,2.4vw,38px)', fontWeight: 700 }}>
            ALS · <span style={{ color: '#7DC242' }}>
              {totalSlides > 1 ? SLIDES[slide] : 'BI Depot'}
            </span>
          </div>
          <div style={{ color: '#5f7da0', fontSize: 'clamp(11px,0.9vw,14px)', marginTop: 2 }}>
            {slide === 0 ? `e-Professional (websag) · ano ${ano} · atualizado ${atualizado}` : 'Indicadores de frota · mês atual'}
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
      {slide === 0 ? (
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
      ) : (
        temEquipamentos && (
          <SlideEquipamentos dash={equipamentos!} ciclo={ciclo!} cfg={configCiclo!} />
        )
      )}
    </main>
  )
}
