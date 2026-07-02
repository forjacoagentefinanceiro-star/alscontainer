import type { DespachaIndicadores, DespachaBreakdown } from '@/lib/despacha/load'
import { MesSelector } from './MesSelector'

function Kpi({ label, value, cor }: { label: string; value: string | number; cor?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: cor ?? '#1a2a3a' }}>{value}</p>
    </div>
  )
}

function tempoMedio(min: number): string {
  if (!min) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function Ranking({ titulo, itens }: { titulo: string; itens: DespachaBreakdown[] }) {
  const max = Math.max(1, ...itens.map(i => i.total))
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="px-5 py-3" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        <span className="text-sm font-bold" style={{ color: '#1a2a3a' }}>{titulo}</span>
      </div>
      {itens.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Sem dados</p>
      ) : (
        <div className="p-4 space-y-2">
          {itens.map(i => (
            <div key={i.label}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span style={{ color: '#374151' }}>{i.label}</span>
                <span className="font-semibold" style={{ color: '#1a2a3a' }}>{i.total}</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 6, background: '#f3f4f6' }}>
                <div className="h-full rounded-full" style={{ width: `${(i.total / max) * 100}%`, background: '#1B4F8A' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function IndicadoresTarefas({ dados }: { dados: DespachaIndicadores | null }) {
  if (!dados) {
    return (
      <div>
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Indicadores de Tarefas</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Visão consolidada do DespachaApp — somente consulta</p>
        </div>
        <div className="rounded-xl p-8 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <p className="text-sm font-semibold" style={{ color: '#92400e' }}>Integração não configurada</p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
            Verifique <code>DESPACHA_API_BASE_URL</code>/<code>DESPACHA_API_KEY</code> ou a disponibilidade da API do DespachaApp.
          </p>
        </div>
      </div>
    )
  }

  const k = dados.kpis
  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Indicadores de Tarefas</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>DespachaApp — somente consulta · {dados.labelSelecionado}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-semibold uppercase" style={{ color: '#9ca3af' }}>Mês (por criação)</span>
          <MesSelector meses={dados.meses} selecionado={dados.mesSelecionado} />
        </div>
      </div>

      {/* KPIs do mês selecionado */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <Kpi label="Total" value={k.total} />
        <Kpi label="Pendentes" value={k.pendente} cor="#92400e" />
        <Kpi label="Em andamento" value={k.em_andamento} cor="#1d4ed8" />
        <Kpi label="Concluídas" value={k.concluida} cor="#047857" />
        <Kpi label="Canceladas" value={k.cancelada} cor="#6b7280" />
        <Kpi label="Atrasadas" value={k.atrasadas} cor={k.atrasadas > 0 ? '#b91c1c' : '#1a2a3a'} />
        <Kpi label="Tempo médio" value={tempoMedio(k.avg_minutes)} />
        <Kpi label="SLA" value={`${k.sla_compliance_pct}%`} cor={k.sla_compliance_pct >= 80 ? '#047857' : '#b91c1c'} />
      </div>

      {/* Quebras do mês selecionado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Ranking titulo="Por setor" itens={dados.porSetor} />
        <Ranking titulo="Por prestador" itens={dados.porPrestador} />
      </div>

      {/* Evolução mês a mês (comparativo) */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="px-5 py-3" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <span className="text-sm font-bold" style={{ color: '#1a2a3a' }}>Evolução mês a mês</span>
          <span className="text-xs ml-2" style={{ color: '#9ca3af' }}>por data de criação</span>
        </div>
        {dados.evolucao.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Sem dados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#6b7280', background: '#fafafa' }}>
                  <th className="text-left px-4 py-2 font-semibold">Mês</th>
                  <th className="text-right px-3 py-2 font-semibold">Total</th>
                  <th className="text-right px-3 py-2 font-semibold">Pend.</th>
                  <th className="text-right px-3 py-2 font-semibold">Em and.</th>
                  <th className="text-right px-3 py-2 font-semibold">Concl.</th>
                  <th className="text-right px-3 py-2 font-semibold">Canc.</th>
                  <th className="text-right px-3 py-2 font-semibold">Atras.</th>
                </tr>
              </thead>
              <tbody>
                {dados.evolucao.map(m => {
                  const sel = m.key === dados.mesSelecionado
                  return (
                    <tr key={m.key} style={{ borderTop: '1px solid #f3f4f6', background: sel ? '#eff6ff' : 'transparent' }}>
                      <td className="px-4 py-2 font-medium" style={{ color: '#1a2a3a' }}>{m.label}</td>
                      <td className="text-right px-3 py-2 font-semibold" style={{ color: '#1a2a3a' }}>{m.total}</td>
                      <td className="text-right px-3 py-2" style={{ color: '#92400e' }}>{m.pendente}</td>
                      <td className="text-right px-3 py-2" style={{ color: '#1d4ed8' }}>{m.em_andamento}</td>
                      <td className="text-right px-3 py-2" style={{ color: '#047857' }}>{m.concluida}</td>
                      <td className="text-right px-3 py-2" style={{ color: '#6b7280' }}>{m.cancelada}</td>
                      <td className="text-right px-3 py-2" style={{ color: m.atrasadas > 0 ? '#b91c1c' : '#9ca3af' }}>{m.atrasadas}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
