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
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Monitoramento Climático</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
          Barra do Itajaí · Barragens · Nível do Rio — atualização automática a cada 15 min
        </p>
      </div>
      <MonitoramentoView barra={barra} barragens={barragens} />
    </div>
  )
}
