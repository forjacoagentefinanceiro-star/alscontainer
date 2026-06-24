'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IndicadorBar, TendenciaLinha } from './BiCharts'
import type { Categoria, KpiT, Conferencia, Grupo } from '@/lib/bi/load'
import type { Ponto } from './BiCharts'
import { setMetaMesAtual } from '@/app/actions'

const nf = new Intl.NumberFormat('pt-BR')
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

// agrupa KPIs pelo campo `grupo` (preserva a ordem de primeira aparição)
function agruparKpis(itens: KpiT[]): [string, KpiT[]][] {
  const ordem: string[] = []
  const map = new Map<string, KpiT[]>()
  for (const k of itens) {
    const g = k.grupo ?? ''
    if (!map.has(g)) { map.set(g, []); ordem.push(g) }
    map.get(g)!.push(k)
  }
  return ordem.map(g => [g, map.get(g)!])
}

function MetaEditor({ metaMes, podeGerenciar }: { metaMes: number | null; podeGerenciar: boolean }) {
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
      const res = await setMetaMesAtual(v)
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

export function BiDashboard({ ano, atualizado, kpis, trend, categorias, conferencia, faturamento, faturamentoMensal, faturamentoAnual, abasPermitidas, metaMes, podeGerenciar }: {
  ano: number; atualizado: string; kpis: KpiT[]; trend: Ponto[]; categorias: Categoria[]; conferencia: Conferencia[]; faturamento: KpiT[]; faturamentoMensal: Grupo | null; faturamentoAnual: Grupo | null; abasPermitidas: string[] | null
  metaMes: number | null; podeGerenciar: boolean
}) {
  const todasTabs = [
    { key: 'visao-geral', label: 'Visão Geral' },
    ...categorias.map(c => ({ key: c.key, label: c.label })),
    ...(faturamento.length ? [{ key: 'faturamento', label: 'Faturamento' }] : []),
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
        <Card titulo="Entradas × Saídas por mês">
          {trend.length ? <TendenciaLinha data={trend} series={['Entradas', 'Saídas']} />
            : <p style={{ color: '#5f7da0', fontSize: 13 }}>Sem dados de movimentação.</p>}
        </Card>
      ) : current === 'faturamento' ? (
        <div style={{ display: 'grid', gap: 18 }}>
          <MetaEditor metaMes={metaMes} podeGerenciar={podeGerenciar} />
          {agruparKpis(faturamento).map(([grupo, itens]) => (
            <div key={grupo}>
              <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0', marginBottom: 8 }}>{grupo}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {itens.map(k => <Kpi key={k.label} k={k} />)}
              </div>
            </div>
          ))}
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
