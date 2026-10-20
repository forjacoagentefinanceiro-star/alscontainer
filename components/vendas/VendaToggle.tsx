'use client'

import { useState, useTransition } from 'react'
import { marcarParaVenda } from '@/app/venda-estoque-actions'

export type ParteVenda = { id: string; para_venda?: boolean | null; preco_anuncio?: number | null; status?: string | null }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Botão "Marcar para venda" do inventário. O container passa a aparecer no estoque do CRM de vendas. */
export function VendaToggle({ c, canEdit, onChange }: {
  c: ParteVenda; canEdit: boolean; onChange: (id: string, v: { para_venda: boolean; preco_anuncio: number | null }) => void
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(c.preco_anuncio ? String(c.preco_anuncio).replace('.', ',') : '')
  const [erro, setErro] = useState('')
  const [pend, start] = useTransition()

  if (c.status === 'vendido') return <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>Vendido</span>

  function salvar(para: boolean) {
    const n = Number(valor.replace(/\./g, '').replace(',', '.'))
    const preco = para && valor.trim() && Number.isFinite(n) ? n : null
    setErro('')
    start(async () => {
      const r = await marcarParaVenda(c.id, para, preco)
      if (r.error) { setErro(r.error); return }
      onChange(c.id, { para_venda: para, preco_anuncio: preco })
      setEditando(false)
    })
  }

  if (editando) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" placeholder="Preço R$"
            className="w-24 rounded border px-2 py-1 text-xs" style={{ borderColor: '#d1d5db' }} />
          <button disabled={pend} onClick={() => salvar(true)} className="px-2 py-1 rounded text-xs font-semibold text-white" style={{ background: '#16a34a' }}>OK</button>
          <button onClick={() => setEditando(false)} className="px-1 text-xs text-gray-500">×</button>
        </div>
        {erro && <span className="text-[11px] text-red-600 max-w-[200px]">{erro}</span>}
      </div>
    )
  }

  if (c.para_venda) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold" style={{ color: '#1B4F8A' }}>À venda{c.preco_anuncio ? ` · ${brl(Number(c.preco_anuncio))}` : ''}</span>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setEditando(true)} className="text-[11px] underline text-gray-500">preço</button>
            <button disabled={pend} onClick={() => salvar(false)} className="text-[11px] underline text-red-500">tirar</button>
          </div>
        )}
        {erro && <span className="text-[11px] text-red-600">{erro}</span>}
      </div>
    )
  }
  if (!canEdit) return <span className="text-xs text-gray-300">—</span>
  return (
    <button onClick={() => setEditando(true)} className="px-2.5 py-1 rounded text-xs font-medium border hover:bg-green-50"
      style={{ borderColor: '#bbf7d0', color: '#166534' }}>
      Marcar p/ venda
    </button>
  )
}
