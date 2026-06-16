'use client'

import { useState, useTransition } from 'react'
import type { PurchaseGoal } from '@/app/actions'
import { upsertGoal } from '@/app/actions'

type Container = { valor_brl: number | null; data_compra: string | null; created_at: string }

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function monthKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ptMonth(key: string) {
  const [y, m] = key.split('-')
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${months[parseInt(m) - 1]}/${y.slice(2)}`
}

export function DashboardView({
  containers,
  goal: initialGoal,
  isAdmin,
}: {
  containers: Container[]
  goal: PurchaseGoal | null
  isAdmin: boolean
}) {
  const [goal, setGoal] = useState(initialGoal)
  const [form, setForm] = useState({
    quantidade: String(initialGoal?.quantidade ?? ''),
    orcamento: String(initialGoal?.orcamento ?? ''),
    prazo: initialGoal?.prazo?.slice(0, 7) ?? '',
  })
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [formError, setFormError] = useState('')

  // ---- Cálculos ----
  const totalUnidades = containers.length
  const totalGasto = containers.reduce((s, c) => s + (c.valor_brl ?? 0), 0)
  const custoMedio = totalUnidades > 0 ? totalGasto / totalUnidades : 0

  const metaQtd = goal?.quantidade ?? 0
  const metaOrc = goal?.orcamento ?? 0
  const prazo = goal?.prazo ? new Date(goal.prazo) : null

  const faltamUnidades = Math.max(0, metaQtd - totalUnidades)
  const orcamentoRestante = metaOrc - totalGasto
  const pctUnidades = metaQtd > 0 ? Math.min(100, Math.round((totalUnidades / metaQtd) * 100)) : 0
  const pctOrcamento = metaOrc > 0 ? Math.min(100, Math.round((totalGasto / metaOrc) * 100)) : 0

  const hoje = new Date()
  const mesesRestantes = prazo
    ? Math.max(1, (prazo.getFullYear() - hoje.getFullYear()) * 12 + (prazo.getMonth() - hoje.getMonth()))
    : 0
  const ritmoNecessario = mesesRestantes > 0 ? Math.ceil(faltamUnidades / mesesRestantes) : faltamUnidades

  const custoProjetadoRestante = faltamUnidades * custoMedio
  const orcamentoSuficiente = orcamentoRestante >= custoProjetadoRestante

  // Meses para o gráfico — últimos 6 que têm dados ou os 6 mais recentes
  const byMonth: Record<string, { qty: number; gasto: number }> = {}
  containers.forEach(c => {
    const key = monthKey(c.data_compra ?? c.created_at)
    if (!byMonth[key]) byMonth[key] = { qty: 0, gasto: 0 }
    byMonth[key].qty++
    byMonth[key].gasto += c.valor_brl ?? 0
  })
  const monthKeys = Object.keys(byMonth).sort().slice(-6)
  const maxQty = Math.max(...monthKeys.map(k => byMonth[k].qty), 1)
  const maxGasto = Math.max(...monthKeys.map(k => byMonth[k].gasto), 1)

  function handleSave() {
    const qty = parseInt(form.quantidade)
    const orc = parseFloat(form.orcamento)
    if (!qty || qty < 1) { setFormError('Informe uma quantidade válida.'); return }
    if (!orc || orc < 1) { setFormError('Informe um orçamento válido.'); return }
    if (!form.prazo) { setFormError('Informe o prazo.'); return }
    setFormError('')
    startTransition(async () => {
      const prazoDate = form.prazo + '-01'
      const res = await upsertGoal({ quantidade: qty, orcamento: orc, prazo: prazoDate })
      if (res.error) { setFormError(res.error); return }
      setGoal(g => ({ ...(g ?? { id: '', created_at: '', updated_at: '' }), quantidade: qty, orcamento: orc, prazo: prazoDate }))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  const noGoal = !goal

  return (
    <div className="space-y-4">

      {/* Cards de topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Unidades */}
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e7eb', borderLeft: '4px solid #1B4F8A' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6b7280' }}>Meta de unidades</p>
          <p className="text-2xl font-bold" style={{ color: '#1a2a3a' }}>
            {totalUnidades}<span className="text-sm font-normal text-gray-400"> / {metaQtd || '—'}</span>
          </p>
          {goal && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1" style={{ color: '#9ca3af' }}>
                <span>{pctUnidades}% concluído</span>
                <span>{faltamUnidades} restam</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: '#f3f4f6' }}>
                <div className="h-2 rounded-full transition-all" style={{ width: `${pctUnidades}%`, background: '#1B4F8A' }} />
              </div>
            </div>
          )}
        </div>

        {/* Orçamento */}
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e7eb', borderLeft: '4px solid #7DC242' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6b7280' }}>Orçamento</p>
          <p className="text-lg font-bold" style={{ color: '#1a2a3a' }}>{fmtBRL(totalGasto)}</p>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>de {goal ? fmtBRL(metaOrc) : '—'}</p>
          {goal && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1" style={{ color: '#9ca3af' }}>
                <span>{pctOrcamento}% usado</span>
                <span>{fmtBRL(orcamentoRestante)} livre</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: '#f3f4f6' }}>
                <div className="h-2 rounded-full transition-all" style={{ width: `${pctOrcamento}%`, background: '#7DC242' }} />
              </div>
            </div>
          )}
        </div>

        {/* Ritmo necessário */}
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e7eb', borderLeft: '4px solid #f59e0b' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6b7280' }}>Ritmo necessário</p>
          <p className="text-2xl font-bold" style={{ color: '#1a2a3a' }}>
            {goal ? ritmoNecessario : '—'}
            {goal && <span className="text-sm font-normal text-gray-400"> /mês</span>}
          </p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
            {goal ? `${mesesRestantes} mes${mesesRestantes !== 1 ? 'es' : ''} até o prazo` : 'Defina uma meta abaixo'}
          </p>
        </div>

        {/* Custo médio */}
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e7eb', borderLeft: '4px solid #7DC242' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6b7280' }}>Custo médio/container</p>
          <p className="text-lg font-bold" style={{ color: '#1a2a3a' }}>
            {totalUnidades > 0 ? fmtBRL(custoMedio) : '—'}
          </p>
          {goal && totalUnidades > 0 && (
            <div className="mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={orcamentoSuficiente
                  ? { background: '#f0fff4', color: '#166534', border: '1px solid #bbf7d0' }
                  : { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                {orcamentoSuficiente ? '✓ Orçamento suficiente' : '✗ Orçamento insuficiente'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Gráfico de barras por mês */}
        <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #e5e7eb' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: '#1a2a3a' }}>Compras por mês</p>

          {monthKeys.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Nenhum container cadastrado ainda</p>
          ) : (
            <>
              <div className="flex items-end gap-3" style={{ height: 120 }}>
                {monthKeys.map(k => {
                  const d = byMonth[k]
                  const hQty = Math.round((d.qty / maxQty) * 90)
                  const hGasto = Math.round((d.gasto / maxGasto) * 90)
                  return (
                    <div key={k} className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex items-end gap-1 w-full justify-center" style={{ height: 96 }}>
                        <div title={`${d.qty} un.`} style={{ width: 14, height: hQty, background: '#1B4F8A', borderRadius: '3px 3px 0 0', minHeight: 4 }} />
                        <div title={fmtBRL(d.gasto)} style={{ width: 14, height: hGasto, background: '#7DC242', borderRadius: '3px 3px 0 0', minHeight: 4 }} />
                      </div>
                      <span className="text-xs" style={{ color: '#9ca3af', fontSize: 10 }}>{ptMonth(k)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-3">
                <div className="flex items-center gap-2 text-xs" style={{ color: '#6b7280' }}>
                  <div style={{ width: 10, height: 10, background: '#1B4F8A', borderRadius: 2 }} />
                  Unidades
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: '#6b7280' }}>
                  <div style={{ width: 10, height: 10, background: '#7DC242', borderRadius: 2 }} />
                  Gasto (R$)
                </div>
              </div>
            </>
          )}
        </div>

        {/* Insights */}
        <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #e5e7eb' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: '#1a2a3a' }}>Análise de suficiência</p>

          {noGoal ? (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280' }}>
              {isAdmin ? 'Defina uma meta na seção abaixo para ver a análise.' : 'Nenhuma meta definida ainda. Solicite ao administrador.'}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Progresso de unidades */}
              <div className="rounded-lg px-4 py-3 text-xs leading-relaxed"
                style={pctUnidades >= 100
                  ? { background: '#f0fff4', color: '#166534', border: '1px solid #bbf7d0' }
                  : { background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                {pctUnidades >= 100
                  ? `✓ Meta de ${metaQtd} containers atingida!`
                  : `📦 ${totalUnidades} de ${metaQtd} containers comprados — faltam ${faltamUnidades} unidades.`}
              </div>

              {/* Ritmo */}
              <div className="rounded-lg px-4 py-3 text-xs leading-relaxed"
                style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
                🕐 Prazo: <strong>{prazo?.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong>.
                {' '}Faltam <strong>{mesesRestantes} mes{mesesRestantes !== 1 ? 'es' : ''}</strong> e{' '}
                <strong>{faltamUnidades} containers</strong> — precisa comprar{' '}
                <strong>{ritmoNecessario}/mês</strong> para cumprir a meta.
              </div>

              {/* Orçamento */}
              <div className="rounded-lg px-4 py-3 text-xs leading-relaxed"
                style={orcamentoSuficiente
                  ? { background: '#f0fff4', color: '#166534', border: '1px solid #bbf7d0' }
                  : { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                {orcamentoSuficiente
                  ? `✓ Orçamento restante (${fmtBRL(orcamentoRestante)}) cobre os ${faltamUnidades} containers restantes com base no custo médio de ${fmtBRL(custoMedio)}.`
                  : `✗ Orçamento restante (${fmtBRL(orcamentoRestante)}) pode ser insuficiente. Projeção para ${faltamUnidades} containers: ${fmtBRL(custoProjetadoRestante)}.`}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formulário de meta — só admin */}
      {isAdmin && (
        <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #e5e7eb' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#1a2a3a' }}>
            {goal ? 'Atualizar meta' : 'Definir meta de compra'}
          </p>
          <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
            Os cálculos do dashboard são atualizados automaticamente
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>
                Quantidade de containers
              </label>
              <input
                type="number" min="1" value={form.quantidade}
                onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
                className="w-full rounded border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: '#d1d5db', color: '#374151' }}
                onFocus={e => e.currentTarget.style.borderColor = '#1B4F8A'}
                onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
                placeholder="Ex: 24"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>
                Orçamento total (R$)
              </label>
              <input
                type="number" min="1" step="1000" value={form.orcamento}
                onChange={e => setForm(f => ({ ...f, orcamento: e.target.value }))}
                className="w-full rounded border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: '#d1d5db', color: '#374151' }}
                onFocus={e => e.currentTarget.style.borderColor = '#1B4F8A'}
                onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
                placeholder="Ex: 2000000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>
                Prazo (mês/ano)
              </label>
              <input
                type="month" value={form.prazo}
                onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
                className="w-full rounded border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: '#d1d5db', color: '#374151' }}
                onFocus={e => e.currentTarget.style.borderColor = '#1B4F8A'}
                onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
              />
            </div>
          </div>

          {formError && (
            <div className="mt-3 rounded px-3 py-2 text-xs" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
              {formError}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave} disabled={isPending}
              className="px-5 py-2.5 rounded text-sm font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: '#1B4F8A' }}>
              {isPending ? 'Salvando...' : goal ? 'Atualizar meta' : 'Salvar meta'}
            </button>
            {saved && (
              <span className="text-xs font-medium" style={{ color: '#166534' }}>✓ Meta salva com sucesso!</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
