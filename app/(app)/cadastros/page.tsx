import { getEmpilhadeiras } from '@/app/actions'
import { EmpilhadeirasManager } from '@/components/EmpilhadeirasManager'

export const dynamic = 'force-dynamic'

export default async function CadastrosPage() {
  const empilhadeiras = await getEmpilhadeiras()

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Cadastros</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Central de cadastros do sistema. Novos cadastros serão adicionados aqui.</p>
      </div>

      <EmpilhadeirasManager empilhadeiras={empilhadeiras} defaultOpen />

      {/* Futuros cadastros entram aqui como novos componentes/cards */}
    </div>
  )
}
