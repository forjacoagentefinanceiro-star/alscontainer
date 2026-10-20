import { getResumoFinanceiro } from '@/app/actions'
import { createClient } from '@/lib/supabase/server'
import { FinanceiroPanel, type VendaInfo } from '@/components/FinanceiroPanel'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage() {
  const resumo = await getResumoFinanceiro()
  const supabase = await createClient()
  const { data: tiposData } = await supabase.from('cv_tipos').select('codigo, preco')
  const preco = Object.fromEntries(((tiposData ?? []) as { codigo: string; preco: number }[]).map(t => [t.codigo, Number(t.preco)]))

  // Containers marcados para venda (no Inventário): margem = preço do tipo − custo (compra + despesas lançadas)
  const vendaPorId: Record<string, VendaInfo> = {}
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  for (const r of resumo) {
    const c = r.container as typeof r.container & { para_venda?: boolean | null; tipo_venda?: string | null }
    if (!c.para_venda || c.status === 'vendido') continue
    const precoVenda = c.tipo_venda ? preco[c.tipo_venda] ?? null : null
    const base = c.data_compra ?? c.created_at
    const dias = base ? Math.max(0, Math.floor((hoje.getTime() - new Date(base.slice(0, 10) + 'T00:00:00').getTime()) / 86400000)) : null
    const margemBruta = precoVenda != null ? precoVenda - r.custoAquisicao : null
    const margemLiquida = precoVenda != null ? precoVenda - r.breakeven : null
    vendaPorId[c.id] = {
      tipo: c.tipo_venda ?? null, precoVenda, compra: r.custoAquisicao, despesas: r.despesas, custoTotal: r.breakeven,
      margemBruta, margemLiquida,
      // margem % = lucro ÷ preço de venda; markup % = lucro ÷ custo
      margemPct: margemLiquida != null && precoVenda ? Math.round((margemLiquida / precoVenda) * 1000) / 10 : null,
      margemBrutaPct: margemBruta != null && precoVenda ? Math.round((margemBruta / precoVenda) * 1000) / 10 : null,
      markupPct: margemLiquida != null && r.breakeven > 0 ? Math.round((margemLiquida / r.breakeven) * 1000) / 10 : null,
      dias,
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Financeiro por Container</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
          Status de locação/venda, receitas, despesas, break-even e margem de venda por unidade.
        </p>
      </div>
      <FinanceiroPanel resumo={resumo} vendaPorId={vendaPorId} />
    </div>
  )
}
