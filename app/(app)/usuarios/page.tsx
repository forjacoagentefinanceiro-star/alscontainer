import { redirect } from 'next/navigation'
import { getMyProfile, getUsers } from '@/app/actions'
import { UsuariosTab } from '@/components/tabs/UsuariosTab'

export default async function UsuariosPage() {
  const profile = await getMyProfile()
  if (!profile || profile.role !== 'admin') redirect('/inventario')

  const users = await getUsers()

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Gestão de Usuários</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Aprove cadastros e defina permissões de acesso</p>
      </div>
      <UsuariosTab users={users} />
    </div>
  )
}
