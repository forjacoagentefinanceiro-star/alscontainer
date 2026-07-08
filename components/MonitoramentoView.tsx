'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { BarraStatus, BarragemPonto } from '@/app/actions'

const GRAFANA_URL = 'https://monitoramento.defesacivil.sc.gov.br/barragens'
const PRATICOS_URL = 'https://praticoszp21.com.br/'

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function statusBarra(profundidade: string): 'fechado' | 'restrito' | 'praticavel' | 'desconhecido' {
  const s = profundidade.toLowerCase()
  if (s.includes('fechad')) return 'fechado'
  if (s.includes('restri') || s.includes('condicion')) return 'restrito'
  if (s.includes('praticáv') || s.includes('praticav')) return 'praticavel'
  return 'desconhecido'
}

const COR_STATUS: Record<string, { bg: string; border: string; dot: string; label: string; text: string }> = {
  normal:      { bg: '#f0fdf4', border: '#86efac', dot: '#16a34a', label: 'Normal',      text: '#15803d' },
  atencao:     { bg: '#fefce8', border: '#fde68a', dot: '#d97706', label: 'Atenção',     text: '#92400e' },
  alerta:      { bg: '#fff7ed', border: '#fed7aa', dot: '#ea580c', label: 'Alerta',      text: '#c2410c' },
  emergencia:  { bg: '#fef2f2', border: '#fecaca', dot: '#dc2626', label: 'Crítica',     text: '#b91c1c' },
  praticavel:  { bg: '#f0fdf4', border: '#86efac', dot: '#16a34a', label: 'Praticável',  text: '#15803d' },
  restrito:    { bg: '#fefce8', border: '#fde68a', dot: '#d97706', label: 'Restrito',    text: '#92400e' },
  fechado:     { bg: '#fef2f2', border: '#fecaca', dot: '#dc2626', label: 'Fechado',     text: '#b91c1c' },
  desconhecido:{ bg: '#f9fafb', border: '#e5e7eb', dot: '#9ca3af', label: 'Sem dados',   text: '#6b7280' },
}

function cor(s: string | null) {
  return COR_STATUS[s ?? 'desconhecido'] ?? COR_STATUS.desconhecido
}

// ── sub-components ─────────────────────────────────────────────────────────────

function Dot({ status }: { status: string }) {
  const c = cor(status)
  return (
    <span className="inline-block rounded-full shrink-0"
      style={{ width: 12, height: 12, background: c.dot, boxShadow: `0 0 0 3px ${c.border}` }} />
  )
}

function StatusBadge({ status }: { status: string }) {
  const c = cor(status)
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest mb-3"
      style={{ color: '#9ca3af' }}>{children}</p>
  )
}

// ── Barra do Itajaí ────────────────────────────────────────────────────────────

function BarraCard({ barra }: { barra: BarraStatus | null }) {
  if (!barra) {
    return (
      <div className="rounded-xl p-4" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
        <p className="text-sm" style={{ color: '#9ca3af' }}>Barra do Itajaí — sem dados</p>
      </div>
    )
  }

  const status = statusBarra(barra.profundidade)
  const c = cor(status)
  // Separa "Praticável · Prof: 12.3m · Maré: 1.2m" em partes
  const partes = barra.profundidade.split('·').map(s => s.trim()).filter(Boolean)
  const condicao = partes[0] ?? barra.profundidade
  const detalhes = partes.slice(1)

  const mudouRecente = barra.changed_em
    ? (Date.now() - new Date(barra.changed_em).getTime()) < 2 * 3600 * 1000
    : false

  return (
    <div className="rounded-xl p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Dot status={status} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#1a2a3a' }}>Barra do Itajaí</p>
            <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
              <a href={PRATICOS_URL} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8' }}>praticoszp21.com.br</a>
            </p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-3">
        <p className="text-base font-bold" style={{ color: c.text }}>{condicao}</p>
        {detalhes.length > 0 && (
          <p className="text-xs mt-1" style={{ color: '#6b7280' }}>{detalhes.join(' · ')}</p>
        )}
      </div>

      {barra.anterior && (
        <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>
          Anterior: {barra.anterior.split('·')[0]?.trim()}
        </p>
      )}

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <p className="text-[10px]" style={{ color: '#9ca3af' }}>
          Atualizado: {fmtHora(barra.atualizado_em)}
        </p>
        {barra.changed_em && (
          <p className="text-[10px]" style={{ color: mudouRecente ? c.dot : '#9ca3af' }}>
            {mudouRecente ? '⚡ ' : ''}Mudou: {fmtHora(barra.changed_em)}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Rio Blumenau ───────────────────────────────────────────────────────────────

function RioCard({ ponto }: { ponto: BarragemPonto }) {
  const status = ponto.status ?? 'desconhecido'
  const c = cor(status)
  const nivel = ponto.nivel_m ? parseFloat(ponto.nivel_m.replace(',', '.')) : null

  // Cotas do Rio Itajaí em Blumenau
  const cotas = [
    { label: 'Atenção',     valor: 5.5,  cor: '#d97706' },
    { label: 'Alerta',      valor: 7.0,  cor: '#ea580c' },
    { label: 'Emergência',  valor: 9.0,  cor: '#dc2626' },
  ]
  const pctBarra = nivel ? Math.min(100, Math.round((nivel / 9.0) * 100)) : null

  return (
    <div className="rounded-xl p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Dot status={status} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#1a2a3a' }}>Rio Itajaí em Blumenau</p>
            {ponto.hora_leitura && (
              <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Leitura: {ponto.hora_leitura}</p>
            )}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span className="text-3xl font-black" style={{ color: c.text }}>
          {ponto.nivel_m ?? '—'}
        </span>
        <span className="text-base font-semibold mb-1" style={{ color: c.text }}>m</span>
        {ponto.anterior_nivel_m && ponto.anterior_nivel_m !== ponto.nivel_m && (
          <span className="text-xs mb-1.5" style={{ color: '#9ca3af' }}>
            (era {ponto.anterior_nivel_m} m)
          </span>
        )}
      </div>

      {/* Barra de cotas */}
      {pctBarra !== null && (
        <div className="mt-2">
          <div className="relative h-2 rounded-full" style={{ background: '#e5e7eb' }}>
            <div className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{ width: `${pctBarra}%`, background: c.dot }} />
            {/* marcadores de cota */}
            {cotas.map(cota => (
              <div key={cota.valor}
                className="absolute top-0 bottom-0 w-px"
                style={{ left: `${Math.round((cota.valor / 9.0) * 100)}%`, background: cota.cor }} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {cotas.map(cota => (
              <span key={cota.valor} className="text-[9px]" style={{ color: cota.cor }}>
                {cota.valor}m
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] mt-2" style={{ color: '#9ca3af' }}>
        Atualizado: {fmtHora(ponto.atualizado_em)}
        {ponto.changed_em && ponto.changed_em !== ponto.atualizado_em && (
          <> · Mudou: {fmtHora(ponto.changed_em)}</>
        )}
      </p>
    </div>
  )
}

// ── Barragem ───────────────────────────────────────────────────────────────────

function BarragemCard({ ponto }: { ponto: BarragemPonto }) {
  const status = ponto.status ?? 'desconhecido'
  const c = cor(status)
  const pct = ponto.capacidade_pct ? parseFloat(ponto.capacidade_pct.replace(',', '.')) : null
  const abertas = ponto.comportas_abertas ? parseInt(ponto.comportas_abertas) : 0
  const fechadas = ponto.comportas_fechadas ? parseInt(ponto.comportas_fechadas) : 0

  return (
    <div className="rounded-xl p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Dot status={status} />
          <p className="text-sm font-bold" style={{ color: '#1a2a3a' }}>{ponto.nome}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase" style={{ color: '#9ca3af' }}>Nível</p>
          <p className="text-base font-bold" style={{ color: c.text }}>{ponto.nivel_m ?? '—'} <span className="text-xs font-normal">m</span></p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase" style={{ color: '#9ca3af' }}>Capacidade</p>
          <p className="text-base font-bold" style={{ color: c.text }}>{ponto.capacidade_pct ?? '—'} <span className="text-xs font-normal">%</span></p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase" style={{ color: '#9ca3af' }}>Comportas</p>
          <p className="text-sm font-bold" style={{ color: abertas > 0 ? '#ea580c' : '#374151' }}>
            {abertas}A / {fechadas}F
          </p>
        </div>
      </div>

      {/* Barra de capacidade */}
      {pct !== null && (
        <div className="mt-2">
          <div className="h-1.5 rounded-full" style={{ background: '#e5e7eb' }}>
            <div className="h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, pct)}%`, background: c.dot }} />
          </div>
        </div>
      )}

      {ponto.hora_leitura && (
        <p className="text-[10px] mt-2" style={{ color: '#9ca3af' }}>Leitura: {fmtHora(ponto.hora_leitura)}</p>
      )}
    </div>
  )
}

// ── view principal ─────────────────────────────────────────────────────────────

export function MonitoramentoView({
  barra,
  barragens,
}: {
  barra: BarraStatus | null
  barragens: BarragemPonto[]
}) {
  const router = useRouter()

  // Auto-refresh a cada 5 minutos
  const refresh = useCallback(() => router.refresh(), [router])
  useEffect(() => {
    const id = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [refresh])

  const rio = barragens.find(p => p.tipo === 'rio')
  const barragensLista = barragens.filter(p => p.tipo === 'barragem')

  // Status geral: pior status entre todos os pontos
  const todosStatus = [
    statusBarra(barra?.profundidade ?? ''),
    ...(rio ? [rio.status ?? 'desconhecido'] : []),
    ...barragensLista.map(p => p.status ?? 'desconhecido'),
  ]
  const ordem = ['emergencia', 'alerta', 'atencao', 'normal', 'desconhecido']
  const piorStatus = ordem.find(s => todosStatus.includes(s)) ?? 'desconhecido'
  const cGeral = cor(piorStatus)

  const temAlerta = piorStatus === 'alerta' || piorStatus === 'emergencia'

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Banner de alerta ativo */}
      {temAlerta && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm"
          style={{ background: cGeral.bg, border: `2px solid ${cGeral.border}`, color: cGeral.text }}>
          <span style={{ fontSize: 20 }}>{piorStatus === 'emergencia' ? '🚨' : '⚠️'}</span>
          {piorStatus === 'emergencia' ? 'SITUAÇÃO DE EMERGÊNCIA ativa' : 'ALERTA ativo — monitorar de perto'}
        </div>
      )}

      {/* Barra do Itajaí */}
      <div>
        <SectionTitle>Barra do Rio Itajaí</SectionTitle>
        <BarraCard barra={barra} />
      </div>

      {/* Rio Blumenau */}
      {rio && (
        <div>
          <SectionTitle>Nível do Rio — Blumenau</SectionTitle>
          <RioCard ponto={rio} />
        </div>
      )}
      {!rio && barragens.length === 0 && (
        <div className="rounded-xl p-6 text-center" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
          <p className="text-sm" style={{ color: '#9ca3af' }}>
            Aguardando primeira execução do workflow de barragens.
          </p>
          <a href="https://github.com" target="_blank" rel="noreferrer"
            className="text-xs mt-1 block" style={{ color: '#1d4ed8' }}>
            GitHub Actions → Monitorar barragens e nível do rio
          </a>
        </div>
      )}

      {/* Barragens */}
      {barragensLista.length > 0 && (
        <div>
          <SectionTitle>Barragens</SectionTitle>
          <div className="space-y-3">
            {barragensLista.map(p => <BarragemCard key={p.id} ponto={p} />)}
          </div>
        </div>
      )}

      {/* Rodapé com fontes */}
      <div className="flex flex-wrap gap-3 pt-2">
        <a href={GRAFANA_URL} target="_blank" rel="noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
          Defesa Civil SC →
        </a>
        <a href={PRATICOS_URL} target="_blank" rel="noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
          Práticos Itajaí →
        </a>
        <span className="text-xs px-3 py-1.5 rounded-lg" style={{ background: '#f9fafb', color: '#9ca3af' }}>
          Refresh automático a cada 5 min
        </span>
      </div>
    </div>
  )
}
