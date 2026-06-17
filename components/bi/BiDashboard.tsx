'use client'

import { useState } from 'react'
import { IndicadorBar, TendenciaLinha, type Ponto } from './BiCharts'

export type Grupo = { code: string; titulo: string; data: Ponto[]; series: string[] }
export type Categoria = { key: string; label: string; grupos: Grupo[] }
export type KpiT = { label: string; value: string; sub?: string; accent?: boolean }

const cardStyle: React.CSSProperties = { background: '#0f2138', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }

function Kpi({ k }: { k: KpiT }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0' }}>{k.label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: k.accent ? '#7DC242' : '#e6eef7', lineHeight: 1.25 }}>{k.value}</div>
      {k.sub && <div style={{ fontSize: 11, color: '#5f7da0', marginTop: 2 }}>{k.sub}</div>}
    </div>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#cfe0f2', marginBottom: 10 }}>{titulo}</h3>
      {children}
    </div>
  )
}

export function BiDashboard({ ano, atualizado, kpis, trend, categorias }: {
  ano: number; atualizado: string; kpis: KpiT[]; trend: Ponto[]; categorias: Categoria[]
}) {
  const tabs = ['Visão Geral', ...categorias.map(c => c.label)]
  const [tab, setTab] = useState('Visão Geral')
  const cat = categorias.find(c => c.label === tab)

  return (
    <div style={{ background: '#0d1b2e', borderRadius: 18, padding: 24, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ color: '#e6eef7', fontSize: 22, fontWeight: 700 }}>BI Depot</h1>
          <p style={{ color: '#5f7da0', fontSize: 13 }}>Dados do e-Professional (websag) · ano {ano}</p>
        </div>
        <div style={{ color: '#5f7da0', fontSize: 12, textAlign: 'right' }}>
          atualizado em<br /><span style={{ color: '#8ca5c8' }}>{atualizado}</span>
        </div>
      </div>

      {/* KPIs (sempre visíveis) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 18 }}>
        {kpis.map(k => <Kpi key={k.label} k={k} />)}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 4 }}>
        {tabs.map(t => {
          const active = t === tab
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                whiteSpace: 'nowrap', padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all .15s',
                background: active ? '#7DC242' : 'rgba(255,255,255,0.04)',
                color: active ? '#0d1b2e' : '#8ca5c8',
                border: active ? '1px solid #7DC242' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {t}
            </button>
          )
        })}
      </div>

      {/* Conteúdo da aba */}
      {tab === 'Visão Geral' ? (
        <Card titulo="Entradas × Saídas por mês">
          {trend.length ? <TendenciaLinha data={trend} series={['Entradas', 'Saídas']} />
            : <p style={{ color: '#5f7da0', fontSize: 13 }}>Sem dados de movimentação.</p>}
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
          {cat?.grupos.map(g => (
            <Card key={g.code} titulo={g.titulo}>
              <IndicadorBar data={g.data} series={g.series} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
