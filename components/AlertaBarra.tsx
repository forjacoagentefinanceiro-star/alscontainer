'use client'

import { useEffect, useRef, useState } from 'react'
import type { BarraStatus } from '@/app/actions'

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—'
const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'

const STORAGE_KEY = 'barra_last_seen_changed_em'

type StatusCor = { bg: string; border: string; label: string; icon: string; textColor: string }

function classCor(status: string): StatusCor {
  const s = status.toLowerCase()
  if (s.includes('fechad')) {
    return { bg: '#fef2f2', border: '#fca5a5', label: 'FECHADA', icon: '🔴', textColor: '#991b1b' }
  }
  if (s.includes('restri')) {
    return { bg: '#fffbeb', border: '#fde68a', label: 'PRATICÁVEL c/ restrições', icon: '🟡', textColor: '#92400e' }
  }
  if (s.includes('praticáv') || s.includes('praticav')) {
    return { bg: '#f0fdf4', border: '#86efac', label: 'PRATICÁVEL', icon: '🟢', textColor: '#14532d' }
  }
  if (s.includes('condicion')) {
    return { bg: '#fff7ed', border: '#fdba74', label: 'CONDICIONADA', icon: '🟠', textColor: '#9a3412' }
  }
  return { bg: '#f8fafc', border: '#e5e7eb', label: status, icon: '⚓', textColor: '#1a2a3a' }
}

export function AlertaBarra({ barra }: { barra: BarraStatus | null }) {
  const [toast, setToast] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const seenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!barra?.changed_em || !barra.profundidade) return
    const lastSeen = localStorage.getItem(STORAGE_KEY)
    if (lastSeen !== barra.changed_em) {
      setToastMsg(barra.profundidade)
      setToast(true)
      seenRef.current = barra.changed_em
    }
  }, [barra?.changed_em, barra?.profundidade])

  function fecharToast() {
    setToast(false)
    if (seenRef.current) localStorage.setItem(STORAGE_KEY, seenRef.current)
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(fecharToast, 20000)
    return () => clearTimeout(t)
  }, [toast])

  if (!barra?.profundidade) return null

  const cor = classCor(barra.profundidade)
  const mudouRecente = barra.changed_em &&
    (Date.now() - new Date(barra.changed_em).getTime()) < 2 * 3600 * 1000
  const toastCor = toastMsg ? classCor(toastMsg) : cor

  return (
    <>
      {/* Banner compacto sempre visível */}
      <div
        className="flex items-center gap-2 flex-wrap px-3 py-1.5 rounded-lg mb-3 text-xs"
        style={{ background: cor.bg, border: `1px solid ${cor.border}` }}
      >
        <span className="font-semibold" style={{ color: cor.textColor }}>
          {cor.icon} Barra Itajaí:
        </span>
        <span className="font-bold" style={{ color: cor.textColor }}>
          {barra.profundidade}
        </span>
        {mudouRecente && barra.anterior && (
          <span style={{ color: '#9ca3af' }}>← era: {barra.anterior}</span>
        )}
        <span style={{ color: '#9ca3af' }}>
          · {hora(barra.atualizado_em)}
          {mudouRecente && barra.changed_em && (
            <> · <strong style={{ color: cor.textColor }}>mudou às {hora(barra.changed_em)}</strong></>
          )}
        </span>
        <a
          href="https://praticoszp21.com.br/"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs underline"
          style={{ color: '#6b7280' }}
        >
          praticoszp21.com.br ↗
        </a>
      </div>

      {/* Toast popup quando muda */}
      {toast && (
        <div
          className="fixed z-50 flex flex-col gap-1 shadow-xl rounded-xl p-4"
          style={{
            top: 16, right: 16, minWidth: 300, maxWidth: 420,
            background: '#1a2a3a', border: `2px solid ${toastCor.border}`,
            animation: 'slideInRight 0.3s ease',
          }}
        >
          <style>{`@keyframes slideInRight{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-sm" style={{ color: toastCor.border }}>
              🚢 Barra Itajaí — condição atualizada
            </span>
            <button
              onClick={fecharToast}
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{ color: '#9ca3af', background: 'rgba(255,255,255,0.06)' }}
            >
              ✕
            </button>
          </div>
          <p className="text-base font-bold" style={{ color: '#e6eef7' }}>
            {toastCor.icon} {toastMsg}
          </p>
          {barra.anterior && (
            <p className="text-xs" style={{ color: '#9ca3af' }}>Anterior: {barra.anterior}</p>
          )}
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            Mudou em {dataHora(barra.changed_em)}
          </p>
          <a
            href="https://praticoszp21.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline mt-1"
            style={{ color: '#7DC242' }}
          >
            Ver praticoszp21.com.br ↗
          </a>
        </div>
      )}
    </>
  )
}
