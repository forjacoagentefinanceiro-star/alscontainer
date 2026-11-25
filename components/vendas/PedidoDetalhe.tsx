'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { brl, dataCurta, WHATS_PATIO } from '@/lib/vendas/config'
import { lancarPagamento, excluirPagamento, liberarPedido } from '@/app/(app)/vendas/pedidos/pedidos-actions'
import { gerarLiberacaoPdf, baixarBlob } from '@/lib/vendas/liberacaoPdf'
import { card, input, btn } from '@/components/vendas/ui'
import type { PedidoRow, PedidoPagamento } from '@/app/(app)/vendas/pedidos/pedidos-actions'

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  aguardando_pagamento: { label: 'Aguardando pagamento', bg: '#fef9c3', color: '#854d0e' },
  parcialmente_pago:    { label: 'Parcialmente pago',    bg: '#dbeafe', color: '#1e40af' },
  quitado:              { label: 'Quitado',               bg: '#dcfce7', color: '#166534' },
  liberado:             { label: 'Liberado ✓',            bg: '#d1fae5', color: '#065f46' },
}
const FORMAS = ['pix', 'transferencia', 'dinheiro', 'cartao', 'cheque', 'outro']
const FORMA_LABEL: Record<string, string> = {
  pix: 'Pix', transferencia: 'Transferência', dinheiro: 'Dinheiro',
  cartao: 'Cartão', cheque: 'Cheque', outro: 'Outro',
}
const num = (v: string) => { const n = Number(v.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0 }

function gerarWhatsUrl(pedido: PedidoRow): string {
  const conts = (pedido.containers as { numero: string; tamanho: string }[])
    .map(c => `📦 ${c.numero}${c.tamanho ? ` (${c.tamanho})` : ''}`).join('\n')
  const dataLib = pedido.liberado_em
    ? new Date(pedido.liberado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : ''
  const msg = `*AUTORIZAÇÃO DE RETIRADA*\nPedido: ${pedido.codigo}\n\n*Cliente:* ${pedido.cliente_nome}${pedido.cidade ? `\n*Cidade:* ${pedido.cidade}` : ''}\n\n*Containers liberados:*\n${conts}\n\n*Total:* ${brl(pedido.total)}\n*Status:* ✅ Quitado\n\n*Data de liberação:* ${dataLib}${pedido.obs_liberacao ? `\n\n*Obs:* ${pedido.obs_liberacao}` : ''}`
  return `https://wa.me/${WHATS_PATIO}?text=${encodeURIComponent(msg)}`
}

export default function PedidoDetalhe({ pedido }: { pedido: PedidoRow }) {
  const router = useRouter()
  const pagamentos: PedidoPagamento[] = pedido.pagamentos ?? []

  const [addValor, setAddValor] = useState('')
  const [addForma, setAddForma] = useState('pix')
  const [addData, setAddData] = useState(new Date().toISOString().slice(0, 10))
  const [addObs, setAddObs] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [obsLib, setObsLib] = useState('')
  const [liberando, setLiberando] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const saldo = Math.max(0, pedido.total - pedido.total_pago)
  const pct = pedido.total > 0 ? Math.min(100, (pedido.total_pago / pedido.total) * 100) : 0
  const st = STATUS[pedido.status] ?? { label: pedido.status, bg: '#f1f5f9', color: '#475569' }

  async function registrarPagamento() {
    setErro(null)
    const v = num(addValor)
    if (!v) return setErro('Informe um valor válido.')
    setAdicionando(true)
    const r = await lancarPagamento(pedido.id, { valor: v, forma: addForma, data_recebimento: addData, obs: addObs })
    setAdicionando(false)
    if ('erro' in r) return setErro(r.erro)
    setAddValor(''); setAddObs('')
    router.refresh()
  }

  async function deletarPagamento(pgId: string) {
    if (!confirm('Remover este pagamento?')) return
    const r = await excluirPagamento(pgId, pedido.id)
    if ('erro' in r) return setErro(r.erro)
    router.refresh()
  }

  async function liberar() {
    if (!confirm(`Confirmar liberação do pedido ${pedido.codigo}? O pátio receberá a autorização de retirada.`)) return
    setLiberando(true); setErro(null)
    const r = await liberarPedido(pedido.id, obsLib)
    setLiberando(false)
    if ('erro' in r) return setErro(r.erro)
    router.refresh()
  }

  async function baixarPdf() {
    setGerandoPdf(true)
    try {
      const { blob, nome } = await gerarLiberacaoPdf({
        codigo: pedido.codigo, propostaCodigo: pedido.proposta_codigo,
        clienteNome: pedido.cliente_nome, telefone: pedido.telefone, cidade: pedido.cidade,
        containers: pedido.containers, total: pedido.total,
        liberadoEm: pedido.liberado_em, obsLiberacao: pedido.obs_liberacao,
      })
      baixarBlob(blob, nome)
    } catch (e) { setErro(`Erro ao gerar PDF: ${(e as Error).message}`) }
    setGerandoPdf(false)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px] items-start">
      {/* Coluna principal */}
      <div className="space-y-4">
        {/* Info do pedido */}
        <section className={`${card} p-4`}>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-lg font-bold" style={{ color: '#0d1b2e' }}>Pedido {pedido.codigo}</h2>
            <span className="text-xs font-semibold rounded-full px-3 py-1" style={{ background: st.bg, color: st.color }}>{st.label}</span>
            {pedido.proposta_codigo && (
              <a href={`/vendas/propostas/${pedido.proposta_id}`} className="text-xs text-blue-600 hover:underline">← Proposta {pedido.proposta_codigo}</a>
            )}
          </div>
          <div className="grid gap-y-3 gap-x-6 sm:grid-cols-3 text-sm">
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cliente</p><p className="font-semibold mt-0.5">{pedido.cliente_nome}</p></div>
            {pedido.cidade && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cidade</p><p className="mt-0.5">{pedido.cidade}</p></div>}
            {pedido.telefone && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Telefone</p><p className="mt-0.5">{pedido.telefone}</p></div>}
          </div>
        </section>

        {/* Containers */}
        <section className={`${card} p-4`}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#0d1b2e' }}>
            Containers ({pedido.containers.length})
          </h3>
          {pedido.containers.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum container vinculado a este pedido.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(pedido.containers as { id: string | null; numero: string; tamanho: string }[]).map((c, i) => (
                <div key={c.id ?? i} className="flex items-center gap-3 py-2 text-sm">
                  <span>📦</span>
                  <span className="font-mono font-semibold">{c.numero || '—'}</span>
                  {c.tamanho && <span className="text-slate-500 text-xs">{c.tamanho}</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pagamentos */}
        <section className={`${card} p-4`}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#0d1b2e' }}>Pagamentos</h3>

          {/* Barra de progresso */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-500">Recebido: <strong className="text-slate-800">{brl(pedido.total_pago)}</strong></span>
              <span className="text-slate-500">Saldo: <strong style={{ color: saldo > 0 ? '#dc2626' : '#16a34a' }}>{brl(saldo)}</strong></span>
            </div>
            <div className="rounded-full h-2.5 overflow-hidden" style={{ background: '#e2e8f0' }}>
              <div className="h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct >= 100 ? '#16a34a' : '#1B4F8A' }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">{pct.toFixed(0)}% do total {brl(pedido.total)}</p>
          </div>

          {/* Lista */}
          {pagamentos.length > 0 && (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 mb-4">
              {pagamentos.map(pg => (
                <div key={pg.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-green-700">{brl(pg.valor)}</span>
                    <span className="text-sm text-slate-500 ml-2">{FORMA_LABEL[pg.forma] ?? pg.forma}</span>
                    {pg.obs && <span className="text-xs text-slate-400 ml-2">· {pg.obs}</span>}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{dataCurta(pg.data_recebimento + 'T12:00:00')}</span>
                  {pedido.status !== 'liberado' && (
                    <button onClick={() => deletarPagamento(pg.id)}
                      className="text-xs text-red-400 hover:text-red-600 shrink-0 p-1">✕</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Form de lançamento */}
          {pedido.status !== 'liberado' && (
            <div className="border border-slate-200 rounded-xl p-3 space-y-3">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Registrar pagamento</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Valor (R$)</span>
                  <input className={`${input} mt-1`} inputMode="decimal" placeholder="0,00"
                    value={addValor} onChange={e => setAddValor(e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Forma</span>
                  <select className={`${input} mt-1`} value={addForma} onChange={e => setAddForma(e.target.value)}>
                    {FORMAS.map(f => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Data do recebimento</span>
                  <input type="date" className={`${input} mt-1`} value={addData} onChange={e => setAddData(e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Observação (opcional)</span>
                  <input className={`${input} mt-1`} placeholder="ex: comprovante enviado"
                    value={addObs} onChange={e => setAddObs(e.target.value)} />
                </label>
              </div>
              <button className={`${btn} w-full`} style={{ background: '#1B4F8A' }}
                disabled={adicionando} onClick={registrarPagamento}>
                {adicionando ? 'Registrando…' : '+ Registrar pagamento'}
              </button>
            </div>
          )}

          {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
        </section>
      </div>

      {/* Sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-4">
        {/* Total */}
        <section className={`${card} p-4`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total do pedido</p>
          <p className="text-3xl font-bold mt-1" style={{ color: '#0d1b2e' }}>{brl(pedido.total)}</p>
          <div className="mt-3 space-y-1.5 text-sm border-t border-slate-100 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Recebido</span>
              <span className="font-semibold text-green-700">{brl(pedido.total_pago)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Saldo devedor</span>
              <span className="font-semibold" style={{ color: saldo > 0 ? '#dc2626' : '#16a34a' }}>{brl(saldo)}</span>
            </div>
          </div>
        </section>

        {/* Liberar (quando quitado) */}
        {pedido.status === 'quitado' && (
          <section className={`${card} p-4 space-y-3`}>
            <p className="text-sm font-bold" style={{ color: '#0d1b2e' }}>Liberar para o pátio</p>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Observação (opcional)</span>
              <textarea className={`${input} mt-1`} rows={2}
                placeholder="ex: retirada agendada para 27/11"
                value={obsLib} onChange={e => setObsLib(e.target.value)} />
            </label>
            <button className={`${btn} w-full`} style={{ background: '#16a34a' }}
              disabled={liberando} onClick={liberar}>
              {liberando ? 'Liberando…' : '✅ Liberar containers'}
            </button>
          </section>
        )}

        {/* Pós-liberação */}
        {pedido.status === 'liberado' && (
          <section className={`${card} p-4 space-y-3`}>
            <p className="text-sm font-bold text-green-700">Liberado em {dataCurta(pedido.liberado_em)}</p>
            {pedido.obs_liberacao && <p className="text-xs text-slate-500">{pedido.obs_liberacao}</p>}
            <button className={`${btn} w-full`} style={{ background: '#1B4F8A' }}
              disabled={gerandoPdf} onClick={baixarPdf}>
              {gerandoPdf ? 'Gerando…' : '📄 PDF de Liberação'}
            </button>
            <a href={gerarWhatsUrl(pedido)} target="_blank" rel="noopener noreferrer"
              className={`${btn} w-full`} style={{ background: '#16a34a' }}>
              📱 Enviar ao pátio (WhatsApp)
            </a>
          </section>
        )}
      </aside>
    </div>
  )
}
