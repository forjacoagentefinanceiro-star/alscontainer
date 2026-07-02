import { despachaFetch } from './client'
import type { DespachaTask, DespachaProvider } from './types'

export async function getDespachaProviders(): Promise<DespachaProvider[]> {
  const res = await despachaFetch<DespachaProvider[]>('/providers')
  return res.success ? res.data : []
}

// ── Aviso de novas solicitações (banner na layout) ───────────────────────────
export type DespachaAlertCounts = {
  novas: number
  titulos: string[]
}

// Só aviso: conta as novas solicitações públicas (QR Code) ainda aguardando
// tratativa, com alguns títulos para preview.
export async function getDespachaAlertCounts(): Promise<DespachaAlertCounts | null> {
  const res = await despachaFetch<DespachaTask[]>('/tasks?status=pendente&limit=50')
  if (!res.success) return null

  const novasSolicitacoes = res.data.filter(t => t.source === 'publico' && t.needs_approval)
  return {
    novas: novasSolicitacoes.length,
    titulos: novasSolicitacoes.slice(0, 5).map(t => t.title),
  }
}

// ── Indicadores por mês (painel read-only) ───────────────────────────────────
export type DespachaBreakdown = { label: string; total: number }
export type DespachaKpis = {
  total: number
  pendente: number
  em_andamento: number
  concluida: number
  cancelada: number
  atrasadas: number
  avg_minutes: number
  sla_compliance_pct: number
}
export type DespachaMesResumo = {
  key: string
  label: string
  total: number
  pendente: number
  em_andamento: number
  concluida: number
  cancelada: number
  atrasadas: number
}
export type DespachaIndicadores = {
  meses: { key: string; label: string }[]
  mesSelecionado: string
  labelSelecionado: string
  kpis: DespachaKpis
  porSetor: DespachaBreakdown[]
  porPrestador: DespachaBreakdown[]
  evolucao: DespachaMesResumo[]
}

const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const ymFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' })

function monthKey(iso: string): string {
  const parts = ymFmt.formatToParts(new Date(iso))
  const y = parts.find(p => p.type === 'year')?.value ?? '0000'
  const m = parts.find(p => p.type === 'month')?.value ?? '00'
  return `${y}-${m}`
}
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MES_ABREV[m - 1] ?? '?'}/${y}`
}

function isOverdue(t: DespachaTask): boolean {
  if (t.status === 'concluida' || t.status === 'cancelada') return false
  const now = Date.now()
  const due = t.due_date ? new Date(t.due_date).getTime() : null
  const sla = t.sla_deadline ? new Date(t.sla_deadline).getTime() : null
  return (due !== null && due < now) || (sla !== null && sla < now)
}

function kpisFromTasks(tasks: DespachaTask[]): DespachaKpis {
  const total = tasks.length
  const pendente = tasks.filter(t => t.status === 'pendente').length
  const em_andamento = tasks.filter(t => t.status === 'em_andamento').length
  const concluida = tasks.filter(t => t.status === 'concluida').length
  const cancelada = tasks.filter(t => t.status === 'cancelada').length
  const atrasadas = tasks.filter(isOverdue).length

  const finished = tasks.filter(t => t.elapsed_minutes)
  const avg_minutes = finished.length
    ? Math.round(finished.reduce((a, t) => a + (t.elapsed_minutes || 0), 0) / finished.length)
    : 0

  const withSla = tasks.filter(t => t.sla_deadline && (t.status === 'concluida' || t.status === 'cancelada'))
  const slaOk = withSla.filter(t => t.completed_at && t.sla_deadline && new Date(t.completed_at) <= new Date(t.sla_deadline)).length
  const sla_compliance_pct = withSla.length ? Math.round((slaOk / withSla.length) * 100) : 100

  return { total, pendente, em_andamento, concluida, cancelada, atrasadas, avg_minutes, sla_compliance_pct }
}

// mesParam: 'YYYY-MM' de um mês existente, 'todos', ou undefined (→ mês mais recente).
export async function getDespachaIndicadores(mesParam?: string): Promise<DespachaIndicadores | null> {
  const [tarefas, providers] = await Promise.all([
    despachaFetch<DespachaTask[]>('/tasks?limit=100'),
    getDespachaProviders(),
  ])
  if (!tarefas.success) return null

  const tasks = tarefas.data
  const nomePrestador = new Map(providers.map(p => [String(p.id), p.name]))

  // meses disponíveis (por data de criação), mais recente primeiro
  const mesesSet = new Set(tasks.map(t => monthKey(t.created_at)))
  const mesesKeys = [...mesesSet].sort().reverse()
  const meses = mesesKeys.map(k => ({ key: k, label: monthLabel(k) }))

  const mesSelecionado = mesParam === 'todos'
    ? 'todos'
    : (mesParam && mesesSet.has(mesParam) ? mesParam : (mesesKeys[0] ?? 'todos'))

  const doMes = mesSelecionado === 'todos'
    ? tasks
    : tasks.filter(t => monthKey(t.created_at) === mesSelecionado)

  const setorMap = new Map<string, number>()
  const prestadorMap = new Map<string, number>()
  for (const t of doMes) {
    const setor = t.sector?.trim() || '— sem setor'
    setorMap.set(setor, (setorMap.get(setor) ?? 0) + 1)
    const prestador = t.assignee_id ? (nomePrestador.get(String(t.assignee_id)) ?? 'Outro') : '— sem prestador'
    prestadorMap.set(prestador, (prestadorMap.get(prestador) ?? 0) + 1)
  }
  const ordenar = (m: Map<string, number>): DespachaBreakdown[] =>
    [...m.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total)

  const evolucao: DespachaMesResumo[] = mesesKeys.map(k => {
    const ts = tasks.filter(t => monthKey(t.created_at) === k)
    const kp = kpisFromTasks(ts)
    return { key: k, label: monthLabel(k), total: kp.total, pendente: kp.pendente, em_andamento: kp.em_andamento, concluida: kp.concluida, cancelada: kp.cancelada, atrasadas: kp.atrasadas }
  })

  return {
    meses,
    mesSelecionado,
    labelSelecionado: mesSelecionado === 'todos' ? 'Todos os meses' : monthLabel(mesSelecionado),
    kpis: kpisFromTasks(doMes),
    porSetor: ordenar(setorMap),
    porPrestador: ordenar(prestadorMap),
    evolucao,
  }
}
