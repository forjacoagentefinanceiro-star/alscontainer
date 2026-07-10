'use client'

import { useState, useTransition } from 'react'
import type { Setor } from '@/app/actions'
import { addSetor, deleteSetor } from '@/app/actions'

export function SetoresManager({ setores, defaultOpen = false }: { setores: Setor[]; defaultOpen?: boolean }) {
  const [list, setList] = useState(setores)
  const [nome, setNome] = useState('')
  const [open, setOpen] = useState(defaultOpen)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function add() {
    const n = nome.trim()
    if (!n) return
    setErro(null)
    startTransition(async () => {
      const res = await addSetor(n)
      if (res.error) { setErro(res.error); return }
      setList(prev => [...prev, { id: crypto.randomUUID(), nome: n, created_at: new Date().toISOString() }]
        .sort((a, b) => a.nome.localeCompare(b.nome)))
      setNome('')
    })
  }

  function remove(id: string, nome: string) {
    if (!confirm(`Remover setor "${nome}"? Equipamentos e usuários com este setor não serão afetados (apenas o cadastro do setor será removido).`)) return
    startTransition(async () => {
      const res = await deleteSetor(id)
      if (res.error) { setErro(res.error); return }
      setList(prev => prev.filter(s => s.id !== id))
    })
  }

  const btn = 'text-xs px-2.5 py-1 rounded border transition-colors'

  return (
    <div className="bg-white rounded-xl max-w-3xl mb-5" style={{ border: '1px solid #e5e7eb' }}>
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: open ? '1px solid #f3f4f6' : 'none' }}>
        <span className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>Setores cadastrados ({list.length})</span>
        <span className="text-xs" style={{ color: '#6b7280' }}>{open ? 'fechar' : 'gerenciar'}</span>
      </button>

      {open && (
        <div className="p-5">
          <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
            Os setores cadastrados aqui aparecem como opção ao definir o setor de um equipamento ou de um usuário.
          </p>

          <div className="flex gap-2 mb-4">
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: '#d1d5db', color: '#1a2a3a' }}
              placeholder="Nome do setor (ex: Pátio A, Portaria, Manutenção)"
            />
            <button onClick={add} disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#1B4F8A' }}>
              Adicionar
            </button>
          </div>

          {erro && <p className="text-xs mb-3 px-3 py-2 rounded" style={{ background: '#fef2f2', color: '#b91c1c' }}>{erro}</p>}

          {list.length === 0 ? (
            <p className="text-sm" style={{ color: '#9ca3af' }}>Nenhum setor cadastrado ainda.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {list.map(s => (
                <div key={s.id} className="flex items-center gap-2 py-2">
                  <span className="flex-1 text-sm font-medium px-2 py-0.5 rounded w-fit" style={{ color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                    {s.nome}
                  </span>
                  <button onClick={() => remove(s.id, s.nome)} disabled={isPending}
                    className={btn} style={{ borderColor: '#fecaca', color: '#ef4444' }}>
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
