import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBarraStatus, getBarragensMonitoramento } from '@/app/actions'
import { MonitoramentoTv } from '@/components/MonitoramentoTv'

export const dynamic = 'force-dynamic'

export default async function TvMonitoramentoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [barra, barragens] = await Promise.all([
    getBarraStatus(),
    getBarragensMonitoramento(),
  ])

  return <MonitoramentoTv barra={barra} barragens={barragens} />
}
