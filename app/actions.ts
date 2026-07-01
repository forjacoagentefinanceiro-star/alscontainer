'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient, OPERADOR_DOMINIO } from '@/lib/supabase/admin'
import { notificarTelegram } from '@/lib/telegram'
import { despachaFetch } from '@/lib/despacha/client'
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

// maior horímetro da máquina considerando TODOS os checklists/eventos, exceto o checklist informado —
// é a base correta para recalcular o "horas_gap" de um evento de abertura depois de uma correção
async function baselineExcluindoChecklist(supabase: SB, equipamento: string, checklistIdExcluir: string): Promise<number> {
  const { data: cks } = await supabase.from('checklists').select('id, horimetro, horimetro_final').eq('equipamento', equipamento).neq('id', checklistIdExcluir)
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
  return max
}

// recalcula o horas_gap do evento de "abertura" (gap) de um checklist a partir do horímetro corrigido
async function recalcGapAbertura(supabase: SB, checklistId: string, equipamento: string | undefined, novoHorimetroInicial: number | null) {
  if (!equipamento) return
  const { data: abertura } = await supabase.from('operacao_eventos').select('id').eq('checklist_id', checklistId).eq('tipo', 'abertura').maybeSingle()
  if (!abertura) return
  const baseline = await baselineExcluindoChecklist(supabase, equipamento, checklistId)
  const novoGap = novoHorimetroInicial != null && novoHorimetroInicial > baseline ? Math.round((novoHorimetroInicial - baseline) * 10) / 10 : 0
  await supabase.from('operacao_eventos').update({ horas_gap: novoGap }).eq('id', abertura.id)
}

// horímetro do último abastecimento (evento com litros) da máquina — base para o cálculo de consumo
async function ultimoAbastecimentoHorimetro(supabase: SB, equipamento: string): Promise<number | null> {
  const { data: cks } = await supabase.from('checklists').select('id').eq('equipamento', equipamento)
  const ids = (cks ?? []).map(c => c.id)
  if (!ids.length) return null
  const { data: evs } = await supabase.from('operacao_eventos').select('horimetro').in('checklist_id', ids).not('litros', 'is', null).order('created_at', { ascending: false }).limit(1)
  return (evs?.[0]?.horimetro as number | null) ?? null
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
  numero: number
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
  tipo: 'parada' | 'retorno' | 'encerramento' | 'problema' | 'abertura'
  motivo: string | null
  horimetro: number | null
  origem: string
  abastecimento?: boolean
  litros?: number | null
  consumo_lh?: number | null
  descricao?: string | null
  parado?: boolean
  fotos?: string[] | null
  resolvido?: boolean
  prestador?: string | null
  acionado_em?: string | null
  chegada_em?: string | null
  chegada_horimetro?: number | null
  liberado_em?: string | null
  liberado_horimetro?: number | null
  horas_gap?: number | null
  gap_confirmado?: boolean | null
  editado_em?: string | null
  excluir_indicadores?: boolean | null
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

async function souAdmin(): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  const { data } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  return { ok: data?.role === 'admin' }
}

// Cria um operador sem e-mail: gera usuario@als.local internamente; operador loga só com o usuário.
export async function criarOperador(nome: string, usuario: string, senha: string, exigirTroca = true) {
  if (!(await souAdmin()).ok) return { error: 'Apenas administradores podem criar operadores.' }
  const u = usuario.trim().toLowerCase().replace(/\s+/g, '')
  if (!nome.trim()) return { error: 'Informe o nome do operador.' }
  if (!u || !/^[a-z0-9._-]+$/.test(u)) return { error: 'Usuário inválido (use letras, números, ponto, hífen ou _).' }
  if (senha.length < 6) return { error: 'A senha deve ter ao menos 6 caracteres.' }

  const email = `${u}@${OPERADOR_DOMINIO}`
  const admin = createAdminClient()
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: senha, email_confirm: true, user_metadata: { name: nome.trim(), usuario: u },
  })
  if (error) return { error: error.message.includes('already') ? `O usuário "${u}" já existe.` : error.message }
  const id = created.user?.id
  if (!id) return { error: 'Falha ao criar o usuário.' }
  const { error: pErr } = await admin.from('user_profiles').upsert({ id, email, name: nome.trim(), role: 'operador', approved: true, must_change_password: exigirTroca })
  if (pErr) return { error: pErr.message }
  revalidatePath('/usuarios')
  return { error: null, usuario: u }
}

export async function testarAlertaTelegram() {
  if (!(await souAdmin()).ok) return { error: 'Apenas administradores.' }
  if (!process.env.TELEGRAM_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return { error: 'TELEGRAM_TOKEN/TELEGRAM_CHAT_ID não configurados na Vercel.' }
  }
  const hora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  await notificarTelegram(`✅ Teste — alerta do ALS Depot está funcionando (${hora}).`)
  return { error: null }
}

// Troca a senha do próprio usuário (1º acesso obrigatório) e limpa a flag de troca.
export async function trocarMinhaSenha(novaSenha: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (novaSenha.length < 6) return { error: 'A senha deve ter ao menos 6 caracteres.' }
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: novaSenha })
  if (error) return { error: error.message }
  await admin.from('user_profiles').update({ must_change_password: false }).eq('id', user.id)
  revalidatePath('/', 'layout')
  return { error: null }
}

export async function redefinirSenhaOperador(userId: string, novaSenha: string) {
  if (!(await souAdmin()).ok) return { error: 'Apenas administradores.' }
  if (novaSenha.length < 6) return { error: 'A senha deve ter ao menos 6 caracteres.' }
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password: novaSenha })
  if (error) return { error: error.message }
  await admin.from('user_profiles').update({ must_change_password: true }).eq('id', userId)
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

// ---- Meta de faturamento do mês (BI) ----
// define a meta de um mês específico (qualquer mês, não só o atual — útil para navegar e ajustar meses anteriores)
export async function setMetaMes(ano: number, mes: number, valor: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data: prof } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  const role = prof?.role as string | undefined
  if (role !== 'admin' && role !== 'editor') return { error: 'Apenas admin/editor podem definir a meta.' }
  if (!Number.isFinite(valor) || valor <= 0) return { error: 'Informe um valor de meta válido.' }
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) return { error: 'Mês/ano inválido.' }
  const { error } = await supabase.from('bi_metas').upsert({ ano, mes, valor }, { onConflict: 'ano,mes' })
  if (error) return { error: error.message }
  revalidatePath('/bi')
  return { error: null }
}

// ---- Configuração do ciclo de equipamentos (dia de início, meta de horas) ----
export type ConfigCiclo = { metaHoras: number; diaInicio: number }

export async function getConfigCiclo(): Promise<ConfigCiclo> {
  const supabase = await createClient()
  const { data } = await supabase.from('config_equipamentos').select('horas_meta_ciclo, dia_inicio_ciclo').eq('id', 1).single()
  const row = data as Record<string, unknown> | null
  return {
    metaHoras: Number(row?.horas_meta_ciclo ?? 0),
    diaInicio: Number(row?.dia_inicio_ciclo ?? 23),
  }
}

export async function setConfigCiclo(metaHoras: number, diaInicio: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data: prof } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  const role = (prof as Record<string, unknown> | null)?.role as string | undefined
  if (role !== 'admin' && role !== 'editor') return { error: 'Sem permissão.' }
  if (!Number.isFinite(metaHoras) || metaHoras < 0) return { error: 'Meta de horas inválida.' }
  if (!Number.isInteger(diaInicio) || diaInicio < 1 || diaInicio > 28) return { error: 'Dia de início deve ser entre 1 e 28.' }
  const { error } = await supabase.from('config_equipamentos').upsert({ id: 1, horas_meta_ciclo: metaHoras, dia_inicio_ciclo: diaInicio }, { onConflict: 'id' })
  if (error) return { error: error.message }
  revalidatePath('/equipamentos/indicadores')
  revalidatePath('/equipamentos/relatorios')
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
  turno?: string
  horimetro: number | null
  itens: ChecklistItem[]
  observacoes: string
  parado?: boolean | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const itensNok = payload.itens.filter(i => i.status === 'nok')
  const tem_pendencia = itensNok.length > 0
  if (tem_pendencia && payload.parado == null) return { error: 'Indique se o equipamento vai ficar parado ou operando aguardando manutenção.' }
  // turno derivado do horário de Brasília (não é mais escolhido no formulário)
  const horaBR = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()))
  const turno = payload.turno?.trim() || (horaBR < 12 ? 'Manhã' : horaBR < 18 ? 'Tarde' : 'Noite')
  // não permite 2 operações abertas para o mesmo equipamento
  const { data: jaAberta } = await supabase.from('checklists').select('id').eq('equipamento', payload.equipamento).eq('status', 'aberta').limit(1)
  if (jaAberta?.length) return { error: `Já existe um checklist aberto para ${payload.equipamento}. Encerre a operação atual antes de abrir outro.` }
  let gapHoras: number | null = null
  let gapDe: number | null = null
  if (payload.horimetro != null) {
    const atual = await horimetroDaMaquina(supabase, payload.equipamento)
    if (atual != null && payload.horimetro < atual)
      return { error: `Horímetro ${payload.horimetro} é menor que o último lançado (${atual}) para ${payload.equipamento}.` }
    // horímetro inicial maior que o último lançado = a máquina rodou entre o fim da operação anterior e esta abertura, sem checklist algum cobrindo o período
    if (atual != null && payload.horimetro > atual) { gapHoras = Math.round((payload.horimetro - atual) * 10) / 10; gapDe = atual }
  }
  const { parado, ...checklistPayload } = payload
  const { data: novo, error } = await supabase.from('checklists').insert({ ...checklistPayload, turno, user_id: user.id, tem_pendencia }).select('id').single()
  if (error) return { error: error.message }
  if (payload.horimetro != null) await recalcHorimetro(supabase, payload.equipamento)

  // avisa o admin: máquina pode ter rodado sem checklist entre as operações
  if (gapHoras != null && gapHoras > 0 && novo?.id) {
    await supabase.from('operacao_eventos').insert({
      checklist_id: novo.id, tipo: 'abertura', horimetro: payload.horimetro,
      motivo: `Horímetro inicial (${payload.horimetro}) maior que o final do checklist anterior (${gapDe}) — possível uso sem checklist de ${gapHoras}h.`,
      uso_sem_checklist: true, horas_gap: gapHoras, origem: 'app', user_id: user.id,
    })
  }

  // item(ns) em desacordo: tratado igual ao "Reportar problema" (mesma tratativa: acionar prestador → chegada → liberar)
  if (tem_pendencia && novo?.id) {
    const descricao = `Item(ns) em desacordo no checklist: ${itensNok.map(i => i.obs ? `${i.item} (${i.obs})` : i.item).join('; ')}`
    const fotos = itensNok.map(i => i.foto).filter((f): f is string => !!f)
    await supabase.from('operacao_eventos').insert({
      checklist_id: novo.id, tipo: 'problema', descricao, parado: payload.parado, fotos, horimetro: payload.horimetro, origem: 'app', user_id: user.id,
    })
    if (payload.parado) {
      const hora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      await notificarTelegram(
        `⛔ MÁQUINA PARADA — item em desacordo no checklist\n\nEquipamento: ${payload.equipamento}\nOperador: ${payload.operador}\nHorário: ${hora}\nHorímetro: ${payload.horimetro ?? '—'}\n${descricao}\n\nAbra o app para acionar o prestador.`
      )
    }
  }

  revalidatePath('/checklist')
  revalidatePath('/historico')
  revalidatePath('/', 'layout')
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

export type ResumoEquipamentos = {
  emOperacao: number
  totalEquip: number
  ociosos: string[]
  checklistsHoje: number
  desacordos: number
  usosSemChecklist: number
  abertas: { id: string; equipamento: string; operador: string; created_at: string; horimetro: number | null; status: 'operando' | 'parado' | 'atenção' }[]
  usosDetalhe: UsoSemChecklist[]
}

export async function getResumoEquipamentos(): Promise<ResumoEquipamentos | null> {
  const { supabase, user } = await usuarioEPapel()
  if (!user) return null
  // início do dia no fuso de Brasília
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const inicioDia = `${ymd}T00:00:00-03:00`

  const [emp, abertasRes, hojeRes, desRes, usosRes] = await Promise.all([
    supabase.from('empilhadeiras').select('nome'),
    supabase.from('checklists').select('id, equipamento, operador, created_at, horimetro').eq('status', 'aberta').order('created_at', { ascending: false }),
    supabase.from('checklists').select('id', { count: 'exact', head: true }).gte('created_at', inicioDia),
    supabase.from('checklists').select('id', { count: 'exact', head: true }).eq('tem_pendencia', true).eq('pendencia_resolvida', false),
    supabase.from('operacao_eventos').select('id, checklist_id, horimetro, motivo, horas_gap, created_at, checklists(equipamento, operador)').eq('uso_sem_checklist', true).order('created_at', { ascending: false }).limit(50),
  ])

  const equipamentos = (emp.data ?? []).map(e => e.nome as string)
  const abertasRaw = abertasRes.data ?? []
  const abertasIds = abertasRaw.map(c => c.id as string)
  let problemasAbertos: { checklist_id: string; parado: boolean | null }[] = []
  if (abertasIds.length) {
    const { data: probs } = await supabase.from('operacao_eventos').select('checklist_id, parado').eq('tipo', 'problema').eq('resolvido', false).in('checklist_id', abertasIds)
    problemasAbertos = probs ?? []
  }
  const abertas: ResumoEquipamentos['abertas'] = abertasRaw.map(c => {
    const probsC = problemasAbertos.filter(p => p.checklist_id === c.id)
    const status = probsC.some(p => p.parado) ? 'parado' : probsC.length ? 'atenção' : 'operando'
    return { id: c.id as string, equipamento: c.equipamento as string, operador: c.operador as string, created_at: c.created_at as string, horimetro: c.horimetro as number | null, status }
  })
  const operando = new Set(abertas.map(a => a.equipamento))
  const usosDetalhe: UsoSemChecklist[] = (usosRes.data ?? []).map((e: Record<string, unknown>) => {
    const ck = (Array.isArray(e.checklists) ? e.checklists[0] : e.checklists) as { equipamento?: string; operador?: string } | undefined
    return {
      id: e.id as string,
      checklist_id: e.checklist_id as string,
      equipamento: ck?.equipamento ?? '—',
      operador: ck?.operador ?? '—',
      horimetro: (e.horimetro as number | null) ?? null,
      motivo: (e.motivo as string | null) ?? null,
      horas_gap: (e.horas_gap as number | null) ?? null,
      created_at: e.created_at as string,
    }
  })
  return {
    emOperacao: abertas.length,
    totalEquip: equipamentos.length,
    ociosos: equipamentos.filter(n => !operando.has(n)),
    checklistsHoje: hojeRes.count ?? 0,
    desacordos: desRes.count ?? 0,
    usosSemChecklist: usosDetalhe.length,
    abertas,
    usosDetalhe,
  }
}

// ---- Dashboard de indicadores das máquinas (frota + por equipamento) ----
export type IndicadorMaquina = {
  equipamento: string
  horimetroAtual: number | null
  horasTrabalhadas: number
  horasSemChecklist: number
  litrosTotal: number
  consumoMedio: number | null
  problemas: number
  problemasParado: number
  paradasResolvidas: number
  tempoParadoMin: number
  tempoMedioParadaMin: number | null
  tempoRespostaMedioMin: number | null
  utilizacaoPct: number | null
  pendenciaPct: number | null
}

export type DashboardEquipamentos = {
  totais: {
    horasTrabalhadas: number
    horasSemChecklist: number
    litrosTotal: number
    consumoMedio: number | null
    problemas: number
    problemasParado: number
    tempoParadoMin: number
    tempoRespostaMedioMin: number | null
    utilizacaoPct: number | null
  }
  maquinas: IndicadorMaquina[]
}

// média ponderada do consumo: soma dos litros ÷ soma das horas entre abastecimentos (cada um já traz consumo_lh = litros ÷ (horímetro atual − horímetro do abastecimento anterior))
function consumoPonderado(abastecimentos: { litros: number | null; consumo_lh: number | null }[]): number | null {
  let somaLitros = 0, somaHoras = 0
  for (const e of abastecimentos) {
    if (e.litros == null || e.consumo_lh == null || e.consumo_lh <= 0) continue
    somaLitros += Number(e.litros)
    somaHoras += Number(e.litros) / Number(e.consumo_lh)
  }
  return somaHoras > 0 ? Math.round((somaLitros / somaHoras) * 10) / 10 : null
}

export async function getDashboardEquipamentos(inicio: string | null, fim: string | null = null): Promise<DashboardEquipamentos> {
  const { supabase, user } = await usuarioEPapel()
  const vazio: DashboardEquipamentos = { totais: { horasTrabalhadas: 0, horasSemChecklist: 0, litrosTotal: 0, consumoMedio: null, problemas: 0, problemasParado: 0, tempoParadoMin: 0, tempoRespostaMedioMin: null, utilizacaoPct: null }, maquinas: [] }
  if (!user) return vazio

  const { data: emp } = await supabase.from('empilhadeiras').select('nome, horimetro_atual')
  let q = supabase.from('checklists').select('id, equipamento, horimetro, horimetro_final, tem_pendencia, created_at')
  if (inicio) q = q.gte('created_at', inicio)
  if (fim) q = q.lt('created_at', fim)
  const { data: cksData } = await q
  const checklists = cksData ?? []
  const ids = checklists.map(c => c.id)

  let eventos: { checklist_id: string; tipo: string; litros: number | null; consumo_lh: number | null; parado: boolean | null; acionado_em: string | null; chegada_em: string | null; liberado_em: string | null; horas_gap: number | null; gap_confirmado: boolean | null; excluir_indicadores: boolean | null; created_at: string }[] = []
  if (ids.length) {
    const { data: evs } = await supabase.from('operacao_eventos')
      .select('checklist_id, tipo, litros, consumo_lh, parado, acionado_em, chegada_em, liberado_em, horas_gap, gap_confirmado, excluir_indicadores, created_at')
      .in('checklist_id', ids)
    eventos = evs ?? []
  }

  const nomes = [...new Set([...(emp ?? []).map(e => e.nome as string), ...checklists.map(c => c.equipamento as string)])].sort((a, b) => a.localeCompare(b))
  const horimetroAtualMap = new Map((emp ?? []).map(e => [e.nome as string, e.horimetro_atual as number | null]))
  const fimMs = fim ? new Date(fim).getTime() : Date.now()
  const periodoHoras = inicio ? (fimMs - new Date(inicio).getTime()) / 3600000 : null

  const maquinas: IndicadorMaquina[] = nomes.map(nome => {
    const cksM = checklists.filter(c => c.equipamento === nome)
    const idsM = new Set(cksM.map(c => c.id))
    const evsM = eventos.filter(e => idsM.has(e.checklist_id))

    const horasChecklist = cksM.reduce((acc, c) => acc + (c.horimetro != null && c.horimetro_final != null ? Math.max(0, Number(c.horimetro_final) - Number(c.horimetro)) : 0), 0)
    // horas confirmadas pelo admin como uso real da máquina sem checklist (gap entre operações) — entram no total de horas trabalhadas
    const horasSemChecklist = evsM.filter(e => e.gap_confirmado === true).reduce((acc, e) => acc + Number(e.horas_gap ?? 0), 0)
    const horasTrabalhadas = horasChecklist + horasSemChecklist

    const abastecimentos = evsM.filter(e => e.litros != null)
    const litrosTotal = abastecimentos.reduce((a, e) => a + Number(e.litros), 0)
    // consumo médio = média ponderada do consumo de cada abastecimento (litros do abastecimento ÷ horímetro atual − horímetro do abastecimento anterior)
    const consumoMedio = consumoPonderado(abastecimentos)

    const probs = evsM.filter(e => e.tipo === 'problema')
    const problemasParado = probs.filter(e => e.parado).length
    // eventos marcados pelo admin para não contar nos indicadores (ex.: tratativa ainda em andamento) — continuam no histórico do checklist
    const probsIndic = probs.filter(e => !e.excluir_indicadores)

    let tempoParadoMin = 0
    let paradasResolvidas = 0
    for (const p of probsIndic) {
      if (!p.liberado_em) continue
      const inicio = p.parado ? p.created_at : (p.chegada_em ?? p.created_at)
      const min = (new Date(p.liberado_em).getTime() - new Date(inicio).getTime()) / 60000
      if (min > 0) { tempoParadoMin += min; paradasResolvidas++ }
    }
    const tempoMedioParadaMin = paradasResolvidas > 0 ? Math.round(tempoParadoMin / paradasResolvidas) : null

    const respostas = probsIndic.filter(e => e.acionado_em && e.chegada_em).map(e => (new Date(e.chegada_em as string).getTime() - new Date(e.acionado_em as string).getTime()) / 60000)
    const tempoRespostaMedioMin = respostas.length ? Math.round(respostas.reduce((a, b) => a + b, 0) / respostas.length) : null

    const utilizacaoPct = periodoHoras ? Math.round((horasTrabalhadas / periodoHoras) * 1000) / 10 : null
    const comPendencia = cksM.filter(c => c.tem_pendencia).length
    const pendenciaPct = cksM.length ? Math.round((comPendencia / cksM.length) * 1000) / 10 : null

    return {
      equipamento: nome,
      horimetroAtual: horimetroAtualMap.get(nome) ?? null,
      horasTrabalhadas: Math.round(horasTrabalhadas * 10) / 10,
      horasSemChecklist: Math.round(horasSemChecklist * 10) / 10,
      litrosTotal: Math.round(litrosTotal * 10) / 10,
      consumoMedio,
      problemas: probs.length,
      problemasParado,
      paradasResolvidas,
      tempoParadoMin: Math.round(tempoParadoMin),
      tempoMedioParadaMin,
      tempoRespostaMedioMin,
      utilizacaoPct,
      pendenciaPct,
    }
  })

  const soma = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const media = (arr: number[]) => (arr.length ? Math.round((soma(arr) / arr.length) * 100) / 100 : null)

  const respostasValidas = maquinas.filter(m => m.tempoRespostaMedioMin != null).map(m => m.tempoRespostaMedioMin as number)
  const horasTrabalhadasTot = Math.round(soma(maquinas.map(m => m.horasTrabalhadas)) * 10) / 10
  const horasSemChecklistTot = Math.round(soma(maquinas.map(m => m.horasSemChecklist)) * 10) / 10
  const litrosTotalTot = Math.round(soma(maquinas.map(m => m.litrosTotal)) * 10) / 10
  const consumoMedioTot = consumoPonderado(eventos.filter(e => e.litros != null))

  return {
    totais: {
      horasTrabalhadas: horasTrabalhadasTot,
      horasSemChecklist: horasSemChecklistTot,
      litrosTotal: litrosTotalTot,
      consumoMedio: consumoMedioTot,
      problemas: soma(maquinas.map(m => m.problemas)),
      problemasParado: soma(maquinas.map(m => m.problemasParado)),
      tempoParadoMin: Math.round(soma(maquinas.map(m => m.tempoParadoMin))),
      tempoRespostaMedioMin: respostasValidas.length ? Math.round(media(respostasValidas) as number) : null,
      utilizacaoPct: periodoHoras && maquinas.length ? Math.round((horasTrabalhadasTot / (periodoHoras * maquinas.length)) * 1000) / 10 : null,
    },
    maquinas,
  }
}

// ---- Consumo médio por mês civil, por equipamento (tendência) ----
export type ConsumoMensal = {
  meses: string[]
  equipamentos: string[]
  pontos: Array<{ mes: string } & Record<string, number | null | string>>
}

export async function getConsumoMensal(numMeses = 6): Promise<ConsumoMensal> {
  const { supabase, user } = await usuarioEPapel()
  if (!user) return { meses: [], equipamentos: [], pontos: [] }

  const tz = 'America/Sao_Paulo'
  const nomesMes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const ymdNow = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const [yNow, mNow] = ymdNow.split('-').map(Number)

  const chaves: { key: string; label: string; ano: number; mes: number }[] = []
  for (let i = numMeses - 1; i >= 0; i--) {
    let mes = mNow - i, ano = yNow
    while (mes <= 0) { mes += 12; ano -= 1 }
    chaves.push({ key: `${ano}-${String(mes).padStart(2, '0')}`, label: `${nomesMes[mes - 1]}/${String(ano).slice(2)}`, ano, mes })
  }
  const inicio = new Date(`${chaves[0].ano}-${String(chaves[0].mes).padStart(2, '0')}-01T00:00:00-03:00`)

  const { data: cks } = await supabase.from('checklists').select('id, equipamento').gte('created_at', inicio.toISOString())
  const checklists = cks ?? []
  const ids = checklists.map(c => c.id)
  const equipPorChecklist = new Map(checklists.map(c => [c.id, c.equipamento as string]))

  let eventos: { checklist_id: string; litros: number | null; consumo_lh: number | null; created_at: string }[] = []
  if (ids.length) {
    const { data: evs } = await supabase.from('operacao_eventos').select('checklist_id, litros, consumo_lh, created_at').in('checklist_id', ids).not('litros', 'is', null)
    eventos = evs ?? []
  }

  const grupos = new Map<string, { litros: number | null; consumo_lh: number | null }[]>()
  for (const e of eventos) {
    const equip = equipPorChecklist.get(e.checklist_id)
    if (!equip) continue
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(e.created_at))
    const chave = `${equip}|${ymd.slice(0, 7)}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push({ litros: e.litros, consumo_lh: e.consumo_lh })
  }

  const equipamentos = [...new Set(checklists.map(c => c.equipamento as string))].sort((a, b) => a.localeCompare(b))

  const pontos = chaves.map(({ key, label }) => {
    const ponto: { mes: string } & Record<string, number | null | string> = { mes: label }
    for (const equip of equipamentos) {
      ponto[equip] = consumoPonderado(grupos.get(`${equip}|${key}`) ?? [])
    }
    return ponto
  })

  return { meses: chaves.map(c => c.label), equipamentos, pontos }
}

// ciclo de faturamento: começa todo dia 23, fecha no dia 22 do mês seguinte (zera no dia 23)
function cicloAtual(diaInicio = 23): { inicio: Date; fim: Date; mesLabel: string } {
  const diaFim = diaInicio - 1  // fim = dia anterior ao início no mês seguinte
  const tz = 'America/Sao_Paulo'
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const [y, m, d] = ymd.split('-').map(Number)
  let anoIni = y, mesIni = m
  if (d < diaInicio) { mesIni -= 1; if (mesIni === 0) { mesIni = 12; anoIni -= 1 } }
  const inicio = new Date(`${anoIni}-${String(mesIni).padStart(2, '0')}-${String(diaInicio).padStart(2, '0')}T00:00:00-03:00`)
  let anoFim = anoIni, mesFim = mesIni + 1
  if (mesFim === 13) { mesFim = 1; anoFim += 1 }
  const fim = new Date(`${anoFim}-${String(mesFim).padStart(2, '0')}-${String(diaFim).padStart(2, '0')}T23:59:59-03:00`)
  const nomesMes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return { inicio, fim, mesLabel: `${nomesMes[mesFim - 1]}/${anoFim}` }
}

export type CicloHoras = { inicio: string; fim: string; mesLabel: string; horasTrabalhadas: number; horasSemChecklist: number }

export async function getHorasCicloAtual(): Promise<CicloHoras> {
  const { supabase, user } = await usuarioEPapel()
  const cfg = await getConfigCiclo()
  const { inicio, fim, mesLabel } = cicloAtual(cfg.diaInicio)
  if (!user) return { inicio: inicio.toISOString(), fim: fim.toISOString(), mesLabel, horasTrabalhadas: 0, horasSemChecklist: 0 }
  const { data: cks } = await supabase.from('checklists').select('id, horimetro, horimetro_final').gte('created_at', inicio.toISOString())
  const checklists = cks ?? []
  const horasChecklist = checklists.reduce((acc, c) => acc + (c.horimetro != null && c.horimetro_final != null ? Math.max(0, Number(c.horimetro_final) - Number(c.horimetro)) : 0), 0)
  // horas sem checklist confirmadas pelo admin dentro do ciclo (já entram no total de horas trabalhadas)
  let horasSemChecklist = 0
  const ids = checklists.map(c => c.id)
  if (ids.length) {
    const { data: evs } = await supabase.from('operacao_eventos').select('horas_gap').in('checklist_id', ids).eq('gap_confirmado', true)
    horasSemChecklist = (evs ?? []).reduce((acc, e) => acc + Number(e.horas_gap ?? 0), 0)
  }
  return {
    inicio: inicio.toISOString(), fim: fim.toISOString(), mesLabel,
    horasTrabalhadas: Math.round((horasChecklist + horasSemChecklist) * 10) / 10,
    horasSemChecklist: Math.round(horasSemChecklist * 10) / 10,
  }
}

// ---- Relatório por operador (horas operadas conforme o horímetro dos checklists dele) ----
export type RelatorioOperador = {
  operador: string
  checklists: number
  horasTrabalhadas: number
  litrosTotal: number
  consumoMedio: number | null
  problemas: number
  pendenciaPct: number | null
}

export async function getRelatorioOperadores(inicio: string | null, fim: string | null = null): Promise<RelatorioOperador[]> {
  const { supabase, user } = await usuarioEPapel()
  if (!user) return []
  let q = supabase.from('checklists').select('id, operador, horimetro, horimetro_final, tem_pendencia, created_at')
  if (inicio) q = q.gte('created_at', inicio)
  if (fim) q = q.lt('created_at', fim)
  const { data: cksData } = await q
  const checklists = cksData ?? []
  const ids = checklists.map(c => c.id)

  let eventos: { checklist_id: string; tipo: string; litros: number | null; consumo_lh: number | null }[] = []
  if (ids.length) {
    const { data: evs } = await supabase.from('operacao_eventos').select('checklist_id, tipo, litros, consumo_lh').in('checklist_id', ids)
    eventos = evs ?? []
  }

  const operadores = [...new Set(checklists.map(c => c.operador as string))].sort((a, b) => a.localeCompare(b))

  const relatorio: RelatorioOperador[] = operadores.map(op => {
    const cksOp = checklists.filter(c => c.operador === op)
    const idsOp = new Set(cksOp.map(c => c.id))
    const evsOp = eventos.filter(e => idsOp.has(e.checklist_id))

    const horasTrabalhadas = cksOp.reduce((acc, c) => acc + (c.horimetro != null && c.horimetro_final != null ? Math.max(0, Number(c.horimetro_final) - Number(c.horimetro)) : 0), 0)
    const litrosTotal = evsOp.filter(e => e.litros != null).reduce((a, e) => a + Number(e.litros), 0)
    // consumo médio = média ponderada do consumo de cada abastecimento dele (litros ÷ Δhorímetro desde o abastecimento anterior da máquina)
    const consumoMedio = consumoPonderado(evsOp.filter(e => e.litros != null))
    const problemas = evsOp.filter(e => e.tipo === 'problema').length
    const comPendencia = cksOp.filter(c => c.tem_pendencia).length
    const pendenciaPct = cksOp.length ? Math.round((comPendencia / cksOp.length) * 1000) / 10 : null

    return {
      operador: op,
      checklists: cksOp.length,
      horasTrabalhadas: Math.round(horasTrabalhadas * 10) / 10,
      litrosTotal: Math.round(litrosTotal * 10) / 10,
      consumoMedio,
      problemas,
      pendenciaPct,
    }
  })

  return relatorio.sort((a, b) => b.horasTrabalhadas - a.horasTrabalhadas)
}

// ---- Relatório detalhado de problemas (linha do tempo completa, não só os ativos) ----
export type RelatorioProblema = {
  id: string
  checklist_id: string
  equipamento: string
  operador: string
  created_at: string
  descricao: string | null
  parado: boolean
  prestador: string | null
  acionado_em: string | null
  chegada_em: string | null
  liberado_em: string | null
  resolvido: boolean
  tempoRespostaMin: number | null
  tempoParadoMin: number | null
}

export async function getRelatorioProblemas(inicio: string | null, fim: string | null = null): Promise<RelatorioProblema[]> {
  const { supabase, user } = await usuarioEPapel()
  if (!user) return []
  let q = supabase.from('operacao_eventos')
    .select('id, checklist_id, descricao, parado, prestador, acionado_em, chegada_em, liberado_em, resolvido, created_at, checklists(equipamento, operador)')
    .eq('tipo', 'problema')
    .order('created_at', { ascending: false })
  if (inicio) q = q.gte('created_at', inicio)
  if (fim) q = q.lt('created_at', fim)
  const { data } = await q
  return (data ?? []).map((e: Record<string, unknown>) => {
    const ck = (Array.isArray(e.checklists) ? e.checklists[0] : e.checklists) as { equipamento?: string; operador?: string } | undefined
    const acionado = e.acionado_em as string | null
    const chegada = e.chegada_em as string | null
    const liberado = e.liberado_em as string | null
    const parado = !!e.parado
    const createdAt = e.created_at as string
    const tempoRespostaMin = acionado && chegada ? Math.round((new Date(chegada).getTime() - new Date(acionado).getTime()) / 60000) : null
    let tempoParadoMin: number | null = null
    if (liberado) {
      const inicio = parado ? createdAt : (chegada ?? createdAt)
      const min = (new Date(liberado).getTime() - new Date(inicio).getTime()) / 60000
      tempoParadoMin = min > 0 ? Math.round(min) : 0
    }
    return {
      id: e.id as string,
      checklist_id: e.checklist_id as string,
      equipamento: ck?.equipamento ?? '—',
      operador: ck?.operador ?? '—',
      created_at: createdAt,
      descricao: e.descricao as string | null,
      parado,
      prestador: e.prestador as string | null,
      acionado_em: acionado,
      chegada_em: chegada,
      liberado_em: liberado,
      resolvido: !!e.resolvido,
      tempoRespostaMin,
      tempoParadoMin,
    }
  })
}

export async function getHistorico(limit = 100): Promise<{ checklist: Checklist; eventos: OperacaoEvento[] }[]> {
  const { supabase, user, gestor } = await usuarioEPapel()
  if (!user) return []
  let q = supabase.from('checklists').select('*').order('created_at', { ascending: false }).limit(limit)
  if (!gestor) q = q.eq('user_id', user.id)
  const { data: cks } = await q
  const lista = (cks ?? []) as Checklist[]
  if (!lista.length) return []
  const ids = lista.map(c => c.id)
  const { data: evs } = await supabase.from('operacao_eventos').select('*').in('checklist_id', ids).order('created_at', { ascending: true })
  const eventos = (evs ?? []) as OperacaoEvento[]
  return lista.map(c => ({ checklist: c, eventos: eventos.filter(e => e.checklist_id === c.id) }))
}

export async function addEvento(checklistId: string, tipo: 'parada' | 'retorno', horimetro: number | null, motivo?: string, usoSemChecklist = false, abastecimento = false, litros: number | null = null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data: ck } = await supabase.from('checklists').select('equipamento').eq('id', checklistId).single()
  const equip = ck?.equipamento as string | undefined
  if (horimetro != null) {
    const base = await baselineHorimetro(supabase, checklistId, equip)
    if (base != null && horimetro < base) return { error: `Horímetro ${horimetro} é menor que o último lançado (${base}). Só é permitido igual ou maior.` }
  }
  // consumo (L/h): litros abastecidos ÷ horas rodadas desde o último abastecimento
  let consumo_lh: number | null = null
  if (litros != null && litros > 0 && horimetro != null && equip) {
    const prevH = await ultimoAbastecimentoHorimetro(supabase, equip)
    if (prevH != null && horimetro > prevH) consumo_lh = Math.round((litros / (horimetro - prevH)) * 100) / 100
  }
  const { error } = await supabase.from('operacao_eventos').insert({
    checklist_id: checklistId, tipo, horimetro, motivo: motivo?.trim() || null, origem: 'app', user_id: user.id,
    uso_sem_checklist: usoSemChecklist, abastecimento, litros, consumo_lh,
  })
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
  const { data: upd, error } = await supabase.from('checklists').update({ status: 'encerrada', horimetro_final: horimetroFinal, encerrada_em: new Date().toISOString() }).eq('id', checklistId).select('id')
  if (error) return { error: error.message }
  if (!upd?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  await supabase.from('operacao_eventos').insert({ checklist_id: checklistId, tipo: 'encerramento', horimetro: horimetroFinal, origem: 'app', user_id: user.id })
  if (horimetroFinal != null && equip) await recalcHorimetro(supabase, equip)
  revalidatePath('/checklist')
  return { error: null }
}

// corrigir horímetros lançados — mesmo na edição, nunca menor que o anterior nem maior que o próximo
export async function updateChecklistHorimetro(checklistId: string, campo: 'horimetro' | 'horimetro_final', valor: number | null) {
  const { gestor } = await usuarioEPapel()
  if (!gestor) return { error: 'Apenas admin/editor podem corrigir horímetros.' }
  const supabase = await createClient()
  if (valor != null) {
    const { prev, next } = await vizinhosSequencia(supabase, checklistId, campo === 'horimetro' ? 'inicial' : 'final')
    if (prev != null && valor < prev) return { error: `Horímetro ${valor} não pode ser menor que o anterior (${prev}).` }
    if (next != null && valor > next) return { error: `Horímetro ${valor} não pode ser maior que o próximo (${next}).` }
  }
  const { data: ck } = await supabase.from('checklists').select('equipamento').eq('id', checklistId).single()
  const { data: upd, error } = await supabase.from('checklists').update({ [campo]: valor }).eq('id', checklistId).select('id')
  if (error) return { error: error.message }
  if (!upd?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  // mantém os eventos espelhados sincronizados com o horímetro do checklist (encerramento ↔ final; abertura ↔ inicial)
  if (campo === 'horimetro_final') {
    await supabase.from('operacao_eventos').update({ horimetro: valor }).eq('checklist_id', checklistId).eq('tipo', 'encerramento')
  } else {
    await supabase.from('operacao_eventos').update({ horimetro: valor }).eq('checklist_id', checklistId).eq('tipo', 'abertura')
    await recalcGapAbertura(supabase, checklistId, ck?.equipamento, valor)
  }
  if (ck?.equipamento) await recalcHorimetro(supabase, ck.equipamento)
  revalidatePath('/checklist')
  revalidatePath('/historico')
  return { error: null }
}

export async function updateEventoHorimetro(eventoId: string, valor: number | null) {
  const { gestor } = await usuarioEPapel()
  if (!gestor) return { error: 'Apenas admin/editor podem corrigir horímetros.' }
  const supabase = await createClient()
  const { data: ev } = await supabase.from('operacao_eventos').select('checklist_id, tipo').eq('id', eventoId).single()
  if (!ev?.checklist_id) return { error: 'Evento não encontrado' }
  if (valor != null) {
    const { prev, next } = await vizinhosSequencia(supabase, ev.checklist_id, eventoId)
    if (prev != null && valor < prev) return { error: `Horímetro ${valor} não pode ser menor que o anterior (${prev}).` }
    if (next != null && valor > next) return { error: `Horímetro ${valor} não pode ser maior que o próximo (${next}).` }
  }
  const { data: upd, error } = await supabase.from('operacao_eventos').update({ horimetro: valor, editado_em: new Date().toISOString() }).eq('id', eventoId).select('id')
  if (error) return { error: error.message }
  if (!upd?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  const { data: ck } = await supabase.from('checklists').select('equipamento').eq('id', ev.checklist_id).single()
  // mantém o horímetro final do checklist sincronizado com o evento de encerramento
  if (ev.tipo === 'encerramento') {
    await supabase.from('checklists').update({ horimetro_final: valor }).eq('id', ev.checklist_id)
  }
  // editou o próprio evento de abertura → recalcula o gap (horas sem checklist) com o valor corrigido
  if (ev.tipo === 'abertura') {
    await recalcGapAbertura(supabase, ev.checklist_id, ck?.equipamento, valor)
  }
  if (ck?.equipamento) await recalcHorimetro(supabase, ck.equipamento)
  revalidatePath('/checklist')
  revalidatePath('/historico')
  revalidatePath('/', 'layout')
  return { error: null }
}

// corrige o horário (data/hora) de um lançamento — fica marcado como "editado"
export async function updateEventoHorario(eventoId: string, novoHorarioISO: string) {
  const { gestor } = await usuarioEPapel()
  if (!gestor) return { error: 'Apenas admin/editor podem corrigir lançamentos.' }
  const supabase = await createClient()
  const d = new Date(novoHorarioISO)
  if (Number.isNaN(d.getTime())) return { error: 'Horário inválido.' }
  const { data: upd, error } = await supabase.from('operacao_eventos').update({ created_at: d.toISOString(), editado_em: new Date().toISOString() }).eq('id', eventoId).select('id')
  if (error) return { error: error.message }
  if (!upd?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  revalidatePath('/checklist')
  revalidatePath('/historico')
  return { error: null }
}

// exclui um lançamento (parada/retorno/abastecimento/encerramento/problema/abertura).
// se for o encerramento, reabre a operação (volta o checklist para "aberta").
export async function excluirEvento(eventoId: string) {
  const { gestor } = await usuarioEPapel()
  if (!gestor) return { error: 'Apenas admin/editor podem excluir lançamentos.' }
  const supabase = await createClient()
  const { data: ev } = await supabase.from('operacao_eventos').select('checklist_id, tipo').eq('id', eventoId).single()
  if (!ev?.checklist_id) return { error: 'Evento não encontrado' }
  const { error } = await supabase.from('operacao_eventos').delete().eq('id', eventoId)
  if (error) return { error: error.message }
  if (ev.tipo === 'encerramento') {
    await supabase.from('checklists').update({ status: 'aberta', horimetro_final: null, encerrada_em: null }).eq('id', ev.checklist_id)
  }
  const { data: ck } = await supabase.from('checklists').select('equipamento').eq('id', ev.checklist_id).single()
  if (ck?.equipamento) await recalcHorimetro(supabase, ck.equipamento)
  revalidatePath('/checklist')
  revalidatePath('/historico')
  revalidatePath('/', 'layout')
  return { error: null }
}

// corrige itens do checklist marcados errado pelo operador (status/observação)
export async function updateChecklistItens(checklistId: string, itens: ChecklistItem[]) {
  const { gestor } = await usuarioEPapel()
  if (!gestor) return { error: 'Apenas admin/editor podem editar o checklist.' }
  const supabase = await createClient()
  const tem_pendencia = itens.some(i => i.status === 'nok')
  const { data: upd, error } = await supabase.from('checklists').update({ itens, tem_pendencia }).eq('id', checklistId).select('id')
  if (error) return { error: error.message }
  if (!upd?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  revalidatePath('/historico')
  revalidatePath('/', 'layout')
  return { error: null }
}

// ---- Reportar problema no equipamento durante a operação ----
export async function reportarProblema(checklistId: string, descricao: string, parado: boolean, fotos: string[], horimetro: number | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!descricao.trim()) return { error: 'Descreva o problema.' }
  if (horimetro == null) return { error: 'Informe o horímetro.' }
  const { data: ck } = await supabase.from('checklists').select('equipamento, operador').eq('id', checklistId).single()
  const equip = ck?.equipamento as string | undefined
  const base = await baselineHorimetro(supabase, checklistId, equip)
  if (base != null && horimetro < base) return { error: `Horímetro ${horimetro} é menor que o último lançado (${base}). Só é permitido igual ou maior.` }
  const { error } = await supabase.from('operacao_eventos').insert({
    checklist_id: checklistId, tipo: 'problema', descricao: descricao.trim(), parado, fotos, horimetro, origem: 'app', user_id: user.id,
  })
  if (error) return { error: error.message }
  if (equip) await recalcHorimetro(supabase, equip)
  if (parado) {
    const hora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    await notificarTelegram(
      `⛔ MÁQUINA PARADA — problema reportado\n\nEquipamento: ${equip ?? '—'}\nOperador: ${ck?.operador ?? '—'}\nHorário: ${hora}\nHorímetro: ${horimetro}h\nDescrição: ${descricao.trim()}\n\nAbra o app para acionar o prestador.`
    )
  }
  revalidatePath('/checklist')
  revalidatePath('/historico')
  revalidatePath('/', 'layout')
  return { error: null }
}

export type ProblemaEquipamento = OperacaoEvento & { equipamento: string; operador: string }

export async function getProblemasAtivos(): Promise<ProblemaEquipamento[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('operacao_eventos')
    .select('*, checklists(equipamento, operador)')
    .eq('tipo', 'problema')
    .eq('resolvido', false)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []).map((e: Record<string, unknown>) => {
    const ck = (Array.isArray(e.checklists) ? e.checklists[0] : e.checklists) as { equipamento?: string; operador?: string } | undefined
    const { checklists, ...rest } = e
    return { ...(rest as unknown as OperacaoEvento), equipamento: ck?.equipamento ?? '—', operador: ck?.operador ?? '—' }
  })
}

export async function resolverProblema(eventoId: string) {
  const { gestor } = await usuarioEPapel()
  if (!gestor) return { error: 'Apenas admin/editor podem resolver problemas.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('operacao_eventos').update({ resolvido: true }).eq('id', eventoId).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  revalidatePath('/', 'layout')
  return { error: null }
}

// Tratativa do problema: 1) aciona o prestador (ADM, após enviar WhatsApp) → 2) chegada da manutenção → 3) libera o equipamento
export async function marcarPrestadorAcionado(eventoId: string, prestador: string) {
  const { gestor } = await usuarioEPapel()
  if (!gestor) return { error: 'Apenas admin/editor podem acionar o prestador.' }
  if (!prestador.trim()) return { error: 'Informe o prestador (ex.: Brasmaq).' }
  const supabase = await createClient()
  const { data: upd, error } = await supabase.from('operacao_eventos').update({ prestador: prestador.trim(), acionado_em: new Date().toISOString() }).eq('id', eventoId).select('id')
  if (error) return { error: error.message }
  if (!upd?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  revalidatePath('/checklist')
  revalidatePath('/historico')
  revalidatePath('/', 'layout')
  return { error: null }
}

export async function marcarChegadaManutencao(eventoId: string, horimetro: number | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data: ev } = await supabase.from('operacao_eventos').select('checklist_id, parado, horimetro').eq('id', eventoId).single()
  if (!ev?.checklist_id) return { error: 'Problema não encontrado' }
  const { data: ck } = await supabase.from('checklists').select('equipamento').eq('id', ev.checklist_id).single()
  const equip = ck?.equipamento as string | undefined
  // máquina parada: o horímetro não mudou desde o reporte → reaproveita; rodando: exige o horímetro atual
  const valor = ev.parado ? (ev.horimetro as number | null) : horimetro
  if (valor == null) return { error: 'Informe o horímetro.' }
  const base = await baselineHorimetro(supabase, ev.checklist_id, equip)
  if (base != null && valor < base) return { error: `Horímetro ${valor} é menor que o último lançado (${base}).` }
  const { data: upd, error } = await supabase.from('operacao_eventos').update({ chegada_em: new Date().toISOString(), chegada_horimetro: valor }).eq('id', eventoId).select('id')
  if (error) return { error: error.message }
  if (!upd?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  if (equip) await recalcHorimetro(supabase, equip)
  revalidatePath('/checklist')
  revalidatePath('/historico')
  revalidatePath('/', 'layout')
  return { error: null }
}

export async function liberarEquipamento(eventoId: string, horimetro: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data: ev } = await supabase.from('operacao_eventos').select('checklist_id').eq('id', eventoId).single()
  if (!ev?.checklist_id) return { error: 'Problema não encontrado' }
  const { data: ck } = await supabase.from('checklists').select('equipamento, operador').eq('id', ev.checklist_id).single()
  const equip = ck?.equipamento as string | undefined
  const base = await baselineHorimetro(supabase, ev.checklist_id, equip)
  if (base != null && horimetro < base) return { error: `Horímetro ${horimetro} é menor que o último lançado (${base}).` }
  const { data: upd, error } = await supabase.from('operacao_eventos').update({ liberado_em: new Date().toISOString(), liberado_horimetro: horimetro, resolvido: true }).eq('id', eventoId).select('id')
  if (error) return { error: error.message }
  if (!upd?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  if (equip) await recalcHorimetro(supabase, equip)
  const horaLiberado = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  await notificarTelegram(
    `✅ EQUIPAMENTO LIBERADO\n\nEquipamento: ${equip ?? '—'}\nOperador: ${ck?.operador ?? '—'}\nHorário: ${horaLiberado}\nHorímetro: ${horimetro}h\n\nA tratativa foi concluída e a máquina está liberada para operar.`
  )
  revalidatePath('/checklist')
  revalidatePath('/historico')
  revalidatePath('/', 'layout')
  return { error: null }
}

// marca/desmarca um evento de problema para ser ignorado nos painéis agregados (tempo parado, resposta do prestador),
// sem remover o registro do histórico do checklist
export async function setExcluirIndicadores(eventoId: string, excluir: boolean) {
  const { supabase, gestor } = await usuarioEPapel()
  if (!gestor) return { error: 'Sem permissão.' }
  const { data: upd, error } = await supabase.from('operacao_eventos').update({ excluir_indicadores: excluir }).eq('id', eventoId).select('id')
  if (error) return { error: error.message }
  if (!upd?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  revalidatePath('/checklist')
  revalidatePath('/historico')
  revalidatePath('/equipamentos/indicadores')
  revalidatePath('/equipamentos/relatorios')
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
  const lista = (data ?? []) as Checklist[]
  if (!lista.length) return lista
  // checklists com pendência que já têm um evento de problema vinculado seguem só pelo banner novo (tratativa) — evita banner duplicado
  const { data: probs } = await supabase.from('operacao_eventos').select('checklist_id').eq('tipo', 'problema').in('checklist_id', lista.map(c => c.id))
  const comProblema = new Set((probs ?? []).map(p => p.checklist_id))
  return lista.filter(c => !comProblema.has(c.id))
}

export async function resolverPendencia(checklistId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data, error } = await supabase.from('checklists').update({ pendencia_resolvida: true }).eq('id', checklistId).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  revalidatePath('/', 'layout')
  return { error: null }
}

export type UsoSemChecklist = {
  id: string; checklist_id: string; equipamento: string; operador: string
  horimetro: number | null; motivo: string | null; horas_gap: number | null; created_at: string
}

export async function getUsosSemChecklist(): Promise<UsoSemChecklist[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('operacao_eventos')
    .select('id, checklist_id, horimetro, motivo, horas_gap, created_at, checklists(equipamento, operador)')
    .eq('uso_sem_checklist', true)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []).map((e: Record<string, unknown>) => {
    const ck = (Array.isArray(e.checklists) ? e.checklists[0] : e.checklists) as { equipamento?: string; operador?: string } | undefined
    return {
      id: e.id as string,
      checklist_id: e.checklist_id as string,
      equipamento: ck?.equipamento ?? '—',
      operador: ck?.operador ?? '—',
      horimetro: (e.horimetro as number | null) ?? null,
      motivo: (e.motivo as string | null) ?? null,
      horas_gap: (e.horas_gap as number | null) ?? null,
      created_at: e.created_at as string,
    }
  })
}

// confirmarReal=true → uso real (entra na métrica "horas sem checklist" e soma nas horas trabalhadas); false → descarta (não conta)
export async function resolverUsoSemChecklist(eventoId: string, confirmarReal: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data, error } = await supabase.from('operacao_eventos').update({ uso_sem_checklist: false, gap_confirmado: confirmarReal }).eq('id', eventoId).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  revalidatePath('/', 'layout')
  revalidatePath('/equipamentos/indicadores')
  revalidatePath('/equipamentos/relatorios')
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

// ---- DespachaApp (Tarefas) ----
export async function updateDespachaTaskStatus(taskId: string, status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Apenas admin pode alterar tarefas do DespachaApp.' }

  const res = await despachaFetch(`/task?id=${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  if (!res.success) return { error: res.error }

  revalidatePath('/tarefas')
  revalidatePath('/', 'layout')
  return { error: null }
}

// Aprovação de solicitação pública: remove a flag needs_approval e inicia o atendimento.
export async function approveDespachaTask(taskId: string, assigneeId?: string, urgency?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Apenas admin pode aprovar solicitações.' }

  // Não muda para em_andamento — o prestador informa o início pelo bot
  const body: Record<string, unknown> = { needs_approval: false }
  if (assigneeId) body.assignee_id = assigneeId
  if (urgency)    body.urgency     = urgency

  const res = await despachaFetch(`/task?id=${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.success) return { error: res.error }

  revalidatePath('/tarefas')
  revalidatePath('/', 'layout')
  return { error: null }
}

export async function updateDespachaTaskAssignee(taskId: string, assigneeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Apenas admin pode alterar tarefas do DespachaApp.' }

  const res = await despachaFetch(`/task?id=${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ assignee_id: assigneeId }),
  })
  if (!res.success) return { error: res.error }

  revalidatePath('/tarefas')
  revalidatePath('/', 'layout')
  return { error: null }
}
