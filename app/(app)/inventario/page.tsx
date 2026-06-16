import { createClient } from '@/lib/supabase/server'
import { InventarioTab } from '@/components/tabs/InventarioTab'

export default async function InventarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: containers } = await supabase
    .from('containers')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: true })

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Inventário de Containers</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Gestão do patrimônio de containers próprios</p>
      </div>
      <InventarioTab initialContainers={(containers ?? []) as Parameters<typeof InventarioTab>[0]['initialContainers']} />
    </div>
  )
}
