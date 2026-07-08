'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Container, ContainerLancamento } from '@/app/actions'
import { updateContainerStatus, addLancamento, deleteLancamento } from '@/app/actions'

type ResumoItem = {
  container: Container
  receitas: number
  despesas: number
  custoAquisicao: number
  breakeven: number
  saldo: number
  breakevenPct: number | null
  lancamentos: ContainerLancamento[]
}

const CATEGORIAS_RECEITA = ['Locação', 'Venda', 'Outro']
const CATEGORIAS_DESPESA = ['Manutenção', 'Handling', 'Storage', 'Frete', 'Outro']

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

function StatusBadge({ status }: { status?: string }) {
  if (status === 'locado') return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>Locado</span>
  )
  if (status === 'vendido') return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>Vendido</span>
  )
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>Disponível</span>
  )
}

function BreakevenBar({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs" style={{ color: '#9ca3af' }}>—</span>
  const clamped = Math.min(pct, 100)
  const cor = pct >= 100 ? '#16a34a' : pct >= 60 ? '#d97706' : '#b91c1c'
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-bold" style={{ color: cor }}>{pct}%</span>
        <span className="text-[10px]" style={{ color: '#9ca3af' }}>do break-even</span>
      </div>
      <div className="rounded-full overflow-hidden h-1.5" style={{ background: '#e5e7eb' }}>
        <div className="h-1.5 rounded-full" style={{ width: `${clamped}%`, background: cor }} />
      </div>
    </div>
  )
}

function ContratoEditor({ container, onClose, onSaved }: {
  container: Container
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState<'disponivel' | 'locado' | 'vendido'>(container.status ?? 'disponivel')
  const [locatario, setLocatario] = useState(container.locatario ?? '')
  const [locacaoInicio, setLocacaoInicio] = useState(container.locacao_inicio ?? '')
  const [locacaoFim, setLocacaoFim] = useState(container.locacao_fim ?? '')
  const [valorMensal, setValorMensal] = useState(container.valor_locacao_mensal != null ? String(container.valor_locacao_mensal) : '')
  const [valorVenda, setValorVenda] = useState(container.valor_venda != null ? String(container.valor_venda) : '')
  const [dataVenda, setDataVenda] = useState(container.data_venda ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function salvar() {
    setErro(null)
    startTransition(async () => {
      const res = await updateContainerStatus(container.id, {
        status,
        locatario: locatario.trim() || null,
        locacao_inicio: locacaoInicio || null,
        locacao_fim: locacaoFim || null,
        valor_locacao_mensal: valorMensal ? parseFloat(valorMensal.replace(',', '.')) : null,
        valor_venda: valorVenda ? parseFloat(valorVenda.replace(',', '.')) : null,
        data_venda: dataVenda || null,
      })
      if (res.error) { setErro(res.error); return }
      onSaved()
      router.refresh()
    })
  }

  const inp = 'w-full rounded border px-2 py-1.5 text-sm outline-none'
  const inpStyle = { borderColor: '#d1d5db', background: '#fff' }

  return (
    <div className="mt-3 p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
      <p className="text-xs font-semibold mb-2" style={{ color: '#1a2a3a' }}>Status e contrato</p>
      <div className="grid grid-cols-3 gap-1 mb-3">
        {(['disponivel', 'locado', 'vendido'] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className="text-xs font-semibold py-1.5 rounded-lg border capitalize"
            style={status === s ? { background: '#1B4F8A', color: '#fff', borderColor: '#1B4F8A' } : { background: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}>
            {s === 'disponivel' ? 'Disponível' : s === 'locado' ? 'Locado' : 'Vendido'}
          </button>
        ))}
      </div>

      {status === 'locado' && (
        <div className="space-y-2">
          <div><label className="text-xs text-gray-500">Locatário</label>
            <input className={inp} style={inpStyle} value={locatario} onChange={e => setLocatario(e.target.value)} placeholder="Nome do locatário" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500">Início da locação</label>
              <input type="date" className={inp} style={inpStyle} value={locacaoInicio} onChange={e => setLocacaoInicio(e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Fim previsto</label>
              <input type="date" className={inp} style={inpStyle} value={locacaoFim} onChange={e => setLocacaoFim(e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-gray-500">Valor mensal (R$)</label>
            <input className={inp} style={inpStyle} value={valorMensal} onChange={e => setValorMensal(e.target.value)} placeholder="0,00" /></div>
        </div>
      )}

      {status === 'vendido' && (
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-gray-500">Valor de venda (R$)</label>
            <input className={inp} style={inpStyle} value={valorVenda} onChange={e => setValorVenda(e.target.value)} placeholder="0,00" /></div>
          <div><label className="text-xs text-gray-500">Data da venda</label>
            <input type="date" className={inp} style={inpStyle} value={dataVenda} onChange={e => setDataVenda(e.target.value)} /></div>
        </div>
      )}

      {erro && <p className="text-xs mt-2" style={{ color: '#b91c1c' }}>{erro}</p>}
      <div className="flex gap-2 mt-3">
        <button onClick={salvar} disabled={isPending}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
          style={{ background: '#1B4F8A' }}>Salvar</button>
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#6b7280' }}>Cancelar</button>
      </div>
    </div>
  )
}

function LancamentoForm({ containerId, onSaved }: { containerId: string; onSaved: () => void }) {
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('receita')
  const [categoria, setCategoria] = useState('Locação')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function salvar() {
    const v = parseFloat(valor.replace(',', '.'))
    if (!v || v <= 0) { setErro('Valor inválido.'); return }
    setErro(null)
    startTransition(async () => {
      const res = await addLancamento({ container_id: containerId, tipo, categoria, valor: v, data, descricao: descricao.trim() || undefined })
      if (res.error) { setErro(res.error); return }
      setValor(''); setDescricao('')
      onSaved()
      router.refresh()
    })
  }

  const cats = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA
  const inp = 'rounded border px-2 py-1.5 text-xs outline-none'
  const inpStyle = { borderColor: '#d1d5db', background: '#fff' }

  return (
    <div className="mt-3 p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
      <p className="text-xs font-semibold mb-2" style={{ color: '#1a2a3a' }}>Novo lançamento</p>
      <div className="flex gap-1 mb-2">
        {(['receita', 'despesa'] as const).map(t => (
          <button key={t} onClick={() => { setTipo(t); setCategoria(t === 'receita' ? 'Locação' : 'Manutenção') }}
            className="text-xs font-semibold px-3 py-1 rounded-lg border flex-1"
            style={tipo === t
              ? { background: t === 'receita' ? '#15803d' : '#b91c1c', color: '#fff', borderColor: 'transparent' }
              : { background: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}>
            {t === 'receita' ? '+ Receita' : '− Despesa'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Categoria</label>
          <select className={`${inp} w-full`} style={inpStyle} value={categoria} onChange={e => setCategoria(e.target.value)}>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Valor (R$)</label>
          <input className={`${inp} w-full`} style={inpStyle} value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Data</label>
          <input type="date" className={`${inp} w-full`} style={inpStyle} value={data} onChange={e => setData(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Descrição (opcional)</label>
          <input className={`${inp} w-full`} style={inpStyle} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="obs..." />
        </div>
      </div>
      {erro && <p className="text-xs mb-1" style={{ color: '#b91c1c' }}>{erro}</p>}
      <button onClick={salvar} disabled={isPending}
        className="text-xs font-semibold px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
        style={{ background: tipo === 'receita' ? '#15803d' : '#b91c1c' }}>
        Lançar
      </button>
    </div>
  )
}

function ContainerCard({ item }: { item: ResumoItem }) {
  const { container: c, receitas, despesas, custoAquisicao, breakeven, saldo, breakevenPct, lancamentos } = item
  const [aberto, setAberto] = useState(false)
  const [editandoStatus, setEditandoStatus] = useState(false)
  const [addingLanc, setAddingLanc] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function excluirLanc(id: string) {
    startTransition(async () => {
      await deleteLancamento(id)
      router.refresh()
    })
  }

  const faltaBE = Math.max(0, breakeven - receitas)

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
      {/* Cabeçalho */}
      <button onClick={() => setAberto(o => !o)} className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold font-mono" style={{ color: '#1B4F8A' }}>{c.numero}</span>
              <span className="text-xs" style={{ color: '#6b7280' }}>{c.tamanho}</span>
              <StatusBadge status={c.status} />
            </div>
            {c.status === 'locado' && c.locatario && (
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                {c.locatario} · {fmtDate(c.locacao_inicio)} → {fmtDate(c.locacao_fim)}
              </p>
            )}
            {c.status === 'vendido' && c.data_venda && (
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Vendido em {fmtDate(c.data_venda)} · {c.valor_venda != null ? fmtBRL(c.valor_venda) : ''}</p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 min-w-32">
          <p className="text-sm font-bold" style={{ color: saldo >= 0 ? '#16a34a' : '#b91c1c' }}>
            {saldo >= 0 ? '+' : ''}{fmtBRL(saldo)}
          </p>
          <p className="text-[10px]" style={{ color: '#9ca3af' }}>saldo vs break-even</p>
          <div className="mt-1">
            <BreakevenBar pct={breakevenPct} />
          </div>
        </div>
      </button>

      {/* Detalhe expandido */}
      {aberto && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: '#f3f4f6' }}>
          {/* Resumo financeiro */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {[
              { label: 'Custo de aquisição', value: fmtBRL(custoAquisicao), cor: '#374151' },
              { label: 'Despesas lançadas', value: fmtBRL(despesas), cor: '#b91c1c' },
              { label: 'Break-even', value: fmtBRL(breakeven), cor: '#92400e' },
              { label: 'Receita total', value: fmtBRL(receitas), cor: '#16a34a' },
            ].map(k => (
              <div key={k.label} className="rounded-lg p-2.5" style={{ background: '#f8fafc', border: '1px solid #f0f0f0' }}>
                <p className="text-[10px] font-medium" style={{ color: '#6b7280' }}>{k.label}</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: k.cor }}>{k.value}</p>
              </div>
            ))}
          </div>
          {faltaBE > 0 && (
            <p className="text-xs mt-2 font-medium" style={{ color: '#92400e' }}>
              Falta {fmtBRL(faltaBE)} ({breakevenPct != null ? `${Math.round(100 - breakevenPct)}% restante` : ''}) para atingir o break-even
            </p>
          )}
          {saldo > 0 && (
            <p className="text-xs mt-2 font-medium" style={{ color: '#16a34a' }}>
              Break-even atingido · lucro de {fmtBRL(saldo)}
            </p>
          )}

          {/* Status/contrato */}
          <div className="mt-3 flex gap-2">
            <button onClick={() => { setEditandoStatus(o => !o); setAddingLanc(false) }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
              style={{ borderColor: '#bfdbfe', color: '#1d4ed8', background: '#eff6ff' }}>
              ✏️ Status / contrato
            </button>
            <button onClick={() => { setAddingLanc(o => !o); setEditandoStatus(false) }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
              style={{ borderColor: '#a7f3d0', color: '#047857', background: '#ecfdf5' }}>
              + Lançamento
            </button>
          </div>

          {editandoStatus && (
            <ContratoEditor container={c} onClose={() => setEditandoStatus(false)} onSaved={() => setEditandoStatus(false)} />
          )}

          {addingLanc && (
            <LancamentoForm containerId={c.id} onSaved={() => setAddingLanc(false)} />
          )}

          {/* Histórico de lançamentos */}
          {lancamentos.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Lançamentos</p>
              <div className="space-y-1.5">
                {lancamentos.map(l => (
                  <div key={l.id} className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg"
                    style={{ background: l.tipo === 'receita' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${l.tipo === 'receita' ? '#bbf7d0' : '#fecaca'}` }}>
                    <div className="min-w-0">
                      <span className="font-semibold" style={{ color: l.tipo === 'receita' ? '#15803d' : '#b91c1c' }}>
                        {l.tipo === 'receita' ? '+' : '−'} {fmtBRL(l.valor)}
                      </span>
                      <span className="ml-2" style={{ color: '#6b7280' }}>{l.categoria}</span>
                      {l.descricao && <span className="ml-1" style={{ color: '#9ca3af' }}>· {l.descricao}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span style={{ color: '#9ca3af' }}>{fmtDate(l.data)}</span>
                      <button onClick={() => excluirLanc(l.id)} disabled={isPending}
                        className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#9ca3af', background: 'rgba(0,0,0,0.04)' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function FinanceiroPanel({ resumo }: { resumo: Awaited<ReturnType<typeof import('@/app/actions').getResumoFinanceiro>> }) {
  const [filtro, setFiltro] = useState<'todos' | 'locado' | 'disponivel' | 'vendido'>('todos')

  const totReceitas = resumo.reduce((a, r) => a + r.receitas, 0)
  const totDespesas = resumo.reduce((a, r) => a + r.despesas, 0)
  const totCusto = resumo.reduce((a, r) => a + r.custoAquisicao, 0)
  const totBreakeven = resumo.reduce((a, r) => a + r.breakeven, 0)
  const totSaldo = resumo.reduce((a, r) => a + r.saldo, 0)
  const locados = resumo.filter(r => r.container.status === 'locado').length
  const disponiveis = resumo.filter(r => r.container.status === 'disponivel').length
  const vendidos = resumo.filter(r => r.container.status === 'vendido').length

  const visivel = filtro === 'todos' ? resumo : resumo.filter(r => r.container.status === filtro)

  return (
    <div>
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Receita total', value: fmtBRL(totReceitas), cor: '#15803d' },
          { label: 'Despesas totais', value: fmtBRL(totDespesas), cor: '#b91c1c' },
          { label: 'Custo de aquisição', value: fmtBRL(totCusto), cor: '#374151' },
          { label: 'Saldo geral', value: fmtBRL(totSaldo), cor: totSaldo >= 0 ? '#15803d' : '#b91c1c' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e7eb' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b7280' }}>{k.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: k.cor }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtro de status */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {([
          { v: 'todos', label: `Todos (${resumo.length})` },
          { v: 'locado', label: `Locados (${locados})` },
          { v: 'disponivel', label: `Disponíveis (${disponiveis})` },
          { v: 'vendido', label: `Vendidos (${vendidos})` },
        ] as const).map(f => (
          <button key={f.v} onClick={() => setFiltro(f.v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
            style={filtro === f.v
              ? { background: '#1B4F8A', color: '#fff', borderColor: '#1B4F8A' }
              : { background: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista de containers */}
      {visivel.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: '#9ca3af' }}>Nenhum container.</p>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {visivel.map(item => <ContainerCard key={item.container.id} item={item} />)}
        </div>
      )}

      {/* Linha de break-even global */}
      {totBreakeven > 0 && (
        <div className="mt-4 max-w-3xl p-4 rounded-xl" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <p className="text-xs font-semibold" style={{ color: '#92400e' }}>Break-even consolidado da frota</p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
            Custo total (aquisição + despesas): <strong style={{ color: '#374151' }}>{fmtBRL(totBreakeven)}</strong> ·
            Receita total: <strong style={{ color: '#15803d' }}>{fmtBRL(totReceitas)}</strong> ·
            {totSaldo >= 0
              ? <span style={{ color: '#15803d' }}> Lucro de {fmtBRL(totSaldo)}</span>
              : <span style={{ color: '#b91c1c' }}> Falta {fmtBRL(-totSaldo)} para break-even da frota</span>
            }
          </p>
        </div>
      )}
    </div>
  )
}
