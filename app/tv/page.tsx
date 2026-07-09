import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadBiData } from '@/lib/bi/load'
import { BiTelevisao } from '@/components/bi/BiTelevisao'
import { getDashboardEquipamentos, getHorasCicloAtual, getConfigCiclo, getBarraStatus, getBarragensMonitoramento } from '@/app/actions'

export const dynamic = 'force-dynamic'

export default async function TvPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const mesAtual = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
  const [ano, mesN] = mesAtual.split('-').map(Number)
  const inicio = new Date(`${ano}-${String(mesN).padStart(2, '0')}-01T00:00:00-03:00`).toISOString()

  const [d, dash, ciclo, cfgCiclo, barra, barragens] = await Promise.all([
    loadBiData(supabase),
    getDashboardEquipamentos(inicio, null),
    getHorasCicloAtual(),
    getConfigCiclo(),
    getBarraStatus(),
    getBarragensMonitoramento(),
  ])

  if (d.empty) {
    return (
      <main style={{ minHeight: '100vh', background: '#0d1b2e', color: '#8ca5c8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        Sem indicadores ainda — rode o robô de extração para popular o BI.
      </main>
    )
  }

  return (
    <BiTelevisao
      ano={d.ano} atualizado={d.atualizado} kpis={d.kpis} trend={d.trend} categorias={d.categorias}
      equipamentos={dash} ciclo={ciclo} configCiclo={cfgCiclo}
      barra={barra} barragens={barragens}
    />
  )
}
