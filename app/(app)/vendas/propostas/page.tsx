import Link from 'next/link'
import { exigirVendas } from '@/lib/vendas/server'
import { brl, dataCurta } from '@/lib/vendas/config'
import PropostaAcoes, { type PropostaRow } from '@/components/vendas/PropostaAcoes'
import { Titulo, Abas, card, input, btn, btnAzul } from '@/components/vendas/ui'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { t: string; c: string }> = {
  aberta: { t: 'Aberta', c: '#d97706' }, vendida: { t: 'Vendida', c: '#16a34a' }, perdida: { t: 'Perdida', c: '#64748b' },
}

export default async function PropostasPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = '', status = '' } = await searchParams
  const { supabase } = await exigirVendas()
  let query = supabase.from('cv_propostas').select('*').order('criado_em', { ascending: false }).limit(300)
  if (status) query = query.eq('status', status)
  const termo = q.trim().replace(/[%,()]/g, ' ')
  if (termo) query = query.or(`codigo.ilike.%${termo}%,cliente_nome.ilike.%${termo}%,telefone.ilike.%${termo}%,documento.ilike.%${termo}%,cidade.ilike.%${termo}%`)
  const { data, error } = await query
  const rows = (data ?? []) as PropostaRow[]
  const hoje = new Date().toISOString().slice(0, 10)
  const abertas = rows.filter(r => r.status === 'aberta')
  const vendidas = rows.filter(r => r.status === 'vendida')

  return (
    <div>
      <Titulo sub={`${rows.length} proposta(s) · ${abertas.length} aberta(s) (${brl(abertas.reduce((s, r) => s + Number(r.total), 0))}) · ${vendidas.length} vendida(s)`}
        acao={<Link href="/vendas/proposta" className={btn} style={btnAzul}>+ Nova proposta</Link>}>
        Propostas de venda
      </Titulo>
      <Abas ativa="/vendas/propostas" />
      {error && <p className="mb-3 text-sm text-red-600">Falta criar a tabela de propostas: {error.message}</p>}
      <form className="flex flex-wrap gap-2 mb-4">
        <input name="q" defaultValue={q} placeholder="Buscar por nº (PV-2026-0001), cliente, telefone, CPF/CNPJ ou cidade" className={`${input} max-w-lg`} />
        <select name="status" defaultValue={status} className={`${input} max-w-[160px]`}>
          <option value="">Todas</option><option value="aberta">Abertas</option><option value="vendida">Vendidas</option><option value="perdida">Perdidas</option>
        </select>
        <button className={btn} style={btnAzul}>Buscar</button>
      </form>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="p-3">Nº</th><th className="p-3">Data</th><th className="p-3">Cliente</th><th className="p-3">Itens</th>
            <th className="p-3 text-right">Total</th><th className="p-3">Validade</th><th className="p-3">Situação</th><th className="p-3">Ações</th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const venc = r.status === 'aberta' && r.validade < hoje
              return (
                <tr key={r.id} className="border-b border-slate-100 align-top">
                  <td className="p-3 font-mono font-semibold whitespace-nowrap">{r.codigo}</td>
                  <td className="p-3 whitespace-nowrap">{dataCurta(r.criado_em)}</td>
                  <td className="p-3"><b>{r.cliente_nome}</b><div className="text-xs text-slate-500">{[r.telefone, r.cidade].filter(Boolean).join(' · ')}</div></td>
                  <td className="p-3 text-xs text-slate-600">{r.itens.map(i => `${i.qtd}× ${i.numero ?? i.descricao}${i.ano ? ` (${i.ano})` : ''}`).join(', ')}</td>
                  <td className="p-3 text-right font-semibold whitespace-nowrap">{brl(Number(r.total))}</td>
                  <td className="p-3 whitespace-nowrap" style={venc ? { color: '#dc2626' } : undefined}>{dataCurta(r.validade + 'T12:00:00')}{venc ? ' (vencida)' : ''}</td>
                  <td className="p-3"><span className="text-xs font-bold uppercase px-2 py-1 rounded-lg text-white" style={{ background: STATUS[r.status]?.c }}>{STATUS[r.status]?.t}</span>
                    {r.lead_id && <Link href={`/vendas/leads/${r.lead_id}`} className="block text-xs underline mt-1" style={{ color: '#1B4F8A' }}>ver lead</Link>}</td>
                  <td className="p-3"><PropostaAcoes p={r} /></td>
                </tr>
              )
            })}
            {rows.length === 0 && !error && <tr><td colSpan={8} className="p-6 text-center text-slate-500">Nenhuma proposta encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
