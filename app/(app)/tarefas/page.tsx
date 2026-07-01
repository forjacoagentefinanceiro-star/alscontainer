import { redirect } from 'next/navigation'
import { getMyProfile } from '@/app/actions'
import { getDespachaStats, getDespachaTasks, getDespachaProviders } from '@/lib/despacha/load'
import { TarefasView } from '@/components/tabs/TarefasView'
import type { DespachaStatus, DespachaUrgency } from '@/lib/despacha/types'

export const dynamic = 'force-dynamic'

export default async function TarefasPage({ searchParams }: { searchParams: Promise<{ status?: string; urgency?: string }> }) {
  const profile = await getMyProfile()
  if (!profile || profile.role !== 'admin') redirect('/inventario')

  const { status, urgency } = await searchParams
  const filtroStatus = status as DespachaStatus | undefined
  const filtroUrgencia = urgency as DespachaUrgency | undefined

  const [stats, tasksRes, providers] = await Promise.all([
    getDespachaStats(),
    getDespachaTasks({ status: filtroStatus, urgency: filtroUrgencia, limit: 50 }),
    getDespachaProviders(),
  ])

  if (!stats && !tasksRes) {
    return (
      <div>
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Tarefas (DespachaApp)</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Solicitações, dashboard e notificações do DespachaApp</p>
        </div>
        <div className="rounded-xl p-8 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <p className="text-sm font-semibold" style={{ color: '#92400e' }}>Integração ainda não configurada</p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
            Verifique <code>DESPACHA_API_BASE_URL</code> e <code>DESPACHA_API_KEY</code> no ambiente, ou se a API do DespachaApp está disponível.
          </p>
        </div>
      </div>
    )
  }

  return (
    <TarefasView
      stats={stats}
      tasks={tasksRes?.tasks ?? []}
      total={tasksRes?.total ?? 0}
      providers={providers}
      filtroStatus={filtroStatus}
      filtroUrgencia={filtroUrgencia}
    />
  )
}
