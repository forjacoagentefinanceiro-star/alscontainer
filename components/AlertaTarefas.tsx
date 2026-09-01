'use client'

import { useState, useEffect } from 'react'

const DESPACHA_APP_URL = 'https://despachaapp.com.br'
const STORAGE_KEY = 'alerta_tarefas_dismissed_count'

// Aviso simples (read-only): sinaliza novas solicitações via QR Code.
// Some ao clicar "Entendi"; reaparece se o número de solicitações aumentar.
export function AlertaTarefas({ novas, titulos }: { novas: number; titulos: string[] }) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10)
      if (saved >= novas) setDismissed(true)
    } catch { /* localStorage indisponível */ }
  }, [novas])

  if (!novas || dismissed) return null

  function handleEntendi() {
    try { localStorage.setItem(STORAGE_KEY, String(novas)) } catch { /* silencioso */ }
    setDismissed(true)
  }

  return (
    <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '2px solid #dc2626', background: '#fef2f2', boxShadow: '0 0 0 3px rgba(220,38,38,0.15)' }}>
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: '#dc2626' }}>
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          <span className="text-lg">📋</span>
          {novas} nova(s) solicitação(ões) via QR Code — trate no DespachaApp
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={DESPACHA_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white whitespace-nowrap"
            style={{ color: '#b91c1c' }}
          >
            Abrir DespachaApp →
          </a>
          <button
            onClick={handleEntendi}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}
          >
            Entendi ✕
          </button>
        </div>
      </div>
      {titulos.length > 0 && (
        <div className="px-4 py-3">
          <ul className="space-y-1">
            {titulos.map((t, i) => (
              <li key={i} className="text-xs" style={{ color: '#374151' }}>• {t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
