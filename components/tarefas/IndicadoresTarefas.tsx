import type { DespachaIndicadores, DespachaBreakdown } from '@/lib/despacha/load'

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
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Indicadores de Tarefas</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Visão consolidada do DespachaApp — somente consulta</p>
      </div>

      {!dados ? (
        <div className="rounded-xl p-8 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <p className="text-sm font-semibold" style={{ color: '#92400e' }}>Integração não configurada</p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
            Verifique <code>DESPACHA_API_BASE_URL</code>/<code>DESPACHA_API_KEY</code> ou a disponibilidade da API do DespachaApp.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
            <Kpi label="Total" value={dados.stats.total} />
            <Kpi label="Pendentes" value={dados.stats.pendente} cor="#92400e" />
            <Kpi label="Em andamento" value={dados.stats.em_andamento} cor="#1d4ed8" />
            <Kpi label="Concluídas" value={dados.stats.concluida} cor="#047857" />
            <Kpi label="Canceladas" value={dados.stats.cancelada} cor="#6b7280" />
            <Kpi label="Atrasadas" value={dados.stats.atrasadas} cor={dados.stats.atrasadas > 0 ? '#b91c1c' : '#1a2a3a'} />
            <Kpi label="Tempo médio" value={tempoMedio(dados.stats.avg_minutes)} />
            <Kpi label="SLA" value={`${dados.stats.sla_compliance_pct}%`} cor={dados.stats.sla_compliance_pct >= 80 ? '#047857' : '#b91c1c'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ranking titulo="Por setor" itens={dados.porSetor} />
            <Ranking titulo="Por prestador" itens={dados.porPrestador} />
          </div>
        </>
      )}
    </div>
  )
}
