'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trocarMinhaSenha, logout } from '@/app/actions'

export default function TrocarSenhaPage() {
  const router = useRouter()
  const [s1, setS1] = useState('')
  const [s2, setS2] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (s1.length < 6) { setErro('A senha deve ter ao menos 6 caracteres.'); return }
    if (s1 !== s2) { setErro('As senhas não conferem.'); return }
    setLoading(true)
    const res = await trocarMinhaSenha(s1)
    setLoading(false)
    if (res.error) setErro(res.error)
    else router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f0f2f5' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-block rounded-xl overflow-hidden mb-4" style={{ background: '#1B4F8A' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ALS" style={{ width: 200, height: 'auto', display: 'block' }} />
          </div>
          <h1 className="text-base font-bold" style={{ color: '#1a2a3a' }}>Defina sua senha</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Primeiro acesso — escolha uma senha pessoal.</p>
        </div>

        <form onSubmit={salvar} className="bg-white rounded-xl p-6 space-y-4" style={{ border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Nova senha</label>
            <input type="password" required value={s1} onChange={e => setS1(e.target.value)} placeholder="mín. 6 caracteres"
              className="w-full rounded border px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#d1d5db', color: '#374151' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Confirme a nova senha</label>
            <input type="password" required value={s2} onChange={e => setS2(e.target.value)} placeholder="repita a senha"
              className="w-full rounded border px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#d1d5db', color: '#374151' }} />
          </div>
          {erro && <div className="rounded px-3 py-2 text-xs" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>{erro}</div>}
          <button type="submit" disabled={loading} className="w-full font-bold rounded py-2.5 text-sm text-white disabled:opacity-50" style={{ background: '#1B4F8A' }}>
            {loading ? 'Salvando…' : 'Salvar e entrar'}
          </button>
          <button type="button" onClick={() => logout()} className="w-full text-xs hover:underline" style={{ color: '#6b7280' }}>Sair</button>
        </form>
      </div>
    </div>
  )
}
