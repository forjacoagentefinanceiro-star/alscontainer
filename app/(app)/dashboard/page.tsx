import { createClient } from '@/lib/supabase/server'
import { getGoal, getMyProfile } from '@/app/actions'
import { DashboardView } from '@/components/tabs/DashboardView'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: containers }, goal, profile] = await Promise.all([
    supabase.from('containers').select('valor_brl, data_compra, created_at').order('created_at', { ascending: true }),
    getGoal(),
    getMyProfile(),
  ])

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Dashboard</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Acompanhamento de metas e orçamento de compras</p>
      </div>
      <DashboardView
        containers={(containers ?? []) as { valor_brl: number | null; data_compra: string | null; created_at: string }[]}
        goal={goal}
        isAdmin={profile?.role === 'admin'}
      />
    </div>
  )
}
