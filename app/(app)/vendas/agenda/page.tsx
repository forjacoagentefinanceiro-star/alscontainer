import { exigirVendas } from '@/lib/vendas/server'
import { agoraMs } from '@/lib/vendas/config'
import AgendaLista, { type LinhaAgenda } from '@/components/vendas/AgendaLista'
import { Titulo, Abas } from '@/components/vendas/ui'

export const dynamic = 'force-dynamic'

export default async function AgendaPage() {
  const { supabase } = await exigirVendas()
  const { data } = await supabase
    .from('cv_tarefas')
    .select('id, lead_id, titulo, vence_em, cv_leads(nome, telefone)')
    .is('concluida_em', null)
    .order('vence_em')
    .limit(300)

  const agora = agoraMs()
  const linhas: LinhaAgenda[] = ((data ?? []) as unknown as Array<{
    id: string; lead_id: string; titulo: string; vence_em: string
    cv_leads: { nome: string; telefone: string | null } | { nome: string; telefone: string | null }[] | null
  }>).map(t => {
    const lead = Array.isArray(t.cv_leads) ? t.cv_leads[0] : t.cv_leads
    return {
      id: t.id, lead_id: t.lead_id, titulo: t.titulo, vence_em: t.vence_em,
      nome: lead?.nome ?? '—', telefone: lead?.telefone ?? null,
      atrasada: new Date(t.vence_em).getTime() < agora,
    }
  })
  const atrasadas = linhas.filter(l => l.atrasada).length

  return (
    <div>
      <Titulo sub={`${linhas.length} em aberto · ${atrasadas} atrasada(s), mais antigas primeiro`}>Agenda de vendas</Titulo>
      <Abas ativa="/vendas/agenda" />
      <AgendaLista linhas={linhas} />
    </div>
  )
}
