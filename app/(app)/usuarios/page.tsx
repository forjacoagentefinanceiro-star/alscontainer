import { redirect } from 'next/navigation'
import { getMyProfile, getUsers, getSetores } from '@/app/actions'
import { UsuariosTab } from '@/components/tabs/UsuariosTab'
import { CriarOperadorForm } from '@/components/CriarOperadorForm'
import { TestarTelegramButton } from '@/components/TestarTelegramButton'

export default async function UsuariosPage() {
  const profile = await getMyProfile()
  if (!profile || profile.role !== 'admin') redirect('/inventario')

  const [users, setores] = await Promise.all([getUsers(), getSetores()])

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Gestão de Usuários</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Aprove cadastros e defina permissões de acesso</p>
      </div>
      <TestarTelegramButton />
      <CriarOperadorForm />
      <UsuariosTab users={users} setores={setores} />
    </div>
  )
}
