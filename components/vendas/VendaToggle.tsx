'use client'

import { useState, useTransition } from 'react'
import { marcarParaVenda } from '@/app/venda-estoque-actions'

export type ParteVenda = { id: string; para_venda?: boolean | null; tipo_venda?: string | null; status?: string | null }
export type TipoVenda = { codigo: string; nome: string; preco: number }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * "Marcar para venda" do inventário. Quem marca só escolhe o TIPO (A/B/C): o preço vem do tipo,
 * cadastrado pelo administrador. Ninguém digita preço por unidade.
 */
export function VendaToggle({ c, canEdit, tipos, onChange }: {
  c: ParteVenda; canEdit: boolean; tipos: TipoVenda[]
  onChange: (id: string, v: { para_venda: boolean; tipo_venda: string | null }) => void
}) {
  const [editando, setEditando] = useState(false)
  const [tipo, setTipo] = useState(c.tipo_venda ?? '')
  const [erro, setErro] = useState('')
  const [pend, start] = useTransition()

  if (c.status === 'locado') {
    return <span className="text-xs" style={{ color: '#9ca3af' }} title="Container locado não pode ser vendido. Encerre a locação primeiro.">Locado</span>
  }
  if (c.status === 'vendido') return <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>Vendido</span>

  const atual = tipos.find(t => t.codigo === c.tipo_venda)

  function salvar(para: boolean) {
    setErro('')
    start(async () => {
      const r = await marcarParaVenda(c.id, para, para ? tipo : null)
      if (r.error) { setErro(r.error); return }
      onChange(c.id, { para_venda: para, tipo_venda: para ? tipo : null })
      setEditando(false)
    })
  }

  if (editando) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <select value={tipo} onChange={e => setTipo(e.target.value)} className="rounded border px-1.5 py-1 text-xs bg-white"
            style={{ borderColor: '#d1d5db', color: '#1a2a3a' }}>
            <option value="">Tipo…</option>
            {tipos.map(t => <option key={t.codigo} value={t.codigo}>{t.codigo} · {brl(t.preco)}</option>)}
          </select>
          <button disabled={pend || !tipo} onClick={() => salvar(true)} className="px-2 py-1 rounded text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#16a34a' }}>OK</button>
          <button onClick={() => setEditando(false)} className="px-1 text-xs text-gray-500">×</button>
        </div>
        {tipos.length === 0 && <span className="text-[11px] text-red-600 max-w-[220px]">Nenhum tipo cadastrado. O administrador cadastra em Vendas &gt; Tipos e preços.</span>}
        {erro && <span className="text-[11px] text-red-600 max-w-[220px]">{erro}</span>}
      </div>
    )
  }

  if (c.para_venda) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold" style={{ color: '#1B4F8A' }}>
          À venda · Tipo {c.tipo_venda ?? '?'}{atual ? ` · ${brl(atual.preco)}` : ''}
        </span>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setEditando(true)} className="text-[11px] underline text-gray-500">trocar tipo</button>
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
