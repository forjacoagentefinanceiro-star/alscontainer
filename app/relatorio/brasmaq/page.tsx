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

export default async function RelatorioBrasmaqStandalone({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string }>
}) {
  // Auth check
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
    <>
      {/* CSS de impressão: garante fundo branco e margens adequadas */}
      <style>{`
        @media print {
          @page { margin: 15mm 15mm 15mm 15mm; size: A4 portrait; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .doc { box-shadow: none !important; border: none !important; border-radius: 0 !important; }
        }
        body { background: #e8eaed; margin: 0; padding: 0; }
      `}</style>

      {/* Barra de controle — oculta na impressão */}
      <div
        className="no-print"
        style={{
          background: '#1a2a3a',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Link
          href="/equipamentos/relatorios"
          style={{ color: '#94a3b8', fontSize: '13px', textDecoration: 'none' }}
        >
          ← Voltar ao app
        </Link>
        <span style={{ color: '#334155', fontSize: '13px' }}>|</span>
        <Link
          href={`?ciclo=${prev}`}
          style={{
            color: '#e2e8f0', fontSize: '13px', textDecoration: 'none',
            padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155',
          }}
        >
          ← Anterior
        </Link>
        <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600 }}>
          {rel.cicloLabel}
        </span>
        <Link
          href={`?ciclo=${next}`}
          style={{
            color: '#e2e8f0', fontSize: '13px', textDecoration: 'none',
            padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155',
          }}
        >
          Próximo →
        </Link>
        <div style={{ flex: 1 }} />
        <PrintButton />
      </div>

      {/* Documento */}
      <div style={{ padding: '32px 24px', minHeight: 'calc(100vh - 49px)' }}>
        <div
          className="doc"
          style={{
            background: '#fff',
            maxWidth: '900px',
            margin: '0 auto',
            borderRadius: '8px',
            boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
            overflow: 'hidden',
            fontFamily: 'var(--font-geist, Arial, sans-serif)',
          }}
        >
          {/* Cabeçalho do documento */}
          <div style={{ padding: '32px 40px 24px', borderBottom: '3px solid #1a2a3a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 4px' }}>
                  ALS Logística · Itajaí SC
                </p>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                  Relatório de Fechamento de Ciclo
                </h1>
                <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
                  Prestador: <strong style={{ color: '#0f172a' }}>{rel.prestador.toUpperCase()}</strong>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 2px' }}>Emitido em</p>
                <p style={{ fontSize: '12px', color: '#374151', fontWeight: 500, margin: 0 }}>{emissao}</p>
              </div>
            </div>
          </div>

          {/* Bloco de resumo do ciclo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '20px 40px' }}>
            <div>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ciclo</p>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{rel.cicloLabel}</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Período</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
                {fmtData(rel.cicloInicio)}<br />
                <span style={{ color: '#64748b', fontWeight: 400 }}>a</span> {fmtData(rel.cicloFim)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total horas utilizadas</p>
              <p style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1 }}>
                {nfh.format(rel.totalHoras)}<span style={{ fontSize: '14px', fontWeight: 500 }}>h</span>
              </p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Acionamentos {PRESTADOR}</p>
              <p style={{ fontSize: '26px', fontWeight: 800, color: rel.totalAcionamentos > 0 ? '#dc2626' : '#0f172a', margin: 0, lineHeight: 1 }}>
                {rel.totalAcionamentos}
              </p>
            </div>
          </div>

          {/* Tabela */}
          <div style={{ padding: '0 0 8px' }}>
            {rel.maquinas.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '14px' }}>
                Sem dados para este ciclo.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#1a2a3a', color: '#f8fafc' }}>
                    <th style={{ padding: '12px 16px 12px 40px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Máquina</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Checklists</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>H. Início</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>H. Fim</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Horas Utilizadas</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Acionamentos</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Com Parada</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>T. Parado</th>
                    <th style={{ padding: '12px 40px 12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>T. Resposta</th>
                  </tr>
                </thead>
                <tbody>
                  {rel.maquinas.map((m, i) => (
                    <tr key={m.equipamento} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '13px 16px 13px 40px', fontWeight: 600, color: '#0f172a', borderBottom: '1px solid #e2e8f0' }}>
                        {m.equipamento}
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'center', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                        {m.checklistsNoCiclo}
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', color: '#64748b', borderBottom: '1px solid #e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
                        {m.horimetroInicio != null ? nfi.format(m.horimetroInicio) : '—'}
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', color: '#64748b', borderBottom: '1px solid #e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
                        {m.horimetroFim != null ? nfi.format(m.horimetroFim) : '—'}
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #e2e8f0', fontVariantNumeric: 'tabular-nums', fontSize: '14px' }}>
                        {nfh.format(m.horasUtilizadas)}h
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #e2e8f0', color: m.acionamentos > 0 ? '#dc2626' : '#94a3b8' }}>
                        {m.acionamentos || '—'}
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #e2e8f0', color: m.comParada > 0 ? '#dc2626' : '#94a3b8' }}>
                        {m.comParada || '—'}
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #e2e8f0', color: m.tempoParadoMin > 0 ? '#dc2626' : '#94a3b8' }}>
                        {fmtMin(m.tempoParadoMin)}
                      </td>
                      <td style={{ padding: '13px 40px 13px 16px', textAlign: 'right', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                        {fmtMin(m.tempoRespostaMedioMin)}
                      </td>
                    </tr>
                  ))}

                  {/* Linha de total */}
                  <tr style={{ background: '#0f172a' }}>
                    <td style={{ padding: '14px 16px 14px 40px', fontWeight: 700, color: '#f8fafc', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }} colSpan={4}>
                      Total do ciclo
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#f8fafc', fontSize: '15px', fontVariantNumeric: 'tabular-nums' }}>
                      {nfh.format(rel.totalHoras)}h
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, color: rel.totalAcionamentos > 0 ? '#fca5a5' : '#94a3b8', fontSize: '15px' }}>
                      {rel.totalAcionamentos}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, color: totalComParada > 0 ? '#fca5a5' : '#94a3b8', fontSize: '15px' }}>
                      {totalComParada}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: totalParado > 0 ? '#fca5a5' : '#94a3b8', fontSize: '14px' }}>
                      {fmtMin(totalParado)}
                    </td>
                    <td style={{ padding: '14px 40px 14px 16px', color: '#475569', textAlign: 'right' }}>—</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Rodapé do documento */}
          <div style={{
            padding: '20px 40px 32px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '32px',
            background: '#f8fafc',
          }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.7, maxWidth: '480px' }}>
              <p style={{ margin: 0 }}>
                <strong style={{ color: '#64748b' }}>Horas utilizadas:</strong> soma de (horímetro final − horímetro inicial) dos checklists abertos e encerrados no ciclo.
              </p>
              <p style={{ margin: '4px 0 0' }}>
                <strong style={{ color: '#64748b' }}>H. Início / H. Fim:</strong> menor e maior horímetro registrados para a máquina no período.
              </p>
              <p style={{ margin: '4px 0 0' }}>
                <strong style={{ color: '#64748b' }}>Acionamentos, paradas e tempos:</strong> referem-se exclusivamente a eventos atribuídos ao prestador <strong style={{ color: '#374151' }}>{PRESTADOR}</strong>.
              </p>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ borderTop: '1px solid #374151', paddingTop: '8px', minWidth: '200px' }}>
                <p style={{ fontSize: '12px', color: '#374151', margin: 0 }}>Responsável / ALS Logística</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
