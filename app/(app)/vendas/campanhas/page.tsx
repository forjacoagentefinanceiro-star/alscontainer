import { exigirVendas } from '@/lib/vendas/server'
import { CANAIS, CANAL_LABEL, brl, dataCurta, type Lead, type Campanha } from '@/lib/vendas/config'
import { NovaCampanha, EditarCampanha } from '@/components/vendas/CampanhaForm'
import { Titulo, Abas } from '@/components/vendas/ui'

export const dynamic = 'force-dynamic'

type Metrica = { leads: number; vendas: number; receita: number }
const zero = (): Metrica => ({ leads: 0, vendas: 0, receita: 0 })
const cpl = (verba: number, n: number) => (n > 0 && verba > 0 ? brl(verba / n) : '—')

export default async function CampanhasPage() {
  const { supabase } = await exigirVendas()
  const [{ data: c }, { data: l }] = await Promise.all([
    supabase.from('cv_campanhas').select('*').order('criado_em', { ascending: false }),
    supabase.from('cv_leads').select('id, canal, campanha_id, etapa, preco').limit(5000),
  ])
  const campanhas = (c ?? []) as Campanha[]
  const leads = (l ?? []) as Pick<Lead, 'id' | 'canal' | 'campanha_id' | 'etapa' | 'preco'>[]

  const porCamp: Record<string, Metrica> = {}
  const porCanal: Record<string, Metrica> = {}
  for (const x of leads) {
    const mc = (porCanal[x.canal] ??= zero())
    mc.leads++
    if (x.etapa === 'vendido') { mc.vendas++; mc.receita += x.preco ?? 0 }
    if (x.campanha_id) {
      const m = (porCamp[x.campanha_id] ??= zero())
      m.leads++
      if (x.etapa === 'vendido') { m.vendas++; m.receita += x.preco ?? 0 }
    }
  }
  const verbaCanal: Record<string, number> = {}
  for (const x of campanhas) verbaCanal[x.canal] = (verbaCanal[x.canal] ?? 0) + Number(x.verba)

  return (
    <div>
      <Titulo sub="Cadastre cada anúncio ou ação, informe o gasto e veja o custo por lead e por venda" acao={<NovaCampanha />}>Campanhas</Titulo>
      <Abas ativa="/vendas/campanhas" />

      <h2 className="font-bold text-sm mb-2" style={{ color: '#0d1b2e' }}>Resultado por canal</h2>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="p-3">Canal</th><th className="p-3">Leads</th><th className="p-3">Vendas</th><th className="p-3">Conversão</th>
            <th className="p-3">Gasto</th><th className="p-3">Custo/lead</th><th className="p-3">Custo/venda</th><th className="p-3">Receita</th>
          </tr></thead>
          <tbody>
            {CANAIS.map(ch => {
              const m = porCanal[ch.key] ?? zero(); const g = verbaCanal[ch.key] ?? 0
              return (
                <tr key={ch.key} className="border-b border-slate-100">
                  <td className="p-3 font-medium">{ch.label}</td><td className="p-3">{m.leads}</td><td className="p-3">{m.vendas}</td>
                  <td className="p-3">{m.leads ? `${Math.round((m.vendas / m.leads) * 100)}%` : '—'}</td>
                  <td className="p-3">{g ? brl(g) : '—'}</td><td className="p-3">{cpl(g, m.leads)}</td><td className="p-3">{cpl(g, m.vendas)}</td>
                  <td className="p-3">{m.receita ? brl(m.receita) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2 className="font-bold text-sm mb-2" style={{ color: '#0d1b2e' }}>Campanhas</h2>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="p-3">Campanha</th><th className="p-3">Canal</th><th className="p-3">Período</th><th className="p-3">Gasto</th>
            <th className="p-3">Leads</th><th className="p-3">Vendas</th><th className="p-3">Custo/lead</th><th className="p-3">Custo/venda</th><th className="p-3" />
          </tr></thead>
          <tbody>
            {campanhas.map(x => {
              const m = porCamp[x.id] ?? zero()
              return (
                <tr key={x.id} className="border-b border-slate-100" style={{ opacity: x.ativa ? 1 : 0.55 }}>
                  <td className="p-3 font-medium">{x.link ? <a href={x.link} target="_blank" rel="noreferrer" className="underline">{x.nome}</a> : x.nome}</td>
                  <td className="p-3">{CANAL_LABEL[x.canal] ?? x.canal}</td>
                  <td className="p-3 whitespace-nowrap">{x.inicio ? dataCurta(x.inicio + 'T12:00:00') : '—'}{x.fim ? ` → ${dataCurta(x.fim + 'T12:00:00')}` : ''}</td>
                  <td className="p-3">{Number(x.verba) ? brl(Number(x.verba)) : '—'}</td>
                  <td className="p-3">{m.leads}</td><td className="p-3">{m.vendas}</td>
                  <td className="p-3">{cpl(Number(x.verba), m.leads)}</td><td className="p-3">{cpl(Number(x.verba), m.vendas)}</td>
                  <td className="p-3"><EditarCampanha campanha={x} /></td>
                </tr>
              )
            })}
            {campanhas.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-500">Nenhuma campanha ainda. Crie uma e escolha-a ao cadastrar cada lead.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
