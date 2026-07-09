import Link from 'next/link'
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
          style={{ fontSize: 12, fontWeight: 600, color: '#0d1b2e', background: '#7DC242', padding: '7px 14px', borderRadius: 999, textDecoration: 'none' }}
        >
          Televisão ↗
        </Link>
      </div>
      <MonitoramentoView barra={barra} barragens={barragens} />
    </div>
  )
}
