import { redirect } from 'next/navigation'
import { getMyProfile } from '@/app/actions'
import { getDespachaIndicadores } from '@/lib/despacha/load'
import { IndicadoresTarefas } from '@/components/tarefas/IndicadoresTarefas'

export const dynamic = 'force-dynamic'

export default async function TarefasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const profile = await getMyProfile()
  if (!profile || profile.role !== 'admin') redirect('/inventario')

  const { mes } = await searchParams
  const dados = await getDespachaIndicadores(mes)
  return <IndicadoresTarefas dados={dados} />
}
