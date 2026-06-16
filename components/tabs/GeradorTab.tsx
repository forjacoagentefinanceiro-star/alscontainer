'use client'

import { useState, useTransition } from 'react'
import { checkDigit, makeContainerNumber } from '@/lib/iso6346'
import { saveSession, clearAllHistory } from '@/app/actions'

type Session = {
  id: string
  owner: string
  cat: string
  qty: number
  new_count: number
  dup_count: number
  nums: { ser: string; cd: number; full: string; dup: boolean }[]
  created_at: string
}

export function GeradorTab({ initialSessions, initialUsedKeys }: {
  initialSessions: Session[]
  initialUsedKeys: string[]
}) {
  const [owner, setOwner] = useState('ALS')
  const [cat, setCat] = useState('U')
  const [qty, setQty] = useState(1)
  const [result, setResult] = useState<{ ser: string; cd: number; full: string; dup: boolean }[]>([])
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [usedKeys, setUsedKeys] = useState<Set<string>>(new Set(initialUsedKeys))
  const [isPending, startTransition] = useTransition()

  const ownerUpper = owner.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A')

  function generate() {
    const nums: typeof result = []
    let serial = 1
    let newCount = 0, dupCount = 0
    while (newCount < qty && serial <= 999999 && typeof qty === 'number') {
      const ser = String(serial).padStart(6, '0')
      const key = `${ownerUpper}${cat} ${ser}`
      const cd = checkDigit(ownerUpper, cat, ser)
      const full = makeContainerNumber(ownerUpper, cat, serial)
      const dup = usedKeys.has(key)
      nums.push({ ser, cd, full, dup })
      if (dup) dupCount++
      else newCount++
      serial++
    }
    setResult(nums)
    const newKeys = new Set(usedKeys)
    nums.filter(n => !n.dup).forEach(n => newKeys.add(`${ownerUpper}${cat} ${n.ser}`))
    setUsedKeys(newKeys)
    startTransition(async () => {
      const session = await saveSession({ owner: ownerUpper, cat, qty, new_count: newCount, dup_count: dupCount, nums })
      setSessions(prev => [{ ...session, nums } as Session, ...prev])
    })
  }

  function handleClear() {
    if (!confirm('Limpar todo o histórico de numerações?')) return
    startTransition(async () => {
      await clearAllHistory()
      setSessions([]); setUsedKeys(new Set()); setResult([])
    })
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Form */}
      <div className="bg-white rounded-lg p-6" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 className="font-bold text-base mb-4" style={{ color: '#1a2a3a' }}>Gerar Numeração ISO 6346</h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#6b7280' }}>Dono (3 letras)</label>
            <input maxLength={3} value={owner}
              onChange={e => setOwner(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              className="w-full rounded border px-3 py-2 text-sm font-mono uppercase outline-none focus:border-blue-500"
              style={{ borderColor: '#d1d5db', color: '#374151' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#6b7280' }}>Categoria</label>
            <select value={cat} onChange={e => setCat(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-500"
              style={{ borderColor: '#d1d5db', color: '#374151' }}>
              <option value="U">U — Carga</option>
              <option value="J">J — Equipamento</option>
              <option value="Z">Z — Reboque</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#6b7280' }}>Quantidade</label>
            <input type="number" min={1} max={100} value={qty}
              onChange={e => setQty(Math.max(1, Math.min(100, +e.target.value)))}
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-500"
              style={{ borderColor: '#d1d5db', color: '#374151' }} />
          </div>
        </div>

        {/* Preview prefixo */}
        <div className="rounded px-4 py-3 mb-4 font-mono text-center"
          style={{ background: '#f0f5ff', border: '1px solid #dbeafe' }}>
          <span className="text-lg font-bold" style={{ color: '#1B4F8A' }}>{ownerUpper}{cat} ______</span>
          <span className="text-xs ml-2" style={{ color: '#6b7280' }}>
            (dígito verificador calculado automaticamente)
          </span>
        </div>

        <button onClick={generate} disabled={isPending}
          className="w-full font-bold rounded py-2.5 text-sm text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: '#1B4F8A' }}>
          {isPending ? 'Gerando...' : `Gerar ${qty} Número${qty > 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Resultado */}
      {result.length > 0 && (
        <div className="bg-white rounded-lg p-5" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#6b7280' }}>
            Números Gerados
          </h3>
          <div className="space-y-1.5">
            {result.map(n => (
              <div key={n.ser} className="flex items-center gap-3 rounded px-3 py-2"
                style={{ background: n.dup ? '#fef2f2' : '#f0fdf4', border: `1px solid ${n.dup ? '#fecaca' : '#bbf7d0'}` }}>
                <span style={{ color: n.dup ? '#ef4444' : '#7DC242' }}>{n.dup ? '✗' : '✓'}</span>
                <span className="font-bold font-mono text-sm" style={{ color: '#1a2a3a' }}>{n.full}</span>
                <span className="text-xs ml-auto" style={{ color: '#6b7280' }}>
                  Dígito verificador: <strong style={{ color: '#1a2a3a' }}>{n.cd}</strong>
                </span>
                {n.dup && <span className="text-xs" style={{ color: '#ef4444' }}>duplicado</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-lg p-5" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b7280' }}>Histórico</h3>
            <button onClick={handleClear} className="text-xs font-medium" style={{ color: '#ef4444' }}>Limpar tudo</button>
          </div>
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="rounded px-3 py-2.5" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold font-mono text-sm" style={{ color: '#1a2a3a' }}>{s.owner}{s.cat}</span>
                  <span className="text-xs" style={{ color: '#9ca3af' }}>{new Date(s.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex gap-4 text-xs" style={{ color: '#6b7280' }}>
                  <span>Solicitados: <strong style={{ color: '#1a2a3a' }}>{s.qty}</strong></span>
                  <span style={{ color: '#7DC242' }}>Novos: <strong>{s.new_count}</strong></span>
                  {s.dup_count > 0 && <span style={{ color: '#ef4444' }}>Duplic.: <strong>{s.dup_count}</strong></span>}
                </div>
                {s.nums && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.nums.map(n => (
                      <span key={n.ser} className="font-mono text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: n.dup ? '#fef2f2' : '#eff6ff',
                          color: n.dup ? '#dc2626' : '#1d4ed8',
                          border: `1px solid ${n.dup ? '#fecaca' : '#bfdbfe'}`
                        }}>
                        {n.full}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
