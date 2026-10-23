'use client'

import { useState } from 'react'

// Planta técnica comparativa (vista lateral, mesma escala): o 20 pés (azul) e o 40 Dry (verde) ficam
// dentro do contorno do 40 HC (laranja). Medidas externas padrão, em metros.
const PX = 56            // pixels por metro
const X0 = 70, BASE = 250
const TIPOS = [
  { id: 'hc', nome: '40 pés HC', sub: 'High Cube', cor: '#ff9f1a', c: 12.192, l: 2.438, a: 2.896 },
  { id: 'dry', nome: '40 pés Dry', sub: 'altura padrão', cor: '#2dd4bf', c: 12.192, l: 2.438, a: 2.591 },
  { id: 'v20', nome: '20 pés', sub: 'altura padrão', cor: '#4da3ff', c: 6.058, l: 2.438, a: 2.591 },
] as const

const fmt = (n: number) => n.toFixed(2).replace('.', ',')

export default function Planta() {
  const [on, setOn] = useState<Record<string, boolean>>({ hc: true, dry: true, v20: true })
  const alternar = (id: string) => setOn(s => ({ ...s, [id]: !s[id] }))
  const t = (id: string) => TIPOS.find(x => x.id === id)!
  const dim = (id: string) => { const x = t(id); return { w: x.c * PX, h: x.a * PX, y: BASE - x.a * PX } }

  return (
    <div>
      <svg viewBox="0 0 960 350" className="w-full" role="img" aria-label="Planta comparativa dos containers de 20 pés, 40 pés Dry e 40 pés HC, na mesma escala, com as medidas">
        <defs>
          <pattern id="malha" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="rgba(255,255,255,.05)" /></pattern>
        </defs>
        <rect width="960" height="350" fill="url(#malha)" />
        <line x1="40" x2="880" y1={BASE} y2={BASE} stroke="rgba(255,255,255,.25)" strokeWidth="1.5" />

        {/* contornos sobrepostos: do maior para o menor */}
        {TIPOS.map(x => {
          const d = dim(x.id)
          return (
            <g key={x.id} style={{ opacity: on[x.id] ? 1 : 0.07, transition: 'opacity .4s' }}>
              <rect x={X0} y={d.y} width={d.w} height={d.h} rx="3" fill={x.cor} fillOpacity={x.id === 'hc' ? 0.06 : 0.09} />
              <rect className="traco" x={X0} y={d.y} width={d.w} height={d.h} rx="3" fill="none" stroke={x.cor} strokeWidth={x.id === 'v20' ? 3 : 2.4} strokeLinejoin="round" />
            </g>
          )
        })}

        {/* nomes dentro dos desenhos */}
        <g className="cota" fontFamily="var(--font-titulo), sans-serif" fontStyle="italic" fontWeight="800" textAnchor="middle" letterSpacing="2">
          <text x={X0 + t('hc').c * PX * 0.72} y={BASE - 125} fontSize="30" fill={t('hc').cor} opacity={on.hc ? 1 : 0.1}>40 HC</text>
          <text x={X0 + t('hc').c * PX * 0.72} y={BASE - 78} fontSize="30" fill={t('dry').cor} opacity={on.dry ? 1 : 0.1}>40 DRY</text>
          <text x={X0 + t('v20').c * PX * 0.5} y={BASE - 78} fontSize="30" fill={t('v20').cor} opacity={on.v20 ? 1 : 0.1}>20 PÉS</text>
        </g>

        {/* cotas de comprimento (abaixo) */}
        <g className="cota" fontFamily="var(--font-titulo), sans-serif" fontWeight="700" fontSize="17" textAnchor="middle" letterSpacing="1.5">
          <g stroke="#4da3ff" strokeWidth="1.4" fill="none" opacity={on.v20 ? 1 : 0.12}>
            <path d={`M${X0} 282H${X0 + t('v20').c * PX}M${X0} 274v16M${X0 + t('v20').c * PX} 274v16`} />
          </g>
          <text x={X0 + t('v20').c * PX / 2} y="274" fill="#4da3ff" opacity={on.v20 ? 1 : 0.12}>20 PÉS · {fmt(t('v20').c)} m</text>
          <g stroke="#ff9f1a" strokeWidth="1.4" fill="none" opacity={on.hc || on.dry ? 1 : 0.12}>
            <path d={`M${X0} 320H${X0 + t('hc').c * PX}M${X0} 312v16M${X0 + t('hc').c * PX} 312v16`} />
          </g>
          <text x={X0 + t('hc').c * PX / 2} y="312" fill="#fff" opacity={on.hc || on.dry ? 1 : 0.12}>40 PÉS (HC E DRY) · {fmt(t('hc').c)} m</text>
        </g>

        {/* cotas de altura (à direita) */}
        <g className="cota" fontFamily="var(--font-titulo), sans-serif" fontWeight="700" fontSize="16" textAnchor="middle" letterSpacing="1.5">
          <g stroke="#2dd4bf" strokeWidth="1.4" fill="none" opacity={on.dry || on.v20 ? 1 : 0.12}>
            <path d={`M${X0 + t('hc').c * PX + 38} ${dim('dry').y}V${BASE}M${X0 + t('hc').c * PX + 30} ${dim('dry').y}h16M${X0 + t('hc').c * PX + 30} ${BASE}h16`} />
          </g>
          <text transform={`translate(${X0 + t('hc').c * PX + 30} ${(dim('dry').y + BASE) / 2 + 8}) rotate(90)`} fill="#2dd4bf" opacity={on.dry || on.v20 ? 1 : 0.12}>{fmt(t('dry').a)} m</text>
          <g stroke="#ff9f1a" strokeWidth="1.4" fill="none" opacity={on.hc ? 1 : 0.12}>
            <path d={`M${X0 + t('hc').c * PX + 82} ${dim('hc').y}V${BASE}M${X0 + t('hc').c * PX + 74} ${dim('hc').y}h16M${X0 + t('hc').c * PX + 74} ${BASE}h16`} />
          </g>
          <text transform={`translate(${X0 + t('hc').c * PX + 74} ${(dim('hc').y + BASE) / 2 + 8}) rotate(90)`} fill="#ff9f1a" opacity={on.hc ? 1 : 0.12}>{fmt(t('hc').a)} m · HC</text>
        </g>
      </svg>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {TIPOS.map(x => (
          <button key={x.id} type="button" onClick={() => alternar(x.id)} aria-pressed={on[x.id]}
            className="cartao flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5"
            style={{ borderColor: on[x.id] ? x.cor : undefined, background: on[x.id] ? `${x.cor}14` : undefined, opacity: on[x.id] ? 1 : 0.55 }}>
            <span className="h-10 w-3 shrink-0 rounded" style={{ background: x.cor }} />
            <span>
              <span className="display block text-2xl" style={{ color: x.cor }}>{x.nome}</span>
              <span className="block text-sm text-white/65">{fmt(x.c)} × {fmt(x.l)} × {fmt(x.a)} m</span>
              <span className="block text-xs text-white/40">{x.sub} · toque para {on[x.id] ? 'ocultar' : 'mostrar'}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-white/40">Desenhos na mesma escala, vista lateral. Medidas externas padrão (comprimento × largura × altura); podem variar de acordo com a unidade.</p>
    </div>
  )
}
