import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirVendas } from '@/lib/vendas/server'
import { Titulo, Abas } from '@/components/vendas/ui'
import PedidoDetalhe from '@/components/vendas/PedidoDetalhe'
import type { PedidoRow, PedidoPagamento } from '../pedidos-actions'
import { getCustos } from '@/lib/vendas/custos'
import type { FechamentoDados } from '@/lib/vendas/liberacaoPdf'
import type { ItemSalvo } from '../../propostas-actions'

export const dynamic = 'force-dynamic'

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, role } = await exigirVendas()
  const admin = role === 'admin'

  const { data } = await supabase
    .from('cv_pedidos')
    .select('*, pagamentos:cv_pedido_pagamentos(*)')
    .eq('id', id)
    .order('registrado_em', { referencedTable: 'cv_pedido_pagamentos', ascending: true })
    .single()

  if (!data) notFound()

  const pedido = data as PedidoRow & { pagamentos: PedidoPagamento[] }

  // Dados de fechamento só para admin, quando há proposta
  let fechamentoDados: FechamentoDados | null = null
  if (admin && pedido.proposta_id) {
    const { data: prop } = await supabase
      .from('cv_propostas')
      .select('codigo, itens, desconto, extras')
      .eq('id', pedido.proposta_id)
      .maybeSingle()

    if (prop) {
      const p = prop as {
        codigo: string
        itens: ItemSalvo[]
        desconto: number | null
        extras: Record<string, number | null> | null
      }

      const containerIds = pedido.containers
        .filter(c => c.id)
        .map(c => c.id as string)

      const custos = containerIds.length ? await getCustos(supabase, containerIds) : {}

      const items = pedido.containers.map(c => {
        const item = p.itens.find(i => i.container_id === c.id)
        const precoVenda = item ? item.qtd * item.unit : 0
        const custoC = c.id ? (custos[c.id]?.custo ?? 0) : (item?.custo ?? 0)
        const despesasC = c.id ? (custos[c.id]?.despesas ?? 0) : 0
        return {
          numero: (c as { numero: string }).numero,
          tamanho: (c as { tamanho: string }).tamanho,
          precoVenda,
          custoAquisicao: custoC,
          despesas: despesasC,
        }
      })

      const extras = p.extras ?? {}
      fechamentoDados = {
        pedidoCodigo: pedido.codigo,
        propostaCodigo: pedido.proposta_codigo,
        clienteNome: pedido.cliente_nome,
        cidade: pedido.cidade,
        criadoEm: pedido.criado_em,
        liberadoEm: pedido.liberado_em,
        items,
        totalVenda: pedido.total,
        descontoAplicado: p.desconto ?? 0,
        fretePago: Number(extras.frete_pago ?? 0),
        outrosCustos: Number(extras.outros_custos ?? 0),
        impostoPct: Number(extras.imposto_pct ?? 0),
        comissaoPct: Number(extras.comissao_pct ?? 0),
        pagamentos: (pedido.pagamentos ?? []).map(pg => ({
          forma: pg.forma,
          valor: pg.valor,
          data: pg.data_recebimento,
        })),
      }
    }
  }

  return (
    <div>
      <Link href="/vendas/pedidos" className="text-sm text-slate-500 hover:underline">← Pedidos de venda</Link>
      <Titulo sub={`Criado em ${new Date(pedido.criado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`}>
        Pedido {pedido.codigo}
      </Titulo>
      <Abas ativa="/vendas/pedidos" />
      <PedidoDetalhe pedido={pedido} fechamentoDados={fechamentoDados} />
    </div>
  )
}
