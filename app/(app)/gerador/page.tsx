import { createClient } from '@/lib/supabase/server'
import { GeradorTab } from '@/components/tabs/GeradorTab'

export default async function GeradorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: sessions }, { data: usedRows }] = await Promise.all([
    supabase.from('container_sessions').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
    supabase.from('used_numbers').select('container_key').eq('user_id', user!.id),
  ])

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Gerador de Numeração ISO 6346</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Gere números válidos para containers próprios</p>
      </div>
      <GeradorTab
        initialSessions={(sessions ?? []) as Parameters<typeof GeradorTab>[0]['initialSessions']}
        initialUsedKeys={(usedRows ?? []).map((r: { container_key: string }) => r.container_key)}
      />
    </div>
  )
}
