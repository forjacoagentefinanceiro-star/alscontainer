'use server'

import { revalidatePath } from 'next/cache'
import { exigirVendas } from '@/lib/vendas/server'
import { calcLocacao, type ExtrasLoc, type Modo } from '@/lib/vendas/locacao'

export type ItemSalvo = {
  container_id: string | null; numero: string | null; ano: number | null
  descricao: string; detalhe: string; qtd: number; unit: number
  custo?: number | null   // só em itens sem container (admin)
  // locação (qtd × diária × dias). Custos só para admin
  origem?: 'proprio' | 'terceiro'; fornecedor?: string; custo_mensal?: number | null; modo?: Modo
}
export type PropostaEntrada = {
  cliente_nome: string; telefone: string; email: string; documento: string; cidade: string
  lead_id: string | null; itens: ItemSalvo[]; validade: string   // aaaa-mm-dd
  pagamento: string; frete: string; observacoes: string; ilustrativas: boolean
  tipo?: 'venda' | 'locacao'; dias?: number; extras?: ExtrasLoc
}
type R<T = object> = ({ ok: true } & T) | { erro: string }
const refresh = () => revalidatePath('/vendas', 'layout')

const totalDe = (d: PropostaEntrada) => d.tipo === 'locacao'
  ? calcLocacao(d.itens, d.dias ?? 1, d.extras).receita
  : d.itens.reduce((s, i) => s + i.qtd * i.unit, 0)
const extrasLoc = (d: PropostaEntrada) => (d.tipo === 'locacao' ? (d.extras ?? {}) : {})
const COSTS: (keyof ExtrasLoc)[] = ['frete_pago', 'outros_custos', 'imposto_pct', 'comissao_pct']

export async function salvarProposta(d: PropostaEntrada): Promise<R<{ id: string; codigo: string; criado_em: string }>> {
  const { supabase } = await exigirVendas()
  if (!d.cliente_nome.trim()) return { erro: 'Informe o nome do cliente.' }
  if (!d.itens.length) return { erro: 'Inclua ao menos um item.' }
  if (d.tipo === 'locacao' && !(d.dias && d.dias >= 1)) return { erro: 'Informe o prazo da locação em dias.' }
  const total = totalDe(d)
  const { data, error } = await supabase.from('cv_propostas').insert({
    tipo: d.tipo ?? 'venda', dias: d.tipo === 'locacao' ? d.dias : null, extras: extrasLoc(d),
    cliente_nome: d.cliente_nome.trim(), telefone: d.telefone || null, email: d.email || null,
    documento: d.documento || null, cidade: d.cidade || null, lead_id: d.lead_id,
    itens: d.itens, total, validade: d.validade, pagamento: d.pagamento, frete: d.frete,
    observacoes: d.observacoes || null, ilustrativas: d.ilustrativas,
  }).select('id, codigo, criado_em').single()
  if (error || !data) return { erro: error?.message ?? 'Não consegui registrar a proposta.' }
  refresh()
  return { ok: true, ...(data as { id: string; codigo: string; criado_em: string }) }
}

export async function atualizarProposta(id: string, d: PropostaEntrada): Promise<R<{ id: string; codigo: string; criado_em: string }>> {
  const { supabase, role } = await exigirVendas()
  if (!d.cliente_nome.trim()) return { erro: 'Informe o nome do cliente.' }
  if (!d.itens.length) return { erro: 'Inclua ao menos um item.' }
  const { data: at } = await supabase.from('cv_propostas').select('status, tipo, itens, extras').eq('id', id).single()
  if (!at) return { erro: 'Proposta não encontrada.' }
  const ant = at as { status: string; tipo: string; itens: ItemSalvo[]; extras: ExtrasLoc }
  if (ant.status === 'vendida') return { erro: 'Proposta já fechada e não pode ser alterada.' }
  d.tipo = ant.tipo === 'locacao' ? 'locacao' : 'venda'
  if (d.tipo === 'locacao') {
    if (!(d.dias && d.dias >= 1)) return { erro: 'Informe o prazo da locação em dias.' }
    if (role !== 'admin') {   // quem não é admin não vê nem altera custos: preserva os já gravados
      d.extras = { ...(d.extras ?? {}) }
      for (const k of COSTS) (d.extras as Record<string, unknown>)[k] = ant.extras?.[k]
      d.itens = d.itens.map((i, n) => {
        const o = ant.itens.find(x => (i.container_id && x.container_id === i.container_id)) ?? (i.container_id ? undefined : ant.itens[n])
        return { ...i, custo_mensal: o?.custo_mensal ?? null, modo: o?.modo ?? i.modo }
      })
    }
  }
  const total = totalDe(d)
  const { data, error } = await supabase.from('cv_propostas').update({
    dias: d.tipo === 'locacao' ? d.dias : null, extras: extrasLoc(d),
    cliente_nome: d.cliente_nome.trim(), telefone: d.telefone || null, email: d.email || null,
    documento: d.documento || null, cidade: d.cidade || null,
    itens: d.itens, total, validade: d.validade, pagamento: d.pagamento, frete: d.frete,
    observacoes: d.observacoes || null, ilustrativas: d.ilustrativas,
  }).eq('id', id).select('id, codigo, criado_em').single()
  if (error || !data) return { erro: error?.message ?? 'Não consegui salvar.' }
  refresh()
  return { ok: true, ...(data as { id: string; codigo: string; criado_em: string }) }
}

export async function marcarProposta(id: string, status: 'aberta' | 'perdida'): Promise<R> {
  const { supabase } = await exigirVendas()
  const { data: p } = await supabase.from('cv_propostas').select('status').eq('id', id).single()
  if (!p) return { erro: 'Proposta não encontrada.' }
  if ((p as { status: string }).status === 'vendida') return { erro: 'Proposta já virou venda.' }
  const { error } = await supabase.from('cv_propostas').update({ status }).eq('id', id)
  if (error) return { erro: error.message }
  refresh(); return { ok: true }
}

type PL = {
  cliente_nome: string; lead_id: string | null; itens: ItemSalvo[]; total: number; codigo: string
  dias: number | null; extras: ExtrasLoc
}
/** Fecha a locação: containers próprios ficam "locado" (início/fim/valor mensal); os de terceiros só constam na proposta. */
async function converterLocacao(supabase: Awaited<ReturnType<typeof exigirVendas>>['supabase'], id: string, p: PL, agora: string, hoje: string): Promise<R> {
  const dias = p.dias ?? 1
  const inicio = p.extras?.inicio || hoje
  const fim = new Date(new Date(inicio + 'T12:00:00').getTime() + dias * 86400000).toISOString().slice(0, 10)
  const proprios = p.itens.filter(i => i.container_id)
  if (proprios.length) {
    const { data: cs } = await supabase.from('containers').select('id, numero, status').in('id', proprios.map(i => i.container_id!))
    const ja = ((cs ?? []) as { id: string; numero: string; status: string | null }[]).filter(c => c.status === 'vendido' || c.status === 'locado')
    if (ja.length) return { erro: `Container(es) indisponível(is): ${ja.map(c => c.numero).join(', ')}. Ajuste a proposta ou o estoque.` }
    for (const i of proprios) {
      const { error } = await supabase.from('containers')
        .update({ status: 'locado', locacao_inicio: inicio, locacao_fim: fim, valor_locacao_mensal: Math.round(i.unit * 30 * 100) / 100 }).eq('id', i.container_id!)
      if (error) return { erro: `Não consegui locar o container ${i.numero}: ${error.message}` }
    }
  }
  if (p.lead_id) {
    await supabase.from('cv_atividades').insert({ lead_id: p.lead_id, tipo: 'etapa', texto: `Proposta de locação ${p.codigo} fechada (${dias} dias, ${p.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` })
  }
  const { error } = await supabase.from('cv_propostas').update({ status: 'vendida', vendida_em: agora }).eq('id', id)
  if (error) return { erro: error.message }
  refresh(); revalidatePath('/inventario'); return { ok: true }
}

/** Converte a proposta em venda: baixa os containers do estoque e registra a venda no funil. */
export async function converterProposta(id: string): Promise<R> {
  const { supabase } = await exigirVendas()
  const { data } = await supabase.from('cv_propostas').select('*').eq('id', id).single()
  if (!data) return { erro: 'Proposta não encontrada.' }
  const p = data as {
    status: string; cliente_nome: string; telefone: string | null; cidade: string | null; lead_id: string | null
    itens: ItemSalvo[]; total: number; codigo: string; tipo: string; dias: number | null; extras: ExtrasLoc
  }
  if (p.status === 'vendida') return { erro: 'Esta proposta já foi convertida.' }
  const agora = new Date().toISOString()
  const hoje = agora.slice(0, 10)
  if (p.tipo === 'locacao') return converterLocacao(supabase, id, p, agora, hoje)

  const comEstoque = p.itens.filter(i => i.container_id)
  if (comEstoque.length) {
    const { data: cs } = await supabase.from('containers').select('id, numero, status').in('id', comEstoque.map(i => i.container_id!))
    const ja = ((cs ?? []) as { id: string; numero: string; status: string | null }[]).filter(c => c.status === 'vendido' || c.status === 'locado')
    if (ja.length) return { erro: `Container(es) indisponível(is): ${ja.map(c => c.numero).join(', ')}. Ajuste a proposta ou o estoque.` }
    for (const i of comEstoque) {
      const { error } = await supabase.from('containers')
        .update({ status: 'vendido', valor_venda: i.unit * i.qtd, data_venda: hoje }).eq('id', i.container_id!)
      if (error) return { erro: `Não consegui baixar o container ${i.numero}: ${error.message}` }
    }
  }

  const primeiro = comEstoque[0]?.container_id ?? null
  let leadId = p.lead_id
  if (leadId) {
    await supabase.from('cv_leads').update({
      etapa: 'vendido', preco: p.total, container_id: primeiro, fechado_em: agora, atualizado_em: agora, motivo_perda: null,
    }).eq('id', leadId)
  } else {
    const { data: l } = await supabase.from('cv_leads').insert({
      nome: p.cliente_nome, telefone: p.telefone, cidade: p.cidade, canal: 'outro', etapa: 'vendido',
      preco: p.total, container_id: primeiro, fechado_em: agora, obs: `Venda originada da proposta ${p.codigo}`,
    }).select('id').single()
    leadId = (l as { id: string } | null)?.id ?? null
  }
  if (leadId) {
    await supabase.from('cv_atividades').insert({ lead_id: leadId, tipo: 'etapa', texto: `Proposta ${p.codigo} convertida em venda (${p.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` })
    await supabase.from('cv_tarefas').update({ concluida_em: agora }).eq('lead_id', leadId).is('concluida_em', null)
  }
  const { error } = await supabase.from('cv_propostas').update({ status: 'vendida', vendida_em: agora, lead_id: leadId }).eq('id', id)
  if (error) return { erro: error.message }
  refresh(); revalidatePath('/inventario'); return { ok: true }
}
