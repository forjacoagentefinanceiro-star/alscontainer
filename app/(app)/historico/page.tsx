import { getHistorico, getMyProfile } from '@/app/actions'
import { HistoricoCard } from '@/components/HistoricoCard'
import { HistoricoFiltro } from '@/components/HistoricoFiltro'

export const dynamic = 'force-dynamic'

export default async function HistoricoPage({ searchParams }: { searchParams: Promise<{ equipamento?: string; problema?: string }> }) {
  const { equipamento, problema } = await searchParams
  const [historico, profile] = await Promise.all([getHistorico(150), getMyProfile()])
  const podeEditar = profile?.role === 'admin' || profile?.role === 'editor'
  const equipamentos = [...new Set(historico.map(h => h.checklist.equipamento))].sort((a, b) => a.localeCompare(b))
  let filtrado = equipamento ? historico.filter(h => h.checklist.equipamento === equipamento) : historico
  if (problema === '1') filtrado = filtrado.filter(h => h.eventos.some(e => e.tipo === 'problema'))

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Histórico de checklists</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Checklists realizados e operações encerradas, com paradas, abastecimentos e consumo.</p>
      </div>

      {equipamentos.length > 0 && <HistoricoFiltro equipamentos={equipamentos} />}

      {filtrado.length === 0 ? (
        <p className="text-sm" style={{ color: '#9ca3af' }}>Nenhum checklist encontrado.</p>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {filtrado.map(({ checklist, eventos }) => (
            <HistoricoCard key={checklist.id} checklist={checklist} eventos={eventos} podeEditar={podeEditar} />
          ))}
        </div>
      )}
    </div>
  )
}
