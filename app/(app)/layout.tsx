import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AlertaDesacordos } from '@/components/AlertaDesacordos'
import { AlertaUsoSemChecklist } from '@/components/AlertaUsoSemChecklist'
import { AlertaProblemas } from '@/components/AlertaProblemas'
import { AlertaTarefas } from '@/components/AlertaTarefas'
import { LiveRefresh } from '@/components/LiveRefresh'
import { getDesacordosAtivos, getUsosSemChecklist, getProblemasAtivos, getBarraStatus } from '@/app/actions'
import { getDespachaAlertCounts } from '@/lib/despacha/load'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Lê role, modulos e setor em uma única query
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, modulos, setor')
    .eq('id', user.id)
    .single()

  const role = (profile as Record<string, unknown> | null)?.role as string | undefined
  const modulos = (profile as Record<string, unknown> | null)?.modulos as string[] | null ?? null
  const setor = (profile as Record<string, unknown> | null)?.setor as string | null ?? null
  const podeGerenciar = role === 'admin' || role === 'editor'
  const isAdmin = role === 'admin'
  let desacordos: Awaited<ReturnType<typeof getDesacordosAtivos>> = []
  let usosSemChecklist: Awaited<ReturnType<typeof getUsosSemChecklist>> = []
  let problemas: Awaited<ReturnType<typeof getProblemasAtivos>> = []
  let barra: Awaited<ReturnType<typeof getBarraStatus>> = null
  if (podeGerenciar) {
    const res = await Promise.allSettled([
      getDesacordosAtivos(setor),
      getUsosSemChecklist(setor),
      getProblemasAtivos(setor),
      getBarraStatus(),
    ])
    if (res[0].status === 'fulfilled') desacordos = res[0].value
    if (res[1].status === 'fulfilled') usosSemChecklist = res[1].value
    if (res[2].status === 'fulfilled') problemas = res[2].value
    if (res[3].status === 'fulfilled') barra = res[3].value
  }
  let tarefasAlerta: Awaited<ReturnType<typeof getDespachaAlertCounts>> = null
  if (isAdmin) {
    try { tarefasAlerta = await getDespachaAlertCounts() } catch { tarefasAlerta = null }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f2f5' }}>
      <Sidebar role={role} modulos={modulos} setor={setor} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar email={user.email!} barra={barra} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {podeGerenciar && <LiveRefresh seconds={30} />}
          {podeGerenciar && <AlertaDesacordos checklists={desacordos} />}
          {podeGerenciar && <AlertaUsoSemChecklist usos={usosSemChecklist} />}
          {podeGerenciar && <AlertaProblemas problemas={problemas} />}
          {isAdmin && tarefasAlerta && <AlertaTarefas {...tarefasAlerta} />}
          {children}
        </main>
      </div>
      <BottomNav role={role} modulos={modulos} setor={setor} />
    </div>
  )
}
