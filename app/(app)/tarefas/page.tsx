import { redirect } from 'next/navigation'
import { getMyProfile } from '@/app/actions'
import { TarefasClient } from '@/components/tabs/TarefasClient'

export default async function TarefasPage() {
  const profile = await getMyProfile()
  if (!profile || profile.role !== 'admin') redirect('/inventario')
  return <TarefasClient />
}
