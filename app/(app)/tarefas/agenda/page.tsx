import { redirect } from 'next/navigation'
import { getMyProfile } from '@/app/actions'
import { getDespachaTasks, getDespachaProviders } from '@/lib/despacha/load'
import { AgendaView } from '@/components/tabs/AgendaView'

export const dynamic = 'force-dynamic'

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>
}) {
  const profile = await getMyProfile()
  if (!profile || profile.role !== 'admin') redirect('/inventario')

  const { m } = await searchParams
  const today = new Date()
  let year  = today.getFullYear()
  let month = today.getMonth() + 1

  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split('-').map(Number)
    year = y; month = mo
  }

  const due_from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay  = new Date(year, month, 0).getDate()
  const due_to   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const [tasksRes, providers] = await Promise.all([
    getDespachaTasks({ due_from, due_to, limit: 100 }),
    getDespachaProviders(),
  ])

  if (!tasksRes && !providers) {
    return (
      <div>
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Agenda de Tarefas</h1>
        </div>
        <div className="rounded-xl p-8 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <p className="text-sm font-semibold" style={{ color: '#92400e' }}>Integração ainda não configurada</p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
            Verifique <code>DESPACHA_API_BASE_URL</code> e <code>DESPACHA_API_KEY</code>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <AgendaView
      tasks={tasksRes?.tasks ?? []}
      providers={providers ?? []}
      year={year}
      month={month}
    />
  )
}
