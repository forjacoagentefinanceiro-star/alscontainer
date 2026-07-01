import { getRelatorioOperadores, getRelatorioProblemas, getDashboardEquipamentos } from '@/app/actions'
import { IndicadoresFiltro } from '@/components/IndicadoresFiltro'
import { ExportarCsvButton } from '@/components/ExportarCsvButton'

export const dynamic = 'force-dynamic'

const dataHora = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—')

function fmtMin(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${Math.round(min)}min`
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return `${h}h${m > 0 ? ` ${m}min` : ''}`
}

function statusProblema(resolvido: boolean, chegada: string | null, acionado: string | null): string {
  if (resolvido) return 'Liberado'
  if (chegada) return 'Manutenção no local'
  if (acionado) return 'Prestador acionado'
  return 'Aguardando gestor'
}

function ReportSection({ title, footer, headers, rows, exportName, cells, empty }: {
  title: string
  footer?: string
  headers: string[]
  rows: (string | number)[][]
  exportName: string
  cells: React.ReactNode[][]
  empty: string
}) {
  return (
    <div className="bg-white rounded-xl overflow-hidden max-w-full mb-6" style={{ border: '1px solid #e5e7eb' }}>
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        <span className="text-sm font-bold" style={{ color: '#1a2a3a' }}>{title}</span>
        {rows.length > 0 && <ExportarCsvButton filename={exportName} headers={headers} rows={rows} />}
      </div>
      {cells.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ color: '#374151' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {headers.map(h => <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {cells.map((row, i) => (
                <tr key={i} className="border-t" style={{ borderColor: '#f3f4f6' }}>
                  {row.map((c, j) => <td key={j} className="px-3 py-2 whitespace-nowrap">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footer && <p className="text-xs px-4 py-2" style={{ color: '#9ca3af', background: '#fafafa' }}>{footer}</p>}
    </div>
  )
}

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
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
  const [operadores, problemas, dash] = await Promise.all([
    getRelatorioOperadores(inicio, fim), getRelatorioProblemas(inicio, fim), getDashboardEquipamentos(inicio, fim),
  ])
  const maquinas = dash.maquinas

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Relatórios</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Operadores, consumo, tempo parado e histórico de problemas/manutenção.</p>
      </div>

      <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>Exibindo dados de: <strong style={{ color: '#1a2a3a' }}>{mesLabel}</strong></p>
      <IndicadoresFiltro basePath="/equipamentos/relatorios" />

      {/* Por operador */}
      <ReportSection
        title="Desempenho por operador"
        empty="Sem dados no período selecionado."
        exportName="relatorio_operadores.csv"
        headers={['Operador', 'Checklists', 'Horas trabalhadas', 'Litros', 'Consumo (L/h)', 'Problemas', '% pendência']}
        rows={operadores.map(o => [o.operador, o.checklists, o.horasTrabalhadas, o.litrosTotal, o.consumoMedio ?? '', o.problemas, o.pendenciaPct ?? ''])}
        footer="Horas trabalhadas somam o horímetro (final − inicial) dos checklists abertos por cada operador."
        cells={operadores.map(o => [
          <span key="op" className="font-medium" style={{ color: '#1a2a3a' }}>{o.operador}</span>,
          o.checklists,
          `${o.horasTrabalhadas}h`,
          `${o.litrosTotal}L`,
          o.consumoMedio != null ? `${o.consumoMedio} L/h` : '—',
          <span key="p" style={{ color: o.problemas ? '#b91c1c' : 'inherit' }}>{o.problemas}</span>,
          <span key="pend" style={{ color: (o.pendenciaPct ?? 0) > 0 ? '#b45309' : 'inherit' }}>{o.pendenciaPct != null ? `${o.pendenciaPct}%` : '—'}</span>,
        ])}
      />

      {/* Consumo por máquina */}
      <ReportSection
        title="Consumo de combustível por equipamento"
        empty="Sem dados no período selecionado."
        exportName="relatorio_consumo_maquina.csv"
        headers={['Equipamento', 'Horas trabalhadas', 'Litros abastecidos', 'Consumo (L/h)']}
        rows={maquinas.map(m => [m.equipamento, m.horasTrabalhadas, m.litrosTotal, m.consumoMedio ?? ''])}
        footer="Consumo (L/h) = litros abastecidos ÷ horas trabalhadas no período. Quedas/picos bruscos podem indicar problema mecânico ou desvio."
        cells={maquinas.map(m => [
          <span key="eq" className="font-medium" style={{ color: '#1a2a3a' }}>{m.equipamento}</span>,
          `${m.horasTrabalhadas}h`,
          `${m.litrosTotal}L`,
          m.consumoMedio != null ? `${m.consumoMedio} L/h` : '—',
        ])}
      />

      {/* Tempo parado por máquina */}
      <ReportSection
        title="Tempo parado por equipamento"
        empty="Sem dados no período selecionado."
        exportName="relatorio_tempo_parado_maquina.csv"
        headers={['Equipamento', 'Problemas', 'Com máquina parada', 'Tempo parado (total)', 'Tempo médio por parada']}
        rows={maquinas.map(m => [m.equipamento, m.problemas, m.problemasParado, m.tempoParadoMin, m.tempoMedioParadaMin ?? ''])}
        footer="Tempo médio por parada (MTTR) = tempo parado total ÷ número de paradas já liberadas."
        cells={maquinas.map(m => [
          <span key="eq" className="font-medium" style={{ color: '#1a2a3a' }}>{m.equipamento}</span>,
          <span key="p" style={{ color: m.problemas ? '#b91c1c' : 'inherit' }}>{m.problemas}</span>,
          m.problemasParado,
          <span key="t" style={{ color: m.tempoParadoMin > 0 ? '#b91c1c' : 'inherit' }}>{fmtMin(m.tempoParadoMin)}</span>,
          fmtMin(m.tempoMedioParadaMin),
        ])}
      />

      {/* Problemas detalhado */}
      <ReportSection
        title="Problemas e manutenção — histórico detalhado"
        empty="Nenhum problema reportado no período."
        exportName="relatorio_problemas.csv"
        headers={['Equipamento', 'Operador', 'Data', 'Descrição', 'Parado', 'Prestador', 'Resposta', 'Tempo parado', 'Status']}
        rows={problemas.map(p => [
          p.equipamento, p.operador, dataHora(p.created_at), p.descricao ?? '', p.parado ? 'Sim' : 'Não', p.prestador ?? '',
          p.tempoRespostaMin ?? '', fmtMin(p.tempoParadoMin), statusProblema(p.resolvido, p.chegada_em, p.acionado_em),
        ])}
        cells={problemas.map(p => [
          <span key="eq" className="font-medium" style={{ color: '#1a2a3a' }}>{p.equipamento}</span>,
          p.operador,
          dataHora(p.created_at),
          <span key="d" className="block max-w-xs truncate" title={p.descricao ?? ''}>{p.descricao}</span>,
          <span key="pa" style={{ color: p.parado ? '#b91c1c' : 'inherit' }}>{p.parado ? 'Sim' : 'Não'}</span>,
          p.prestador ?? '—',
          p.tempoRespostaMin != null ? fmtMin(p.tempoRespostaMin) : '—',
          fmtMin(p.tempoParadoMin),
          <span key="s" style={{ color: p.resolvido ? '#047857' : '#b45309' }}>{statusProblema(p.resolvido, p.chegada_em, p.acionado_em)}</span>,
        ])}
      />
    </div>
  )
}
