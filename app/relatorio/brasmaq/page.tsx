import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getRelatorioCicloPrestador } from '@/app/actions'
import { PrintButton } from '@/components/PrintButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Relatório Brasmaq — ALS Logística' }

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

function adjacentes(cicloParam?: string): { prev: string; next: string } {
  let ano: number, mes: number
  if (cicloParam) {
    ;[ano, mes] = cicloParam.split('-').map(Number)
  } else {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    const [y, m, d] = today.split('-').map(Number)
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

export default async function RelatorioBrasmaqPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { ciclo } = await searchParams
  const { prev, next } = adjacentes(ciclo)
  const rel = await getRelatorioCicloPrestador(PRESTADOR, ciclo)
  const emissao = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const totalParado = rel.maquinas.reduce((a, m) => a + m.tempoParadoMin, 0)
  const totalComParada = rel.maquinas.reduce((a, m) => a + m.comParada, 0)

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100vh', padding: '24px 16px', fontFamily: 'var(--font-geist, system-ui, sans-serif)' }}>
      <style>{`
        @media print {
          @page { margin: 12mm 14mm; size: A4 portrait; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Barra de controle — oculta na impressão */}
      <div className="no-print" style={{ maxWidth: '900px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <Link href="/equipamentos/relatorios" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>
          ← Relatórios
        </Link>
        <span style={{ color: '#d1d5db', fontSize: '13px' }}>|</span>
        <Link
          href={`?ciclo=${prev}`}
          style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', textDecoration: 'none' }}
        >
          ← Ciclo anterior
        </Link>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a2a3a' }}>{rel.cicloLabel}</span>
        <Link
          href={`?ciclo=${next}`}
          style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', textDecoration: 'none' }}
        >
          Próximo ciclo →
        </Link>
        <div style={{ flex: 1 }} />
        <PrintButton />
      </div>

      {/* Documento do relatório */}
      <div style={{ maxWidth: '900px', margin: '0 auto', background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>

        {/* Cabeçalho */}
        <div style={{ padding: '28px 32px 22px', borderBottom: '3px solid #1a2a3a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 6px 0' }}>
              ALS Logística
            </p>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1a2a3a', margin: '0 0 5px 0' }}>
              Relatório de Fechamento de Ciclo
            </h1>
            <p style={{ fontSize: '13px', color: '#4b5563', margin: 0 }}>
              Prestador: <strong style={{ color: '#1a2a3a' }}>{rel.prestador.toUpperCase()}</strong>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 2px 0' }}>Emitido em</p>
            <p style={{ fontSize: '12px', color: '#374151', fontWeight: 500, margin: 0 }}>{emissao}</p>
          </div>
        </div>

        {/* Resumo do ciclo — 4 itens sempre visíveis */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '18px 32px', gap: '8px' }}>
          <div>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ciclo</p>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#1a2a3a', margin: 0 }}>{rel.cicloLabel}</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Período</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a2a3a', margin: 0 }}>
              {fmtData(rel.cicloInicio)} a {fmtData(rel.cicloFim)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total horas utilizadas</p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: '#1a2a3a', margin: 0, lineHeight: 1.1 }}>
              {nfh.format(rel.totalHoras)}<span style={{ fontSize: '13px', fontWeight: 500 }}>h</span>
            </p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Acionamentos {PRESTADOR}</p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: rel.totalAcionamentos > 0 ? '#b91c1c' : '#1a2a3a', margin: 0, lineHeight: 1.1 }}>
              {rel.totalAcionamentos}
            </p>
          </div>
        </div>

        {/* Tabela por máquina */}
        <div style={{ padding: '0 0 4px' }}>
          {rel.maquinas.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '48px', color: '#9ca3af', fontSize: '14px', margin: 0 }}>
              Sem dados para este ciclo.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#374151' }}>
                <thead>
                  <tr style={{ background: '#1a2a3a', color: '#fff' }}>
                    {['Máquina', 'Checklists', 'H. Início', 'H. Fim', 'Horas Utilizadas', 'Acionamentos', 'Com Parada', 'T. Parado', 'T. Resposta Médio'].map((h, i) => (
                      <th key={h} style={{
                        padding: '11px 14px',
                        textAlign: i === 0 ? 'left' : i >= 5 ? 'center' : 'right',
                        fontWeight: 600,
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                        paddingLeft: i === 0 ? '24px' : '14px',
                        paddingRight: i === 8 ? '24px' : '14px',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rel.maquinas.map((m, i) => (
                    <tr key={m.equipamento} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '12px 14px 12px 24px', fontWeight: 600, color: '#1a2a3a', borderBottom: '1px solid #f3f4f6' }}>{m.equipamento}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>{m.checklistsNoCiclo}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#6b7280', borderBottom: '1px solid #f3f4f6', fontVariantNumeric: 'tabular-nums' }}>
                        {m.horimetroInicio != null ? nfi.format(m.horimetroInicio) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#6b7280', borderBottom: '1px solid #f3f4f6', fontVariantNumeric: 'tabular-nums' }}>
                        {m.horimetroFim != null ? nfi.format(m.horimetroFim) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#1a2a3a', borderBottom: '1px solid #f3f4f6', fontVariantNumeric: 'tabular-nums', fontSize: '13px' }}>
                        {nfh.format(m.horasUtilizadas)}h
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #f3f4f6', color: m.acionamentos > 0 ? '#b91c1c' : '#9ca3af' }}>
                        {m.acionamentos || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #f3f4f6', color: m.comParada > 0 ? '#b91c1c' : '#9ca3af' }}>
                        {m.comParada || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #f3f4f6', color: m.tempoParadoMin > 0 ? '#b91c1c' : '#9ca3af' }}>
                        {fmtMin(m.tempoParadoMin)}
                      </td>
                      <td style={{ padding: '12px 24px 12px 14px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>
                        {fmtMin(m.tempoRespostaMedioMin)}
                      </td>
                    </tr>
                  ))}

                  {/* Linha de total */}
                  <tr style={{ background: '#1a2a3a' }}>
                    <td style={{ padding: '13px 14px 13px 24px', fontWeight: 700, color: '#f9fafb', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }} colSpan={4}>
                      Total do ciclo
                    </td>
                    <td style={{ padding: '13px 14px', textAlign: 'right', fontWeight: 800, color: '#f9fafb', fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
                      {nfh.format(rel.totalHoras)}h
                    </td>
                    <td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: 700, fontSize: '14px', color: rel.totalAcionamentos > 0 ? '#fca5a5' : '#9ca3af' }}>
                      {rel.totalAcionamentos}
                    </td>
                    <td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: 700, fontSize: '14px', color: totalComParada > 0 ? '#fca5a5' : '#9ca3af' }}>
                      {totalComParada}
                    </td>
                    <td style={{ padding: '13px 14px', textAlign: 'right', fontWeight: 700, fontSize: '13px', color: totalParado > 0 ? '#fca5a5' : '#9ca3af' }}>
                      {fmtMin(totalParado)}
                    </td>
                    <td style={{ padding: '13px 24px 13px 14px', color: '#475569', textAlign: 'right' }}>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div style={{ padding: '18px 32px 28px', borderTop: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.8, maxWidth: '500px' }}>
            <p style={{ margin: 0 }}><strong style={{ color: '#6b7280' }}>Horas utilizadas:</strong> soma de (horímetro final − horímetro inicial) dos checklists abertos e encerrados no ciclo.</p>
            <p style={{ margin: 0 }}><strong style={{ color: '#6b7280' }}>H. Início / H. Fim:</strong> menor e maior horímetro registrados para a máquina no período.</p>
            <p style={{ margin: 0 }}><strong style={{ color: '#6b7280' }}>Acionamentos, paradas e tempos:</strong> referem-se exclusivamente a eventos atribuídos ao prestador <strong style={{ color: '#374151' }}>{PRESTADOR}</strong>.</p>
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ borderTop: '1px solid #374151', paddingTop: '8px', minWidth: '200px' }}>
              <p style={{ fontSize: '12px', color: '#374151', margin: 0 }}>Responsável / ALS Logística</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
