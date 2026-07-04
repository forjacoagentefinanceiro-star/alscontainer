'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions'
import { Package2 } from 'lucide-react'
import type { BarraStatus } from '@/app/actions'

const pageTitles: Record<string, string> = {
  '/inventario': 'Inventário',
  '/gerador':    'Gerador ISO',
  '/importar':   'Importar',
  '/exportar':   'Exportar',
}

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—'
const dataHoraFmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'

const STORAGE_KEY = 'barra_last_seen_changed_em'

type StatusCor = { bg: string; border: string; label: string; icon: string; textColor: string; dot: string }

function classCor(status: string): StatusCor {
  const s = status.toLowerCase()
  if (s.includes('fechad'))
    return { bg: '#fef2f2', border: '#fca5a5', label: 'FECHADA', icon: '🔴', textColor: '#991b1b', dot: '#ef4444' }
  if (s.includes('restri'))
    return { bg: '#fffbeb', border: '#fde68a', label: 'PRATICÁVEL c/ restrições', icon: '🟡', textColor: '#92400e', dot: '#f59e0b' }
  if (s.includes('praticáv') || s.includes('praticav'))
    return { bg: '#f0fdf4', border: '#86efac', label: 'PRATICÁVEL', icon: '🟢', textColor: '#14532d', dot: '#22c55e' }
  if (s.includes('condicion'))
    return { bg: '#fff7ed', border: '#fdba74', label: 'CONDICIONADA', icon: '🟠', textColor: '#9a3412', dot: '#f97316' }
  return { bg: '#f8fafc', border: '#e5e7eb', label: status, icon: '⚓', textColor: '#1a2a3a', dot: '#6b7280' }
}

function BarraSemaforo({ barra }: { barra: BarraStatus }) {
  const [toast, setToast] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [tooltipAberto, setTooltipAberto] = useState(false)
  const seenRef = useRef<string | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!barra.changed_em || !barra.profundidade) return
    const lastSeen = localStorage.getItem(STORAGE_KEY)
    if (lastSeen !== barra.changed_em) {
      setToastMsg(barra.profundidade)
      setToast(true)
      seenRef.current = barra.changed_em
    }
  }, [barra.changed_em, barra.profundidade])

  function fecharToast() {
    setToast(false)
    if (seenRef.current) localStorage.setItem(STORAGE_KEY, seenRef.current)
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(fecharToast, 20000)
    return () => clearTimeout(t)
  }, [toast])

  // fecha tooltip ao clicar fora
  useEffect(() => {
    if (!tooltipAberto) return
    function handleClick(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setTooltipAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [tooltipAberto])

  const cor = classCor(barra.profundidade)
  const toastCor = toastMsg ? classCor(toastMsg) : cor
  const mudouRecente = barra.changed_em &&
    (Date.now() - new Date(barra.changed_em).getTime()) < 2 * 3600 * 1000

  return (
    <>
      {/* Semáforo com tooltip */}
      <div ref={tooltipRef} className="relative">
        <button
          onMouseEnter={() => setTooltipAberto(true)}
          onMouseLeave={() => setTooltipAberto(false)}
          onClick={() => setTooltipAberto(o => !o)}
          title="Condição da Barra de Itajaí"
          className="flex items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
          style={{
            width: 26, height: 26,
            background: cor.dot,
            border: '2px solid rgba(0,0,0,0.12)',
            boxShadow: mudouRecente ? `0 0 0 3px ${cor.dot}44` : undefined,
            animation: mudouRecente ? 'barraPulse 2s ease-in-out infinite' : undefined,
          }}
        >
          <span style={{ fontSize: 11, filter: 'brightness(0) invert(1)', opacity: 0.85 }}>⚓</span>
        </button>

        {tooltipAberto && (
          <div
            className="absolute z-50 rounded-xl shadow-2xl p-3"
            style={{
              right: 0, top: 'calc(100% + 8px)',
              width: 280,
              background: '#1a2a3a',
              border: `1.5px solid ${cor.dot}`,
            }}
            onMouseEnter={() => setTooltipAberto(true)}
            onMouseLeave={() => setTooltipAberto(false)}
          >
            <p className="text-xs font-bold mb-1" style={{ color: cor.dot }}>⚓ Barra de Itajaí</p>
            <p className="text-sm font-bold" style={{ color: '#e6eef7' }}>
              {cor.icon} {cor.label}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{barra.profundidade}</p>
            {mudouRecente && barra.anterior && (
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                Anterior: {barra.anterior}
              </p>
            )}
            <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-xs" style={{ color: '#64748b' }}>
                {mudouRecente && barra.changed_em
                  ? <>Mudou às {hora(barra.changed_em)}</>
                  : <>Atualizado: {hora(barra.atualizado_em)}</>
                }
              </span>
              <a
                href="https://praticoszp21.com.br/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline"
                style={{ color: '#7DC242' }}
              >
                ver site ↗
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Toast de mudança */}
      {toast && (
        <div
          className="fixed z-50 flex flex-col gap-1 shadow-2xl rounded-xl p-4"
          style={{
            top: 16, right: 16, minWidth: 300, maxWidth: 420,
            background: '#1a2a3a',
            border: `2px solid ${toastCor.dot}`,
            animation: 'slideInRight 0.3s ease',
          }}
        >
          <style>{`
            @keyframes slideInRight{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}
            @keyframes barraPulse{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 0 4px currentColor}}
          `}</style>
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-sm" style={{ color: toastCor.dot }}>
              🚢 Barra Itajaí — condição atualizada
            </span>
          </div>
          <p className="text-base font-bold mt-0.5" style={{ color: '#e6eef7' }}>
            {toastCor.icon} {toastMsg}
          </p>
          {barra.anterior && (
            <p className="text-xs" style={{ color: '#94a3b8' }}>Anterior: {barra.anterior}</p>
          )}
          <p className="text-xs" style={{ color: '#64748b' }}>
            Mudou em {dataHoraFmt(barra.changed_em)}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <a
              href="https://praticoszp21.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline"
              style={{ color: '#7DC242' }}
            >
              praticoszp21.com.br ↗
            </a>
            <button
              onClick={fecharToast}
              className="text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ background: toastCor.dot, color: '#fff' }}
            >
              ✓ Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export function TopBar({ email, barra }: { email: string; barra?: BarraStatus | null }) {
  const pathname = usePathname()
  const pageTitle = pageTitles[pathname] ?? 'ALS Depot'

  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 shrink-0"
      style={{
        height: 64,
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Mobile: logo + título da página */}
      <div className="flex items-center gap-3 md:hidden">
        <div className="rounded-lg overflow-hidden" style={{ background: '#1B4F8A', height: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ALS" style={{ height: 36, width: 'auto', display: 'block' }} />
        </div>
        <span className="text-sm font-bold" style={{ color: '#1a2a3a' }}>{pageTitle}</span>
      </div>

      {/* Desktop: ícone + nome do depot */}
      <div className="hidden md:flex items-center gap-2">
        <Package2 size={18} style={{ color: '#1B4F8A' }} />
        <span className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>
          Depot Itajaí, SC
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: '#f0f5ff', color: '#1B4F8A', border: '1px solid #dbeafe' }}>
          alslog.com.br
        </span>
      </div>

      {/* Direita: email + semáforo + botão sair */}
      <div className="flex items-center gap-3">
        <span className="text-xs hidden sm:block truncate max-w-40" style={{ color: '#9ca3af' }}>{email}</span>
        {barra?.profundidade && <BarraSemaforo barra={barra} />}
        <form action={logout}>
          <button
            type="submit"
            className="text-xs font-semibold rounded px-3 py-1.5 transition-opacity hover:opacity-80"
            style={{ background: '#1B4F8A', color: '#fff' }}
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  )
}
