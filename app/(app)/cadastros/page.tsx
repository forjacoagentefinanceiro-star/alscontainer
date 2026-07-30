import { getEmpilhadeiras, getSetores, getMyProfile } from '@/app/actions'
import { EmpilhadeirasManager } from '@/components/EmpilhadeirasManager'
import { SetoresManager } from '@/components/SetoresManager'

export const dynamic = 'force-dynamic'

export default async function CadastrosPage() {
  const [empilhadeiras, setores, profile] = await Promise.all([
    getEmpilhadeiras(),
    getSetores(),
    getMyProfile(),
  ])
  const isAdmin = profile?.role === 'admin'

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Cadastros</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
          {isAdmin ? 'Central de cadastros do sistema.' : 'Cadastro de equipamentos.'}
        </p>
      </div>

      {isAdmin && <SetoresManager setores={setores} defaultOpen />}
      <EmpilhadeirasManager empilhadeiras={empilhadeiras} setores={setores} defaultOpen={!isAdmin} />
    </div>
  )
}
