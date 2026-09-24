'use client'

import { useState } from 'react'

// Endereço oficial do app (o mesmo para todos os aparelhos)
const LINK_APP = 'https://alscontainer.vercel.app/login'

// Mesmo gerador de QR usado em /tarefas/qrcode
function qrUrl(data: string, size = 300) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=10&format=png`
}

// Link para instalar o ALS Depot (PWA) em celulares e computadores novos
export function InstalarAppCard() {
  const link = LINK_APP
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2500) }
    catch { window.prompt('Copie o link:', link) }
  }

  function whatsapp() {
    const texto = `📲 *ALS Depot — instalar o app*\n\nAbra no celular e entre com seu usuário:\n${link}\n\n• Android (Chrome): menu ⋮ → *Instalar app*\n• iPhone (Safari): Compartilhar → *Adicionar à Tela de Início*`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  return (
    <div className="bg-white rounded-xl mb-5 max-w-2xl p-4 flex gap-4 flex-wrap items-start" style={{ border: '1px solid #e5e7eb' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrUrl(link, 240)} alt="QR Code para instalar o ALS Depot" width={120} height={120}
        className="rounded-lg shrink-0" style={{ border: '1px solid #e5e7eb' }} />
      <div className="flex-1 min-w-[220px]">
        <p className="text-sm font-bold" style={{ color: '#1a2a3a' }}>📲 Instalar o app em novos aparelhos</p>
        <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Aponte a câmera para o QR Code ou envie o link. Depois de instalar, a pessoa entra com o próprio usuário.</p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <code className="text-xs px-2 py-1.5 rounded select-all" style={{ background: '#f3f4f6', color: '#1a2a3a' }}>{link}</code>
          <button onClick={copiar} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#1B4F8A' }}>
            {copiado ? '✓ Copiado' : 'Copiar link'}
          </button>
          <button onClick={whatsapp} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#25D366' }}>
            Enviar no WhatsApp
          </button>
        </div>
        <ul className="mt-3 text-xs space-y-1" style={{ color: '#374151' }}>
          <li><strong>Android (Chrome):</strong> abrir o link → menu ⋮ → <em>Instalar app</em> (ou <em>Adicionar à tela inicial</em>).</li>
          <li><strong>iPhone (Safari):</strong> abrir o link → botão Compartilhar → <em>Adicionar à Tela de Início</em>.</li>
          <li><strong>Computador (Chrome/Edge):</strong> abrir o link → ícone de instalar na barra de endereço.</li>
        </ul>
      </div>
    </div>
  )
}
