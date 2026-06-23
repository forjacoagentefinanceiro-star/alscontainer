'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient, OPERADOR_DOMINIO } from '@/lib/supabase/admin'
import { notificarTelegram } from '@/lib/telegram'
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
  tipo: 'parada' | 'retorno' | 'encerramento' | 'problema'
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
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const tem_pendencia = payload.itens.some(i => i.status === 'nok')
  // turno derivado do horário de Brasília (não é mais escolhido no formulário)
  const horaBR = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()))
  const turno = payload.turno?.trim() || (horaBR < 12 ? 'Manhã' : horaBR < 18 ? 'Tarde' : 'Noite')
  // não permite 2 operações abertas para o mesmo equipamento
  const { data: jaAberta } = await supabase.from('checklists').select('id').eq('equipamento', payload.equipamento).eq('status', 'aberta').limit(1)
  if (jaAberta?.length) return { error: `Já existe um checklist aberto para ${payload.equipamento}. Encerre a operação atual antes de abrir outro.` }
  if (payload.horimetro != null) {
    const atual = await horimetroDaMaquina(supabase, payload.equipamento)
    if (atual != null && payload.horimetro < atual)
      return { error: `Horímetro ${payload.horimetro} é menor que o último lançado (${atual}) para ${payload.equipamento}.` }
  }
  const { error } = await supabase.from('checklists').insert({ ...payload, turno, user_id: user.id, tem_pendencia })
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

export type ResumoEquipamentos = {
  emOperacao: number
  totalEquip: number
  ociosos: string[]
  checklistsHoje: number
  desacordos: number
  usosSemChecklist: number
  abertas: { equipamento: string; operador: string; created_at: string; horimetro: number | null }[]
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
    supabase.from('checklists').select('equipamento, operador, created_at, horimetro').eq('status', 'aberta').order('created_at', { ascending: false }),
    supabase.from('checklists').select('id', { count: 'exact', head: true }).gte('created_at', inicioDia),
    supabase.from('checklists').select('id', { count: 'exact', head: true }).eq('tem_pendencia', true).eq('pendencia_resolvida', false),
    supabase.from('operacao_eventos').select('id, checklist_id, horimetro, created_at, checklists(equipamento, operador)').eq('uso_sem_checklist', true).order('created_at', { ascending: false }).limit(50),
  ])

  const equipamentos = (emp.data ?? []).map(e => e.nome as string)
  const abertas = (abertasRes.data ?? []) as ResumoEquipamentos['abertas']
  const operando = new Set(abertas.map(a => a.equipamento))
  const usosDetalhe: UsoSemChecklist[] = (usosRes.data ?? []).map((e: Record<string, unknown>) => {
    const ck = (Array.isArray(e.checklists) ? e.checklists[0] : e.checklists) as { equipamento?: string; operador?: string } | undefined
    return {
      id: e.id as string,
      checklist_id: e.checklist_id as string,
      equipamento: ck?.equipamento ?? '—',
      operador: ck?.operador ?? '—',
      horimetro: (e.horimetro as number | null) ?? null,
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
  litrosTotal: number
  consumoMedio: number | null
  problemas: number
  problemasParado: number
  tempoParadoMin: number
  tempoRespostaMedioMin: number | null
  utilizacaoPct: number | null
  pendenciaPct: number | null
}

export type DashboardEquipamentos = {
  periodoDias: number
  totais: {
    horasTrabalhadas: number
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

export async function getDashboardEquipamentos(dias = 30): Promise<DashboardEquipamentos> {
  const { supabase, user } = await usuarioEPapel()
  const vazio: DashboardEquipamentos = { periodoDias: dias, totais: { horasTrabalhadas: 0, litrosTotal: 0, consumoMedio: null, problemas: 0, problemasParado: 0, tempoParadoMin: 0, tempoRespostaMedioMin: null, utilizacaoPct: null }, maquinas: [] }
  if (!user) return vazio

  const cutoff = dias > 0 ? new Date(Date.now() - dias * 86400000).toISOString() : null
  const { data: emp } = await supabase.from('empilhadeiras').select('nome, horimetro_atual')
  let q = supabase.from('checklists').select('id, equipamento, horimetro, horimetro_final, tem_pendencia, created_at')
  if (cutoff) q = q.gte('created_at', cutoff)
  const { data: cksData } = await q
  const checklists = cksData ?? []
  const ids = checklists.map(c => c.id)

  let eventos: { checklist_id: string; tipo: string; litros: number | null; consumo_lh: number | null; parado: boolean | null; acionado_em: string | null; chegada_em: string | null; liberado_em: string | null; created_at: string }[] = []
  if (ids.length) {
    const { data: evs } = await supabase.from('operacao_eventos')
      .select('checklist_id, tipo, litros, consumo_lh, parado, acionado_em, chegada_em, liberado_em, created_at')
      .in('checklist_id', ids)
    eventos = evs ?? []
  }

  const nomes = [...new Set([...(emp ?? []).map(e => e.nome as string), ...checklists.map(c => c.equipamento as string)])].sort((a, b) => a.localeCompare(b))
  const horimetroAtualMap = new Map((emp ?? []).map(e => [e.nome as string, e.horimetro_atual as number | null]))
  const periodoHoras = cutoff ? dias * 24 : null

  const maquinas: IndicadorMaquina[] = nomes.map(nome => {
    const cksM = checklists.filter(c => c.equipamento === nome)
    const idsM = new Set(cksM.map(c => c.id))
    const evsM = eventos.filter(e => idsM.has(e.checklist_id))

    const horasTrabalhadas = cksM.reduce((acc, c) => acc + (c.horimetro != null && c.horimetro_final != null ? Math.max(0, Number(c.horimetro_final) - Number(c.horimetro)) : 0), 0)

    const abastecimentos = evsM.filter(e => e.litros != null)
    const litrosTotal = abastecimentos.reduce((a, e) => a + Number(e.litros), 0)
    // consumo médio = litros consumidos ÷ horas trabalhadas no período
    const consumoMedio = horasTrabalhadas > 0 && litrosTotal > 0 ? Math.round((litrosTotal / horasTrabalhadas) * 10) / 10 : null

    const probs = evsM.filter(e => e.tipo === 'problema')
    const problemasParado = probs.filter(e => e.parado).length

    let tempoParadoMin = 0
    for (const p of probs) {
      if (!p.liberado_em) continue
      const inicio = p.parado ? p.created_at : (p.chegada_em ?? p.created_at)
      const min = (new Date(p.liberado_em).getTime() - new Date(inicio).getTime()) / 60000
      if (min > 0) tempoParadoMin += min
    }

    const respostas = probs.filter(e => e.acionado_em && e.chegada_em).map(e => (new Date(e.chegada_em as string).getTime() - new Date(e.acionado_em as string).getTime()) / 60000)
    const tempoRespostaMedioMin = respostas.length ? Math.round(respostas.reduce((a, b) => a + b, 0) / respostas.length) : null

    const utilizacaoPct = periodoHoras ? Math.round((horasTrabalhadas / periodoHoras) * 1000) / 10 : null
    const comPendencia = cksM.filter(c => c.tem_pendencia).length
    const pendenciaPct = cksM.length ? Math.round((comPendencia / cksM.length) * 1000) / 10 : null

    return {
      equipamento: nome,
      horimetroAtual: horimetroAtualMap.get(nome) ?? null,
      horasTrabalhadas: Math.round(horasTrabalhadas * 10) / 10,
      litrosTotal: Math.round(litrosTotal * 10) / 10,
      consumoMedio,
      problemas: probs.length,
      problemasParado,
      tempoParadoMin: Math.round(tempoParadoMin),
      tempoRespostaMedioMin,
      utilizacaoPct,
      pendenciaPct,
    }
  })

  const soma = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const media = (arr: number[]) => (arr.length ? Math.round((soma(arr) / arr.length) * 100) / 100 : null)

  const respostasValidas = maquinas.filter(m => m.tempoRespostaMedioMin != null).map(m => m.tempoRespostaMedioMin as number)
  const horasTrabalhadasTot = Math.round(soma(maquinas.map(m => m.horasTrabalhadas)) * 10) / 10
  const litrosTotalTot = Math.round(soma(maquinas.map(m => m.litrosTotal)) * 10) / 10
  const consumoMedioTot = horasTrabalhadasTot > 0 && litrosTotalTot > 0 ? Math.round((litrosTotalTot / horasTrabalhadasTot) * 10) / 10 : null

  return {
    periodoDias: dias,
    totais: {
      horasTrabalhadas: horasTrabalhadasTot,
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

// ciclo de faturamento: começa todo dia 23, fecha no dia 22 do mês seguinte (zera no dia 23)
function cicloAtual(): { inicio: Date; fim: Date; mesLabel: string } {
  const tz = 'America/Sao_Paulo'
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const [y, m, d] = ymd.split('-').map(Number)
  let anoIni = y, mesIni = m
  if (d < 23) { mesIni -= 1; if (mesIni === 0) { mesIni = 12; anoIni -= 1 } }
  const inicio = new Date(`${anoIni}-${String(mesIni).padStart(2, '0')}-23T00:00:00-03:00`)
  let anoFim = anoIni, mesFim = mesIni + 1
  if (mesFim === 13) { mesFim = 1; anoFim += 1 }
  const fim = new Date(`${anoFim}-${String(mesFim).padStart(2, '0')}-22T23:59:59-03:00`)
  const nomesMes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return { inicio, fim, mesLabel: `${nomesMes[mesFim - 1]}/${anoFim}` }
}

export type CicloHoras = { inicio: string; fim: string; mesLabel: string; horasTrabalhadas: number }

export async function getHorasCicloAtual(): Promise<CicloHoras> {
  const { supabase, user } = await usuarioEPapel()
  const { inicio, fim, mesLabel } = cicloAtual()
  if (!user) return { inicio: inicio.toISOString(), fim: fim.toISOString(), mesLabel, horasTrabalhadas: 0 }
  const { data } = await supabase.from('checklists').select('horimetro, horimetro_final').gte('created_at', inicio.toISOString())
  const horas = (data ?? []).reduce((acc, c) => acc + (c.horimetro != null && c.horimetro_final != null ? Math.max(0, Number(c.horimetro_final) - Number(c.horimetro)) : 0), 0)
  return { inicio: inicio.toISOString(), fim: fim.toISOString(), mesLabel, horasTrabalhadas: Math.round(horas * 10) / 10 }
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
  // mantém o evento de encerramento sincronizado com o horímetro final do checklist
  if (campo === 'horimetro_final') {
    await supabase.from('operacao_eventos').update({ horimetro: valor }).eq('checklist_id', checklistId).eq('tipo', 'encerramento')
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
  const { data: upd, error } = await supabase.from('operacao_eventos').update({ horimetro: valor }).eq('id', eventoId).select('id')
  if (error) return { error: error.message }
  if (!upd?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  // mantém o horímetro final do checklist sincronizado com o evento de encerramento
  if (ev.tipo === 'encerramento') {
    await supabase.from('checklists').update({ horimetro_final: valor }).eq('id', ev.checklist_id)
  }
  const { data: ck } = await supabase.from('checklists').select('equipamento').eq('id', ev.checklist_id).single()
  if (ck?.equipamento) await recalcHorimetro(supabase, ck.equipamento)
  revalidatePath('/checklist')
  revalidatePath('/historico')
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
  const { data, error } = await supabase.from('checklists').update({ pendencia_resolvida: true }).eq('id', checklistId).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
  revalidatePath('/', 'layout')
  return { error: null }
}

export type UsoSemChecklist = { id: string; checklist_id: string; equipamento: string; operador: string; horimetro: number | null; created_at: string }

export async function getUsosSemChecklist(): Promise<UsoSemChecklist[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('operacao_eventos')
    .select('id, checklist_id, horimetro, created_at, checklists(equipamento, operador)')
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
      created_at: e.created_at as string,
    }
  })
}

export async function resolverUsoSemChecklist(eventoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data, error } = await supabase.from('operacao_eventos').update({ uso_sem_checklist: false }).eq('id', eventoId).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Não foi possível salvar (sem permissão de UPDATE no banco).' }
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
