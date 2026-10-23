'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { mascara, soDigitos } from './lead'

const CHAVE = 'mla-contato'

/** Contato já informado nesta aparelho (evita pedir de novo a cada clique). */
export function contatoSalvo(): { nome: string; tel: string } | null {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVE) || 'null')
    if (j && typeof j.nome === 'string' && typeof j.tel === 'string' && j.tel.length >= 10) return j
  } catch { /* modo privado */ }
  return null
}
export function guardarContato(nome: string, tel: string) {
  try { localStorage.setItem(CHAVE, JSON.stringify({ nome, tel })) } catch { /* modo privado */ }
}

/** Pede nome e WhatsApp antes de abrir a conversa, para o lead chegar completo no CRM. */
export default function ModalContato({ onConfirmar, onFechar }: { onConfirmar: (nome: string, tel: string) => void; onFechar: () => void }) {
  const [nome, setNome] = useState(''); const [tel, setTel] = useState(''); const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(false)
  useEffect(() => {
    setPronto(true)
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', f)
    const antes = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', f); document.body.style.overflow = antes }
  }, [onFechar])

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    const d = soDigitos(tel)
    if (nome.trim().length < 2) { setErro('Digite o seu nome.'); return }
    if (d.length < 10 || d.length > 11) { setErro('Digite o telefone com DDD, ex.: (47) 99999-9999.'); return }
    guardarContato(nome.trim(), d)
    onConfirmar(nome.trim(), d)
  }

  if (!pronto) return null
  const campo: React.CSSProperties = { marginTop: 4, width: '100%', borderRadius: 12, border: 0, background: '#fff', padding: '14px 16px', fontSize: 16, color: '#0f172a', outline: 'none' }
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Seus dados para o atendimento" onClick={onFechar}
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(5,7,10,.72)', backdropFilter: 'blur(4px)' }}>
      <form onSubmit={enviar} noValidate onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 400, borderRadius: 24, padding: 24, background: '#14171e', color: '#fff', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)', fontFamily: 'inherit' }}>
        <p style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>Antes de abrir o WhatsApp</p>
        <p style={{ marginTop: 6, fontSize: 14, color: 'rgba(255,255,255,.7)' }}>Informe seu nome e telefone para que possamos te atender e retornar caso a conversa caia.</p>
        <label style={{ display: 'block', marginTop: 16, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>Seu nome
          <input value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" autoFocus placeholder="Como podemos te chamar?" style={campo} /></label>
        <label style={{ display: 'block', marginTop: 12, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>Seu WhatsApp
          <input value={tel} onChange={e => setTel(mascara(e.target.value))} inputMode="tel" autoComplete="tel-national" placeholder="(47) 99999-9999" style={campo} /></label>
        {erro && <p style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: '#f87171' }}>{erro}</p>}
        <button type="submit" style={{ marginTop: 16, width: '100%', borderRadius: 999, border: 0, padding: '15px 20px', fontSize: 16, fontWeight: 800, color: '#fff', background: '#16a34a', cursor: 'pointer' }}>Continuar no WhatsApp</button>
        <button type="button" onClick={onFechar} style={{ marginTop: 8, width: '100%', border: 0, background: 'transparent', padding: 8, fontSize: 14, color: 'rgba(255,255,255,.55)', cursor: 'pointer' }}>Cancelar</button>
        <p style={{ marginTop: 6, fontSize: 12, lineHeight: 1.4, color: 'rgba(255,255,255,.45)', textAlign: 'center' }}>Usamos seus dados só para este atendimento.</p>
      </form>
    </div>,
    document.body,
  )
}
