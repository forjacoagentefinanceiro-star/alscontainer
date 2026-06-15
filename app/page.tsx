import { createClient } from '@/lib/supabase/server'
import { ContainerApp } from '@/components/ContainerApp'
import { logout } from './actions'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sessions } = await supabase
    .from('container_sessions')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const { data: usedRows } = await supabase
    .from('used_numbers')
    .select('container_key')
    .eq('user_id', user!.id)

  const usedKeys: string[] = (usedRows ?? []).map((r: { container_key: string }) => r.container_key)

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">📦 Gerador de Container</h1>
          <p className="text-xs text-slate-500">ISO 6346 · {user!.email}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-1.5 transition-colors"
          >
            Sair
          </button>
        </form>
      </div>
      <ContainerApp initialSessions={sessions ?? []} initialUsedKeys={usedKeys} />
    </div>
  )
}
