import { despachaFetch } from './client'
import type { DespachaTask, DespachaStats, DespachaProvider, DespachaListParams } from './types'

export async function getDespachaStats(): Promise<DespachaStats | null> {
  const res = await despachaFetch<DespachaStats>('/stats')
  return res.success ? res.data : null
}

function toQuery(params?: DespachaListParams): string {
  if (!params) return ''
  const p = new URLSearchParams()
  if (params.status) p.set('status', params.status)
  if (params.urgency) p.set('urgency', params.urgency)
  if (params.assignee_id) p.set('assignee_id', params.assignee_id)
  if (params.due_from) p.set('due_from', params.due_from)
  if (params.due_to) p.set('due_to', params.due_to)
  p.set('limit', String(params.limit ?? 50))
  p.set('offset', String(params.offset ?? 0))
  const qs = p.toString()
  return qs ? `?${qs}` : ''
}

export async function getDespachaTasks(params?: DespachaListParams): Promise<{ tasks: DespachaTask[]; total: number } | null> {
  const res = await despachaFetch<DespachaTask[]>(`/tasks${toQuery(params)}`)
  if (!res.success) return null
  return { tasks: res.data, total: res.total ?? res.data.length }
}

export async function getDespachaProviders(): Promise<DespachaProvider[]> {
  const res = await despachaFetch<DespachaProvider[]>('/providers')
  return res.success ? res.data : []
}

export type DespachaAlertCounts = {
  urgentes: number
  atrasadas: number
  preview: DespachaTask[]
  novasSolicitacoes: DespachaTask[]
  providers: DespachaProvider[]
}

// Usado pelo banner na layout — mantém o custo baixo (roda em toda navegação):
// 1 chamada de tarefas pendentes serve tanto o alerta de "urgentes" quanto o
// de "novas solicitações via QR Code" (source === 'publico').
export async function getDespachaAlertCounts(): Promise<DespachaAlertCounts | null> {
  const [stats, pendentes, providers] = await Promise.all([
    despachaFetch<DespachaStats>('/stats'),
    despachaFetch<DespachaTask[]>('/tasks?status=pendente&limit=50'),
    getDespachaProviders(),
  ])

  if (!stats.success) return null

  const tasks = pendentes.success ? pendentes.data : []
  const urgentesTasks = tasks.filter(t => t.urgency === 'critica' || t.urgency === 'alta')
  const novasSolicitacoes = tasks.filter(t => t.source === 'publico' && t.needs_approval)

  return {
    urgentes: urgentesTasks.length,
    atrasadas: stats.data.atrasadas,
    preview: urgentesTasks.slice(0, 5),
    novasSolicitacoes,
    providers,
  }
}
