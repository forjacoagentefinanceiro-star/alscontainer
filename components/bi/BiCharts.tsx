'use client'

import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'

// Paleta no padrão "sala de controle" (verde ALS + azuis)
const PALETTE = ['#7DC242', '#A8D96B', '#4FA3D1', '#2E7DB0', '#1B4F8A', '#5FBFA0', '#C5E89A', '#3AA0C0', '#6FA8DC', '#B6D7A8']

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

/** Barras empilhadas: uma barra por série, ao longo do eixo (meses). */
export function IndicadorBar({ data, series }: { data: Ponto[]; series: Serie[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="eixo" tick={axisStyle} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          tickFormatter={(s: string) => String(s).slice(0, 3)} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={46} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: '#8ca5c8' }} />}
        {series.map((s, i) => (
          <Bar key={s} dataKey={s} stackId="a" fill={corSerie(s, i)} radius={i === series.length - 1 ? [3, 3, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Linha de tendência (ex.: entradas × saídas por mês). */
export function TendenciaLinha({ data, series }: { data: Ponto[]; series: Serie[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="eixo" tick={axisStyle} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={46} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#8ca5c8' }} />
        {series.map((s, i) => (
          <Line key={s} type="monotone" dataKey={s} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5} dot={{ r: 3 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
