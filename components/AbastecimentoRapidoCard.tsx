'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addAbastecimentoParaMaquina } from '@/app/actions'
import { HorimetroInput } from '@/components/HorimetroInput'

type Props = {
  equipamento: string
  horasDesdeAbastecimento: number | null
  ultimoAbastHorimetro: number | null
  horimetroAtual: number | null
  consumoMedio: number | null
  gestor: boolean
}

export function AbastecimentoRapidoCard({ equipamento, horasDesdeAbastecimento, ultimoAbastHorimetro, horimetroAtual, consumoMedio, gestor }: Props) {
  const h = horasDesdeAbastecimento
  const litrosEst = (h != null && consumoMedio != null) ? Math.round(h * consumoMedio) : null
  const cor = h == null ? '#9ca3af' : h >= 20 ? '#b91c1c' : h >= 12 ? '#d97706' : '#047857'

  const [aberto, setAberto] = useState(false)
  const [horim, setHorim] = useState<number | null>(null)
  const [litrosStr, setLitrosStr] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function confirmar() {
    const litros = parseFloat(litrosStr.replace(',', '.'))
    if (!horim || horim <= 0) { setErro('Informe o horímetro.'); return }
    if (!litros || litros <= 0) { setErro('Informe os litros.'); return }
    setErro(null)
    startTransition(async () => {
      const res = await addAbastecimentoParaMaquina(equipamento, horim, litros)
      if (res.error) { setErro(res.error); return }
      setAberto(false); setHorim(null); setLitrosStr('')
      router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e7eb', borderLeft: `4px solid ${cor}` }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b7280' }}>{equipamento}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: cor }}>{h != null ? `${h}h` : '—'}</p>
      <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
        {litrosEst != null ? `≈ ${litrosEst}L consumidos est.` : 'desde o último abastecimento'}
      </p>
      <div className="mt-1.5 flex flex-col gap-0.5">
        <p className="text-[11px]" style={{ color: '#6b7280' }}>
          ⛽ abast: <span className="font-semibold">{ultimoAbastHorimetro != null ? `${ultimoAbastHorimetro}h` : '—'}</span>
        </p>
        <p className="text-[11px]" style={{ color: '#6b7280' }}>
          📍 atual: <span className="font-semibold">{horimetroAtual != null ? `${horimetroAtual}h` : '—'}</span>
        </p>
      </div>

      {gestor && (
        <div className="mt-2">
          {aberto ? (
            <div className="rounded-lg px-2 py-2 flex flex-col gap-1.5" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <span className="text-[11px] font-semibold" style={{ color: '#9a3412' }}>⛽ Abastecimento retroativo</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <HorimetroInput value={horim} onChange={setHorim} placeholder="Horímetro" autoFocus
                  className="rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: '#c2410c', color: '#1a2a3a', width: 92 }} />
                <div className="flex items-center gap-1">
                  <input type="number" min="1" step="0.1" value={litrosStr} onChange={e => setLitrosStr(e.target.value)}
                    placeholder="Litros" className="rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: '#c2410c', color: '#1a2a3a', width: 72 }} />
                  <span className="text-[11px]" style={{ color: '#9a3412' }}>L</span>
                </div>
              </div>
              {erro && <p className="text-[11px]" style={{ color: '#b91c1c' }}>{erro}</p>}
              <div className="flex gap-1.5">
                <button onClick={confirmar} disabled={isPending}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white disabled:opacity-50" style={{ background: '#c2410c' }}>
                  Confirmar
                </button>
                <button onClick={() => { setAberto(false); setErro(null) }} className="text-xs" style={{ color: '#6b7280' }}>cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setAberto(true); setErro(null) }}
              className="text-[11px] px-2 py-1 rounded border" style={{ color: '#c2410c', borderColor: '#fed7aa', background: '#fff7ed' }}>
              ⛽ Registrar abastecimento
            </button>
          )}
        </div>
      )}
    </div>
  )
}
