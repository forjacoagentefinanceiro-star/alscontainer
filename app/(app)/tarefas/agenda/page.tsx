import { redirect } from 'next/navigation'
import { getMyProfile } from '@/app/actions'
import { AgendaClient } from '@/components/tabs/AgendaClient'

export default async function AgendaPage() {
  const profile = await getMyProfile()
  if (!profile || profile.role !== 'admin') redirect('/inventario')
  return <AgendaClient />
}
