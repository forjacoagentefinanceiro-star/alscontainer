'use client'

import { useState, useTransition } from 'react'
import type { Empilhadeira } from '@/app/actions'
import { addEmpilhadeira, updateEmpilhadeira, deleteEmpilhadeira } from '@/app/actions'

export function EmpilhadeirasManager({ empilhadeiras, defaultOpen = false }: { empilhadeiras: Empilhadeira[]; defaultOpen?: boolean }) {
  const [list, setList] = useState(empilhadeiras)
  const [nome, setNome] = useState('')
  const [open, setOpen] = useState(defaultOpen)
  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [isPending, startTransition] = useTransition()

  function add() {
    const n = nome.trim()
    if (!n) return
    startTransition(async () => {
      const res = await addEmpilhadeira(n)
      if (!res.error) {
        setList(prev => [...prev, { id: crypto.randomUUID(), nome: n, ativo: true, horimetro_atual: null, created_at: new Date().toISOString() }].sort((a, b) => a.nome.localeCompare(b.nome)))
        setNome('')
      }
    })
  }

  function salvarEdicao(id: string) {
    const n = editVal.trim()
    if (!n) return
    startTransition(async () => {
      const res = await updateEmpilhadeira(id, n)
      if (!res.error) {
        setList(prev => prev.map(e => e.id === id ? { ...e, nome: n } : e).sort((a, b) => a.nome.localeCompare(b.nome)))
        setEditId(null)
      }
    })
  }

  function remove(id: string) {
    if (!confirm('Remover este equipamento?')) return
    startTransition(async () => {
      const res = await deleteEmpilhadeira(id)
      if (!res.error) setList(prev => prev.filter(e => e.id !== id))
    })
  }

  const btn = 'text-xs px-2.5 py-1 rounded border transition-colors'

  return (
    <div className="bg-white rounded-xl max-w-3xl mb-5" style={{ border: '1px solid #e5e7eb' }}>
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: open ? '1px solid #f3f4f6' : 'none' }}>
        <span className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>Equipamentos cadastrados ({list.length})</span>
        <span className="text-xs" style={{ color: '#6b7280' }}>{open ? 'fechar' : 'gerenciar'}</span>
      </button>
      {open && (
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            <input value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }}
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: '#d1d5db', color: '#1a2a3a' }}
              placeholder="Identificação (nº / placa / modelo)" />
            <button onClick={add} disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#1B4F8A' }}>
              Adicionar
            </button>
          </div>

          {list.length === 0 ? (
            <p className="text-sm" style={{ color: '#9ca3af' }}>Nenhum equipamento cadastrado ainda.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {list.map(e => (
                <div key={e.id} className="flex items-center gap-2 py-2">
                  {editId === e.id ? (
                    <>
                      <input value={editVal} onChange={ev => setEditVal(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter') salvarEdicao(e.id); if (ev.key === 'Escape') setEditId(null) }}
                        autoFocus className="flex-1 rounded border px-2 py-1.5 text-sm outline-none" style={{ borderColor: '#1B4F8A', color: '#1a2a3a' }} />
                      <button onClick={() => salvarEdicao(e.id)} disabled={isPending} className={btn} style={{ borderColor: '#a7f3d0', color: '#047857' }}>Salvar</button>
                      <button onClick={() => setEditId(null)} className={btn} style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm" style={{ color: '#1a2a3a' }}>
                        {e.nome}
                        {e.horimetro_atual != null && <span className="ml-2 text-xs" style={{ color: '#6b7280' }}>· horímetro {e.horimetro_atual}h</span>}
                      </span>
                      <button onClick={() => { setEditId(e.id); setEditVal(e.nome) }} className={btn} style={{ borderColor: '#bfdbfe', color: '#1d4ed8' }}>Editar</button>
                      <button onClick={() => remove(e.id)} disabled={isPending} className={btn} style={{ borderColor: '#fecaca', color: '#ef4444' }}>Remover</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
