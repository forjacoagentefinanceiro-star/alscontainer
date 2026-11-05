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
  if (admin && itens.length) {
    const { data } = await supabase.from('containers').select('id, valor_brl').in('id', itens.map(i => i.id))
    for (const c of (data ?? []) as { id: string; valor_brl: number | null }[]) custos[c.id] = Number(c.valor_brl ?? 0)
  }
  const estoque: ItemEstoque[] = itens.map(i => ({
    id: i.id, numero: i.numero, tamanho: i.tamanho, ano: i.ano_fabricacao, tipo: i.tipo_venda,
    preco: i.preco_anuncio, custo: admin ? (custos[i.id] ?? 0) : null,
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
      <PropostaForm estoque={estoque} cliente={cliente} verMargem={admin} />
    </div>
  )
}
