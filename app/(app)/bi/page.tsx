import { createClient } from '@/lib/supabase/server'
import { BiDashboard } from '@/components/bi/BiDashboard'
import { loadBiData } from '@/lib/bi/load'

export const dynamic = 'force-dynamic'

export default async function BiPage() {
  const supabase = await createClient()
  const d = await loadBiData(supabase)

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

  return <BiDashboard ano={d.ano} atualizado={d.atualizado} kpis={d.kpis} trend={d.trend} categorias={d.categorias} />
}
