'use server'

import { revalidatePath } from 'next/cache'
import { exigirVendas } from '@/lib/vendas/server'

export type PedidoPagamento = {
  id: string; pedido_id: string; valor: number; forma: string
  data_recebimento: string; obs: string | null; registrado_em: string
  comprovante_url: string | null
}

export type MotoristaItem = {
  container_numero: string
  motorista_nome: string
  motorista_doc: string
  veiculo_placa: string
  veiculo_modelo: string
  liberado_em?: string    // ISO — gravado ao liberar cada container
}

export type PedidoRow = {
  id: string; codigo: string
  proposta_id: string | null; proposta_codigo: string | null
  cliente_nome: string; telefone: string | null; cidade: string | null
  containers: { id: string | null; numero: string; tamanho: string }[]
  total: number; total_pago: number; status: string
  obs_liberacao: string | null; liberado_em: string | null; criado_em: string
  motorista_nome: string | null; motorista_doc: string | null
  veiculo_placa: string | null; veiculo_modelo: string | null
  motoristas: MotoristaItem[] | null
  pagamentos?: PedidoPagamento[]
}

export type DadosMotorista = {
  motoristas: MotoristaItem[]
  obs: string
}

export type DadosLiberacaoContainer = {
  container_numero: string
  motorista_nome: string
  motorista_doc: string
  veiculo_placa: string
  veiculo_modelo: string
  data_retirada?: string   // YYYY-MM-DD; padrão = hoje
}

type R<T = object> = ({ ok: true } & T) | { erro: string }
const refresh = () => revalidatePath('/vendas/pedidos', 'layout')

export async function lancarPagamento(
  pedidoId: string,
  dados: { valor: number; forma: string; data_recebimento: string; obs: string }
): Promise<R> {
  const { supabase } = await exigirVendas()
  const { data: p } = await supabase.from('cv_pedidos').select('total, total_pago, status').eq('id', pedidoId).single()
  if (!p) return { erro: 'Pedido não encontrado.' }
  const ped = p as { total: number; total_pago: number; status: string }
  if (ped.status === 'liberado') return { erro: 'Pedido já foi liberado.' }
  const { error } = await supabase.from('cv_pedido_pagamentos').insert({
    pedido_id: pedidoId, valor: dados.valor, forma: dados.forma,
    data_recebimento: dados.data_recebimento, obs: dados.obs || null,
  })
  if (error) return { erro: error.message }
  const { data: pags } = await supabase.from('cv_pedido_pagamentos').select('valor').eq('pedido_id', pedidoId)
  const novoTotal = ((pags ?? []) as { valor: number }[]).reduce((s, pg) => s + pg.valor, 0)
  const novoStatus = novoTotal >= ped.total ? 'quitado' : novoTotal > 0 ? 'parcialmente_pago' : 'aguardando_pagamento'
  await supabase.from('cv_pedidos').update({ total_pago: novoTotal, status: novoStatus }).eq('id', pedidoId)
  refresh()
  return { ok: true }
}

export async function excluirPagamento(pagamentoId: string, pedidoId: string): Promise<R> {
  const { supabase } = await exigirVendas()
  const { data: p } = await supabase.from('cv_pedidos').select('total, status').eq('id', pedidoId).single()
  if (!p) return { erro: 'Pedido não encontrado.' }
  if ((p as { status: string }).status === 'liberado') return { erro: 'Pedido já liberado. Não é possível excluir pagamentos.' }
  const { error } = await supabase.from('cv_pedido_pagamentos').delete().eq('id', pagamentoId)
  if (error) return { erro: error.message }
  const { data: pags } = await supabase.from('cv_pedido_pagamentos').select('valor').eq('pedido_id', pedidoId)
  const novoTotal = ((pags ?? []) as { valor: number }[]).reduce((s, pg) => s + pg.valor, 0)
  const novoStatus = novoTotal >= (p as { total: number }).total ? 'quitado' : novoTotal > 0 ? 'parcialmente_pago' : 'aguardando_pagamento'
  await supabase.from('cv_pedidos').update({ total_pago: novoTotal, status: novoStatus }).eq('id', pedidoId)
  refresh()
  return { ok: true }
}

export async function salvarComprovanteUrl(pagamentoId: string, url: string): Promise<R> {
  const { supabase } = await exigirVendas()
  const { error } = await supabase.from('cv_pedido_pagamentos').update({ comprovante_url: url }).eq('id', pagamentoId)
  if (error) return { erro: error.message }
  refresh()
  return { ok: true }
}

export async function liberarPedido(pedidoId: string, dados: DadosMotorista): Promise<R> {
  const { supabase } = await exigirVendas()
  const { data: p } = await supabase.from('cv_pedidos').select('total, total_pago, status').eq('id', pedidoId).single()
  if (!p) return { erro: 'Pedido não encontrado.' }
  const ped = p as { total: number; total_pago: number; status: string }
  if (ped.status === 'liberado') return { erro: 'Pedido já foi liberado.' }
  if (ped.total_pago < ped.total) return { erro: `Pedido não está quitado. Faltam ${(ped.total - ped.total_pago).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` }

  const motoristas = dados.motoristas.filter(m => m.motorista_nome.trim() || m.veiculo_placa.trim())
  if (motoristas.length === 0) return { erro: 'Informe pelo menos um motorista e placa.' }
  const semNome = motoristas.find(m => !m.motorista_nome.trim())
  if (semNome) return { erro: `Informe o nome do motorista do container ${semNome.container_numero}.` }
  const semPlaca = motoristas.find(m => !m.veiculo_placa.trim())
  if (semPlaca) return { erro: `Informe a placa do veículo do container ${semPlaca.container_numero}.` }

  const motorizadasNorm = motoristas.map(m => ({
    ...m, motorista_nome: m.motorista_nome.trim(), motorista_doc: m.motorista_doc.trim(),
    veiculo_placa: m.veiculo_placa.trim().toUpperCase(), veiculo_modelo: m.veiculo_modelo.trim(),
  }))
  const primeiro = motorizadasNorm[0]!

  const { error } = await supabase.from('cv_pedidos').update({
    status: 'liberado', liberado_em: new Date().toISOString(),
    obs_liberacao: dados.obs || null,
    motoristas: motorizadasNorm,
    motorista_nome: primeiro.motorista_nome, motorista_doc: primeiro.motorista_doc || null,
    veiculo_placa: primeiro.veiculo_placa, veiculo_modelo: primeiro.veiculo_modelo || null,
  }).eq('id', pedidoId)
  if (error) return { erro: error.message }
  refresh()
  revalidatePath('/vendas/propostas', 'layout')
  return { ok: true }
}

/** Libera um container por vez, gravando motorista+placa no histórico da venda */
export async function liberarContainerPedido(
  pedidoId: string,
  dados: DadosLiberacaoContainer,
): Promise<R<{ todosLiberados: boolean }>> {
  const { supabase } = await exigirVendas()
  const { data: p } = await supabase
    .from('cv_pedidos')
    .select('total, total_pago, status, containers, motoristas')
    .eq('id', pedidoId).single()
  if (!p) return { erro: 'Pedido não encontrado.' }

  const ped = p as {
    total: number; total_pago: number; status: string
    containers: { numero: string; tamanho: string }[]
    motoristas: MotoristaItem[] | null
  }

  if (ped.status === 'liberado') return { erro: 'Todos os containers já foram liberados.' }
  if (ped.total_pago < ped.total)
    return { erro: `Pedido não está quitado. Faltam ${(ped.total - ped.total_pago).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` }
  if (!dados.motorista_nome.trim()) return { erro: 'Informe o nome do motorista.' }
  if (!dados.veiculo_placa.trim()) return { erro: 'Informe a placa do veículo.' }

  const existing: MotoristaItem[] = ped.motoristas ?? []
  if (existing.some(m => m.container_numero === dados.container_numero))
    return { erro: `Container ${dados.container_numero} já foi liberado.` }

  const liberadoEm = dados.data_retirada
    ? new Date(dados.data_retirada + 'T12:00:00-03:00').toISOString()
    : new Date().toISOString()

  const novoMot: MotoristaItem = {
    container_numero: dados.container_numero,
    motorista_nome: dados.motorista_nome.trim(),
    motorista_doc: dados.motorista_doc.trim(),
    veiculo_placa: dados.veiculo_placa.trim().toUpperCase(),
    veiculo_modelo: dados.veiculo_modelo.trim(),
    liberado_em: liberadoEm,
  }

  const novaLista = [...existing, novoMot]
  const todosLiberados = ped.containers.every(c =>
    novaLista.some(m => m.container_numero === c.numero)
  )

  const update: Record<string, unknown> = {
    motoristas: novaLista,
    motorista_nome: novaLista[0]!.motorista_nome,
    motorista_doc: novaLista[0]!.motorista_doc || null,
    veiculo_placa: novaLista[0]!.veiculo_placa,
    veiculo_modelo: novaLista[0]!.veiculo_modelo || null,
  }
  if (todosLiberados) {
    update.status = 'liberado'
    update.liberado_em = new Date().toISOString()
  }

  const { error } = await supabase.from('cv_pedidos').update(update).eq('id', pedidoId)
  if (error) return { erro: error.message }
  refresh()
  revalidatePath('/vendas/propostas', 'layout')
  return { ok: true, todosLiberados }
}

/** Cria pedido manualmente para propostas já vendidas antes desta feature */
export async function criarPedidoManual(propostaId: string): Promise<R<{ id: string; codigo: string }>> {
  const { supabase } = await exigirVendas()
  const { data } = await supabase.from('cv_propostas').select('*').eq('id', propostaId).single()
  if (!data) return { erro: 'Proposta não encontrada.' }
  const p = data as { status: string; tipo: string; cliente_nome: string; telefone: string | null; cidade: string | null; itens: { container_id: string | null; numero: string | null }[]; total: number; codigo: string }
  if (p.status !== 'vendida') return { erro: 'Proposta ainda não foi convertida em venda.' }
  if (p.tipo === 'locacao') return { erro: 'Locações não geram Pedido de Venda.' }
  const { data: existe } = await supabase.from('cv_pedidos').select('id, codigo').eq('proposta_id', propostaId).maybeSingle()
  if (existe) return { ok: true, ...(existe as { id: string; codigo: string }) }
  const idsContainer = p.itens.filter(i => i.container_id).map(i => i.container_id as string)
  const { data: cs } = idsContainer.length
    ? await supabase.from('containers').select('id, numero, tamanho').in('id', idsContainer)
    : { data: [] as { id: string; numero: string; tamanho: string }[] }
  const csMap: Record<string, { numero: string; tamanho: string }> = Object.fromEntries(((cs ?? []) as { id: string; numero: string; tamanho: string }[]).map(c => [c.id, c]))
  const containers = [
    ...p.itens.filter(i => i.container_id).map(i => ({ id: i.container_id, numero: csMap[i.container_id!]?.numero ?? i.numero ?? '', tamanho: csMap[i.container_id!]?.tamanho ?? '' })),
    ...p.itens.filter(i => !i.container_id).map(i => ({ id: null as null, numero: i.numero ?? '', tamanho: '' })),
  ]
  const { data: novo, error } = await supabase.from('cv_pedidos').insert({
    proposta_id: propostaId, proposta_codigo: p.codigo,
    cliente_nome: p.cliente_nome, telefone: p.telefone, cidade: p.cidade,
    containers, total: p.total,
  }).select('id, codigo').single()
  if (error || !novo) return { erro: error?.message ?? 'Não foi possível criar o pedido.' }
  refresh()
  return { ok: true, ...(novo as { id: string; codigo: string }) }
}
