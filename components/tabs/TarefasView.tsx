'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateDespachaTaskStatus, updateDespachaTaskAssignee } from '@/app/actions'
import type { DespachaTask, DespachaStats, DespachaProvider, DespachaStatus, DespachaUrgency } from '@/lib/despacha/types'

const statusLabel: Record<DespachaStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}
const statusColor: Record<DespachaStatus, { bg: string; color: string; border: string }> = {
  pendente:     { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  em_andamento: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  concluida:    { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  cancelada:    { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
}
const urgencyLabel: Record<DespachaUrgency, string> = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' }
const urgencyColor: Record<DespachaUrgency, { bg: string; color: string; border: string }> = {
  critica: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  alta:    { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  media:   { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  baixa:   { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
}

function Kpi({ label, value, cor }: { label: string; value: string | number; cor?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: cor ?? '#1a2a3a' }}>{value}</p>
    </div>
  )
}

function dataHora(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function TarefasView({
  stats,
  tasks,
  total,
  providers,
  filtroStatus,
  filtroUrgencia,
}: {
  stats: DespachaStats | null
  tasks: DespachaTask[]
  total: number
  providers: DespachaProvider[]
  filtroStatus?: DespachaStatus
  filtroUrgencia?: DespachaUrgency
}) {
  const router = useRouter()
  const [list, setList] = useState(tasks)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const providerName = (id: string | null) => (id ? providers.find(p => p.id === id)?.name ?? id : '—')

  function aplicarFiltros(status?: string, urgency?: string) {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (urgency) p.set('urgency', urgency)
    const qs = p.toString()
    router.push(qs ? `/tarefas?${qs}` : '/tarefas')
  }

  function mudarStatus(taskId: string, status: DespachaStatus) {
    setErro(null)
    startTransition(async () => {
      const res = await updateDespachaTaskStatus(taskId, status)
      if (res.error) setErro(res.error)
      else setList(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    })
  }

  function mudarPrestador(taskId: string, assigneeId: string) {
    setErro(null)
    startTransition(async () => {
      const res = await updateDespachaTaskAssignee(taskId, assigneeId)
      if (res.error) setErro(res.error)
      else setList(prev => prev.map(t => t.id === taskId ? { ...t, assignee_id: assigneeId, status: 'em_andamento' } : t))
    })
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Tarefas (DespachaApp)</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Solicitações, dashboard e notificações do DespachaApp</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <Kpi label="Total" value={stats.total} />
          <Kpi label="Pendentes" value={stats.pendente} cor="#92400e" />
          <Kpi label="Em andamento" value={stats.em_andamento} cor="#1d4ed8" />
          <Kpi label="Concluídas" value={stats.concluida} cor="#047857" />
          <Kpi label="Atrasadas" value={stats.atrasadas} cor={stats.atrasadas > 0 ? '#b91c1c' : '#1a2a3a'} />
          <Kpi label="SLA" value={`${stats.sla_compliance_pct}%`} />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={filtroStatus ?? ''}
          onChange={e => aplicarFiltros(e.target.value || undefined, filtroUrgencia)}
          className="rounded border text-xs px-2 py-1.5 outline-none font-semibold"
          style={{ borderColor: '#d1d5db', color: '#374151' }}
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select
          value={filtroUrgencia ?? ''}
          onChange={e => aplicarFiltros(filtroStatus, e.target.value || undefined)}
          className="rounded border text-xs px-2 py-1.5 outline-none font-semibold"
          style={{ borderColor: '#d1d5db', color: '#374151' }}
        >
          <option value="">Todas as urgências</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <span className="text-xs" style={{ color: '#9ca3af' }}>{total} tarefa{total !== 1 ? 's' : ''}</span>
      </div>

      {erro && <p className="text-xs px-3 py-2 rounded mb-3" style={{ background: '#fee2e2', color: '#b91c1c' }}>{erro}</p>}

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {list.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Nenhuma tarefa encontrada</p>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
            {list.map(t => (
              <div key={t.id} className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>{t.title}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ ...urgencyColor[t.urgency], border: `1px solid ${urgencyColor[t.urgency].border}` }}>
                      {urgencyLabel[t.urgency]}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                    {t.requester}{t.sector ? ` · ${t.sector}` : ''} · prestador: {providerName(t.assignee_id)}
                  </p>
                  {t.description && <p className="text-xs mt-1" style={{ color: '#374151' }}>{t.description}</p>}
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                    Criada {dataHora(t.created_at)}{t.due_date ? ` · vencimento ${dataHora(t.due_date)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={t.assignee_id ?? ''}
                    onChange={e => { if (e.target.value) mudarPrestador(t.id, e.target.value) }}
                    disabled={isPending}
                    className="rounded border text-xs px-2 py-1.5 outline-none font-semibold disabled:opacity-50"
                    style={{ borderColor: '#d1d5db', color: '#374151' }}
                  >
                    <option value="" disabled>Prestador…</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select
                    value={t.status}
                    onChange={e => mudarStatus(t.id, e.target.value as DespachaStatus)}
                    disabled={isPending}
                    className="rounded border text-xs px-2 py-1.5 outline-none font-semibold disabled:opacity-50"
                    style={{ ...statusColor[t.status], borderColor: statusColor[t.status].border }}
                  >
                    <option value="pendente">Pendente</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
