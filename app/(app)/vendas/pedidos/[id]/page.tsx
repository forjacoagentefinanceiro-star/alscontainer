import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirVendas } from '@/lib/vendas/server'
import { Titulo, Abas } from '@/components/vendas/ui'
import PedidoDetalhe from '@/components/vendas/PedidoDetalhe'
import type { PedidoRow, PedidoPagamento } from '../pedidos-actions'

export const dynamic = 'force-dynamic'

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await exigirVendas()

  const { data } = await supabase
    .from('cv_pedidos')
    .select('*, pagamentos:cv_pedido_pagamentos(id, pedido_id, valor, forma, data_recebimento, obs, registrado_em, comprovante_url)')
    .eq('id', id)
    .order('registrado_em', { referencedTable: 'cv_pedido_pagamentos', ascending: true })
    .single()

  if (!data) notFound()

  const pedido = data as PedidoRow & { pagamentos: PedidoPagamento[] }

  return (
    <div>
      <Link href="/vendas/pedidos" className="text-sm text-slate-500 hover:underline">← Pedidos de venda</Link>
      <Titulo sub={`Criado em ${new Date(pedido.criado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`}>
        Pedido {pedido.codigo}
      </Titulo>
      <Abas ativa="/vendas/pedidos" />
      <PedidoDetalhe pedido={pedido} />
    </div>
  )
}
