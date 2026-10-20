import Link from 'next/link'
import { exigirVendas } from '@/lib/vendas/server'
import { CANAIS, ETAPAS, ETAPA_COR, ETAPA_LABEL, CANAL_LABEL, brl, dataCurta, formatTelefone, type Lead, type Campanha } from '@/lib/vendas/config'
import { Titulo, Abas, input } from '@/components/vendas/ui'

export const dynamic = 'force-dynamic'

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string; canal?: string; etapa?: string; campanha?: string }> }) {
  const sp = await searchParams
  const { supabase } = await exigirVendas()
  let qb = supabase.from('cv_leads').select('*').order('criado_em', { ascending: false }).limit(500)
  if (sp.canal) qb = qb.eq('canal', sp.canal)
  if (sp.etapa) qb = qb.eq('etapa', sp.etapa)
  if (sp.campanha) qb = qb.eq('campanha_id', sp.campanha)
  if (sp.q) {
    const t = sp.q.replace(/[%,()]/g, ' ').trim()
    if (t) qb = qb.or(`nome.ilike.%${t}%,telefone.ilike.%${t}%,cidade.ilike.%${t}%`)
  }
  const [{ data }, { data: c }] = await Promise.all([qb, supabase.from('cv_campanhas').select('*')])
  const leads = (data ?? []) as Lead[]
  const campanhas = (c ?? []) as Campanha[]
  const nomeCamp = Object.fromEntries(campanhas.map(x => [x.id, x.nome]))

  return (
    <div>
      <Titulo sub={`${leads.length} lead(s)`}>Leads</Titulo>
      <Abas ativa="/vendas/leads" />
      <form className="flex flex-wrap gap-2 mb-4">
        <input name="q" defaultValue={sp.q} placeholder="Buscar nome, telefone ou cidade" className={`${input} w-64`} />
        <select name="canal" defaultValue={sp.canal ?? ''} className={`${input} w-auto`}>
          <option value="">Todos os canais</option>
          {CANAIS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
        <select name="etapa" defaultValue={sp.etapa ?? ''} className={`${input} w-auto`}>
          <option value="">Todas as etapas</option>
          {ETAPAS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
        <select name="campanha" defaultValue={sp.campanha ?? ''} className={`${input} w-auto`}>
          <option value="">Todas as campanhas</option>
          {campanhas.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
        <button className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: '#1B4F8A' }}>Filtrar</button>
      </form>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
              <th className="p-3">Nome</th><th className="p-3">Telefone</th><th className="p-3">Canal</th>
              <th className="p-3">Campanha</th><th className="p-3">Ano</th><th className="p-3">Valor</th>
              <th className="p-3">Etapa</th><th className="p-3">Entrou</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-medium"><Link href={`/vendas/leads/${l.id}`} className="block text-slate-900">{l.nome}{l.cidade ? <span className="text-slate-400 font-normal"> · {l.cidade}</span> : null}</Link></td>
                <td className="p-3 whitespace-nowrap">{formatTelefone(l.telefone)}</td>
                <td className="p-3">{CANAL_LABEL[l.canal] ?? l.canal}</td>
                <td className="p-3">{l.campanha_id ? nomeCamp[l.campanha_id] ?? '—' : '—'}</td>
                <td className="p-3">{l.ano_pref ?? '—'}</td>
                <td className="p-3">{brl(l.preco)}</td>
                <td className="p-3"><span className="font-semibold" style={{ color: ETAPA_COR[l.etapa] }}>{ETAPA_LABEL[l.etapa]}</span></td>
                <td className="p-3 whitespace-nowrap">{dataCurta(l.criado_em)}</td>
              </tr>
            ))}
            {leads.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-500">Nenhum lead encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
