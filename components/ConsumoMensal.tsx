'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import type { ConsumoMensal } from '@/app/actions'
import { PALETTE } from '@/components/bi/BiCharts'

const tickStyle = { fontSize: 11, fill: '#6b7280' }

export function ConsumoMensalChart({ dados }: { dados: ConsumoMensal }) {
  if (!dados.equipamentos.length) return null
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={dados.pontos} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
        <XAxis dataKey="mes" tick={tickStyle} />
        <YAxis tick={tickStyle} unit=" L/h" width={60} />
        <Tooltip formatter={(v, name) => [v != null ? `${v} L/h` : '—', name]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {dados.equipamentos.map((eq, i) => (
          <Line key={eq} type="monotone" dataKey={eq} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function ConsumoMensalTabela({ dados }: { dados: ConsumoMensal }) {
  if (!dados.equipamentos.length) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ color: '#374151' }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Equipamento</th>
            {dados.meses.map(m => <th key={m} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {dados.equipamentos.map(eq => (
            <tr key={eq} className="border-t" style={{ borderColor: '#f3f4f6' }}>
              <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: '#1a2a3a' }}>{eq}</td>
              {dados.pontos.map((p, i) => {
                const v = p[eq] as number | null
                return <td key={i} className="px-3 py-2 whitespace-nowrap">{v != null ? `${v} L/h` : '—'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
