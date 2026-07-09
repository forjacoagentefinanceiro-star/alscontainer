'use client'

import {
  ResponsiveContainer,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList,
} from 'recharts'

const compactNf = new Intl.NumberFormat('pt-BR', { notation: 'compact' })

// Paleta no padrão "sala de controle" (verde ALS + azuis) — única paleta de gráficos do app, não criar outra.
export const PALETTE = ['#7DC242', '#A8D96B', '#4FA3D1', '#2E7DB0', '#1B4F8A', '#5FBFA0', '#C5E89A', '#3AA0C0', '#6FA8DC', '#B6D7A8']

// Cores fixas por armador (demais usam a paleta padrão)
const ARMADOR_CORES: Record<string, string> = {
  HPL: '#EC6608', HAPAG: '#EC6608',          // laranja
  EVER: '#1FA24A', EVERGREEN: '#1FA24A',     // verde
  LOG: '#1B6FB5', LOGIN: '#1B6FB5',          // azul (Log-In aparece como "LOG")
  ONE: '#AD1457',                            // magenta
  VLC: '#F2C200',                            // amarelo
  LIVRE: '#5f7da0',                          // cinza (espaço livre, não é armador)
}

/** Cor de uma série: usa a cor do armador se reconhecida, senão a paleta. */
function corSerie(nome: string, i: number): string {
  const key = String(nome).toUpperCase().replace(/[^A-Z]/g, '')
  for (const k of Object.keys(ARMADOR_CORES)) {
    if (key === k || key.startsWith(k)) return ARMADOR_CORES[k]
  }
  return PALETTE[i % PALETTE.length]
}

const axisStyle = { fontSize: 11, fill: '#8ca5c8' }
const tooltipStyle = {
  background: '#0d1b2e',
  border: '1px solid rgba(125,194,66,0.3)',
  borderRadius: 8,
  color: '#e6eef7',
  fontSize: 12,
}

export type Serie = string
export type Ponto = { eixo: string } & Record<string, number | string>

/** Formata rótulos de classe de tempo: até 60 → minutos; acima → horas. */
function fmtTempo(s: unknown): string {
  const t = String(s)
  const min = t.match(/(\d+)\s*MIN/i)
  if (min) {
    const n = parseInt(min[1], 10)
    if (n > 60) { const h = n / 60; return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1)} h` }
    return `${n} min`
  }
  if (/maior que\s*\d+\s*hora/i.test(t)) { const m = t.match(/(\d+)/); return `> ${m ? m[1] : ''} h` }
  const hr = t.match(/(\d+)\s*HORA/i)
  if (hr) return `${hr[1]} h`
  return t
}

// shape customizado para Bar: usa style={{ fill }} em vez de atributo SVG
// (atributos SVG têm especificidade menor que CSS — o preflight do Tailwind v4 os sobrescreve)
function makeBarShape(color: string, rounded: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function BarShape(props: any) {
    const { x, y, width, height } = props as { x: number; y: number; width: number; height: number }
    if (!width || height <= 0) return null
    const h = Math.max(0, height)
    const r = rounded ? Math.min(3, h / 2, width / 2) : 0
    return <rect x={x} y={y} width={width} height={h} rx={r} ry={r} style={{ fill: color }} />
  }
}

/** Barras empilhadas: uma barra por série, ao longo do eixo (meses). */
export function IndicadorBar({ data, series }: { data: Ponto[]; series: Serie[] }) {
  const dataT = data.map(p => ({ ...p, __total: series.reduce((s, k) => s + (Number(p[k]) || 0), 0) }))
  return (
    <ResponsiveContainer width="100%" height={258}>
      <BarChart data={dataT} margin={{ top: 22, right: 12, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="eixo" tick={axisStyle} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          tickFormatter={(s: string) => { const t = String(s); return t.length > 4 ? t.slice(0, 3) : t; }} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => compactNf.format(v)} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(value, name) => [value as number, fmtTempo(name)]} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: '#8ca5c8', paddingTop: 6 }} formatter={(value) => fmtTempo(value)} />}
        {series.map((s, i) => {
          const color = corSerie(s, i)
          const isTop = i === series.length - 1
          return (
            <Bar key={s} dataKey={s} stackId="a" fill={color} isAnimationActive={false} shape={makeBarShape(color, isTop)}>
              {isTop && (
                <LabelList dataKey="__total" position="top" formatter={(v) => compactNf.format(Number(v) || 0)} style={{ fill: '#cfe0f2', fontSize: 11, fontWeight: 600 }} />
              )}
            </Bar>
          )
        })}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Linha de tendência (ex.: entradas × saídas por mês). */
export function TendenciaLinha({ data, series }: { data: Ponto[]; series: Serie[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={`grad-${i}`} id={`trend-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.25} />
              <stop offset="95%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="eixo" tick={axisStyle} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v)} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#8ca5c8' }} />
        {series.map((s, i) => (
          <Area
            key={s}
            type="monotone"
            dataKey={s}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2.5}
            fill={`url(#trend-grad-${i})`}
            dot={{ r: 3, fill: PALETTE[i % PALETTE.length], strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
