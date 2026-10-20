import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirVendas } from '@/lib/vendas/server'
import { ETAPA_COR, ETAPA_LABEL, dataHora, type Lead, type Campanha, type Tarefa, type Atividade, brl } from '@/lib/vendas/config'
import { getEstoque, rotuloContainer } from '@/lib/vendas/estoque'
import LeadForm from '@/components/vendas/LeadForm'
import LeadAcoes from '@/components/vendas/LeadAcoes'

export const dynamic = 'force-dynamic'

const ICONE: Record<string, string> = { whatsapp: '💬', etapa: '➡️', nota: '📝', ligacao: '📞', visita: '📍' }

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, role } = await exigirVendas()
  const [{ data: l }, { data: c }, { data: t }, { data: a }, { itens }] = await Promise.all([
    supabase.from('cv_leads').select('*').eq('id', id).maybeSingle(),
    supabase.from('cv_campanhas').select('*'),
    supabase.from('cv_tarefas').select('*').eq('lead_id', id).order('vence_em'),
    supabase.from('cv_atividades').select('*').eq('lead_id', id).order('criado_em', { ascending: false }),
    getEstoque(supabase),
  ])
  if (!l) notFound()
  const lead = l as Lead
  // o container do lead pode já estar fora do estoque (vendido): busca separado para mostrar
  let atual = itens.find(x => x.id === lead.container_id)
  if (!atual && lead.container_id) {
    const { data: ct } = await supabase.from('containers').select('id, numero, tamanho, ano_fabricacao, preco_anuncio, status, obs').eq('id', lead.container_id).maybeSingle()
    if (ct) atual = ct as typeof itens[number]
  }
  const estoque = atual && !itens.some(x => x.id === atual!.id) ? [atual, ...itens] : itens
  const atividades = (a ?? []) as Atividade[]

  return (
    <div>
      <Link href="/vendas" className="text-sm text-slate-500 hover:underline">← Funil</Link>
      <div className="flex flex-wrap items-center gap-3 mt-1 mb-4">
        <h1 className="text-xl font-bold" style={{ color: '#0d1b2e' }}>{lead.nome}</h1>
        <span className="text-xs font-bold uppercase px-2 py-1 rounded-lg text-white" style={{ background: ETAPA_COR[lead.etapa] }}>{ETAPA_LABEL[lead.etapa]}</span>
        {atual && <span className="text-sm font-mono text-slate-600">{rotuloContainer(atual)}</span>}
        {lead.motivo_perda && <span className="text-sm text-slate-500">Motivo: {lead.motivo_perda}</span>}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <LeadAcoes lead={lead} tarefas={(t ?? []) as Tarefa[]} precoTxt={lead.preco ? brl(lead.preco) : atual?.preco_anuncio ? brl(Number(atual.preco_anuncio)) : undefined} />
        </div>
        <div className="space-y-4">
          <LeadForm lead={lead} campanhas={(c ?? []) as Campanha[]} estoque={estoque} podePreco={role === 'admin'} />
          <section className="bg-white rounded-2xl border border-slate-200 p-4">
            <h2 className="font-bold text-sm mb-2" style={{ color: '#0d1b2e' }}>Histórico</h2>
            <ul className="space-y-3">
              {atividades.map(x => (
                <li key={x.id} className="text-sm">
                  <p className="text-xs text-slate-400">{ICONE[x.tipo] ?? '•'} {dataHora(x.criado_em)}</p>
                  <p className="whitespace-pre-wrap text-slate-800">{x.texto}</p>
                </li>
              ))}
              {atividades.length === 0 && <li className="text-sm text-slate-500">Sem registros ainda.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
