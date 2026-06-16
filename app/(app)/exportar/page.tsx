import { createClient } from '@/lib/supabase/server'
import { ExportTab } from '@/components/tabs/ExportTab'

export default async function ExportarPage() {
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
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Exportar Inventário</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Exporte em XML compatível ou CSV/XLS</p>
      </div>
      <ExportTab containers={(containers ?? []) as Parameters<typeof ExportTab>[0]['containers']} />
    </div>
  )
}
