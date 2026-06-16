import { createClient } from '@/lib/supabase/server'
import { InventarioTab } from '@/components/tabs/InventarioTab'

export default async function InventarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: containers }, { data: profile }] = await Promise.all([
    supabase.from('containers').select('*').order('created_at', { ascending: true }),
    supabase.from('user_profiles').select('role').eq('id', user!.id).single(),
  ])

  const role = (profile?.role ?? 'viewer') as 'admin' | 'editor' | 'viewer'

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Inventário de Containers</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Gestão do patrimônio de containers próprios</p>
      </div>
      <InventarioTab
        initialContainers={(containers ?? []) as Parameters<typeof InventarioTab>[0]['initialContainers']}
        role={role}
      />
    </div>
  )
}
