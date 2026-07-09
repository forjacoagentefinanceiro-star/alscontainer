'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IndicadorBar, TendenciaLinha } from './BiCharts'
import type { Categoria, KpiT, Conferencia, Grupo, FaturamentoResumo } from '@/lib/bi/load'
import type { Ponto } from './BiCharts'
import { setMetaMes } from '@/app/actions'
import type { ComparacaoDia, ComparacaoMetrica } from '@/lib/bi/load'

const nf = new Intl.NumberFormat('pt-BR')
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtBrl = (v: number | null) => (v == null ? '—' : brl.format(v))

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
function mesNumero(eixo: string): number {
  const idx = MESES_PT.findIndex(m => normalizar(m) === normalizar(eixo))
  return idx >= 0 ? idx + 1 : new Date().getMonth() + 1
}
const cardStyle: React.CSSProperties = { background: '#0f2138', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }

function Kpi({ k }: { k: KpiT }) {
  const cor = k.cor ?? (k.accent ? '#7DC242' : '#e6eef7')
  return (
    <div style={{
      background: '#0f2138',
      border: `1px solid ${k.destaque ? cor : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 14, padding: 16, minWidth: 0,
    }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0' }}>{k.label}</div>
      <div style={{
        fontSize: k.compact ? 'clamp(14px, 3vw, 20px)' : 'clamp(22px, 5vw, 30px)',
        fontWeight: 700, color: cor, lineHeight: 1.25,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{k.value}</div>
      {k.sub && <div style={{ fontSize: 11, color: '#5f7da0', marginTop: 2 }}>{k.sub}</div>}
    </div>
  )
}

function Card({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#cfe0f2', marginBottom: sub ? 2 : 10 }}>{titulo}</h3>
      {sub && <div style={{ fontSize: 11, color: '#5f7da0', marginBottom: 10 }}>{sub}</div>}
      {children}
    </div>
  )
}

// card "hero" — métrica principal, em destaque (até 4 por tela, conforme boas práticas de dashboard)
function HeroCard({ label, value, sub, cor, progresso }: { label: string; value: string; sub?: string; cor: string; progresso?: number | null }) {
  return (
    <div style={{ background: '#0f2138', border: `1px solid ${cor}66`, borderRadius: 16, padding: 18, minWidth: 0 }}>
      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 700, color: cor, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#5f7da0', marginTop: 4 }}>{sub}</div>}
      {progresso != null && (
        <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, progresso))}%`, background: cor, borderRadius: 999 }} />
        </div>
      )}
    </div>
  )
}

// linha compacta de detalhe — informação secundária, sem o peso visual de um card
function StatRow({ label, value, cor }: { label: string; value: string; cor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 13, color: '#8ca5c8' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: cor ?? '#cfe0f2', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function MetaEditor({ ano, mes, metaMes, podeGerenciar }: { ano: number; mes: number; metaMes: number | null; podeGerenciar: boolean }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(metaMes != null ? String(metaMes) : '')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (!podeGerenciar) return null

  function salvar() {
    setErro(null)
    const v = Number(valor.replace(',', '.'))
    if (!Number.isFinite(v) || v <= 0) { setErro('Informe um valor válido.'); return }
    startTransition(async () => {
      const res = await setMetaMes(ano, mes, v)
      if (res.error) { setErro(res.error); return }
      setEditando(false)
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      {editando ? (
        <>
          <input value={valor} onChange={e => setValor(e.target.value)} placeholder="Valor da meta (R$)" autoFocus
            style={{ background: '#0f2138', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 10px', color: '#e6eef7', fontSize: 13, width: 160 }} />
          <button onClick={salvar} disabled={isPending} style={{ fontSize: 12, fontWeight: 600, color: '#0d1b2e', background: '#7DC242', padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
            Salvar
          </button>
          <button onClick={() => setEditando(false)} style={{ fontSize: 12, color: '#5f7da0', background: 'none', border: 'none', cursor: 'pointer' }}>cancelar</button>
        </>
      ) : (
        <button onClick={() => { setEditando(true); setErro(null) }} style={{ fontSize: 12, fontWeight: 600, color: '#8ca5c8', background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
          {metaMes != null ? 'Editar meta do mês' : '+ Definir meta do mês'}
        </button>
      )}
      {erro && <span style={{ fontSize: 12, color: '#f87171' }}>{erro}</span>}
    </div>
  )
}

function ComparacaoCard({ label, metrica, formato }: { label: string; metrica: ComparacaoMetrica; formato: 'numero' | 'brl' }) {
  const fmt = formato === 'brl' ? brl.format : nf.format
  const corDelta = metrica.delta == null ? '#5f7da0' : metrica.delta > 0 ? '#7DC242' : metrica.delta < 0 ? '#f87171' : '#5f7da0'
  const setaIcon = metrica.delta == null ? '—' : metrica.delta > 0 ? '▲' : metrica.delta < 0 ? '▼' : '='
  return (
    <div style={{ background: '#0f2138', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, minWidth: 0 }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#5f7da0', marginBottom: 2 }}>Mês atual (MTD)</div>
          <div style={{ fontSize: 'clamp(16px,3vw,22px)', fontWeight: 700, color: '#e6eef7' }}>{metrica.hoje != null ? fmt(metrica.hoje) : '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#5f7da0', marginBottom: 2 }}>Mês passado (mesmo dia)</div>
          <div style={{ fontSize: 'clamp(16px,3vw,22px)', fontWeight: 700, color: '#8ca5c8' }}>{metrica.mesPassado != null ? fmt(metrica.mesPassado) : '—'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
        <span style={{ fontSize: 16, color: corDelta }}>{setaIcon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: corDelta }}>
          {metrica.delta != null ? fmt(Math.abs(metrica.delta)) : '—'}
        </span>
        {metrica.pct != null && (
          <span style={{ fontSize: 12, color: corDelta }}>({metrica.pct > 0 ? '+' : ''}{metrica.pct}%)</span>
        )}
        {metrica.delta == null && <span style={{ fontSize: 12, color: '#5f7da0' }}>sem dados do mês passado ainda</span>}
      </div>
    </div>
  )
}

function ConfCard({ c }: { c: Conferencia }) {
  const th: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', color: '#8ca5c8', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }
  const td: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', color: '#cfe0f2', fontVariantNumeric: 'tabular-nums' }
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#cfe0f2' }}>{c.metrica}</h3>
        <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, color: c.ok ? '#0d1b2e' : '#fff', background: c.ok ? '#7DC242' : '#dc2626' }}>
          {c.ok ? '✓ bate' : '⚠ divergência'}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr><th style={{ ...th, textAlign: 'left' }}>Mês</th>{c.itens.map(i => <th key={i.eixo} style={th}>{i.eixo.slice(0, 3)}</th>)}</tr>
          </thead>
          <tbody>
            <tr><td style={{ ...td, textAlign: 'left', color: '#8ca5c8' }}>Total</td>{c.itens.map(i => <td key={i.eixo} style={td}>{nf.format(i.total)}</td>)}</tr>
            <tr><td style={{ ...td, textAlign: 'left', color: '#8ca5c8' }}>Soma armadores</td>{c.itens.map(i => <td key={i.eixo} style={td}>{nf.format(i.soma)}</td>)}</tr>
            <tr><td style={{ ...td, textAlign: 'left', color: '#8ca5c8' }}>Diferença</td>{c.itens.map(i => <td key={i.eixo} style={{ ...td, color: i.dif === 0 ? '#3b6d11' : '#f87171', fontWeight: i.dif === 0 ? 400 : 700 }}>{nf.format(i.dif)}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function BiDashboard({ ano, atualizado, kpis, trend, categorias, conferencia, faturamentoResumo, faturamentoMensal, faturamentoAnual, abasPermitidas, podeGerenciar, metasPorMes, comparacaoDia }: {
  ano: number; atualizado: string; kpis: KpiT[]; trend: Ponto[]; categorias: Categoria[]; conferencia: Conferencia[]; faturamentoResumo: FaturamentoResumo | null; faturamentoMensal: Grupo | null; faturamentoAnual: Grupo | null; abasPermitidas: string[] | null
  podeGerenciar: boolean; metasPorMes: Record<string, number>; comparacaoDia: ComparacaoDia | null
}) {
  // navegação por mês na aba Faturamento (dentro do ano corrente, que é o que o robô extrai)
  // comparação por mês normalizado: os dados de faturamento (escala) e de movimentação (websag) podem vir com capitalização/acentos diferentes
  const todosMeses = faturamentoMensal?.data.map(p => p.eixo) ?? (faturamentoResumo ? [faturamentoResumo.mesLabel] : [])
  const idxMesAtualBruto = faturamentoResumo ? todosMeses.findIndex(m => normalizar(m) === normalizar(faturamentoResumo!.mesLabel)) : -1
  // não deixa navegar para meses futuros (ainda sem dado, sempre R$ 0,00)
  const mesesDisponiveis = idxMesAtualBruto >= 0 ? todosMeses.slice(0, idxMesAtualBruto + 1) : todosMeses
  const idxMesAtual = idxMesAtualBruto >= 0 ? idxMesAtualBruto : mesesDisponiveis.length - 1
  const [mesIdx, setMesIdx] = useState(idxMesAtual)
  const eixoSelecionado = mesesDisponiveis[mesIdx] ?? faturamentoResumo?.mesLabel ?? ''
  const isMesAtual = normalizar(eixoSelecionado) === normalizar(faturamentoResumo?.mesLabel ?? '')
  const pontoSelecionado = faturamentoMensal?.data.find(p => p.eixo === eixoSelecionado)
  const mesRealSelecionado = isMesAtual
    ? faturamentoResumo?.mesReal ?? null
    : pontoSelecionado ? (faturamentoMensal?.series ?? []).reduce((acc, s) => acc + (Number(pontoSelecionado[s]) || 0), 0) : null
  const metaSelecionada = metasPorMes[eixoSelecionado] ?? null
  const pctSelecionado = metaSelecionada != null && metaSelecionada > 0 ? Math.round(((mesRealSelecionado ?? 0) / metaSelecionada) * 1000) / 10 : null
  const faltaSelecionada = metaSelecionada != null ? Math.max(0, metaSelecionada - (mesRealSelecionado ?? 0)) : null
  const atingidaSelecionada = metaSelecionada != null && (mesRealSelecionado ?? 0) >= metaSelecionada
  const numeroMesSelecionado = mesNumero(eixoSelecionado)
  const todasTabs = [
    { key: 'visao-geral', label: 'Visão Geral' },
    ...categorias.map(c => ({ key: c.key, label: c.label })),
    ...(faturamentoResumo ? [{ key: 'faturamento', label: 'Faturamento' }] : []),
    { key: 'conferencia', label: 'Conferência' },
  ]
  // null = vê todas; senão filtra pelas abas liberadas ao usuário
  const tabs = abasPermitidas ? todasTabs.filter(t => abasPermitidas.includes(t.key)) : todasTabs
  const [tabKey, setTabKey] = useState(tabs[0]?.key ?? 'visao-geral')
  const current = tabs.some(t => t.key === tabKey) ? tabKey : (tabs[0]?.key ?? 'visao-geral')
  const cat = categorias.find(c => c.key === current)

  return (
    <div style={{ background: '#0d1b2e', borderRadius: 18, padding: 'clamp(14px, 3vw, 24px)', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ color: '#e6eef7', fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 700 }}>BI Depot</h1>
          <p style={{ color: '#5f7da0', fontSize: 13 }}>Dados do e-Professional (websag) · ano {ano}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/tv" target="_blank" style={{ fontSize: 12, fontWeight: 600, color: '#0d1b2e', background: '#7DC242', padding: '7px 14px', borderRadius: 999, textDecoration: 'none' }}>
            Televisão ↗
          </Link>
          <div style={{ color: '#5f7da0', fontSize: 12, textAlign: 'right' }}>
            atualizado em<br /><span style={{ color: '#8ca5c8' }}>{atualizado}</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        {kpis.map(k => <Kpi key={k.label} k={k} />)}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 4 }}>
        {tabs.map(t => {
          const active = t.key === current
          return (
            <button
              key={t.key}
              onClick={() => setTabKey(t.key)}
              style={{
                whiteSpace: 'nowrap', padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all .15s',
                background: active ? '#7DC242' : 'rgba(255,255,255,0.04)',
                color: active ? '#0d1b2e' : '#8ca5c8',
                border: active ? '1px solid #7DC242' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo da aba */}
      {tabs.length === 0 ? (
        <p style={{ color: '#8ca5c8', fontSize: 13 }}>Você não tem abas liberadas no BI. Fale com o administrador.</p>
      ) : current === 'visao-geral' ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Cards de comparação hoje vs mesmo dia mês passado */}
          {comparacaoDia && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#cfe0f2', margin: 0 }}>Comparação dia a dia</h3>
                <span style={{ fontSize: 11, color: '#5f7da0' }}>
                  {comparacaoDia.dataHoje} vs {comparacaoDia.dataMesPassado}
                </span>
                {!comparacaoDia.temDados && (
                  <span style={{ fontSize: 11, color: '#F2C200', background: 'rgba(242,194,0,0.1)', padding: '2px 8px', borderRadius: 999 }}>
                    acumulando histórico — disponível após 1 mês
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
                <ComparacaoCard label="Depot · Entradas (MTD)" metrica={comparacaoDia.movEntrada} formato="numero" />
                <ComparacaoCard label="Depot · Saídas (MTD)" metrica={comparacaoDia.movSaida} formato="numero" />
                {faturamentoResumo && (
                  <ComparacaoCard label="Faturamento (MTD)" metrica={comparacaoDia.faturamento} formato="brl" />
                )}
              </div>
            </div>
          )}
          <Card titulo="Entradas × Saídas por mês">
            {trend.length ? <TendenciaLinha data={trend} series={['Entradas', 'Saídas']} />
              : <p style={{ color: '#5f7da0', fontSize: 13 }}>Sem dados de movimentação.</p>}
          </Card>
        </div>
      ) : current === 'faturamento' && faturamentoResumo ? (
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Navegação entre meses */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setMesIdx(i => Math.max(0, i - 1))} disabled={mesIdx <= 0}
              style={{ fontSize: 16, color: '#cfe0f2', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 12px', cursor: mesIdx <= 0 ? 'default' : 'pointer', opacity: mesIdx <= 0 ? 0.4 : 1 }}>
              ←
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#e6eef7', minWidth: 90, textAlign: 'center' }}>{eixoSelecionado} · {ano}</span>
            <button onClick={() => setMesIdx(i => Math.min(mesesDisponiveis.length - 1, i + 1))} disabled={mesIdx >= mesesDisponiveis.length - 1}
              style={{ fontSize: 16, color: '#cfe0f2', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 12px', cursor: mesIdx >= mesesDisponiveis.length - 1 ? 'default' : 'pointer', opacity: mesIdx >= mesesDisponiveis.length - 1 ? 0.4 : 1 }}>
              →
            </button>
            {!isMesAtual && (
              <button onClick={() => setMesIdx(idxMesAtual >= 0 ? idxMesAtual : mesesDisponiveis.length - 1)} style={{ fontSize: 12, color: '#7DC242', background: 'none', border: 'none', cursor: 'pointer' }}>
                voltar para o mês atual
              </button>
            )}
          </div>

          {/* Hero — as métricas que importam para decisão, sempre poucas por tela */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <HeroCard
              label={`Faturamento real · ${eixoSelecionado}`}
              value={fmtBrl(mesRealSelecionado)}
              sub="terminal + depot"
              cor="#4FA3D1"
            />
            <div style={{ display: 'grid', gap: 6 }}>
              <HeroCard
                label="Meta do mês"
                value={fmtBrl(metaSelecionada)}
                sub={pctSelecionado != null ? `${pctSelecionado}% atingido` : 'meta não definida'}
                cor="#7DC242"
                progresso={pctSelecionado}
              />
              <MetaEditor key={`${ano}-${numeroMesSelecionado}`} ano={ano} mes={numeroMesSelecionado} metaMes={metaSelecionada} podeGerenciar={podeGerenciar} />
            </div>
            {isMesAtual && (
              <HeroCard
                label="Projeção"
                value={fmtBrl(faturamentoResumo.projecao)}
                sub="real + terminal a faturar"
                cor="#dc2626"
              />
            )}
            <HeroCard
              label="Falta para a meta"
              value={metaSelecionada == null ? '—' : atingidaSelecionada ? 'Meta atingida 🎉' : fmtBrl(faltaSelecionada)}
              sub={
                metaSelecionada == null || atingidaSelecionada
                  ? 'sobre o faturamento real'
                  : `${pctSelecionado ?? 0}% atingido · ${Math.round((100 - (pctSelecionado ?? 0)) * 10) / 10}% restante`
              }
              cor={metaSelecionada == null ? '#5f7da0' : atingidaSelecionada ? '#7DC242' : '#dc2626'}
            />
          </div>

          {/* Detalhamento — secundário, sem o mesmo peso visual do hero (sempre do ano/mês atual, dados anuais não navegam) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0', marginBottom: 8 }}>Detalhamento anual</h3>
              <StatRow label="Terminal" value={fmtBrl(faturamentoResumo.anualTerminal)} />
              <StatRow label="Depot" value={fmtBrl(faturamentoResumo.anualDepot)} />
              <StatRow label="Total" value={fmtBrl(faturamentoResumo.anualTotal)} cor="#4FA3D1" />
            </div>
            {isMesAtual && (
              <div style={cardStyle}>
                <h3 style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0', marginBottom: 8 }}>Detalhamento do mês atual</h3>
                <StatRow label="Terminal" value={fmtBrl(faturamentoResumo.mesTerminal)} />
                <StatRow label="Depot" value={fmtBrl(faturamentoResumo.mesDepot)} />
                <StatRow label="Terminal a faturar" value={fmtBrl(faturamentoResumo.terminalAFaturar)} cor="#F2C200" />
              </div>
            )}
          </div>

          {(faturamentoMensal || faturamentoAnual) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 14 }}>
              {faturamentoMensal && (
                <Card titulo={faturamentoMensal.titulo} sub={faturamentoMensal.medida}>
                  <IndicadorBar data={faturamentoMensal.data} series={faturamentoMensal.series} />
                </Card>
              )}
              {faturamentoAnual && (
                <Card titulo={faturamentoAnual.titulo} sub={faturamentoAnual.medida}>
                  <IndicadorBar data={faturamentoAnual.data} series={faturamentoAnual.series} />
                </Card>
              )}
            </div>
          )}
        </div>
      ) : current === 'conferencia' ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <p style={{ color: '#8ca5c8', fontSize: 13, margin: 0 }}>
            Cruza o total de cada métrica com a soma das suas quebras por armador. Diferença ≠ 0 indica que a extração divergiu do e-Professional.
          </p>
          {conferencia.length === 0
            ? <Card titulo="Conferência"><p style={{ color: '#5f7da0', fontSize: 13 }}>Sem métricas com quebra por armador para conferir ainda.</p></Card>
            : conferencia.map(c => <ConfCard key={c.metrica} c={c} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 14 }}>
          {cat?.grupos.map(g => (
            <Card key={g.code} titulo={g.titulo} sub={g.medida}>
              <IndicadorBar data={g.data} series={g.series} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
