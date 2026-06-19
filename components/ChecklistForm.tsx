'use client'

import { useState, useTransition } from 'react'
import { addChecklist, type ChecklistItem } from '@/app/actions'

const ITENS = [
  'Nível de óleo do motor',
  'Nível de óleo hidráulico',
  'Nível de arrefecimento (água)',
  'Combustível / carga da bateria',
  'Vazamentos (óleo / hidráulico / combustível)',
  'Pneus (calibragem, desgaste, danos)',
  'Freios (serviço e estacionamento)',
  'Direção',
  'Buzina e alarme de ré',
  'Faróis, luzes e giroflex',
  'Espelhos retrovisores',
  'Cinto de segurança',
  'Garfos / spreader (travas e condição)',
  'Mastro, correntes e mangueiras hidráulicas',
  'Sistema de elevação / inclinação',
  'Extintor e limpeza da cabine',
]

type St = 'ok' | 'nok' | 'na'
const OPCOES: { v: St; label: string; on: string }[] = [
  { v: 'ok', label: 'OK', on: '#16a34a' },
  { v: 'nok', label: 'Não OK', on: '#dc2626' },
  { v: 'na', label: 'N/A', on: '#6b7280' },
]

export function ChecklistForm({ operadorPadrao = '', empilhadeiras = [] }: { operadorPadrao?: string; empilhadeiras?: string[] }) {
  const [operador, setOperador] = useState(operadorPadrao)
  const [equipamento, setEquipamento] = useState('')
  const [turno, setTurno] = useState('Manhã')
  const [horimetro, setHorimetro] = useState('')
  const [status, setStatus] = useState<Record<string, St>>(() => Object.fromEntries(ITENS.map(i => [i, 'ok'])))
  const [obs, setObs] = useState<Record<string, string>>({})
  const [observacoes, setObservacoes] = useState('')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; txt: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const pendencias = ITENS.filter(i => status[i] === 'nok').length

  function salvar() {
    if (!operador.trim() || !equipamento.trim()) {
      setMsg({ tipo: 'erro', txt: 'Preencha o operador e o equipamento.' })
      return
    }
    const itens: ChecklistItem[] = ITENS.map(item => ({ item, status: status[item], obs: obs[item]?.trim() || undefined }))
    startTransition(async () => {
      const res = await addChecklist({
        operador: operador.trim(),
        equipamento: equipamento.trim(),
        turno,
        horimetro: horimetro ? parseFloat(horimetro.replace(',', '.')) : null,
        itens,
        observacoes: observacoes.trim(),
      })
      if (res.error) setMsg({ tipo: 'erro', txt: 'Erro ao salvar: ' + res.error })
      else {
        setMsg({ tipo: 'ok', txt: '✓ Checklist registrado com sucesso!' })
        setStatus(Object.fromEntries(ITENS.map(i => [i, 'ok'])))
        setObs({})
        setObservacoes('')
        setHorimetro('')
      }
    })
  }

  const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none'
  const inputStyle = { borderColor: '#d1d5db', color: '#1a2a3a' } as const

  return (
    <div className="bg-white rounded-xl max-w-3xl" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {/* Cabeçalho */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
        <div>
          <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Operador *</label>
          <input className={inputCls} style={inputStyle} value={operador} onChange={e => setOperador(e.target.value)} placeholder="Nome do operador" />
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Equipamento *</label>
          {empilhadeiras.length ? (
            <select className={inputCls} style={inputStyle} value={equipamento} onChange={e => setEquipamento(e.target.value)}>
              <option value="">Selecione o equipamento…</option>
              {empilhadeiras.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          ) : (
            <input className={inputCls} style={inputStyle} value={equipamento} onChange={e => setEquipamento(e.target.value)} placeholder="Nº / placa da empilhadeira" />
          )}
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Turno</label>
          <select className={inputCls} style={inputStyle} value={turno} onChange={e => setTurno(e.target.value)}>
            <option>Manhã</option><option>Tarde</option><option>Noite</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Horímetro</label>
          <input className={inputCls} style={inputStyle} value={horimetro} onChange={e => setHorimetro(e.target.value)} placeholder="ex.: 12345" inputMode="decimal" />
        </div>
      </div>

      {/* Itens */}
      <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
        {ITENS.map(item => (
          <div key={item} className="px-4 py-3">
            <span className="text-sm font-medium block mb-2" style={{ color: '#1a2a3a' }}>{item}</span>
            <div className="grid grid-cols-3 gap-2">
              {OPCOES.map(op => {
                const active = status[item] === op.v
                return (
                  <button key={op.v} type="button" onClick={() => setStatus(p => ({ ...p, [item]: op.v }))}
                    className="py-3 rounded-lg text-sm font-semibold border transition-colors active:scale-95"
                    style={{
                      background: active ? op.on : '#fff',
                      color: active ? '#fff' : '#6b7280',
                      borderColor: active ? op.on : '#d1d5db',
                    }}>
                    {op.label}
                  </button>
                )
              })}
            </div>
            {status[item] === 'nok' && (
              <input className="mt-2 w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#fecaca', color: '#1a2a3a' }}
                value={obs[item] || ''} onChange={e => setObs(p => ({ ...p, [item]: e.target.value }))}
                placeholder="Descreva o problema" />
            )}
          </div>
        ))}
      </div>

      {/* Observações + salvar */}
      <div className="p-5" style={{ borderTop: '1px solid #f3f4f6' }}>
        <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Observações gerais</label>
        <textarea className={inputCls} style={inputStyle} rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />

        {msg && (
          <p className="text-sm mt-3 px-3 py-2 rounded"
            style={{ background: msg.tipo === 'ok' ? '#ecfdf5' : '#fef2f2', color: msg.tipo === 'ok' ? '#047857' : '#b91c1c' }}>
            {msg.txt}
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 gap-3">
          <span className="text-xs" style={{ color: pendencias ? '#b91c1c' : '#047857' }}>
            {pendencias ? `${pendencias} item(ns) marcado(s) como "Não OK"` : 'Nenhuma pendência marcada'}
          </span>
          <button onClick={salvar} disabled={isPending}
            className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-semibold text-white transition-colors active:scale-95 disabled:opacity-50"
            style={{ background: '#1B4F8A' }}>
            {isPending ? 'Salvando…' : 'Registrar checklist'}
          </button>
        </div>
      </div>
    </div>
  )
}
