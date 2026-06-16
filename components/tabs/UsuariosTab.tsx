'use client'

import { useState, useTransition } from 'react'
import type { UserProfile } from '@/app/actions'
import { approveUser, updateUserRole, revokeUser } from '@/app/actions'

const roleLabel = { admin: 'Admin', editor: 'Editor', viewer: 'Visualizador' }
const roleColor = {
  admin:  { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  editor: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  viewer: { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
}

export function UsuariosTab({ users }: { users: UserProfile[] }) {
  const [list, setList] = useState(users)
  const [isPending, startTransition] = useTransition()

  const pending  = list.filter(u => !u.approved)
  const approved = list.filter(u => u.approved)

  function handleApprove(userId: string, role: UserProfile['role']) {
    startTransition(async () => {
      const res = await approveUser(userId, role)
      if (!res.error) setList(prev => prev.map(u => u.id === userId ? { ...u, approved: true, role } : u))
    })
  }

  function handleRole(userId: string, role: UserProfile['role']) {
    startTransition(async () => {
      const res = await updateUserRole(userId, role)
      if (!res.error) setList(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    })
  }

  function handleRevoke(userId: string) {
    if (!confirm('Revogar acesso deste usuário?')) return
    startTransition(async () => {
      const res = await revokeUser(userId)
      if (!res.error) setList(prev => prev.map(u => u.id === userId ? { ...u, approved: false } : u))
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Pendentes */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
          <span className="text-sm font-bold" style={{ color: '#92400e' }}>Aguardando aprovação</span>
          {pending.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f59e0b', color: '#fff' }}>
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Nenhum cadastro pendente</p>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
            {pending.map(u => (
              <div key={u.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>{u.email}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                      Solicitado em {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                    Pendente
                  </span>
                </div>

                {/* Aprovar com papel */}
                <div className="flex flex-wrap gap-2">
                  <p className="text-xs w-full mb-1" style={{ color: '#6b7280' }}>Aprovar como:</p>
                  {(['viewer', 'editor', 'admin'] as const).map(role => (
                    <button key={role} onClick={() => handleApprove(u.id, role)} disabled={isPending}
                      className="flex-1 py-2 rounded text-xs font-semibold border transition-colors disabled:opacity-50"
                      style={{
                        background: role === 'viewer' ? '#f9fafb' : role === 'editor' ? '#eff6ff' : '#fef3c7',
                        color:      role === 'viewer' ? '#374151' : role === 'editor' ? '#1d4ed8' : '#92400e',
                        border:     `1px solid ${role === 'viewer' ? '#e5e7eb' : role === 'editor' ? '#bfdbfe' : '#fde68a'}`,
                      }}>
                      {roleLabel[role]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aprovados */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="px-5 py-3" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <span className="text-sm font-bold" style={{ color: '#1a2a3a' }}>Usuários com acesso</span>
          <span className="text-xs ml-2" style={{ color: '#9ca3af' }}>{approved.length} usuário{approved.length !== 1 ? 's' : ''}</span>
        </div>

        {approved.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Nenhum usuário aprovado</p>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
            {approved.map(u => (
              <div key={u.id} className="px-5 py-3 flex items-center gap-4">
                {/* Avatar inicial */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white"
                  style={{ background: '#1B4F8A' }}>
                  {u.email[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#1a2a3a' }}>{u.email}</p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>
                    desde {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                {/* Papel */}
                <select
                  value={u.role}
                  onChange={e => handleRole(u.id, e.target.value as UserProfile['role'])}
                  disabled={isPending}
                  className="rounded border text-xs px-2 py-1.5 outline-none font-semibold"
                  style={{
                    ...roleColor[u.role],
                    borderColor: roleColor[u.role].border,
                  }}
                >
                  <option value="viewer">Visualizador</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>

                {/* Revogar */}
                <button onClick={() => handleRevoke(u.id)} disabled={isPending}
                  className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-red-50 disabled:opacity-50"
                  style={{ borderColor: '#fecaca', color: '#ef4444' }}>
                  Revogar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legenda de papéis */}
      <div className="rounded-xl p-4" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
        <p className="text-xs font-semibold mb-2" style={{ color: '#6b7280' }}>PERMISSÕES POR PAPEL</p>
        <div className="space-y-1.5 text-xs" style={{ color: '#374151' }}>
          <p><strong style={{ color: '#92400e' }}>Admin:</strong> aprovação de usuários + acesso total ao inventário</p>
          <p><strong style={{ color: '#1d4ed8' }}>Editor:</strong> adicionar, editar e excluir containers</p>
          <p><strong style={{ color: '#6b7280' }}>Visualizador:</strong> somente consulta — sem edição</p>
        </div>
      </div>
    </div>
  )
}
