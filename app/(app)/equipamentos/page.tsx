import Link from 'next/link'
import { getResumoEquipamentos, getDesacordosAtivos } from '@/app/actions'
import { LiveRefresh } from '@/components/LiveRefresh'
import { DesacordosSection } from '@/components/DesacordosSection'

export const dynamic = 'force-dynamic'

const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

function Card({ label, value, cor, sub }: { label: string; value: number | string; cor: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e7eb' }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b7280' }}>{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color: cor }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{sub}</p>}
    </div>
  )
}

export default async function EquipamentosPage() {
  const [r, desacordos] = await Promise.all([getResumoEquipamentos(), getDesacordosAtivos()])
  if (!r) return <p className="text-sm" style={{ color: '#9ca3af' }}>Sem dados.</p>

  return (
    <div>
      <LiveRefresh seconds={30} />
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Painel de Equipamentos</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Checklist aberto = máquina em operação. Atualiza ao vivo.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/equipamentos/relatorios" className="text-sm font-semibold px-4 py-2 rounded-lg border whitespace-nowrap" style={{ borderColor: '#1B4F8A', color: '#1B4F8A', background: '#fff' }}>
            📄 Relatórios
          </Link>
          <Link href="/equipamentos/indicadores" className="text-sm font-semibold px-4 py-2 rounded-lg text-white whitespace-nowrap" style={{ background: '#1B4F8A' }}>
            📊 Ver dashboard completo →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mb-6">
        <Card label="Em operação" value={r.emOperacao} cor="#047857" sub="checklists abertos" />
        <Card label="Ociosas" value={r.ociosos.length} cor="#6b7280" sub={`de ${r.totalEquip} cadastradas`} />
        <Card label="Checklists hoje" value={r.checklistsHoje} cor="#1B4F8A" />
        <DesacordosSection initial={desacordos} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
        {/* Em operação */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
          <div className="px-4 py-3" style={{ background: '#ecfdf5', borderBottom: '1px solid #a7f3d0' }}>
            <span className="text-sm font-bold" style={{ color: '#047857' }}>Em operação agora ({r.emOperacao})</span>
          </div>
          {r.abertas.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Nenhuma máquina em operação.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {r.abertas.map((a, i) => {
                const cor = a.status === 'parado' ? '#dc2626' : a.status === 'atenção' ? '#f59e0b' : '#22c55e'
                const tituloStatus = a.status === 'parado' ? 'Máquina parada por problema' : a.status === 'atenção' ? 'Problema reportado (operando)' : 'Operando normalmente'
                return (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span title={tituloStatus} className="shrink-0 rounded-full" style={{ width: 9, height: 9, background: cor }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1a2a3a' }}>{a.equipamento}</p>
                        <p className="text-xs truncate" style={{ color: '#9ca3af' }}>{a.operador} · desde {dataHora(a.created_at)}</p>
                      </div>
                    </div>
                    <span className="text-xs shrink-0" style={{ color: '#6b7280' }}>{a.horimetro != null ? `${a.horimetro}h` : '—'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Ociosas */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
          <div className="px-4 py-3" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <span className="text-sm font-bold" style={{ color: '#374151' }}>Ociosas / paradas ({r.ociosos.length})</span>
          </div>
          {r.ociosos.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Todas as máquinas estão em operação.</p>
          ) : (
            <div className="px-4 py-3 flex flex-wrap gap-2">
              {r.ociosos.map(n => (
                <span key={n} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#f3f4f6', color: '#374151' }}>{n}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {r.usosDetalhe.length > 0 && (
        <div className="mt-4 max-w-4xl rounded-xl overflow-hidden" style={{ border: '1px solid #fed7aa', background: '#fff7ed' }}>
          <p className="text-xs font-semibold px-4 py-2" style={{ color: '#b45309' }}>
            🛠️ {r.usosDetalhe.length} uso(s) de máquina sem checklist pendente(s) de revisão
          </p>
          <div className="divide-y" style={{ borderColor: '#fed7aa' }}>
            {r.usosDetalhe.map(u => (
              <div key={u.id} className="px-4 py-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1a2a3a' }}>{u.equipamento} · {u.operador}</p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>{dataHora(u.created_at)}{u.horimetro != null ? ` · ${u.horimetro}h` : ''}</p>
                </div>
                <Link href={`/historico?equipamento=${encodeURIComponent(u.equipamento)}#checklist-${u.checklist_id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border whitespace-nowrap" style={{ borderColor: '#fdba74', color: '#9a3412', background: '#fff' }}>
                  Abrir checklist →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
