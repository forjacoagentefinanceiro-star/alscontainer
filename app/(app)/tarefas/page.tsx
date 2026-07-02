import { redirect } from 'next/navigation'
import { getMyProfile } from '@/app/actions'
import { getDespachaIndicadores } from '@/lib/despacha/load'
import { IndicadoresTarefas } from '@/components/tarefas/IndicadoresTarefas'

export const dynamic = 'force-dynamic'

export default async function TarefasPage() {
  const profile = await getMyProfile()
  if (!profile || profile.role !== 'admin') redirect('/inventario')

  const dados = await getDespachaIndicadores()
  return <IndicadoresTarefas dados={dados} />
}
