'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { OperacaoEvento } from '@/app/actions'
import { marcarPrestadorAcionado, marcarChegadaManutencao, liberarEquipamento } from '@/app/actions'

const hora = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

export function ProblemaTratativa({ evento, podeAcionar }: { evento: OperacaoEvento; podeAcionar: boolean }) {
  const [e, setE] = useState(evento)
  const [etapa, setEtapa] = useState<'acionar' | 'chegada' | 'liberar' | null>(null)
  const [prestadorInput, setPrestadorInput] = useState('Brasmaq')
  const [horimInput, setHorimInput] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function confirmarAcionar() {
    setErro(null)
    if (!prestadorInput.trim()) { setErro('Informe o prestador.'); return }
    startTransition(async () => {
      const res = await marcarPrestadorAcionado(e.id, prestadorInput)
      if (res.error) { setErro(res.error); return }
      setE(prev => ({ ...prev, prestador: prestadorInput.trim(), acionado_em: new Date().toISOString() }))
      setEtapa(null)
      router.refresh()
    })
  }

  function confirmarChegada() {
    setErro(null)
    const h = e.parado ? (e.horimetro ?? null) : (horimInput.trim() === '' ? null : parseFloat(horimInput.replace(',', '.')))
    if (h == null) { setErro('Informe o horímetro.'); return }
    startTransition(async () => {
      const res = await marcarChegadaManutencao(e.id, h)
      if (res.error) { setErro(res.error); return }
      setE(prev => ({ ...prev, chegada_em: new Date().toISOString(), chegada_horimetro: h }))
      setEtapa(null)
      router.refresh()
    })
  }

  function confirmarLiberar() {
    setErro(null)
    const h = horimInput.trim() === '' ? null : parseFloat(horimInput.replace(',', '.'))
    if (h == null) { setErro('Informe o horímetro.'); return }
    startTransition(async () => {
      const res = await liberarEquipamento(e.id, h)
      if (res.error) { setErro(res.error); return }
      setE(prev => ({ ...prev, liberado_em: new Date().toISOString(), liberado_horimetro: h, resolvido: true }))
      setEtapa(null)
      router.refresh()
    })
  }

  const btn = (bg: string) => ({ background: bg } as const)

  return (
    <div className="mt-1 w-full">
      {erro && <p className="text-xs px-2 py-1 rounded mb-1" style={{ background: '#fee2e2', color: '#b91c1c' }}>{erro}</p>}

      {e.liberado_em ? (
        <span className="text-xs font-semibold" style={{ color: '#047857' }}>
          ✅ Equipamento liberado em {hora(e.liberado_em)} · horímetro {e.liberado_horimetro}h
        </span>
      ) : e.chegada_em ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: '#1d4ed8' }}>
            🔧 Manutenção no local desde {hora(e.chegada_em)} · horímetro {e.chegada_horimetro}h
          </span>
          {etapa === 'liberar' ? (
            <span className="inline-flex items-center gap-1">
              <input value={horimInput} onChange={ev => setHorimInput(ev.target.value)} placeholder="Horímetro" inputMode="decimal" autoFocus
                className="rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: '#16a34a', color: '#1a2a3a', width: 110 }} />
              <button onClick={confirmarLiberar} disabled={isPending} className="text-xs font-semibold px-2 py-1 rounded text-white" style={btn('#16a34a')}>Confirmar</button>
              <button onClick={() => setEtapa(null)} className="text-xs" style={{ color: '#6b7280' }}>cancelar</button>
            </span>
          ) : (
            <button onClick={() => { setEtapa('liberar'); setHorimInput(''); setErro(null) }}
              className="text-xs font-semibold px-3 py-1 rounded-lg text-white" style={btn('#16a34a')}>
              Liberar equipamento
            </button>
          )}
        </div>
      ) : e.acionado_em ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: '#1d4ed8' }}>📨 {e.prestador} Acionada</span>
          {etapa === 'chegada' ? (
            e.parado ? (
              <span className="inline-flex items-center gap-1">
                <span className="text-xs" style={{ color: '#6b7280' }}>Confirmar chegada com horímetro {e.horimetro}h?</span>
                <button onClick={confirmarChegada} disabled={isPending} className="text-xs font-semibold px-2 py-1 rounded text-white" style={btn('#1d4ed8')}>Confirmar</button>
                <button onClick={() => setEtapa(null)} className="text-xs" style={{ color: '#6b7280' }}>cancelar</button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <input value={horimInput} onChange={ev => setHorimInput(ev.target.value)} placeholder="Horímetro atual" inputMode="decimal" autoFocus
                  className="rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: '#1d4ed8', color: '#1a2a3a', width: 110 }} />
                <button onClick={confirmarChegada} disabled={isPending} className="text-xs font-semibold px-2 py-1 rounded text-white" style={btn('#1d4ed8')}>Confirmar</button>
                <button onClick={() => setEtapa(null)} className="text-xs" style={{ color: '#6b7280' }}>cancelar</button>
              </span>
            )
          ) : (
            <button onClick={() => { setEtapa('chegada'); setHorimInput(''); setErro(null) }}
              className="text-xs font-semibold px-3 py-1 rounded-lg text-white" style={btn('#1d4ed8')}>
              Chegada da manutenção
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: '#92400e' }}>Aguardando interação do gestor</span>
          {podeAcionar && (
            etapa === 'acionar' ? (
              <span className="inline-flex items-center gap-1">
                <input value={prestadorInput} onChange={ev => setPrestadorInput(ev.target.value)} placeholder="Prestador (ex.: Brasmaq)" autoFocus
                  className="rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: '#92400e', color: '#1a2a3a', width: 140 }} />
                <button onClick={confirmarAcionar} disabled={isPending} className="text-xs font-semibold px-2 py-1 rounded text-white" style={btn('#92400e')}>Confirmar</button>
                <button onClick={() => setEtapa(null)} className="text-xs" style={{ color: '#6b7280' }}>cancelar</button>
              </span>
            ) : (
              <button onClick={() => { setEtapa('acionar'); setErro(null) }}
                className="text-xs font-semibold px-3 py-1 rounded-lg text-white" style={btn('#92400e')}>
                Marcar prestador acionado
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
