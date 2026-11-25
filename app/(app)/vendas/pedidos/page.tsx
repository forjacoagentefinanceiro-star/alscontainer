import Link from 'next/link'
import { exigirVendas } from '@/lib/vendas/server'
import { brl, dataCurta } from '@/lib/vendas/config'
import { Titulo, Abas, Kpi, card } from '@/components/vendas/ui'

export const dynamic = 'force-dynamic'

const STATUS_INFO: Record<string, { label: string; bg: string; color: string }> = {
  aguardando_pagamento: { label: 'Aguardando',   bg: '#fef9c3', color: '#854d0e' },
  parcialmente_pago:    { label: 'Parcialmente pago', bg: '#dbeafe', color: '#1e40af' },
  quitado:              { label: 'Quitado',       bg: '#dcfce7', color: '#166534' },
  liberado:             { label: 'Liberado ✓',    bg: '#d1fae5', color: '#065f46' },
}

export default async function PedidosPage() {
  const { supabase } = await exigirVendas()

  const { data: pedidos } = await supabase
    .from('cv_pedidos')
    .select('id, codigo, cliente_nome, cidade, containers, total, total_pago, status, criado_em')
    .order('criado_em', { ascending: false })
    .limit(200)

  const rows = (pedidos ?? []) as {
    id: string; codigo: string; cliente_nome: string; cidade: string | null
    containers: { numero: string; tamanho: string }[]; total: number; total_pago: number
    status: string; criado_em: string
  }[]

  const abertos = rows.filter(r => r.status !== 'liberado')
  const totalReceber = abertos.reduce((s, r) => s + Math.max(0, r.total - r.total_pago), 0)
  const totalQuitado = rows.filter(r => r.status === 'quitado').reduce((s, r) => s + r.total, 0)
  const totalLiberado = rows.filter(r => r.status === 'liberado').length

  return (
    <div>
      <Titulo>Pedidos de Venda</Titulo>
      <Abas ativa="/vendas/pedidos" />

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <Kpi label="A receber (em aberto)" valor={brl(totalReceber)} nota={`${abertos.length} pedido(s) em aberto`} />
        <Kpi label="Aguardando liberação" valor={brl(totalQuitado)} nota="Quitados, ainda não liberados" />
        <Kpi label="Liberados" valor={String(totalLiberado)} nota="Autorização emitida" />
      </div>

      {rows.length === 0 ? (
        <div className={`${card} p-8 text-center`}>
          <p className="text-slate-500 text-sm">Nenhum pedido ainda. Converta uma proposta de venda para criar o primeiro.</p>
        </div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pedido</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Containers</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Saldo</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(r => {
                const saldo = Math.max(0, r.total - r.total_pago)
                const st = STATUS_INFO[r.status] ?? { label: r.status, bg: '#f1f5f9', color: '#475569' }
                const conts = (r.containers as { numero: string; tamanho: string }[])
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/vendas/pedidos/${r.id}`} className="font-mono font-semibold text-blue-700 hover:underline">
                        {r.codigo}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: '#0d1b2e' }}>{r.cliente_nome}</p>
                      {r.cidade && <p className="text-xs text-slate-500">{r.cidade}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {conts.length === 0
                        ? <span className="text-slate-400 text-xs">—</span>
                        : conts.slice(0, 2).map((c, i) => (
                            <p key={i} className="font-mono text-xs">{c.numero} <span className="text-slate-400">{c.tamanho}</span></p>
                          ))
                      }
                      {conts.length > 2 && <p className="text-xs text-slate-400">+{conts.length - 2} mais</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{brl(r.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span style={{ color: saldo > 0 ? '#dc2626' : '#16a34a' }} className="font-semibold">
                        {brl(saldo)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold rounded-full px-2.5 py-1 whitespace-nowrap"
                        style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{dataCurta(r.criado_em)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
