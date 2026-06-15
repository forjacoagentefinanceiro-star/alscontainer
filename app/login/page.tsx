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
    setError('')
    setSuccess('')
    setLoading(true)

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-sm">
        {/* Logo / título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 mb-4">
            <span className="text-2xl">📦</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">Gerador de Container</h1>
          <p className="text-sm text-slate-500 mt-1">Numeração ISO 6346</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-5">
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500 transition-colors"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-950 border border-red-800 rounded-lg px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-emerald-950 border border-emerald-800 rounded-lg px-3 py-2 text-xs text-emerald-300">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess('') }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              {mode === 'login' ? 'Não tem conta? Criar agora' : 'Já tenho conta → Entrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
