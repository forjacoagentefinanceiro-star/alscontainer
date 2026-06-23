import { getRelatorioOperadores, getRelatorioProblemas } from '@/app/actions'
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

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: diasParam } = await searchParams
  const dias = diasParam != null ? Number(diasParam) : 30
  const [operadores, problemas] = await Promise.all([getRelatorioOperadores(dias), getRelatorioProblemas(dias)])

  const headersOp = ['Operador', 'Checklists', 'Horas trabalhadas', 'Litros', 'Consumo (L/h)', 'Problemas', '% pendência']
  const rowsOp = operadores.map(o => [o.operador, o.checklists, o.horasTrabalhadas, o.litrosTotal, o.consumoMedio ?? '', o.problemas, o.pendenciaPct ?? ''])

  const headersProb = ['Equipamento', 'Operador', 'Data', 'Descrição', 'Parado', 'Prestador', 'Resposta (min)', 'Tempo parado', 'Status']
  const rowsProb = problemas.map(p => [
    p.equipamento, p.operador, dataHora(p.created_at), p.descricao ?? '', p.parado ? 'Sim' : 'Não', p.prestador ?? '',
    p.tempoRespostaMin ?? '', fmtMin(p.tempoParadoMin), statusProblema(p.resolvido, p.chegada_em, p.acionado_em),
  ])

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Relatórios</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Desempenho por operador e histórico detalhado de problemas/manutenção.</p>
      </div>

      <IndicadoresFiltro basePath="/equipamentos/relatorios" />

      {/* Relatório por operador */}
      <div className="bg-white rounded-xl overflow-hidden max-w-full mb-6" style={{ border: '1px solid #e5e7eb' }}>
        <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <span className="text-sm font-bold" style={{ color: '#1a2a3a' }}>Desempenho por operador</span>
          {operadores.length > 0 && <ExportarCsvButton filename="relatorio_operadores.csv" headers={headersOp} rows={rowsOp} />}
        </div>
        {operadores.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Sem dados no período selecionado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ color: '#374151' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {headersOp.map(h => <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {operadores.map(o => (
                  <tr key={o.operador} className="border-t" style={{ borderColor: '#f3f4f6' }}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: '#1a2a3a' }}>{o.operador}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{o.checklists}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{o.horasTrabalhadas}h</td>
                    <td className="px-3 py-2 whitespace-nowrap">{o.litrosTotal}L</td>
                    <td className="px-3 py-2 whitespace-nowrap">{o.consumoMedio != null ? `${o.consumoMedio} L/h` : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: o.problemas ? '#b91c1c' : 'inherit' }}>{o.problemas}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: (o.pendenciaPct ?? 0) > 0 ? '#b45309' : 'inherit' }}>{o.pendenciaPct != null ? `${o.pendenciaPct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs px-4 py-2" style={{ color: '#9ca3af', background: '#fafafa' }}>
          Horas trabalhadas somam o horímetro (final − inicial) dos checklists abertos por cada operador.
        </p>
      </div>

      {/* Relatório detalhado de problemas */}
      <div className="bg-white rounded-xl overflow-hidden max-w-full" style={{ border: '1px solid #e5e7eb' }}>
        <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <span className="text-sm font-bold" style={{ color: '#1a2a3a' }}>Problemas e manutenção — histórico detalhado</span>
          {problemas.length > 0 && <ExportarCsvButton filename="relatorio_problemas.csv" headers={headersProb} rows={rowsProb} />}
        </div>
        {problemas.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Nenhum problema reportado no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ color: '#374151' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {headersProb.map(h => <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {problemas.map(p => (
                  <tr key={p.id} className="border-t" style={{ borderColor: '#f3f4f6' }}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: '#1a2a3a' }}>{p.equipamento}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.operador}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{dataHora(p.created_at)}</td>
                    <td className="px-3 py-2 max-w-xs truncate" title={p.descricao ?? ''}>{p.descricao}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: p.parado ? '#b91c1c' : 'inherit' }}>{p.parado ? 'Sim' : 'Não'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.prestador ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.tempoRespostaMin != null ? fmtMin(p.tempoRespostaMin) : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtMin(p.tempoParadoMin)}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: p.resolvido ? '#047857' : '#b45309' }}>{statusProblema(p.resolvido, p.chegada_em, p.acionado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
