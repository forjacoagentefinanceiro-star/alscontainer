import Link from 'next/link'
import { Tv2 } from 'lucide-react'
import { getBarraStatus, getBarragensMonitoramento } from '@/app/actions'
import { MonitoramentoView } from '@/components/MonitoramentoView'

export const dynamic = 'force-dynamic'

export default async function MonitoramentoPage() {
  const [barra, barragens] = await Promise.all([
    getBarraStatus(),
    getBarragensMonitoramento(),
  ])

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Monitoramento Climático</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
            Barra do Itajaí · Barragens · Nível do Rio — atualização automática a cada 15 min
          </p>
        </div>
        <Link
          href="/tv/monitoramento"
          target="_blank"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shrink-0"
          style={{ background: '#0d1b2e', color: '#60a5fa', textDecoration: 'none' }}
        >
          <Tv2 size={16} />
          Televisão
        </Link>
      </div>
      <MonitoramentoView barra={barra} barragens={barragens} />
    </div>
  )
}
