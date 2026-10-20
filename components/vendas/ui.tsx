import Link from 'next/link'
import type { ReactNode } from 'react'

export const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm'
export const input = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30'
export const btn = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50'
export const btnAzul = { background: '#1B4F8A' }
export const btnVerde = { background: '#16a34a' }
export const btnLeve = 'inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'

export function Titulo({ children, sub, acao }: { children: ReactNode; sub?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#0d1b2e' }}>{children}</h1>
        {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {acao}
    </div>
  )
}

export function Kpi({ label, valor, nota }: { label: string; valor: ReactNode; nota?: string }) {
  return (
    <div className={`${card} p-4`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: '#0d1b2e' }}>{valor}</p>
      {nota && <p className="text-xs text-slate-500 mt-0.5">{nota}</p>}
    </div>
  )
}

export function Abas({ ativa }: { ativa: string }) {
  const abas = [
    ['/vendas', 'Funil'], ['/vendas/leads', 'Leads'], ['/vendas/agenda', 'Agenda'],
    ['/vendas/campanhas', 'Campanhas'], ['/vendas/estoque', 'Estoque à venda'], ['/vendas/tipos', 'Tipos e preços'],
  ]
  return (
    <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
      {abas.map(([href, nome]) => (
        <Link key={href} href={href}
          className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap"
          style={href === ativa ? { background: '#1B4F8A', color: '#fff' } : { background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}>
          {nome}
        </Link>
      ))}
    </div>
  )
}
