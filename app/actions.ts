'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type SB = Awaited<ReturnType<typeof createClient>>

// horímetro atual registrado no cadastro da máquina (por nome)
async function horimetroDaMaquina(supabase: SB, equipamento: string): Promise<number | null> {
  const { data } = await supabase.from('empilhadeiras').select('horimetro_atual').eq('nome', equipamento).maybeSingle()
  return data?.horimetro_atual ?? null
}

// maior horímetro já lançado considerando o cadastro da máquina E os lançamentos da própria operação
async function baselineHorimetro(supabase: SB, checklistId: string, equipamento: string | undefined): Promise<number | null> {
  let max: number | null = null
  const up = (v: number | null | undefined) => { if (v != null) max = max == null ? Number(v) : Math.max(max, Number(v)) }
  if (equipamento) up(await horimetroDaMaquina(supabase, equipamento))
  const { data: ck } = await supabase.from('checklists').select('horimetro, horimetro_final').eq('id', checklistId).single()
  up(ck?.horimetro); up(ck?.horimetro_final)
  const { data: evs } = await supabase.from('operacao_eventos').select('horimetro').eq('checklist_id', checklistId)
  for (const e of evs ?? []) up(e.horimetro)
  return max
}

// recalcula o horímetro atual da máquina = maior valor entre todos os lançamentos
async function recalcHorimetro(supabase: SB, equipamento: string) {
  const { data: cks } = await supabase.from('checklists').select('id, horimetro, horimetro_final').eq('equipamento', equipamento)
  let max = 0
  const ids: string[] = []
  for (const c of cks ?? []) {
    ids.push(c.id)
    if (c.horimetro != null) max = Math.max(max, Number(c.horimetro))
    if (c.horimetro_final != null) max = Math.max(max, Number(c.horimetro_final))
  }
  if (ids.length) {
    const { data: evs } = await supabase.from('operacao_eventos').select('horimetro').in('checklist_id', ids)
    for (const e of evs ?? []) if (e.horimetro != null) max = Math.max(max, Number(e.horimetro))
  }
  await supabase.from('empilhadeiras').update({ horimetro_atual: max || null }).eq('nome', equipamento)
}

// vizinhos (anterior/próximo com valor) na sequência da operação: inicial → eventos (por hora) → final
async function vizinhosSequencia(supabase: SB, checklistId: string, alvo: 'inicial' | 'final' | string): Promise<{ prev: number | null; next: number | null }> {
  const { data: ck } = await supabase.from('checklists').select('horimetro, horimetro_final').eq('id', checklistId).single()
  const { data: evs } = await supabase.from('operacao_eventos').select('id, horimetro, created_at').eq('checklist_id', checklistId).order('created_at', { ascending: true })
  const seq: { key: string; value: number | null }[] = [{ key: 'inicial', value: ck?.horimetro ?? null }]
  for (const e of evs ?? []) seq.push({ key: e.id, value: e.horimetro ?? null })
  seq.push({ key: 'final', value: ck?.horimetro_final ?? null })
  const idx = seq.findIndex(s => s.key === alvo)
  let prev: number | null = null, next: number | null = null
  for (let i = idx - 1; i >= 0; i--) if (seq[i].value != null) { prev = Number(seq[i].value); break }
  for (let i = idx + 1; i < seq.length; i++) if (seq[i].value != null) { next = Number(seq[i].value); break }
  return { prev, next }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ---- Tipos ----
export type Container = {
  id: string
  user_id: string
  numero: string
  tipo: 'nacional' | 'importado'
  nacionalizado: boolean
  tamanho: string
  fornecedor: string
  data_compra: string | null
  valor_usd: number | null
  cotacao: number | null
  extras_brl: number | null
  valor_brl: number | null
  obs: string
  iso_valido: boolean
  created_at: string
}

export type UserProfile = {
  id: string
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer' | 'operador'
  approved: boolean
  bi_abas: string[] | null // null = vê todas as abas do BI
  created_at: string
}

export type Role = UserProfile['role']

// ---- Checklist de empilhadeira ----
export type ChecklistItem = { item: string; status: 'ok' | 'nok' | 'na'; obs?: string; foto?: string }
export type Checklist = {
  id: string
  user_id: string | null
  operador: string
  equipamento: string
  turno: string
  horimetro: number | null
  itens: ChecklistItem[]
  observacoes: string
  tem_pendencia: boolean
  status: 'aberta' | 'encerrada'
  horimetro_final: number | null
  encerrada_em: string | null
  pendencia_resolvida: boolean
  created_at: string
}

export type OperacaoEvento = {
  id: string
  checklist_id: string
  tipo: 'parada' | 'retorno' | 'encerramento'
  motivo: string | null
  horimetro: number | null
  origem: string
  created_at: string
}

// ---- Perfil do usuário atual ----
export async function getMyProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
  return data as UserProfile | null
}

// ---- CRUD containers (sem filtro user_id — todos aprovados veem tudo) ----
export async function addContainer(payload: Omit<Container, 'id' | 'user_id' | 'created_at'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { error } = await supabase.from('containers').insert({ ...payload, user_id: user.id })
  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

export async function updateContainer(id: string, payload: Partial<Omit<Container, 'id' | 'user_id' | 'created_at'>>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { error } = await supabase.from('containers').update(payload).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

export async function deleteContainer(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { error } = await supabase.from('containers').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

export async function importContainers(items: Omit<Container, 'id' | 'user_id' | 'created_at'>[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', count: 0 }
  const rows = items.map(i => ({ ...i, user_id: user.id }))
  const { error, count } = await supabase.from('containers').insert(rows, { count: 'exact' })
  if (error) return { error: error.message, count: 0 }
  revalidatePath('/')
  return { error: null, count: count ?? items.length }
}

// ---- Gestão de usuários (admin) ----
export async function getUsers(): Promise<UserProfile[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as UserProfile[]
}

export async function approveUser(userId: string, role: Role) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profiles')
    .update({ approved: true, role })
    .eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/usuarios')
  return { error: null }
}

export async function updateUserRole(userId: string, role: Role) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profiles')
    .update({ role })
    .eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/usuarios')
  return { error: null }
}

export async function updateUserBiAbas(userId: string, abas: string[] | null) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profiles')
    .update({ bi_abas: abas })
    .eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/usuarios')
  return { error: null }
}

export async function revokeUser(userId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profiles')
    .update({ approved: false })
    .eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/usuarios')
  return { error: null }
}

// ---- Checklist de empilhadeira ----
// papel do usuário atual (admin/editor veem tudo; demais só o próprio)
async function usuarioEPapel() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, gestor: false }
  const { data } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  const role = data?.role as string | undefined
  return { supabase, user, gestor: role === 'admin' || role === 'editor' }
}

export async function getChecklists(limit = 30): Promise<Checklist[]> {
  const { supabase, user, gestor } = await usuarioEPapel()
  if (!user) return []
  let q = supabase.from('checklists').select('*').order('created_at', { ascending: false }).limit(limit)
  if (!gestor) q = q.eq('user_id', user.id)
  const { data } = await q
  return (data ?? []) as Checklist[]
}

export async function addChecklist(payload: {
  operador: string
  equipamento: string
  turno: string
  horimetro: number | null
  itens: ChecklistItem[]
  observacoes: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const tem_pendencia = payload.itens.some(i => i.status === 'nok')
  if (payload.horimetro != null) {
    const atual = await horimetroDaMaquina(supabase, payload.equipamento)
    if (atual != null && payload.horimetro < atual)
      return { error: `Horímetro ${payload.horimetro} é menor que o último lançado (${atual}) para ${payload.equipamento}.` }
  }
  const { error } = await supabase.from('checklists').insert({ ...payload, user_id: user.id, tem_pendencia })
  if (error) return { error: error.message }
  if (payload.horimetro != null) await recalcHorimetro(supabase, payload.equipamento)
  revalidatePath('/checklist')
  return { error: null }
}

// ---- Operação (checklist aberto + eventos de parada/retorno/encerramento) ----
export async function getOperacoesAbertas(): Promise<{ checklist: Checklist; eventos: OperacaoEvento[] }[]> {
  const { supabase, user, gestor } = await usuarioEPapel()
  if (!user) return []
  let q = supabase.from('checklists').select('*').eq('status', 'aberta').order('created_at', { ascending: false })
  if (!gestor) q = q.eq('user_id', user.id)
  const { data: cks } = await q
  const lista = (cks ?? []) as Checklist[]
  if (!lista.length) return []
  const ids = lista.map(c => c.id)
  const { data: evs } = await supabase.from('operacao_eventos').select('*').in('checklist_id', ids).order('created_at', { ascending: true })
  const eventos = (evs ?? []) as OperacaoEvento[]
  return lista.map(c => ({ checklist: c, eventos: eventos.filter(e => e.checklist_id === c.id) }))
}

export async function addEvento(checklistId: string, tipo: 'parada' | 'retorno', horimetro: number | null, motivo?: string, usoSemChecklist = false) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data: ck } = await supabase.from('checklists').select('equipamento').eq('id', checklistId).single()
  const equip = ck?.equipamento as string | undefined
  if (horimetro != null) {
    const base = await baselineHorimetro(supabase, checklistId, equip)
    if (base != null && horimetro < base) return { error: `Horímetro ${horimetro} é menor que o último lançado (${base}). Só é permitido igual ou maior.` }
  }
  const { error } = await supabase.from('operacao_eventos').insert({ checklist_id: checklistId, tipo, horimetro, motivo: motivo?.trim() || null, origem: 'app', user_id: user.id, uso_sem_checklist: usoSemChecklist })
  if (error) return { error: error.message }
  if (horimetro != null && equip) await recalcHorimetro(supabase, equip)
  revalidatePath('/checklist')
  revalidatePath('/', 'layout')
  return { error: null }
}

export async function encerrarOperacao(checklistId: string, horimetroFinal: number | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data: ck } = await supabase.from('checklists').select('equipamento').eq('id', checklistId).single()
  const equip = ck?.equipamento as string | undefined
  if (horimetroFinal != null) {
    const base = await baselineHorimetro(supabase, checklistId, equip)
    if (base != null && horimetroFinal < base) return { error: `Horímetro ${horimetroFinal} é menor que o último lançado (${base}).` }
  }
  const { error } = await supabase.from('checklists').update({ status: 'encerrada', horimetro_final: horimetroFinal, encerrada_em: new Date().toISOString() }).eq('id', checklistId)
  if (error) return { error: error.message }
  await supabase.from('operacao_eventos').insert({ checklist_id: checklistId, tipo: 'encerramento', horimetro: horimetroFinal, origem: 'app', user_id: user.id })
  if (horimetroFinal != null && equip) await recalcHorimetro(supabase, equip)
  revalidatePath('/checklist')
  return { error: null }
}

// corrigir horímetros lançados — mesmo na edição, nunca menor que o anterior nem maior que o próximo
export async function updateChecklistHorimetro(checklistId: string, campo: 'horimetro' | 'horimetro_final', valor: number | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (valor != null) {
    const { prev, next } = await vizinhosSequencia(supabase, checklistId, campo === 'horimetro' ? 'inicial' : 'final')
    if (prev != null && valor < prev) return { error: `Horímetro ${valor} não pode ser menor que o anterior (${prev}).` }
    if (next != null && valor > next) return { error: `Horímetro ${valor} não pode ser maior que o próximo (${next}).` }
  }
  const { data: ck } = await supabase.from('checklists').select('equipamento').eq('id', checklistId).single()
  const { error } = await supabase.from('checklists').update({ [campo]: valor }).eq('id', checklistId)
  if (error) return { error: error.message }
  if (ck?.equipamento) await recalcHorimetro(supabase, ck.equipamento)
  revalidatePath('/checklist')
  return { error: null }
}

export async function updateEventoHorimetro(eventoId: string, valor: number | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data: ev } = await supabase.from('operacao_eventos').select('checklist_id').eq('id', eventoId).single()
  if (!ev?.checklist_id) return { error: 'Evento não encontrado' }
  if (valor != null) {
    const { prev, next } = await vizinhosSequencia(supabase, ev.checklist_id, eventoId)
    if (prev != null && valor < prev) return { error: `Horímetro ${valor} não pode ser menor que o anterior (${prev}).` }
    if (next != null && valor > next) return { error: `Horímetro ${valor} não pode ser maior que o próximo (${next}).` }
  }
  const { error } = await supabase.from('operacao_eventos').update({ horimetro: valor }).eq('id', eventoId)
  if (error) return { error: error.message }
  const { data: ck } = await supabase.from('checklists').select('equipamento').eq('id', ev.checklist_id).single()
  if (ck?.equipamento) await recalcHorimetro(supabase, ck.equipamento)
  revalidatePath('/checklist')
  return { error: null }
}

// ---- Alertas de desacordo (pendências do checklist, para admin/gestor) ----
export async function getDesacordosAtivos(): Promise<Checklist[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('checklists')
    .select('*')
    .eq('tem_pendencia', true)
    .eq('pendencia_resolvida', false)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as Checklist[]
}

export async function resolverPendencia(checklistId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { error } = await supabase.from('checklists').update({ pendencia_resolvida: true }).eq('id', checklistId)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { error: null }
}

export type UsoSemChecklist = { id: string; equipamento: string; operador: string; horimetro: number | null; created_at: string }

export async function getUsosSemChecklist(): Promise<UsoSemChecklist[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('operacao_eventos')
    .select('id, horimetro, created_at, checklists(equipamento, operador)')
    .eq('uso_sem_checklist', true)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []).map((e: Record<string, unknown>) => {
    const ck = (Array.isArray(e.checklists) ? e.checklists[0] : e.checklists) as { equipamento?: string; operador?: string } | undefined
    return {
      id: e.id as string,
      equipamento: ck?.equipamento ?? '—',
      operador: ck?.operador ?? '—',
      horimetro: (e.horimetro as number | null) ?? null,
      created_at: e.created_at as string,
    }
  })
}

export async function resolverUsoSemChecklist(eventoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { error } = await supabase.from('operacao_eventos').update({ uso_sem_checklist: false }).eq('id', eventoId)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { error: null }
}

// ---- Empilhadeiras (equipamentos do checklist) ----
export type Empilhadeira = { id: string; nome: string; ativo: boolean; horimetro_atual: number | null; created_at: string }

export async function getEmpilhadeiras(): Promise<Empilhadeira[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('empilhadeiras').select('*').order('nome', { ascending: true })
  return (data ?? []) as Empilhadeira[]
}

export async function addEmpilhadeira(nome: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const n = nome.trim()
  if (!n) return { error: 'Informe a identificação do equipamento.' }
  const { error } = await supabase.from('empilhadeiras').insert({ nome: n })
  if (error) return { error: error.message }
  revalidatePath('/checklist')
  return { error: null }
}

export async function updateEmpilhadeira(id: string, nome: string) {
  const supabase = await createClient()
  const n = nome.trim()
  if (!n) return { error: 'Informe a identificação do equipamento.' }
  const { error } = await supabase.from('empilhadeiras').update({ nome: n }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/cadastros')
  revalidatePath('/checklist')
  return { error: null }
}

export async function deleteEmpilhadeira(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('empilhadeiras').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/checklist')
  return { error: null }
}

// ---- Metas de compra ----
export type PurchaseGoal = {
  id: string
  quantidade: number
  orcamento: number
  prazo: string
  created_at: string
  updated_at: string
}

export async function getGoal(): Promise<PurchaseGoal | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('purchase_goals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data as PurchaseGoal | null
}

export async function upsertGoal(payload: { quantidade: number; orcamento: number; prazo: string }) {
  const supabase = await createClient()
  const { data: existing } = await supabase.from('purchase_goals').select('id').limit(1).single()
  if (existing) {
    const { error } = await supabase
      .from('purchase_goals')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('purchase_goals').insert(payload)
    if (error) return { error: error.message }
  }
  revalidatePath('/dashboard')
  return { error: null }
}

// ---- Gerador de Numeração ----
export async function saveSession(data: {
  owner: string
  cat: string
  qty: number
  new_count: number
  dup_count: number
  nums: { ser: string; cd: number; full: string; dup: boolean }[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: session, error } = await supabase
    .from('container_sessions')
    .insert({
      user_id: user.id,
      owner: data.owner, cat: data.cat, qty: data.qty,
      new_count: data.new_count, dup_count: data.dup_count, nums: data.nums,
    })
    .select().single()

  if (error) throw error

  const rows = data.nums.filter(n => !n.dup).map(n => ({
    user_id: user.id,
    container_key: `${data.owner}${data.cat} ${n.ser}`,
    full_number: n.full,
    check_digit: n.cd,
  }))
  if (rows.length > 0) await supabase.from('used_numbers').insert(rows)

  revalidatePath('/')
  return session
}

export async function deleteSession(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  await supabase.from('container_sessions').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/')
}

export async function clearAllHistory() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  await supabase.from('container_sessions').delete().eq('user_id', user.id)
  await supabase.from('used_numbers').delete().eq('user_id', user.id)
  revalidatePath('/')
}
