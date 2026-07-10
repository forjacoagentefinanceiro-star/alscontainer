import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getResumoFinanceiro } from '@/app/actions'
import type { Container } from '@/app/actions'
import { PrintButton } from '@/components/PrintButton'

export const dynamic = 'force-dynamic'

const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtUSD = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'

export default async function RelatorioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: containers }, resumo] = await Promise.all([
    supabase.from('containers').select('*').order('numero'),
    getResumoFinanceiro(),
  ])

  const todos = (containers ?? []) as Container[]
  const nacionais = todos.filter(c => c.tipo === 'nacional')
  const importados = todos.filter(c => c.tipo === 'importado')
  const nacionalizados = todos.filter(c => c.nacionalizado)
  const totalBRL = todos.reduce((s, c) => s + (c.valor_brl ?? 0), 0)
  const totalUSD = importados.reduce((s, c) => s + (c.valor_usd ?? 0), 0)

  const totReceita = resumo.reduce((a, r) => a + r.receitas, 0)
  const totDespesasOp = resumo.reduce((a, r) => a + r.despesas, 0)
  const totCusto = resumo.reduce((a, r) => a + r.custoAquisicao, 0)
  const totSaldo = resumo.reduce((a, r) => a + r.saldo, 0)
  const totBreakeven = resumo.reduce((a, r) => a + r.breakeven, 0)
  const breakevenPct = totBreakeven > 0 ? Math.round((totReceita / totBreakeven) * 100) : 0
  const locados = resumo.filter(r => r.container.status === 'locado').length
  const disponiveis = resumo.filter(r => r.container.status === 'disponivel').length
  const vendidos = resumo.filter(r => r.container.status === 'vendido').length
  const receitaMensal = resumo.filter(r => r.container.status === 'locado').reduce((a, r) => a + (r.container.valor_locacao_mensal ?? 0), 0)
  const temFinanceiro = resumo.length > 0

  const hoje = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const tdBase: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', color: '#1a2a3a' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; margin: 0 !important; }
          @page { size: A4 portrait; margin: 12mm 15mm; }
          .report-doc { box-shadow: none !important; margin: 0 !important; padding: 4px 0 0 !important; max-width: 100% !important; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { page-break-inside: avoid; }
          .section-title { page-break-after: avoid; }
        }
      `}</style>

      {/* Toolbar — só na tela */}
      <div className="no-print"
        style={{ position: 'sticky', top: 0, zIndex: 10, background: '#ffffff', borderBottom: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 16, padding: '10px 24px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="ALS Logística" style={{ height: 30, width: 'auto', borderRadius: 3 }} />
        <span className="text-xs" style={{ color: '#d1d5db' }}>|</span>
        <a href="/inventario" className="text-sm font-medium" style={{ color: '#1B4F8A' }}>
          ← Inventário
        </a>
        <span className="text-xs" style={{ color: '#d1d5db' }}>|</span>
        <span className="text-xs font-semibold" style={{ color: '#6b7280' }}>
          Relatório de Inventário de Containers
        </span>
        <div style={{ flex: 1 }} />
        <span className="text-xs" style={{ color: '#9ca3af' }}>Gerado: {hoje}</span>
        <PrintButton />
      </div>

      {/* Documento */}
      <div className="report-doc" style={{
        maxWidth: 860, margin: '24px auto 48px', background: '#fff',
        padding: '40px 48px', boxShadow: '0 0 0 1px #e5e7eb',
        borderRadius: 4, fontFamily: "'Helvetica Neue', Arial, sans-serif",
      }}>

        {/* Cabeçalho */}
        <div style={{ borderBottom: '3px solid #1B4F8A', paddingBottom: 18, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ marginBottom: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="ALS Logística" style={{ height: 54, width: 'auto', borderRadius: 4 }} />
              </div>
              <h1 style={{ fontSize: 18, fontWeight: 900, color: '#1a2a3a', margin: 0, lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                Relatório de Inventário
              </h1>
              <h2 style={{ fontSize: 13, fontWeight: 500, color: '#4b5563', margin: '3px 0 0', letterSpacing: '0.01em' }}>
                Containers Próprios — Depot Itajaí, SC
              </h2>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#1a2a3a' }}>{hoje}</div>
              <div>ALS Depot v1.0</div>
              <div style={{ marginTop: 2, fontSize: 10, color: '#9ca3af' }}>Documento de uso interno</div>
            </div>
          </div>
        </div>

        {/* Resumo do inventário */}
        <div style={{ marginBottom: 28 }}>
          <h3 className="section-title" style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px', borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>
            Resumo do Inventário
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {[
              { label: 'Total', value: String(todos.length), accent: '#1B4F8A', big: true },
              { label: 'Nacionais', value: String(nacionais.length), accent: '#7DC242', big: true },
              { label: 'Importados', value: String(importados.length), accent: '#1B4F8A', big: true },
              { label: 'Nacionalizados', value: String(nacionalizados.length), accent: '#7DC242', big: true },
              { label: 'Valor Total (R$)', value: fmtBRL(totalBRL), accent: '#1B4F8A', big: false },
            ].map(m => (
              <div key={m.label} style={{
                borderLeft: `4px solid ${m.accent}`, border: `1px solid #e5e7eb`,
                borderLeftWidth: 4, borderLeftColor: m.accent,
                borderRadius: 6, padding: '10px 12px', background: '#fafafa',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{m.label}</div>
                <div style={{ fontSize: m.big ? 24 : 14, fontWeight: 800, color: '#1a2a3a', lineHeight: 1 }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Financeiro */}
        {temFinanceiro && (
          <div style={{ marginBottom: 28 }}>
            <h3 className="section-title" style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px', borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>
              Financeiro da Frota
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
              {[
                { label: 'Receita Acumulada', value: fmtBRL(totReceita), cor: '#15803d' },
                { label: 'Custo + Despesas', value: fmtBRL(totCusto + totDespesasOp), cor: '#b91c1c' },
                { label: 'Saldo da Frota', value: (totSaldo >= 0 ? '+' : '') + fmtBRL(totSaldo), cor: totSaldo >= 0 ? '#15803d' : '#b91c1c' },
                { label: 'Break-even Global', value: `${breakevenPct}%`, cor: breakevenPct >= 100 ? '#15803d' : breakevenPct >= 60 ? '#d97706' : '#b91c1c' },
              ].map(k => (
                <div key={k.label} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 12px', background: '#fafafa' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{k.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: k.cor }}>{k.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginRight: 2 }}>Status dos containers:</span>
              {[
                { label: `${locados} locado${locados !== 1 ? 's' : ''}`, bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', show: true },
                { label: `${disponiveis} disponível${disponiveis !== 1 ? 'is' : ''}`, bg: '#f9fafb', color: '#4b5563', border: '#e5e7eb', show: true },
                { label: `${vendidos} vendido${vendidos !== 1 ? 's' : ''}`, bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', show: vendidos > 0 },
                { label: `${fmtBRL(receitaMensal)}/mês em locação`, bg: '#fefce8', color: '#92400e', border: '#fde68a', show: receitaMensal > 0 },
              ].filter(c => c.show).map((chip, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: chip.bg, color: chip.color, border: `1px solid ${chip.border}` }}>
                  {chip.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tabela de inventário */}
        <div>
          <h3 className="section-title" style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px', borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>
            Inventário Completo — {todos.length} container{todos.length !== 1 ? 's' : ''}
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: '#1B4F8A' }}>
                {['#', 'Número ISO 6346', 'Tipo', 'Tam.', 'Fornecedor', 'Data Compra', 'Valor USD', 'Cotação', 'Valor R$', 'Observações'].map(h => (
                  <th key={h} style={{ padding: '8px 8px', textAlign: 'left', fontSize: 9.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todos.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ ...tdBase, color: '#9ca3af', fontSize: 9 }}>{i + 1}</td>
                  <td style={{ ...tdBase, fontFamily: 'monospace', fontWeight: 700, color: '#1a2a3a', whiteSpace: 'nowrap' }}>
                    {c.numero}
                    <span style={{ marginLeft: 3, color: c.iso_valido ? '#7DC242' : '#ef4444', fontSize: 10 }}>
                      {c.iso_valido ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style={{ ...tdBase }}>
                    <span style={{
                      fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                      background: c.tipo === 'nacional' ? '#f0fff4' : '#eff6ff',
                      color: c.tipo === 'nacional' ? '#166534' : '#1d4ed8',
                      border: `1px solid ${c.tipo === 'nacional' ? '#bbf7d0' : '#bfdbfe'}`,
                    }}>
                      {c.tipo === 'nacional' ? 'Nacional' : 'Importado'}
                    </span>
                    {c.nacionalizado && (
                      <span style={{ fontSize: 9, marginLeft: 3, color: '#7DC242', fontWeight: 700 }}>Nac.</span>
                    )}
                  </td>
                  <td style={{ ...tdBase, color: '#374151' }}>{c.tamanho}</td>
                  <td style={{ ...tdBase, color: '#374151', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.fornecedor || '—'}
                  </td>
                  <td style={{ ...tdBase, color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(c.data_compra)}</td>
                  <td style={{ ...tdBase, fontFamily: 'monospace', color: '#374151' }}>
                    {c.valor_usd != null ? `$ ${fmtUSD(c.valor_usd)}` : '—'}
                  </td>
                  <td style={{ ...tdBase, fontFamily: 'monospace', color: '#374151' }}>
                    {c.cotacao != null ? `R$ ${Number(c.cotacao).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ ...tdBase, fontFamily: 'monospace', fontWeight: 700, color: '#1a2a3a', whiteSpace: 'nowrap' }}>
                    {fmtBRL(c.valor_brl)}
                  </td>
                  <td style={{ ...tdBase, color: '#6b7280', fontSize: 9.5, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.obs || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#1a2a3a' }}>
                <td colSpan={6} style={{ padding: '8px 8px', fontWeight: 700, color: '#fff', fontSize: 11 }}>
                  TOTAL GERAL — {todos.length} container{todos.length !== 1 ? 's' : ''}
                </td>
                <td style={{ padding: '8px 8px', fontFamily: 'monospace', fontWeight: 700, color: '#e5e7eb', fontSize: 10.5 }}>
                  $ {fmtUSD(totalUSD)}
                </td>
                <td style={{ padding: '8px 8px', color: '#6b7280' }} />
                <td style={{ padding: '8px 8px', fontFamily: 'monospace', fontWeight: 900, color: '#7DC242', fontSize: 13, whiteSpace: 'nowrap' }}>
                  {fmtBRL(totalBRL)}
                </td>
                <td style={{ padding: '8px 8px' }} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Por tipo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
          {[
            { titulo: `Nacionais (${nacionais.length})`, items: nacionais, showUSD: false },
            { titulo: `Importados (${importados.length})`, items: importados, showUSD: true },
          ].map(grupo => (
            <div key={grupo.titulo}>
              <h4 style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px', borderBottom: '1px solid #e5e7eb', paddingBottom: 5 }}>
                {grupo.titulo}
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ padding: '5px 6px', textAlign: 'left', color: '#6b7280', fontSize: 9, fontWeight: 700 }}>Número</th>
                    <th style={{ padding: '5px 6px', textAlign: 'left', color: '#6b7280', fontSize: 9, fontWeight: 700 }}>Tam.</th>
                    <th style={{ padding: '5px 6px', textAlign: 'left', color: '#6b7280', fontSize: 9, fontWeight: 700 }}>Fornecedor</th>
                    {grupo.showUSD && <th style={{ padding: '5px 6px', textAlign: 'right', color: '#6b7280', fontSize: 9, fontWeight: 700 }}>USD</th>}
                    <th style={{ padding: '5px 6px', textAlign: 'right', color: '#6b7280', fontSize: 9, fontWeight: 700 }}>Valor R$</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.items.map((c, i) => (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '4px 6px', fontFamily: 'monospace', fontWeight: 700, fontSize: 9.5, color: '#1a2a3a' }}>{c.numero}</td>
                      <td style={{ padding: '4px 6px', color: '#374151', fontSize: 9.5 }}>{c.tamanho}</td>
                      <td style={{ padding: '4px 6px', color: '#6b7280', fontSize: 9, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.fornecedor || '—'}
                      </td>
                      {grupo.showUSD && (
                        <td style={{ padding: '4px 6px', fontFamily: 'monospace', color: '#374151', fontSize: 9.5, textAlign: 'right' }}>
                          {c.valor_usd != null ? `$${fmtUSD(c.valor_usd)}` : '—'}
                        </td>
                      )}
                      <td style={{ padding: '4px 6px', fontFamily: 'monospace', fontWeight: 700, color: '#1a2a3a', fontSize: 9.5, textAlign: 'right' }}>
                        {fmtBRL(c.valor_brl)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#e5e7eb' }}>
                    <td colSpan={grupo.showUSD ? 3 : 3} style={{ padding: '5px 6px', fontWeight: 700, color: '#1a2a3a', fontSize: 9.5 }}>Total</td>
                    {grupo.showUSD && (
                      <td style={{ padding: '5px 6px', fontFamily: 'monospace', fontWeight: 700, color: '#1a2a3a', fontSize: 9.5, textAlign: 'right' }}>
                        ${fmtUSD(grupo.items.reduce((s, c) => s + (c.valor_usd ?? 0), 0))}
                      </td>
                    )}
                    <td style={{ padding: '5px 6px', fontFamily: 'monospace', fontWeight: 700, color: '#1B4F8A', fontSize: 9.5, textAlign: 'right' }}>
                      {fmtBRL(grupo.items.reduce((s, c) => s + (c.valor_brl ?? 0), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Situação Comercial */}
        {temFinanceiro && (
          <div style={{ marginTop: 28 }}>
            <h3 className="section-title" style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px', borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>
              Situação Comercial — locação e rentabilidade por container
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr style={{ background: '#1a2a3a' }}>
                  {['Número', 'Status', 'Cliente / Locatário', 'Início', 'Fim', 'Valor/mês', 'Receita Total', 'Custo Aquisição', 'Saldo'].map(h => (
                    <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumo.map((r, i) => {
                  const c = r.container
                  const status = c.status ?? 'disponivel'
                  const statusStyle = status === 'locado'
                    ? { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }
                    : status === 'vendido'
                    ? { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }
                    : { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }
                  const statusLabel = status === 'locado' ? 'Locado' : status === 'vendido' ? 'Vendido' : 'Disponível'
                  const saldoCor = r.saldo >= 0 ? '#15803d' : '#b91c1c'
                  return (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ ...tdBase, fontFamily: 'monospace', fontWeight: 700, fontSize: 9.5, color: '#1a2a3a', whiteSpace: 'nowrap' }}>{c.numero}</td>
                      <td style={{ ...tdBase }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, ...statusStyle }}>{statusLabel}</span>
                      </td>
                      <td style={{ ...tdBase, fontSize: 9.5, color: '#374151', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.locatario || '—'}
                      </td>
                      <td style={{ ...tdBase, fontSize: 9.5, color: '#374151', whiteSpace: 'nowrap' }}>{c.locacao_inicio ? fmtDate(c.locacao_inicio) : '—'}</td>
                      <td style={{ ...tdBase, fontSize: 9.5, color: '#374151', whiteSpace: 'nowrap' }}>{c.locacao_fim ? fmtDate(c.locacao_fim) : '—'}</td>
                      <td style={{ ...tdBase, fontFamily: 'monospace', fontSize: 9.5, color: '#374151' }}>{c.valor_locacao_mensal ? fmtBRL(c.valor_locacao_mensal) : '—'}</td>
                      <td style={{ ...tdBase, fontFamily: 'monospace', fontWeight: 700, fontSize: 9.5, color: r.receitas > 0 ? '#15803d' : '#9ca3af' }}>
                        {r.receitas > 0 ? fmtBRL(r.receitas) : '—'}
                      </td>
                      <td style={{ ...tdBase, fontFamily: 'monospace', fontSize: 9.5, color: '#374151' }}>{fmtBRL(r.custoAquisicao)}</td>
                      <td style={{ ...tdBase, fontFamily: 'monospace', fontWeight: 700, fontSize: 9.5, color: saldoCor }}>
                        {(r.saldo >= 0 ? '+' : '') + fmtBRL(r.saldo)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#1a2a3a' }}>
                  <td colSpan={6} style={{ padding: '7px 8px', fontWeight: 700, color: '#fff', fontSize: 10 }}>TOTAIS</td>
                  <td style={{ padding: '7px 8px', fontFamily: 'monospace', fontWeight: 700, color: '#7DC242', fontSize: 10 }}>{fmtBRL(totReceita)}</td>
                  <td style={{ padding: '7px 8px', fontFamily: 'monospace', color: '#d1d5db', fontSize: 10 }}>{fmtBRL(totCusto + totDespesasOp)}</td>
                  <td style={{ padding: '7px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: 10, color: totSaldo >= 0 ? '#7DC242' : '#f87171' }}>
                    {(totSaldo >= 0 ? '+' : '') + fmtBRL(totSaldo)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Rodapé */}
        <div style={{ marginTop: 36, paddingTop: 14, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 9.5, color: '#9ca3af' }}>
            <span style={{ fontWeight: 700, color: '#1B4F8A' }}>ALS Depot</span>
            {' '}· Itajaí, SC · alslog.com.br · ALS Depot v1.0
          </div>
          <div style={{ fontSize: 9.5, color: '#9ca3af' }}>
            Gerado em {hoje} · Documento de uso interno e confidencial
          </div>
        </div>
      </div>
    </div>
  )
}
