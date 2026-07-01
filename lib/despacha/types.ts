export type DespachaUrgency = 'critica' | 'alta' | 'media' | 'baixa'
export type DespachaStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'

export type DespachaTask = {
  id: string
  title: string
  description: string | null
  requester: string
  assignee_id: string | null
  sector: string | null
  urgency: DespachaUrgency
  status: DespachaStatus
  due_date: string | null
  sla_deadline: string | null
  completed_at: string | null
  started_at: string | null
  created_at: string
  elapsed_minutes: number | null
  client_name: string | null
  client_address: string | null
  task_type: string | null
  client_id: string | null
  source: string | null
  requester_phone: string | null
  requester_sector: string | null
  category: string | null
  notes: string | null
  photos: string | null
  needs_approval: boolean
}

export type DespachaProvider = {
  id: string
  name: string
  sector: string | null
  active: number
  chat_id: string | null
}

export type DespachaStats = {
  total: number
  pendente: number
  em_andamento: number
  concluida: number
  cancelada: number
  atrasadas: number
  avg_minutes: number
  sla_compliance_pct: number
}

export type DespachaListParams = {
  status?: DespachaStatus
  urgency?: DespachaUrgency
  assignee_id?: string
  due_from?: string
  due_to?: string
  limit?: number
  offset?: number
}
