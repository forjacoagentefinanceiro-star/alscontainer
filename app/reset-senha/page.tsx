'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetSenhaPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.push('/'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f0f2f5' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-block rounded-xl overflow-hidden mb-4"
            style={{ background: '#1B4F8A', boxShadow: '0 4px 24px rgba(27,79,138,0.35)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ALS Logística" style={{ width: 240, height: 'auto', display: 'block' }} />
          </div>
          <h1 className="text-base font-bold" style={{ color: '#1a2a3a' }}>Redefinir senha</h1>
        </div>

        <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          {done ? (
            <div className="text-center py-4">
              <p className="text-2xl mb-3">✅</p>
              <p className="text-sm font-semibold" style={{ color: '#166534' }}>Senha atualizada com sucesso!</p>
              <p className="text-xs mt-1" style={{ color: '#6b7280' }}>Redirecionando...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Nova senha</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full rounded border px-3 py-2.5 text-sm outline-none transition-colors"
                  style={{ borderColor: '#d1d5db', color: '#374151' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#1B4F8A'}
                  onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
                  placeholder="••••••••" minLength={6} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Confirmar nova senha</label>
                <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                  className="w-full rounded border px-3 py-2.5 text-sm outline-none transition-colors"
                  style={{ borderColor: '#d1d5db', color: '#374151' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#1B4F8A'}
                  onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
                  placeholder="••••••••" minLength={6} />
              </div>

              {error && (
                <div className="rounded px-3 py-2 text-xs" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full font-bold rounded py-2.5 text-sm text-white transition-opacity disabled:opacity-50 hover:opacity-90"
                style={{ background: '#1B4F8A' }}>
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
