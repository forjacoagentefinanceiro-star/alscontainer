import { exigirVendas } from '@/lib/vendas/server'
import { getEstoque } from '@/lib/vendas/estoque'
import { formatTelefone, type Lead } from '@/lib/vendas/config'
import PropostaForm, { type ItemEstoque } from '@/components/vendas/PropostaForm'
import { Titulo, Abas } from '@/components/vendas/ui'

export const dynamic = 'force-dynamic'

export default async function PropostaPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: leadId } = await searchParams
  const { supabase, role } = await exigirVendas()
  const admin = role === 'admin'
  const { itens } = await getEstoque(supabase)

  // Custo de aquisição (valor_brl) só vai para o navegador se for admin
  const custos: Record<string, number> = {}
  const despesas: Record<string, number> = {}
  if (admin && itens.length) {
    const ids = itens.map(i => i.id)
    const [{ data }, { data: lanc }] = await Promise.all([
      supabase.from('containers').select('id, valor_brl').in('id', ids),
      supabase.from('container_lancamentos').select('container_id, valor').eq('tipo', 'despesa').in('container_id', ids),
    ])
    for (const c of (data ?? []) as { id: string; valor_brl: number | null }[]) custos[c.id] = Number(c.valor_brl ?? 0)
    for (const l of (lanc ?? []) as { container_id: string; valor: number }[]) despesas[l.container_id] = (despesas[l.container_id] ?? 0) + Number(l.valor)
  }
  const estoque: ItemEstoque[] = itens.map(i => ({
    id: i.id, numero: i.numero, tamanho: i.tamanho, ano: i.ano_fabricacao, tipo: i.tipo_venda,
    preco: i.preco_anuncio, custo: admin ? (custos[i.id] ?? 0) : null, despesas: admin ? (despesas[i.id] ?? 0) : null,
  }))

  let lead: Lead | null = null
  if (leadId) {
    const { data } = await supabase.from('cv_leads').select('*').eq('id', leadId).maybeSingle()
    lead = (data as Lead | null)
  }
  const cliente = {
    nome: lead?.nome ?? '', telefone: lead ? formatTelefone(lead.telefone) : '', email: '', documento: '', cidade: lead?.cidade ?? '',
  }

  return (
    <div>
      <Titulo sub="Monte a proposta com containers do estoque e baixe em PDF">Proposta de venda</Titulo>
      <Abas ativa="/vendas/proposta" />
      <PropostaForm estoque={estoque} cliente={cliente} verMargem={admin} leadId={lead?.id ?? null} />
    </div>
  )
}
