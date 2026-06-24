import { getDashboardEquipamentos, getHorasCicloAtual, getConsumoMensal } from '@/app/actions'
import { IndicadoresFiltro } from '@/components/IndicadoresFiltro'
import { IndicadoresCharts } from '@/components/IndicadoresCharts'
import { ConsumoMensalChart, ConsumoMensalTabela } from '@/components/ConsumoMensal'
import { LiveRefresh } from '@/components/LiveRefresh'

export const dynamic = 'force-dynamic'

function fmtMin(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${Math.round(min)}min`
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return `${h}h${m > 0 ? ` ${m}min` : ''}`
}

function Card({ label, value, cor, sub }: { label: string; value: string | number; cor: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e7eb' }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b7280' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: cor }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{sub}</p>}
    </div>
  )
}

export default async function IndicadoresPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: diasParam } = await searchParams
  const dias = diasParam != null ? Number(diasParam) : 30
  const [d, ciclo, consumoMensal] = await Promise.all([getDashboardEquipamentos(dias), getHorasCicloAtual(), getConsumoMensal(6)])
  const t = d.totais
  const disponibilidadePct = t.utilizacaoPct != null ? Math.round((100 - t.utilizacaoPct) * 10) / 10 : null

  return (
    <div>
      <LiveRefresh seconds={60} />
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Dashboard de Equipamentos</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Indicadores da frota: abastecimento, problemas, tempo parado e utilização.</p>
      </div>

      <IndicadoresFiltro />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 max-w-6xl mb-3">
        <Card label="Horas trabalhadas no ciclo" value={`${ciclo.horasTrabalhadas}h`} cor="#1B4F8A" sub={`${ciclo.mesLabel} · 23 a 22, zera no dia 23`} />
        <Card label="Horas trabalhadas (período)" value={t.horasTrabalhadas} cor="#1B4F8A" sub="soma de todas as máquinas" />
        <Card label="Consumo médio" value={t.consumoMedio != null ? `${t.consumoMedio} L/h` : '—'} cor="#9a3412" sub="litros ÷ horas trabalhadas" />
        <Card label="Litros abastecidos" value={`${t.litrosTotal} L`} cor="#9a3412" />
        <Card label="Utilização média" value={t.utilizacaoPct != null ? `${t.utilizacaoPct}%` : '—'} cor="#047857" sub={dias > 0 ? `sobre ${dias} dias` : 'período completo'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-6xl mb-6">
        <Card label="Problemas reportados" value={t.problemas} cor={t.problemas ? '#b91c1c' : '#047857'} sub={`${t.problemasParado} com máquina parada`} />
        <Card label="Tempo parado (total)" value={fmtMin(t.tempoParadoMin)} cor="#b91c1c" />
        <Card label="Resposta do prestador" value={fmtMin(t.tempoRespostaMedioMin)} cor="#1d4ed8" sub="média acionamento → chegada" />
        <Card label="Disponibilidade" value={disponibilidadePct != null ? `${disponibilidadePct}%` : '—'} cor="#047857" sub="100% − utilização" />
      </div>
      <div className="grid grid-cols-2 max-w-6xl mb-6">
        <Card label="Horas sem checklist" value={`${t.horasSemChecklist}h`} cor="#9a3412" sub="gaps de horímetro confirmados pelo admin · já somadas nas horas trabalhadas" />
      </div>

      <div className="bg-white rounded-xl overflow-hidden max-w-full" style={{ border: '1px solid #e5e7eb' }}>
        <div className="px-4 py-3" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <span className="text-sm font-bold" style={{ color: '#1a2a3a' }}>Por equipamento</span>
        </div>
        {d.maquinas.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Sem dados no período selecionado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ color: '#374151' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Equipamento', 'Horímetro', 'Horas trab.', 'Sem checklist', 'Consumo', 'Litros', 'Problemas', 'Tempo parado', 'Resposta', 'Utilização', '% pendência'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.maquinas.map(m => (
                  <tr key={m.equipamento} className="border-t" style={{ borderColor: '#f3f4f6' }}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: '#1a2a3a' }}>{m.equipamento}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{m.horimetroAtual ?? '—'}h</td>
                    <td className="px-3 py-2 whitespace-nowrap">{m.horasTrabalhadas}h</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: m.horasSemChecklist > 0 ? '#9a3412' : 'inherit' }}>{m.horasSemChecklist > 0 ? `${m.horasSemChecklist}h` : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{m.consumoMedio != null ? `${m.consumoMedio} L/h` : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{m.litrosTotal}L</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: m.problemasParado ? '#b91c1c' : 'inherit' }}>
                      {m.problemas}{m.problemasParado > 0 ? ` (${m.problemasParado} parado)` : ''}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtMin(m.tempoParadoMin)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtMin(m.tempoRespostaMedioMin)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{m.utilizacaoPct != null ? `${m.utilizacaoPct}%` : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: (m.pendenciaPct ?? 0) > 0 ? '#b45309' : 'inherit' }}>{m.pendenciaPct != null ? `${m.pendenciaPct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {d.maquinas.length > 0 && (
        <>
          <h2 className="text-sm font-bold mt-6 mb-3" style={{ color: '#1a2a3a' }}>Consumo médio por equipamento</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 max-w-full mb-6">
            {d.maquinas.map(m => (
              <Card key={m.equipamento} label={m.equipamento} value={m.consumoMedio != null ? `${m.consumoMedio} L/h` : '—'} cor="#9a3412" sub={`${m.litrosTotal}L no período`} />
            ))}
          </div>

          <h2 className="text-sm font-bold mb-3" style={{ color: '#1a2a3a' }}>Gráficos</h2>
          <IndicadoresCharts maquinas={d.maquinas} />
        </>
      )}

      {consumoMensal.equipamentos.length > 0 && (
        <>
          <h2 className="text-sm font-bold mt-2 mb-3" style={{ color: '#1a2a3a' }}>Tendência mensal de consumo (últimos 6 meses)</h2>
          <div className="bg-white rounded-xl p-4 mb-4" style={{ border: '1px solid #e5e7eb' }}>
            <ConsumoMensalChart dados={consumoMensal} />
          </div>
          <div className="bg-white rounded-xl overflow-hidden mb-6" style={{ border: '1px solid #e5e7eb' }}>
            <ConsumoMensalTabela dados={consumoMensal} />
          </div>
        </>
      )}
    </div>
  )
}
