'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarOperador } from '@/app/actions'

export function CriarOperadorForm() {
  const [nome, setNome] = useState('')
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [exigirTroca, setExigirTroca] = useState(true)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; txt: string } | null>(null)
  const [aberto, setAberto] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function criar() {
    setMsg(null)
    startTransition(async () => {
      const res = await criarOperador(nome, usuario, senha, exigirTroca)
      if (res.error) setMsg({ tipo: 'erro', txt: res.error })
      else {
        setMsg({ tipo: 'ok', txt: `✓ Operador criado! Login: usuário "${res.usuario}" + a senha provisória${exigirTroca ? '. Ele será obrigado a trocá-la no 1º acesso.' : '.'}` })
        setNome(''); setUsuario(''); setSenha('')
        router.refresh()
      }
    })
  }

  const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none'
  const inputStyle = { borderColor: '#d1d5db', color: '#1a2a3a' } as const

  return (
    <div className="bg-white rounded-xl mb-5 max-w-2xl" style={{ border: '1px solid #e5e7eb' }}>
      <button onClick={() => setAberto(o => !o)} className="w-full px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: aberto ? '1px solid #f3f4f6' : 'none' }}>
        <span className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>+ Criar operador (sem e-mail)</span>
        <span className="text-xs" style={{ color: '#6b7280' }}>{aberto ? 'fechar' : 'abrir'}</span>
      </button>
      {aberto && (
        <div className="p-5">
          <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
            O operador entra com <strong>usuário + senha</strong> (não precisa de e-mail). Já fica aprovado com o papel <strong>operador</strong>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Nome</label>
              <input className={inputCls} style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do operador" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Usuário (login)</label>
              <input className={inputCls} style={inputStyle} value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="ex.: joao.silva" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Senha provisória</label>
              <input className={inputCls} style={inputStyle} value={senha} onChange={e => setSenha(e.target.value)} placeholder="mín. 6 caracteres" />
            </div>
          </div>
          <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer" style={{ color: '#374151' }}>
            <input type="checkbox" checked={exigirTroca} onChange={e => setExigirTroca(e.target.checked)} />
            Pedir troca de senha no 1º acesso (você não fica sabendo a senha final)
          </label>
          {msg && (
            <p className="text-sm mt-3 px-3 py-2 rounded" style={{ background: msg.tipo === 'ok' ? '#ecfdf5' : '#fef2f2', color: msg.tipo === 'ok' ? '#047857' : '#b91c1c' }}>
              {msg.txt}
            </p>
          )}
          <button onClick={criar} disabled={isPending} className="mt-4 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#1B4F8A' }}>
            {isPending ? 'Criando…' : 'Criar operador'}
          </button>
        </div>
      )}
    </div>
  )
}
