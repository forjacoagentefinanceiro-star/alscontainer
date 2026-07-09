import { createClient } from '@/lib/supabase/server'
import { BiDashboard } from '@/components/bi/BiDashboard'
import { loadBiData } from '@/lib/bi/load'
import { getMyProfile } from '@/app/actions'

export const dynamic = 'force-dynamic'

export default async function BiPage() {
  const supabase = await createClient()
  const [d, profile] = await Promise.all([loadBiData(supabase), getMyProfile()])
  // admin vê todas; demais veem só as abas liberadas (null = todas)
  const abasPermitidas = profile?.role === 'admin' ? null : (profile?.bi_abas ?? null)

  if (d.empty) {
    return (
      <div style={{ background: '#0d1b2e', borderRadius: 18, padding: 24, minHeight: '100%' }}>
        <h1 style={{ color: '#e6eef7', fontSize: 22, fontWeight: 700 }}>BI Depot</h1>
        <p style={{ color: '#8ca5c8', marginTop: 8 }}>
          Ainda não há indicadores. O robô roda diariamente; rode o workflow no GitHub Actions para popular agora.
        </p>
      </div>
    )
  }

  const podeGerenciar = profile?.role === 'admin' || profile?.role === 'editor'
  return <BiDashboard ano={d.ano} atualizado={d.atualizado} kpis={d.kpis} trend={d.trend} categorias={d.categorias} conferencia={d.conferencia} faturamentoResumo={d.faturamentoResumo} faturamentoMensal={d.faturamentoMensal} faturamentoAnual={d.faturamentoAnual} abasPermitidas={abasPermitidas} podeGerenciar={podeGerenciar} metasPorMes={d.metasPorMes} comparacaoDia={d.comparacaoDia} />
}
