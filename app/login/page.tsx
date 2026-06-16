'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f0f2f5' }}>
      <div className="w-full max-w-sm">

        {/* Logo card — fundo do PNG é #1B4F8A, sem padding extra */}
        <div className="text-center mb-6">
          <div className="inline-block rounded-xl overflow-hidden mb-4"
            style={{ background: '#1B4F8A', boxShadow: '0 4px 24px rgba(27,79,138,0.35)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ALS Logística" style={{ width: 240, height: 'auto', display: 'block' }} />
          </div>
          <h1 className="text-base font-bold" style={{ color: '#1a2a3a' }}>Depot — Gestão de Containers</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Sistema interno · Itajaí, SC</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: '#6b7280' }}>
            {mode === 'login' ? 'Entrar na plataforma' : 'Criar conta'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded border px-3 py-2.5 text-sm outline-none transition-colors"
                style={{ borderColor: '#d1d5db', color: '#374151' }}
                onFocus={e => e.currentTarget.style.borderColor = '#1B4F8A'}
                onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
                placeholder="seu@email.com" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Senha</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full rounded border px-3 py-2.5 text-sm outline-none transition-colors"
                style={{ borderColor: '#d1d5db', color: '#374151' }}
                onFocus={e => e.currentTarget.style.borderColor = '#1B4F8A'}
                onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
                placeholder="••••••••" />
            </div>

            {error && (
              <div className="rounded px-3 py-2 text-xs" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                {error}
              </div>
            )}
            {success && (
              <div className="rounded px-3 py-2 text-xs" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
                {success}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full font-bold rounded py-2.5 text-sm text-white transition-opacity disabled:opacity-50 hover:opacity-90"
              style={{ background: '#1B4F8A' }}>
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess('') }}
              className="text-xs transition-colors hover:underline"
              style={{ color: '#6b7280' }}>
              {mode === 'login' ? 'Não tem conta? Criar agora' : 'Já tenho conta → Entrar'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: '#9ca3af' }}>
          © ALS Logística — alslog.com.br
        </p>
      </div>
    </div>
  )
}
