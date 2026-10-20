import Link from 'next/link'
import { exigirVendas } from '@/lib/vendas/server'
import { getEstoque } from '@/lib/vendas/estoque'
import { ETAPA_LABEL, brl } from '@/lib/vendas/config'
import { Titulo, Abas } from '@/components/vendas/ui'

export const dynamic = 'force-dynamic'

export default async function EstoquePage() {
  const { supabase, role } = await exigirVendas()
  const { itens, erro } = await getEstoque(supabase)
  const ids = itens.map(i => i.id)
  const { data: l } = ids.length
    ? await supabase.from('cv_leads').select('id, nome, etapa, container_id').in('container_id', ids).not('etapa', 'in', '(vendido,perdido)')
    : { data: [] as { id: string; nome: string; etapa: string; container_id: string }[] }
  const leadsPor: Record<string, { id: string; nome: string; etapa: string }[]> = {}
  for (const x of (l ?? []) as { id: string; nome: string; etapa: string; container_id: string }[]) (leadsPor[x.container_id] ??= []).push(x)

  const porAno: Record<string, number> = {}
  for (const i of itens) { const k = i.ano_fabricacao ? String(i.ano_fabricacao) : 'sem ano'; porAno[k] = (porAno[k] ?? 0) + 1 }
  const podeMarcar = role === 'admin' || role === 'editor'

  return (
    <div>
      <Titulo sub={`${itens.length} container(s) à venda · ${Object.entries(porAno).map(([a, n]) => `${a}: ${n}`).join(' · ') || 'nenhum ainda'}`}>
        Estoque à venda
      </Titulo>
      <Abas ativa="/vendas/estoque" />
      {erro && (
        <div className="mb-4 max-w-xl bg-white rounded-2xl border border-amber-300 p-4 text-sm">
          <p className="font-bold mb-1">Falta rodar o SQL do estoque</p>
          <p className="text-slate-600">Rode <code>supabase/crm_vendas_estoque.sql</code> no SQL Editor do Supabase e recarregue.</p>
          <p className="text-xs text-slate-400 mt-1">{erro}</p>
        </div>
      )}
      <p className="text-sm text-slate-600 mb-3 max-w-2xl">
        Estes são os containers do estoque do ALS Container marcados como <b>Marcar p/ venda</b> no Inventário. {podeMarcar ? (
          <Link href="/inventario" className="underline" style={{ color: '#1B4F8A' }}>Ir ao Inventário</Link>
        ) : 'Peça a um editor para marcar no Inventário.'} Ao fechar a venda no funil, o container sai daqui e fica como vendido no estoque.
      </p>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="p-3">Container</th><th className="p-3">Tamanho</th><th className="p-3">Ano</th>
            <th className="p-3">Preço do anúncio</th><th className="p-3">Situação</th>
          </tr></thead>
          <tbody>
            {itens.map(i => {
              const ls = leadsPor[i.id] ?? []
              return (
                <tr key={i.id} className="border-b border-slate-100">
                  <td className="p-3 font-mono font-semibold">{i.numero}</td>
                  <td className="p-3">{i.tamanho}</td>
                  <td className="p-3">{i.ano_fabricacao ?? '—'}</td>
                  <td className="p-3">{i.preco_anuncio ? brl(Number(i.preco_anuncio)) : <span className="text-slate-400">defina no Inventário</span>}</td>
                  <td className="p-3">
                    {ls.length === 0 ? <span className="font-semibold text-green-700">Disponível</span> : ls.map(x => (
                      <Link key={x.id} href={`/vendas/leads/${x.id}`} className="block text-xs underline" style={{ color: '#1B4F8A' }}>
                        {ETAPA_LABEL[x.etapa]} · {x.nome}
                      </Link>
                    ))}
                  </td>
                </tr>
              )
            })}
            {itens.length === 0 && !erro && <tr><td colSpan={5} className="p-6 text-center text-slate-500">Nenhum container marcado para venda ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
