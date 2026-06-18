import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadBiData } from '@/lib/bi/load'
import { BiTelevisao } from '@/components/bi/BiTelevisao'

export const dynamic = 'force-dynamic'

export default async function TvPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const d = await loadBiData(supabase)
  if (d.empty) {
    return (
      <main style={{ minHeight: '100vh', background: '#0d1b2e', color: '#8ca5c8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        Sem indicadores ainda — rode o robô de extração para popular o BI.
      </main>
    )
  }

  return <BiTelevisao ano={d.ano} atualizado={d.atualizado} kpis={d.kpis} trend={d.trend} categorias={d.categorias} />
}
