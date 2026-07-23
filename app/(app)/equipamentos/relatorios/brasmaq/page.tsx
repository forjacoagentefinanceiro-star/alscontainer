import Link from 'next/link'
import { getRelatorioCicloPrestador } from '@/app/actions'
import { PrintButton } from '@/components/PrintButton'

export const dynamic = 'force-dynamic'

const PRESTADOR = 'Brasmaq'

const nfh = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nfi = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })

function fmtMin(min: number | null): string {
  if (min == null || min === 0) return '—'
  if (min < 60) return `${Math.round(min)}min`
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return `${h}h${m > 0 ? ` ${m}min` : ''}`
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// Computes prev/next closing month strings (YYYY-MM) for navigation
function adjacentes(cicloParam?: string): { prev: string; next: string } {
  let ano: number, mes: number
  if (cicloParam) {
    ;[ano, mes] = cicloParam.split('-').map(Number)
  } else {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    const [y, m, d] = today.split('-').map(Number)
    // closing month = current if d < 23, else next month
    if (d < 23) { ano = y; mes = m }
    else { mes = m + 1; ano = y; if (mes === 13) { mes = 1; ano++ } }
  }
  const prevMes = mes === 1 ? 12 : mes - 1
  const prevAno = mes === 1 ? ano - 1 : ano
  const nextMes = mes === 12 ? 1 : mes + 1
  const nextAno = mes === 12 ? ano + 1 : ano
  return {
    prev: `${prevAno}-${String(prevMes).padStart(2, '0')}`,
    next: `${nextAno}-${String(nextMes).padStart(2, '0')}`,
  }
}

export default async function RelatorioBrasmaqPage({ searchParams }: { searchParams: Promise<{ ciclo?: string }> }) {
  const { ciclo } = await searchParams
  const { prev, next } = adjacentes(ciclo)
  const rel = await getRelatorioCicloPrestador(PRESTADOR, ciclo)
  const emissao = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const totalParado = rel.maquinas.reduce((a, m) => a + m.tempoParadoMin, 0)
  const totalComParada = rel.maquinas.reduce((a, m) => a + m.comParada, 0)

  return (
    <div>
      {/* Barra de navegação — oculta na impressão */}
      <div className="flex items-center gap-3 mb-5 print:hidden flex-wrap">
        <Link href="/equipamentos/relatorios" className="text-xs" style={{ color: '#6b7280' }}>
          ← Relatórios
        </Link>
        <span className="text-xs" style={{ color: '#d1d5db' }}>|</span>
        <Link
          href={`?ciclo=${prev}`}
          className="text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: '#e5e7eb', color: '#374151', background: '#fff' }}
        >
          ← Ciclo anterior
        </Link>
        <span className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>
          {rel.cicloLabel}
        </span>
        <Link
          href={`?ciclo=${next}`}
          className="text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: '#e5e7eb', color: '#374151', background: '#fff' }}
        >
          Próximo ciclo →
        </Link>
        <div className="flex-1" />
        <PrintButton />
      </div>

      {/* Documento do relatório */}
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ border: '1px solid #e5e7eb' }}
      >
        {/* Cabeçalho */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ borderBottom: '3px solid #1a2a3a' }}>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#9ca3af', letterSpacing: '0.15em' }}>
              ALS Logística
            </p>
            <h1 className="text-xl font-bold mt-1" style={{ color: '#1a2a3a' }}>
              Relatório de Fechamento de Ciclo
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#4b5563' }}>
              Prestador: <strong style={{ color: '#1a2a3a' }}>{rel.prestador.toUpperCase()}</strong>
            </p>
          </div>
          <div className="text-right text-xs" style={{ color: '#9ca3af' }}>
            <p>Emitido em</p>
            <p className="font-medium" style={{ color: '#374151' }}>{emissao}</p>
          </div>
        </div>

        {/* Resumo do ciclo */}
        <div className="px-6 py-4 grid grid-cols-2 gap-4 sm:grid-cols-4" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Ciclo</p>
            <p className="text-sm font-bold" style={{ color: '#1a2a3a' }}>{rel.cicloLabel}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Período</p>
            <p className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>
              {fmtData(rel.cicloInicio)} → {fmtData(rel.cicloFim)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Total horas utilizadas</p>
            <p className="text-xl font-bold" style={{ color: '#1a2a3a' }}>{nfh.format(rel.totalHoras)}<span className="text-sm font-normal">h</span></p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Acionamentos {PRESTADOR}</p>
            <p className="text-xl font-bold" style={{ color: rel.totalAcionamentos > 0 ? '#b91c1c' : '#1a2a3a' }}>
              {rel.totalAcionamentos}
            </p>
          </div>
        </div>

        {/* Tabela por máquina */}
        <div className="px-6 py-5">
          {rel.maquinas.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: '#9ca3af' }}>
              Sem dados para este ciclo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ background: '#1a2a3a', color: '#fff' }}>
                    <th className="px-3 py-2.5 text-left font-semibold rounded-tl">Máquina</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Checklists</th>
                    <th className="px-3 py-2.5 text-right font-semibold">H. Início</th>
                    <th className="px-3 py-2.5 text-right font-semibold">H. Fim</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Horas Utilizadas</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Acionamentos</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Com Parada</th>
                    <th className="px-3 py-2.5 text-right font-semibold">T. Parado</th>
                    <th className="px-3 py-2.5 text-right font-semibold rounded-tr">T. Resposta Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {rel.maquinas.map((m, i) => (
                    <tr key={m.equipamento} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td className="px-3 py-2.5 font-medium border-b" style={{ borderColor: '#e5e7eb', color: '#1a2a3a' }}>
                        {m.equipamento}
                      </td>
                      <td className="px-3 py-2.5 text-center border-b" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
                        {m.checklistsNoCiclo}
                      </td>
                      <td className="px-3 py-2.5 text-right border-b tabular-nums" style={{ borderColor: '#e5e7eb', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                        {m.horimetroInicio != null ? nfi.format(m.horimetroInicio) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right border-b tabular-nums" style={{ borderColor: '#e5e7eb', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                        {m.horimetroFim != null ? nfi.format(m.horimetroFim) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right border-b font-bold tabular-nums" style={{ borderColor: '#e5e7eb', color: '#1a2a3a', fontVariantNumeric: 'tabular-nums' }}>
                        {nfh.format(m.horasUtilizadas)}h
                      </td>
                      <td className="px-3 py-2.5 text-center border-b font-medium" style={{ borderColor: '#e5e7eb', color: m.acionamentos > 0 ? '#b91c1c' : '#9ca3af' }}>
                        {m.acionamentos || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center border-b font-medium" style={{ borderColor: '#e5e7eb', color: m.comParada > 0 ? '#b91c1c' : '#9ca3af' }}>
                        {m.comParada || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right border-b font-medium" style={{ borderColor: '#e5e7eb', color: m.tempoParadoMin > 0 ? '#b91c1c' : '#9ca3af' }}>
                        {fmtMin(m.tempoParadoMin)}
                      </td>
                      <td className="px-3 py-2.5 text-right border-b" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
                        {fmtMin(m.tempoRespostaMedioMin)}
                      </td>
                    </tr>
                  ))}

                  {/* Linha de total */}
                  <tr style={{ background: '#f1f5f9' }}>
                    <td className="px-3 py-3 font-bold text-xs uppercase tracking-wide" style={{ color: '#1a2a3a', letterSpacing: '0.05em' }}
                      colSpan={4}>
                      Total do ciclo
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums" style={{ color: '#1a2a3a', fontVariantNumeric: 'tabular-nums', fontSize: '0.85rem' }}>
                      {nfh.format(rel.totalHoras)}h
                    </td>
                    <td className="px-3 py-3 text-center font-bold" style={{ color: rel.totalAcionamentos > 0 ? '#b91c1c' : '#1a2a3a' }}>
                      {rel.totalAcionamentos}
                    </td>
                    <td className="px-3 py-3 text-center font-bold" style={{ color: totalComParada > 0 ? '#b91c1c' : '#1a2a3a' }}>
                      {totalComParada}
                    </td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: totalParado > 0 ? '#b91c1c' : '#1a2a3a' }}>
                      {fmtMin(totalParado)}
                    </td>
                    <td className="px-3 py-3 text-right" style={{ color: '#6b7280' }}>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div
          className="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6"
          style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}
        >
          <div className="text-xs" style={{ color: '#9ca3af' }}>
            <p>• <strong>Horas utilizadas</strong>: soma de (horímetro final − inicial) dos checklists abertos no ciclo.</p>
            <p className="mt-0.5">• <strong>H. Início / H. Fim</strong>: menor horímetro inicial e maior horímetro final registrados para a máquina no ciclo.</p>
            <p className="mt-0.5">• <strong>Acionamentos, paradas e tempos</strong>: referem-se exclusivamente a eventos atribuídos ao prestador <strong>{PRESTADOR}</strong>.</p>
          </div>
          <div className="text-center shrink-0 print:mt-4">
            <div className="pt-2" style={{ borderTop: '1px solid #374151', minWidth: '200px' }}>
              <p className="text-xs" style={{ color: '#374151' }}>Responsável / ALS Logística</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
