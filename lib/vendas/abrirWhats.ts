'use client'

import { formatTelefone, numeroWhats } from './config'

// Mesmo comportamento do CRM do Viver de Locação: o WhatsApp Web isola a aba,
// então o computador tem 3 modos (lembrados por aparelho): app, copiar, web.
// No celular é sempre wa.me.
export type DestinoWhats = 'web' | 'app' | 'copiar'
const CHAVE = 'als-vendas-whats-destino'

export function destinoWhats(): DestinoWhats {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === 'app' || v === 'copiar' ? v : 'web'
  } catch { return 'web' }
}
export function salvarDestinoWhats(d: DestinoWhats) {
  try { localStorage.setItem(CHAVE, d) } catch { /* modo privado */ }
}

function ehCelular() {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || window.matchMedia('(pointer: coarse)').matches
}

export function avisar(texto: string, ms = 4000) {
  const el = document.createElement('div')
  el.setAttribute('role', 'status')
  el.textContent = texto
  el.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);background:#0d1b2e;color:#fff;padding:10px 16px;border-radius:12px;font-size:13px;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:90vw'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), ms)
}

/** Devolve false se o telefone não serve. Chamar direto no clique (evita bloqueio de pop-up). */
export function abrirWhats(telefone: string | null | undefined, texto?: string): boolean {
  const n = numeroWhats(telefone)
  if (!n) return false
  const q = texto ? `&text=${encodeURIComponent(texto)}` : ''
  if (ehCelular()) {
    window.location.href = `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
    return true
  }
  const modo = destinoWhats()
  if (modo === 'app') { window.location.href = `whatsapp://send?phone=${n}${q}`; return true }
  if (modo === 'copiar') {
    const tel = formatTelefone(telefone)
    navigator.clipboard?.writeText(texto ?? n)
      .then(() => avisar(`✓ Copiado. Cole na conversa de ${tel} no seu WhatsApp`, 5000))
      .catch(() => avisar('Não consegui copiar. Selecione o texto e copie manualmente', 5000))
    return true
  }
  window.open(`https://web.whatsapp.com/send?phone=${n}${q}`, '_blank')
  return true
}
