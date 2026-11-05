'use server'

import { revalidatePath } from 'next/cache'
import { exigirVendas } from '@/lib/vendas/server'

export type ItemSalvo = {
  container_id: string | null; numero: string | null; ano: number | null
  descricao: string; detalhe: string; qtd: number; unit: number
}
export type PropostaEntrada = {
  cliente_nome: string; telefone: string; email: string; documento: string; cidade: string
  lead_id: string | null; itens: ItemSalvo[]; validade: string   // aaaa-mm-dd
  pagamento: string; frete: string; observacoes: string; ilustrativas: boolean
}
type R<T = object> = ({ ok: true } & T) | { erro: string }
const refresh = () => revalidatePath('/vendas', 'layout')

export async function salvarProposta(d: PropostaEntrada): Promise<R<{ id: string; codigo: string; criado_em: string }>> {
  const { supabase } = await exigirVendas()
  if (!d.cliente_nome.trim()) return { erro: 'Informe o nome do cliente.' }
  if (!d.itens.length) return { erro: 'Inclua ao menos um item.' }
  const total = d.itens.reduce((s, i) => s + i.qtd * i.unit, 0)
  const { data, error } = await supabase.from('cv_propostas').insert({
    cliente_nome: d.cliente_nome.trim(), telefone: d.telefone || null, email: d.email || null,
    documento: d.documento || null, cidade: d.cidade || null, lead_id: d.lead_id,
    itens: d.itens, total, validade: d.validade, pagamento: d.pagamento, frete: d.frete,
    observacoes: d.observacoes || null, ilustrativas: d.ilustrativas,
  }).select('id, codigo, criado_em').single()
  if (error || !data) return { erro: error?.message ?? 'Não consegui registrar a proposta.' }
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

/** Converte a proposta em venda: baixa os containers do estoque e registra a venda no funil. */
export async function converterProposta(id: string): Promise<R> {
  const { supabase } = await exigirVendas()
  const { data } = await supabase.from('cv_propostas').select('*').eq('id', id).single()
  if (!data) return { erro: 'Proposta não encontrada.' }
  const p = data as {
    status: string; cliente_nome: string; telefone: string | null; cidade: string | null; lead_id: string | null
    itens: ItemSalvo[]; total: number; codigo: string
  }
  if (p.status === 'vendida') return { erro: 'Esta proposta já foi convertida em venda.' }
  const agora = new Date().toISOString()
  const hoje = agora.slice(0, 10)

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
