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
  novas: number
  titulos: string[]
}

// Usado pelo banner na layout (só aviso): conta as novas solicitações públicas
// (QR Code) ainda aguardando tratativa, com alguns títulos para preview.
export async function getDespachaAlertCounts(): Promise<DespachaAlertCounts | null> {
  const res = await despachaFetch<DespachaTask[]>('/tasks?status=pendente&limit=50')
  if (!res.success) return null

  const novasSolicitacoes = res.data.filter(t => t.source === 'publico' && t.needs_approval)
  return {
    novas: novasSolicitacoes.length,
    titulos: novasSolicitacoes.slice(0, 5).map(t => t.title),
  }
}

export type DespachaBreakdown = { label: string; total: number }
export type DespachaIndicadores = {
  stats: DespachaStats
  porSetor: DespachaBreakdown[]
  porPrestador: DespachaBreakdown[]
}

// Painel de indicadores (read-only): KPIs do /stats + quebras por setor e por
// prestador calculadas a partir da lista de tarefas (até 100 mais recentes).
export async function getDespachaIndicadores(): Promise<DespachaIndicadores | null> {
  const [stats, tarefas, providers] = await Promise.all([
    despachaFetch<DespachaStats>('/stats'),
    despachaFetch<DespachaTask[]>('/tasks?limit=100'),
    getDespachaProviders(),
  ])

  if (!stats.success) return null

  const tasks = tarefas.success ? tarefas.data : []
  const nomePrestador = new Map(providers.map(p => [String(p.id), p.name]))

  const setorMap = new Map<string, number>()
  const prestadorMap = new Map<string, number>()
  for (const t of tasks) {
    const setor = t.sector?.trim() || '— sem setor'
    setorMap.set(setor, (setorMap.get(setor) ?? 0) + 1)
    const prestador = t.assignee_id ? (nomePrestador.get(String(t.assignee_id)) ?? 'Outro') : '— sem prestador'
    prestadorMap.set(prestador, (prestadorMap.get(prestador) ?? 0) + 1)
  }

  const ordenar = (m: Map<string, number>): DespachaBreakdown[] =>
    [...m.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total)

  return { stats: stats.data, porSetor: ordenar(setorMap), porPrestador: ordenar(prestadorMap) }
}
