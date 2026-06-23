'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts'
import type { IndicadorMaquina } from '@/app/actions'
import { PALETTE } from '@/components/bi/BiCharts'

// mesma paleta "sala de controle" do BI — não usar outras cores nos gráficos
const COR_HORAS = PALETTE[4]   // #1B4F8A
const COR_CONSUMO = PALETTE[2] // #4FA3D1
const COR_PARADO = PALETTE[0]  // #7DC242

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e7eb' }}>
      <p className="text-sm font-bold mb-2" style={{ color: '#1a2a3a' }}>{title}</p>
      {children}
    </div>
  )
}

const tickStyle = { fontSize: 11, fill: '#6b7280' }

export function IndicadoresCharts({ maquinas }: { maquinas: IndicadorMaquina[] }) {
  if (!maquinas.length) return null
  const horas = maquinas.map(m => ({ nome: m.equipamento, valor: m.horasTrabalhadas }))
  const consumo = maquinas.filter(m => m.consumoMedio != null).map(m => ({ nome: m.equipamento, valor: m.consumoMedio as number }))
  const parado = maquinas.filter(m => m.tempoParadoMin > 0).map(m => ({ nome: m.equipamento, valor: Math.round((m.tempoParadoMin / 60) * 10) / 10 }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-full mb-6">
      <ChartCard title="Horas trabalhadas por equipamento">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={horas} margin={{ top: 18, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
            <XAxis dataKey="nome" tick={tickStyle} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={tickStyle} />
            <Tooltip formatter={(v) => [`${v}h`, 'Horas']} />
            <Bar dataKey="valor" fill={COR_HORAS} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="valor" position="top" style={{ fontSize: 11, fill: COR_HORAS, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Consumo médio (L/h) por equipamento">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={consumo} margin={{ top: 18, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
            <XAxis dataKey="nome" tick={tickStyle} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={tickStyle} />
            <Tooltip formatter={(v) => [`${v} L/h`, 'Consumo']} />
            <Bar dataKey="valor" fill={COR_CONSUMO} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="valor" position="top" style={{ fontSize: 11, fill: COR_CONSUMO, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tempo parado (h) por equipamento">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={parado} margin={{ top: 18, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
            <XAxis dataKey="nome" tick={tickStyle} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={tickStyle} />
            <Tooltip formatter={(v) => [`${v}h`, 'Parado']} />
            <Bar dataKey="valor" fill={COR_PARADO} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="valor" position="top" style={{ fontSize: 11, fill: COR_PARADO, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
