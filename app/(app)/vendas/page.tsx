import { exigirVendas } from '@/lib/vendas/server'
import { brl, type Lead, type Campanha } from '@/lib/vendas/config'
import { getEstoque } from '@/lib/vendas/estoque'
import Kanban from '@/components/vendas/Kanban'
import LeadForm from '@/components/vendas/LeadForm'
import { Titulo, Kpi, Abas } from '@/components/vendas/ui'

export const dynamic = 'force-dynamic'

export default async function VendasPage() {
  const { supabase } = await exigirVendas()
  const [{ data: l, error }, { data: c }, estq, { count: atrasadas }] = await Promise.all([
    supabase.from('cv_leads').select('*').order('atualizado_em', { ascending: false }).limit(600),
    supabase.from('cv_campanhas').select('*').order('criado_em', { ascending: false }),
    getEstoque(supabase),
    supabase.from('cv_tarefas').select('id', { count: 'exact', head: true }).is('concluida_em', null).lt('vence_em', new Date().toISOString()),
  ])

  if (error) {
    return (
      <div className="max-w-xl bg-white rounded-2xl border border-amber-300 p-5">
        <h1 className="font-bold mb-1">Falta criar as tabelas do CRM de vendas</h1>
        <p className="text-sm text-slate-600">Rode o arquivo <code>supabase/crm_vendas.sql</code> no SQL Editor do Supabase e recarregue esta página.</p>
        <p className="text-xs text-slate-400 mt-2">{error.message}</p>
      </div>
    )
  }

  const leads = (l ?? []) as Lead[]
  const campanhas = (c ?? []) as Campanha[]
  const estoque = estq.itens
  const numeros = Object.fromEntries(estoque.map(i => [i.id, i.numero]))
  const abertos = leads.filter(x => x.etapa !== 'vendido' && x.etapa !== 'perdido')
  const vendidos = leads.filter(x => x.etapa === 'vendido')
  const perdidos = leads.filter(x => x.etapa === 'perdido')
  const receita = vendidos.reduce((s, x) => s + (x.preco ?? 0), 0)
  const fechados = vendidos.length + perdidos.length
  const resp = leads.filter(x => x.primeira_resposta_em)
  const tempoMin = resp.length
    ? Math.round(resp.reduce((s, x) => s + (new Date(x.primeira_resposta_em!).getTime() - new Date(x.criado_em).getTime()), 0) / resp.length / 60000)
    : null
  const reservados = new Set(abertos.filter(x => x.container_id).map(x => x.container_id))

  return (
    <div>
      <Titulo sub="Funil de venda dos containers 40' High Cube usados" acao={<LeadForm campanhas={campanhas} estoque={estoque} />}>
        Vendas de Containers
      </Titulo>
      <Abas ativa="/vendas" />
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
        <Kpi label="Leads em aberto" valor={abertos.length} />
        <Kpi label="Vendidos" valor={vendidos.length} nota={brl(receita)} />
        <Kpi label="Conversão" valor={fechados ? `${Math.round((vendidos.length / fechados) * 100)}%` : '—'} nota={`${fechados} fechados`} />
        <Kpi label="1ª resposta (média)" valor={tempoMin == null ? '—' : tempoMin < 60 ? `${tempoMin} min` : `${Math.round(tempoMin / 60)} h`} />
        <Kpi label="Containers à venda" valor={estoque.length} nota={reservados.size ? `${reservados.size} em negociação` : undefined} />
        <Kpi label="Tarefas atrasadas" valor={atrasadas ?? 0} />
      </div>
      <Kanban leads={leads} numeros={numeros} />
    </div>
  )
}
