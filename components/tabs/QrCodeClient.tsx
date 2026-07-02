'use client'

import { useState, useEffect, useRef } from 'react'

function qrUrl(data: string, size = 300) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=10&format=png`
}

type PortalInfo = {
  invite_code: string
  portal_url: string
  company_name: string
}

export function QrCodeClient() {
  const [info,    setInfo]    = useState<PortalInfo | null>(null)
  const [erro,    setErro]    = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [local,   setLocal]   = useState('')   // label personalizado para impressão
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/despacha?path=/portal')
      .then(r => r.json())
      .then(b => {
        if (b.success) setInfo(b.data)
        else setErro(b.error ?? 'Erro ao carregar portal')
      })
      .catch(() => setErro('Falha de rede'))
      .finally(() => setLoading(false))
  }, [])

  function compartilharWhatsApp() {
    if (!info) return
    const texto = `📋 *Abra um chamado de manutenção*\n\nEscaneie o QR Code ou acesse o link abaixo para registrar uma solicitação de serviço:\n\n${info.portal_url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  async function baixarQrCode() {
    if (!info) return
    try {
      const res  = await fetch(qrUrl(portalUrl, 600))
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'qrcode-solicitar-servico.png'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      window.open(qrUrl(portalUrl, 600), '_blank')
    }
  }

  function imprimir() {
    window.print()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm" style={{ color: '#9ca3af' }}>Carregando…</div>
    </div>
  )

  if (erro || !info) return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>{erro ?? 'Erro desconhecido'}</p>
    </div>
  )

  const portalUrl = info.portal_url

  return (
    <>
      {/* ── Tela normal (não impressão) ───────────────────────────────── */}
      <div className="no-print">
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>QR Code — Solicitar Serviço</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
            Funcionários escaneiam o código para abrir chamados de manutenção
          </p>
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'start' }}>
          {/* QR Code preview */}
          <div className="rounded-2xl p-6 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl(portalUrl, 240)} alt="QR Code" width={240} height={240}
              style={{ display: 'block', margin: '0 auto', borderRadius: 8 }} />
            <p className="text-xs mt-3 font-semibold" style={{ color: '#6b7280' }}>
              {info.company_name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af', wordBreak: 'break-all', maxWidth: 240 }}>
              {portalUrl}
            </p>
          </div>

          {/* Ações */}
          <div className="space-y-3">
            {/* Copiar link */}
            <div className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9ca3af' }}>Link do portal</p>
              <div className="flex items-center gap-2">
                <input readOnly value={portalUrl}
                  className="flex-1 text-xs px-3 py-2 rounded-lg"
                  style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#374151' }} />
                <button
                  onClick={() => { navigator.clipboard.writeText(portalUrl) }}
                  className="text-xs px-3 py-2 rounded-lg font-semibold"
                  style={{ background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer' }}>
                  Copiar
                </button>
              </div>
            </div>

            {/* Baixar QR Code */}
            <button onClick={baixarQrCode}
              className="w-full rounded-xl p-4 flex items-center gap-3 text-left font-semibold"
              style={{ background: '#dcfce7', border: '1.5px solid #86efac', color: '#15803d', cursor: 'pointer' }}>
              <span style={{ fontSize: '1.5rem' }}>⬇️</span>
              <div>
                <div className="text-sm font-bold">Baixar imagem do QR Code</div>
                <div className="text-xs font-normal" style={{ color: '#16a34a' }}>Salva o PNG para enviar no WhatsApp ou imprimir</div>
              </div>
            </button>

            {/* WhatsApp — envia só o link */}
            <button onClick={compartilharWhatsApp}
              className="w-full rounded-xl p-4 flex items-center gap-3 text-left font-semibold"
              style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', color: '#15803d', cursor: 'pointer' }}>
              <span style={{ fontSize: '1.5rem' }}>📲</span>
              <div>
                <div className="text-sm font-bold">Compartilhar link via WhatsApp</div>
                <div className="text-xs font-normal" style={{ color: '#16a34a' }}>
                  Envia o link do portal — anexe o QR Code baixado acima separadamente
                </div>
              </div>
            </button>

            {/* Label para impressão */}
            <div className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9ca3af' }}>
                Local / Identificação (opcional — aparece nas placas impressas)
              </p>
              <input
                value={local}
                onChange={e => setLocal(e.target.value)}
                placeholder="Ex: Galpão A, Oficina, Portaria…"
                className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                style={{ border: '1.5px solid #e5e7eb', color: '#1a2a3a' }}
              />
            </div>

            {/* Imprimir */}
            <button onClick={imprimir}
              className="w-full rounded-xl p-4 flex items-center gap-3 text-left font-semibold"
              style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', color: '#1d4ed8', cursor: 'pointer' }}>
              <span style={{ fontSize: '1.5rem' }}>🖨️</span>
              <div>
                <div className="text-sm font-bold">Imprimir 4 placas por folha A4</div>
                <div className="text-xs font-normal" style={{ color: '#2563eb' }}>Layout otimizado para cortar e colar nas dependências</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── Layout de impressão — 4 placas por folha A4 ───────────────── */}
      <div ref={printRef} className="print-only">
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 10mm; }
            body * { visibility: hidden !important; }
            .print-only,
            .print-only * { visibility: visible !important; }
            .print-only {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              height: auto !important;
              display: block !important;
              padding: 10mm !important;
              box-sizing: border-box !important;
              background: white !important;
            }
          }
          .print-only { display: none; }
        `}</style>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8mm',
          width: '100%',
        }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              border: '2px solid #1B4F8A',
              borderRadius: 12,
              padding: '8mm',
              textAlign: 'center',
              pageBreakInside: 'avoid',
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}>
              {/* Header */}
              <div style={{
                background: '#1B4F8A',
                color: '#fff',
                borderRadius: 8,
                padding: '6px 12px',
                width: '100%',
                boxSizing: 'border-box',
              }}>
                <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '.02em' }}>
                  🛠️ SOLICITAR SERVIÇO
                </div>
                <div style={{ fontSize: 10, opacity: .85, marginTop: 2 }}>
                  {info.company_name}
                </div>
              </div>

              {/* QR */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl(portalUrl, 200)}
                alt="QR Code"
                style={{ width: 160, height: 160, display: 'block' }}
              />

              {/* Instrução */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2a3a' }}>
                Aponte a câmera para abrir um chamado
              </div>
              <div style={{ fontSize: 9, color: '#6b7280', wordBreak: 'break-all', maxWidth: 180 }}>
                {portalUrl}
              </div>

              {/* Local / identificação */}
              {local && (
                <div style={{
                  marginTop: 4,
                  background: '#f3f4f6',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#374151',
                  width: '100%',
                  boxSizing: 'border-box',
                }}>
                  📍 {local}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
