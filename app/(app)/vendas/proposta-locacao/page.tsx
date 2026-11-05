import { exigirVendas } from '@/lib/vendas/server'
import { getProprios } from '@/lib/vendas/estoque'
import { formatTelefone, type Lead } from '@/lib/vendas/config'
import LocacaoForm from '@/components/vendas/LocacaoForm'
import { Titulo, Abas } from '@/components/vendas/ui'

export const dynamic = 'force-dynamic'

export default async function PropostaLocacaoPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: leadId } = await searchParams
  const { supabase, role } = await exigirVendas()
  const admin = role === 'admin'
  const proprios = await getProprios(supabase, admin)
  let lead: Lead | null = null
  if (leadId) {
    const { data } = await supabase.from('cv_leads').select('*').eq('id', leadId).maybeSingle()
    lead = (data as Lead | null)
  }
  const cliente = { nome: lead?.nome ?? '', telefone: lead ? formatTelefone(lead.telefone) : '', email: '', documento: '', cidade: lead?.cidade ?? '' }
  return (
    <div>
      <Titulo sub="Containers próprios ou de terceiros, prazo em dias, custos e margem líquida">Proposta de locação</Titulo>
      <Abas ativa="/vendas/proposta-locacao" />
      <LocacaoForm proprios={proprios} cliente={cliente} verMargem={admin} leadId={lead?.id ?? null} />
    </div>
  )
}
