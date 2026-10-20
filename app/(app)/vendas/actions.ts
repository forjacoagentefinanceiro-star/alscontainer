'use server'

import { revalidatePath } from 'next/cache'
import { exigirVendas, type SB } from '@/lib/vendas/server'
import { ETAPA_LABEL, TAREFA_POR_ETAPA } from '@/lib/vendas/config'

type R = { ok: true } | { erro: string }
const refresh = () => { revalidatePath('/vendas', 'layout') }
const txt = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return s || null }
const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.')
  const n = Number(s); return s && Number.isFinite(n) ? n : null
}

function venceEm(horas: number) {
  const d = new Date(Date.now() + horas * 3600_000)
  // sábado/domingo → empurra para segunda (BRT = UTC-3)
  const dow = new Date(d.getTime() - 3 * 3600_000).getUTCDay()
  if (dow === 0) d.setTime(d.getTime() + 24 * 3600_000)
  if (dow === 6) d.setTime(d.getTime() + 48 * 3600_000)
  return d.toISOString()
}

async function tarefaDaEtapa(supabase: SB, leadId: string, etapa: string) {
  // fecha as tarefas abertas anteriores e agenda a da nova etapa
  await supabase.from('cv_tarefas').update({ concluida_em: new Date().toISOString() }).eq('lead_id', leadId).is('concluida_em', null)
  const t = TAREFA_POR_ETAPA[etapa]
  if (t) await supabase.from('cv_tarefas').insert({ lead_id: leadId, titulo: t[0], vence_em: venceEm(t[1]) })
}

export async function criarLead(fd: FormData): Promise<(R & { id?: string })> {
  const { supabase } = await exigirVendas()
  const nome = txt(fd.get('nome'))
  if (!nome) return { erro: 'Informe o nome.' }
  const { data, error } = await supabase.from('cv_leads').insert({
    nome, telefone: txt(fd.get('telefone')), cidade: txt(fd.get('cidade')),
    canal: txt(fd.get('canal')) ?? 'whatsapp', campanha_id: txt(fd.get('campanha_id')),
    uso: txt(fd.get('uso')), ano_pref: num(fd.get('ano_pref')), responsavel: txt(fd.get('responsavel')), obs: txt(fd.get('obs')),
  }).select('id').single()
  if (error || !data) return { erro: error?.message ?? 'Erro ao salvar.' }
  await tarefaDaEtapa(supabase, data.id, 'novo')
  refresh()
  return { ok: true, id: data.id }
}

export async function atualizarLead(id: string, fd: FormData): Promise<R> {
  const { supabase } = await exigirVendas()
  const nome = txt(fd.get('nome'))
  if (!nome) return { erro: 'Informe o nome.' }
  const { error } = await supabase.from('cv_leads').update({
    nome, telefone: txt(fd.get('telefone')), cidade: txt(fd.get('cidade')),
    canal: txt(fd.get('canal')) ?? 'whatsapp', campanha_id: txt(fd.get('campanha_id')),
    uso: txt(fd.get('uso')), ano_pref: num(fd.get('ano_pref')), preco: num(fd.get('preco')),
    responsavel: txt(fd.get('responsavel')), obs: txt(fd.get('obs')), atualizado_em: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { erro: error.message }
  refresh(); return { ok: true }
}

export async function moverEtapa(id: string, etapa: string, extra?: { motivo?: string; preco?: number | null }): Promise<R> {
  const { supabase } = await exigirVendas()
  if (!ETAPA_LABEL[etapa]) return { erro: 'Etapa inválida.' }
  const { data: antes } = await supabase.from('cv_leads').select('etapa, ano_pref, preco').eq('id', id).single()
  if (!antes) return { erro: 'Lead não encontrado.' }
  if (antes.etapa === etapa) return { ok: true }
  const fechando = etapa === 'vendido' || etapa === 'perdido'
  const upd: Record<string, unknown> = {
    etapa, atualizado_em: new Date().toISOString(),
    fechado_em: fechando ? new Date().toISOString() : null,
    motivo_perda: etapa === 'perdido' ? (extra?.motivo ?? null) : null,
  }
  if (extra?.preco != null) upd.preco = extra.preco
  const { error } = await supabase.from('cv_leads').update(upd).eq('id', id)
  if (error) return { erro: error.message }
  await supabase.from('cv_atividades').insert({
    lead_id: id, tipo: 'etapa',
    texto: `${ETAPA_LABEL[antes.etapa]} → ${ETAPA_LABEL[etapa]}${extra?.motivo ? ` (${extra.motivo})` : ''}`,
  })
  if (fechando) await supabase.from('cv_tarefas').update({ concluida_em: new Date().toISOString() }).eq('lead_id', id).is('concluida_em', null)
  else await tarefaDaEtapa(supabase, id, etapa)

  // baixa de estoque do ano ao vender (e devolve se sair de "vendido")
  if (antes.ano_pref) {
    const { data: p } = await supabase.from('cv_precos').select('unidades, vendidas').eq('ano', antes.ano_pref).maybeSingle()
    if (p) {
      if (etapa === 'vendido') await supabase.from('cv_precos').update({ unidades: Math.max(0, p.unidades - 1), vendidas: p.vendidas + 1 }).eq('ano', antes.ano_pref)
      else if (antes.etapa === 'vendido') await supabase.from('cv_precos').update({ unidades: p.unidades + 1, vendidas: Math.max(0, p.vendidas - 1) }).eq('ano', antes.ano_pref)
    }
  }
  refresh(); return { ok: true }
}

export async function registrarWhats(id: string, titulo: string, mensagem: string): Promise<R> {
  const { supabase } = await exigirVendas()
  await supabase.from('cv_atividades').insert({ lead_id: id, tipo: 'whatsapp', texto: `${titulo}: ${mensagem}` })
  await supabase.from('cv_leads').update({ atualizado_em: new Date().toISOString() }).eq('id', id)
  // marca a 1ª resposta (tempo de primeira resposta no painel)
  await supabase.from('cv_leads').update({ primeira_resposta_em: new Date().toISOString() }).eq('id', id).is('primeira_resposta_em', null)
  refresh(); return { ok: true }
}

export async function adicionarNota(id: string, texto: string): Promise<R> {
  const { supabase } = await exigirVendas()
  if (!texto.trim()) return { erro: 'Escreva algo.' }
  const { error } = await supabase.from('cv_atividades').insert({ lead_id: id, tipo: 'nota', texto: texto.trim() })
  if (error) return { erro: error.message }
  refresh(); return { ok: true }
}

export async function criarTarefa(id: string, titulo: string, venceEmIso: string): Promise<R> {
  const { supabase } = await exigirVendas()
  if (!titulo.trim() || !venceEmIso) return { erro: 'Informe título e data.' }
  const { error } = await supabase.from('cv_tarefas').insert({ lead_id: id, titulo: titulo.trim(), vence_em: new Date(venceEmIso).toISOString() })
  if (error) return { erro: error.message }
  refresh(); return { ok: true }
}

export async function concluirTarefa(id: string): Promise<R> {
  const { supabase } = await exigirVendas()
  const { error } = await supabase.from('cv_tarefas').update({ concluida_em: new Date().toISOString() }).eq('id', id)
  if (error) return { erro: error.message }
  refresh(); return { ok: true }
}

export async function adiarTarefa(id: string, dias: number): Promise<R> {
  const { supabase } = await exigirVendas()
  const { error } = await supabase.from('cv_tarefas').update({ vence_em: venceEm(dias * 24) }).eq('id', id)
  if (error) return { erro: error.message }
  refresh(); return { ok: true }
}

export async function excluirLead(id: string): Promise<R> {
  const { supabase } = await exigirVendas()
  const { error } = await supabase.from('cv_leads').delete().eq('id', id)
  if (error) return { erro: error.message }
  refresh(); return { ok: true }
}

export async function salvarCampanha(fd: FormData): Promise<R> {
  const { supabase } = await exigirVendas()
  const id = txt(fd.get('id'))
  const nome = txt(fd.get('nome'))
  if (!nome) return { erro: 'Informe o nome da campanha.' }
  const row = {
    nome, canal: txt(fd.get('canal')) ?? 'outro', inicio: txt(fd.get('inicio')), fim: txt(fd.get('fim')),
    verba: num(fd.get('verba')) ?? 0, link: txt(fd.get('link')), utm: txt(fd.get('utm')), ativa: fd.get('ativa') !== 'off',
  }
  const { error } = id ? await supabase.from('cv_campanhas').update(row).eq('id', id) : await supabase.from('cv_campanhas').insert(row)
  if (error) return { erro: error.message }
  refresh(); return { ok: true }
}

export async function excluirCampanha(id: string): Promise<R> {
  const { supabase } = await exigirVendas()
  const { error } = await supabase.from('cv_campanhas').delete().eq('id', id)
  if (error) return { erro: error.message }
  refresh(); return { ok: true }
}

export async function salvarPreco(fd: FormData): Promise<R> {
  const { supabase } = await exigirVendas()
  const ano = num(fd.get('ano')); const preco = num(fd.get('preco'))
  if (!ano || preco == null) return { erro: 'Informe ano e preço.' }
  const { error } = await supabase.from('cv_precos').upsert({ ano, preco, unidades: num(fd.get('unidades')) ?? 0 }, { onConflict: 'ano' })
  if (error) return { erro: error.message }
  refresh(); return { ok: true }
}

export async function excluirPreco(ano: number): Promise<R> {
  const { supabase } = await exigirVendas()
  const { error } = await supabase.from('cv_precos').delete().eq('ano', ano)
  if (error) return { erro: error.message }
  refresh(); return { ok: true }
}
