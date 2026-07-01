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

export type DespachaAlertCounts = { urgentes: number; atrasadas: number; preview: DespachaTask[] }

// Usado pelo banner na layout — mantém o custo baixo (roda em toda navegação).
export async function getDespachaAlertCounts(): Promise<DespachaAlertCounts | null> {
  const [stats, criticas, altas] = await Promise.all([
    despachaFetch<DespachaStats>('/stats'),
    despachaFetch<DespachaTask[]>('/tasks?status=pendente&urgency=critica&limit=5'),
    despachaFetch<DespachaTask[]>('/tasks?status=pendente&urgency=alta&limit=5'),
  ])

  if (!stats.success) return null

  const totalUrgentes = (criticas.success ? criticas.total ?? 0 : 0) + (altas.success ? altas.total ?? 0 : 0)
  const preview = [
    ...(criticas.success ? criticas.data : []),
    ...(altas.success ? altas.data : []),
  ].slice(0, 5)

  return { urgentes: totalUrgentes, atrasadas: stats.data.atrasadas, preview }
}
