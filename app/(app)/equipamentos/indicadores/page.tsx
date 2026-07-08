import { getDashboardEquipamentos, getHorasCicloAtual, getConsumoMensal, getConfigCiclo, getIndicadoresPorPrestador } from '@/app/actions'
import { IndicadoresFiltro } from '@/components/IndicadoresFiltro'
import { IndicadoresCharts } from '@/components/IndicadoresCharts'
import { ConsumoMensalChart, ConsumoMensalTabela } from '@/components/ConsumoMensal'
import { LiveRefresh } from '@/components/LiveRefresh'
import { MetaHorasCicloEditor } from '@/components/MetaHorasCicloEditor'

export const dynamic = 'force-dynamic'

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

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

function CicloCard({ horasTrabalhadas, mesLabel, meta, diaInicio, gestor }: {
  horasTrabalhadas: number; mesLabel: string; meta: number; diaInicio: number; gestor: boolean
}) {
  const diaFim = diaInicio - 1
  let cor = '#1B4F8A'
  let badge: string | null = null
  if (meta > 0) {
    const pct = horasTrabalhadas / meta
    if (pct > 1) { cor = '#b91c1c'; badge = `${Math.round(pct * 100)}% da meta — EXCEDIDO` }
    else if (pct >= 0.8) { cor = '#92400e'; badge = `${Math.round(pct * 100)}% da meta — atenção` }
    else { badge = `${Math.round(pct * 100)}% de ${meta}h` }
  }
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: `2px solid ${cor}` }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b7280' }}>Horas trabalhadas no ciclo</p>
      <p className="text-2xl font-bold mt-1" style={{ color: cor }}>{horasTrabalhadas}h</p>
      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{mesLabel} · dia {diaInicio} a {diaFim}, zera no dia {diaInicio}</p>
      {meta > 0 && badge && (
        <p className="text-xs font-semibold mt-1" style={{ color: cor }}>{badge}</p>
      )}
      {meta > 0 && (
        <div className="mt-2 rounded-full overflow-hidden h-1.5" style={{ background: '#e5e7eb' }}>
          <div className="h-1.5 rounded-full transition-all" style={{
            width: `${Math.min(100, (horasTrabalhadas / meta) * 100)}%`,
            background: cor,
          }} />
        </div>
      )}
      {gestor && <MetaHorasCicloEditor metaAtual={meta} diaInicioAtual={diaInicio} />}
    </div>
  )
}

export default async function IndicadoresPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams
  const mesAtual = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
  const mes = mesParam ?? mesAtual
  const [ano, mesN] = mes.split('-').map(Number)
  const inicio = new Date(`${ano}-${String(mesN).padStart(2, '0')}-01T00:00:00-03:00`).toISOString()
  const fimISO = mesN === 12
    ? new Date(`${ano + 1}-01-01T00:00:00-03:00`).toISOString()
    : new Date(`${ano}-${String(mesN + 1).padStart(2, '0')}-01T00:00:00-03:00`).toISOString()
  const fim = mes === mesAtual ? null : fimISO
  const mesLabel = `${NOMES_MES[mesN - 1]} ${ano}`

  const [d, ciclo, consumoMensal, cfgCiclo, perfil, prestadores] = await Promise.all([
    getDashboardEquipamentos(inicio, fim),
    getHorasCicloAtual(),
    getConsumoMensal(6),
    getConfigCiclo(),
    import('@/app/actions').then(m => m.getMyProfile()),
    getIndicadoresPorPrestador(inicio, fim),
  ])
  const { metaHoras, diaInicio } = cfgCiclo
  const t = d.totais
  const disponibilidadePct = t.utilizacaoPct != null ? Math.round((100 - t.utilizacaoPct) * 10) / 10 : null
  const pctSemChecklistCiclo = ciclo.horasTrabalhadas > 0 ? Math.round((ciclo.horasSemChecklist / ciclo.horasTrabalhadas) * 1000) / 10 : null
  const pctSemChecklistPeriodo = t.horasTrabalhadas > 0 ? Math.round((t.horasSemChecklist / t.horasTrabalhadas) * 1000) / 10 : null
  const gestor = perfil?.role === 'admin' || perfil?.role === 'editor'

  return (
    <div>
      <LiveRefresh seconds={60} />
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Dashboard de Equipamentos</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Indicadores da frota: abastecimento, problemas, tempo parado e utilização.</p>
      </div>

      <IndicadoresFiltro />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 max-w-6xl mb-3">
        <CicloCard horasTrabalhadas={ciclo.horasTrabalhadas} mesLabel={ciclo.mesLabel} meta={metaHoras} diaInicio={diaInicio} gestor={gestor} />
        <Card label={`Horas trabalhadas — ${mesLabel}`} value={t.horasTrabalhadas} cor="#1B4F8A" sub="soma de todas as máquinas no mês" />
        <Card label="Consumo médio" value={t.consumoMedio != null ? `${t.consumoMedio} L/h` : '—'} cor="#9a3412" sub="litros ÷ horas trabalhadas" />
        <Card label="Litros abastecidos" value={`${t.litrosTotal} L`} cor="#9a3412" />
        <Card label="Utilização média" value={t.utilizacaoPct != null ? `${t.utilizacaoPct}%` : '—'} cor="#047857" sub={`${mesLabel}`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-6xl mb-6">
        <Card label="Problemas reportados" value={t.problemas} cor={t.problemas ? '#b91c1c' : '#047857'} sub={`${t.problemasParado} com máquina parada`} />
        <Card label="Tempo parado (total)" value={fmtMin(t.tempoParadoMin)} cor="#b91c1c" />
        <Card label="Resposta do prestador" value={fmtMin(t.tempoRespostaMedioMin)} cor="#1d4ed8" sub="média acionamento → chegada" />
        <Card label="Disponibilidade" value={disponibilidadePct != null ? `${disponibilidadePct}%` : '—'} cor="#047857" sub="100% − utilização" />
      </div>
      <div className="grid grid-cols-2 max-w-6xl mb-6">
        <Card
          label="Horas sem checklist"
          value={`${t.horasSemChecklist}h`}
          cor="#9a3412"
          sub={
            `${pctSemChecklistCiclo != null ? `${pctSemChecklistCiclo}% do ciclo` : '—'} · ` +
            `${pctSemChecklistPeriodo != null ? `${pctSemChecklistPeriodo}% do período` : '—'} · gaps confirmados pelo admin`
          }
        />
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

      {prestadores.length > 0 && (
        <div className="mt-6 bg-white rounded-xl overflow-hidden max-w-full" style={{ border: '1px solid #e5e7eb' }}>
          <div className="px-4 py-3" style={{ background: '#fef9f0', borderBottom: '1px solid #fed7aa' }}>
            <span className="text-sm font-bold" style={{ color: '#9a3412' }}>Por prestador — tempo parado e resposta</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ color: '#374151' }}>
              <thead>
                <tr style={{ background: '#fef9f0' }}>
                  {['Prestador', 'Acionamentos', 'C/ máq. parada', 'Tempo parado total', 'Tempo parado médio', 'Tempo resposta médio', 'Equipamentos'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: '#9a3412' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prestadores.map(p => (
                  <tr key={p.prestador} className="border-t" style={{ borderColor: '#fed7aa' }}>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: '#1a2a3a' }}>{p.prestador}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.acionamentos}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: p.comParada ? '#b91c1c' : 'inherit' }}>
                      {p.comParada || '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: p.tempoParadoTotalMin > 0 ? '#b91c1c' : 'inherit' }}>
                      {fmtMin(p.tempoParadoTotalMin)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtMin(p.tempoParadoMedioMin)}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#1d4ed8' }}>{fmtMin(p.tempoRespostaMedioMin)}</td>
                    <td className="px-3 py-2" style={{ color: '#6b7280' }}>{p.maquinas.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
