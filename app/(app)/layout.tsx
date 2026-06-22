import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AlertaDesacordos } from '@/components/AlertaDesacordos'
import { getDesacordosAtivos } from '@/app/actions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as string | undefined
  const podeGerenciar = role === 'admin' || role === 'editor'
  const desacordos = podeGerenciar ? await getDesacordosAtivos() : []

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f2f5' }}>
      <Sidebar role={role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar email={user.email!} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {podeGerenciar && <AlertaDesacordos checklists={desacordos} />}
          {children}
        </main>
      </div>
      <BottomNav role={role} />
    </div>
  )
}
