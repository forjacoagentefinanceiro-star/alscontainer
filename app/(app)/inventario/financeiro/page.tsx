import { getResumoFinanceiro } from '@/app/actions'
import { FinanceiroPanel } from '@/components/FinanceiroPanel'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage() {
  const resumo = await getResumoFinanceiro()
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Financeiro por Container</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
          Status de locação/venda, receitas, despesas e break-even por unidade.
        </p>
      </div>
      <FinanceiroPanel resumo={resumo} />
    </div>
  )
}
