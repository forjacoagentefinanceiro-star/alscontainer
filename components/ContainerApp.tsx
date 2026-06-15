'use client'

import { useState, useTransition } from 'react'
import { checkDigit } from '@/lib/iso6346'
import { saveSession, deleteSession, clearAllHistory } from '@/app/actions'

type Num = { ser: string; cd: number; full: string; dup: boolean }

type Session = {
  id: string
  owner: string
  cat: string
  qty: number
  new_count: number
  dup_count: number
  nums: Num[]
  created_at: string
}

const CATS = [
  { value: 'U', label: 'U — Carga (Freight)' },
  { value: 'J', label: 'J — Acessório de carga' },
  { value: 'Z', label: 'Z — Trailer / Chassis' },
]

function makeKey(owner: string, cat: string, ser: string) {
  return `${owner}${cat} ${ser}`
}

export function ContainerApp({
  initialSessions,
  initialUsedKeys,
}: {
  initialSessions: Session[]
  initialUsedKeys: string[]
}) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [usedKeys, setUsedKeys] = useState<Set<string>>(new Set(initialUsedKeys))
  const [generated, setGenerated] = useState<Num[]>([])
  const [showResult, setShowResult] = useState(false)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [owner, setOwner] = useState('ALS')
  const [cat, setCat] = useState('U')
  const [start, setStart] = useState(1)
  const [qty, setQty] = useState(10)

  // preview
  const validOwner = owner.length === 3
  const ser0 = start.toString().padStart(6, '0')
  const cd0 = validOwner ? checkDigit(owner, cat, ser0) : null

  // detecção de conflitos no range
  const conflictCount = (() => {
    if (!validOwner) return 0
    let n = 0
    for (let i = 0; i < Math.min(qty, 5000); i++) {
      const s = (start + i).toString().padStart(6, '0')
      if (usedKeys.has(makeKey(owner, cat, s))) n++
    }
    return n
  })()

  function showToast(msg: string, error = false) {
    setToast(msg)
    setToastError(error)
    setTimeout(() => setToast(''), 3000)
  }

  function generate() {
    if (!validOwner) return showToast('Prefixo deve ter 3 letras', true)
    if (isNaN(start) || start < 0) return showToast('Número inicial inválido', true)
    if (start + qty - 1 > 999999) return showToast('Limite: máximo serial é 999999', true)

    const nums: Num[] = []
    const newKeys: string[] = []

    for (let i = 0; i < Math.min(qty, 5000); i++) {
      const serial = start + i
      const ser = serial.toString().padStart(6, '0')
      const cd = checkDigit(owner, cat, ser)
      const full = `${owner}${cat} ${ser} ${cd}`
      const key = makeKey(owner, cat, ser)
      const dup = usedKeys.has(key)
      nums.push({ ser, cd, full, dup })
      if (!dup) newKeys.push(key)
    }

    setGenerated(nums)
    setShowResult(true)

    startTransition(async () => {
      const newCount = newKeys.length
      const dupCount = nums.length - newCount
      const session = await saveSession({ owner, cat, qty: nums.length, new_count: newCount, dup_count: dupCount, nums })
      setUsedKeys(prev => new Set([...prev, ...newKeys]))
      setSessions(prev => [session, ...prev])
      showToast(`${newCount} novos registrados${dupCount ? `, ${dupCount} duplicados` : ''}`)
    })
  }

  function handleDeleteSession(id: string) {
    if (!confirm('Remover sessão do histórico?')) return
    startTransition(async () => {
      await deleteSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
    })
  }

  function handleClearAll() {
    if (!confirm('Apagar TODO o histórico e liberar TODOS os números?\nEssa ação não pode ser desfeita.')) return
    startTransition(async () => {
      await clearAllHistory()
      setSessions([])
      setUsedKeys(new Set())
      setGenerated([])
      setShowResult(false)
      showToast('Histórico apagado.')
    })
  }

  function copyText(text: string, label = 'Copiado!') {
    navigator.clipboard.writeText(text).then(() => showToast(label))
  }

  function copyAll() {
    copyText(generated.filter(n => !n.dup).map(n => n.full).join('\n'), `${generated.filter(n => !n.dup).length} números copiados!`)
  }

  function copySession(s: Session) {
    copyText(s.nums.filter(n => !n.dup).map(n => n.full).join('\n'), `Sessão copiada (${s.new_count} números)`)
  }

  function download(filename: string, content: string, mime: string) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([content], { type: mime }))
    a.download = filename
    a.click()
    showToast(`${filename} baixado!`)
  }

  function downloadTxt() {
    download('containers.txt', generated.map(n => n.full).join('\n'), 'text/plain')
  }

  function downloadCsv() {
    const rows = ['container,serial,digito_verificador,ja_usado']
    generated.forEach(n => rows.push(`${n.full},${n.ser},${n.cd},${n.dup}`))
    download('containers.csv', rows.join('\n'), 'text/csv')
  }

  function exportHistory() {
    if (sessions.length === 0) { showToast('Sem histórico para exportar', true); return }
    const rows = ['container,serial,digito_verificador,ja_usado,data,sessao_id']
    sessions.forEach(s => s.nums.forEach(n =>
      rows.push(`${n.full},${n.ser},${n.cd},${n.dup},"${new Date(s.created_at).toLocaleString('pt-BR')}",${s.id}`)
    ))
    download('historico-containers.csv', rows.join('\n'), 'text/csv')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* CONFIG */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Configuração</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Prefixo (3 letras)</label>
            <input
              value={owner}
              maxLength={3}
              onChange={e => setOwner(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500 transition-colors font-mono"
              placeholder="ALS"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Categoria</label>
            <select
              value={cat}
              onChange={e => setCat(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500 transition-colors font-mono"
            >
              {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Número inicial</label>
            <input
              type="number" min={0} max={999999}
              value={start}
              onChange={e => setStart(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500 transition-colors font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Quantidade</label>
            <input
              type="number" min={1} max={5000}
              value={qty}
              onChange={e => setQty(Math.min(parseInt(e.target.value) || 1, 5000))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Preview */}
        <div className={`mt-4 rounded-xl border px-4 py-3 text-center font-mono text-xl tracking-widest transition-colors ${conflictCount > 0 ? 'border-red-700 text-red-300 bg-red-950/30' : 'border-slate-700 text-sky-400 bg-slate-950'}`}>
          {validOwner
            ? <>{owner}{cat} {ser0} <span className="text-amber-400">{cd0}</span></>
            : <span className="text-slate-600">—</span>
          }
        </div>

        {conflictCount > 0 && (
          <div className="mt-2 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2 text-xs text-red-300">
            ⚠️ <strong>{conflictCount} número(s) já usados</strong> neste range — serão marcados em vermelho.
          </div>
        )}

        <p className="mt-3 text-xs text-slate-600">
          Formato: <span className="text-slate-400">OOOO NNNNNN <span className="text-amber-400">C</span></span> — O = prefixo 3 letras + categoria · N = serial 6 dígitos · <span className="text-amber-400">C = dígito verificador ISO 6346</span>
        </p>

        <div className="flex gap-3 mt-4 flex-wrap">
          <button
            onClick={generate}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors"
          >
            {isPending ? 'Salvando...' : 'Gerar e registrar'}
          </button>
          <button
            onClick={() => { setShowResult(false); setGenerated([]) }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors"
          >
            Limpar resultado
          </button>
        </div>
      </div>

      {/* RESULTADO */}
      {showResult && generated.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Números gerados agora</p>
            <span className="text-xs bg-slate-800 text-blue-400 px-3 py-1 rounded-full font-semibold">
              {generated.length} containers{generated.filter(n => n.dup).length > 0 ? ` · ${generated.filter(n => n.dup).length} duplicados` : ''}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap mb-4">
            <button onClick={copyAll} className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg px-4 py-2 transition-colors">Copiar todos</button>
            <button onClick={downloadTxt} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg px-4 py-2 transition-colors">Baixar .txt</button>
            <button onClick={downloadCsv} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg px-4 py-2 transition-colors">Baixar .csv</button>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-80 overflow-y-auto">
            {generated.map((n, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-900 last:border-0 hover:bg-slate-900/50 ${n.dup ? 'bg-red-950/20' : ''}`}>
                <span className="text-slate-600 text-xs w-9 shrink-0">{String(i + 1).padStart(4, '0')}</span>
                <span className={`font-mono text-sm flex-1 ${n.dup ? 'text-red-400 line-through' : 'text-sky-300'}`}>
                  {n.full.slice(0, -1)}<span className="text-amber-400">{n.cd}</span>
                  {n.dup && <span className="ml-2 text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded font-bold no-underline">JÁ USADO</span>}
                </span>
                <button
                  onClick={e => { navigator.clipboard.writeText(n.full); const b = e.currentTarget; b.textContent = '✓'; setTimeout(() => { b.textContent = 'copiar' }, 1500) }}
                  className="text-xs text-slate-500 hover:text-blue-400 border border-slate-700 hover:border-blue-600 rounded px-2 py-0.5 transition-colors shrink-0"
                >copiar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HISTÓRICO */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Histórico de numerações</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-amber-900/50 text-amber-400 px-3 py-1 rounded-full font-semibold">{usedKeys.size} números únicos</span>
            <button onClick={exportHistory} className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-1.5 transition-colors">Exportar</button>
            <button onClick={handleClearAll} className="text-xs text-red-500 hover:text-red-300 border border-red-900 hover:border-red-700 rounded-lg px-3 py-1.5 transition-colors">Apagar tudo</button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center text-slate-600 py-10 text-sm">Nenhuma numeração gerada ainda.</div>
        ) : (
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-[480px] overflow-y-auto divide-y divide-slate-900">
            {sessions.map(s => {
              const MAX = 12
              const date = new Date(s.created_at).toLocaleString('pt-BR')
              return (
                <div key={s.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                    <div>
                      <span className="font-mono text-sm text-sky-400">{s.owner}{s.cat}</span>
                      <span className="text-slate-400 text-sm"> — {s.qty} número{s.qty !== 1 ? 's' : ''}</span>
                      <div className="text-xs text-slate-600 mt-0.5">{date}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {s.dup_count > 0 && <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">{s.dup_count} dup.</span>}
                      <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full">{s.new_count} novos</span>
                      <button onClick={() => copySession(s)} className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded px-2 py-0.5 transition-colors">copiar</button>
                      <button onClick={() => handleDeleteSession(s.id)} className="text-xs text-red-600 hover:text-red-400 border border-red-900 rounded px-2 py-0.5 transition-colors">×</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {s.nums.slice(0, MAX).map((n, i) => (
                      <span key={i} className={`font-mono text-xs rounded px-2 py-1 border ${n.dup ? 'border-red-900/60 text-red-500 line-through bg-red-950/20' : 'border-slate-700 text-sky-300 bg-slate-900'}`}>
                        {s.owner}{s.cat} {n.ser} <span className="text-amber-400 font-bold">{n.cd}</span>
                      </span>
                    ))}
                    {s.nums.length > MAX && (
                      <span className="text-xs text-slate-600 self-center px-1">+{s.nums.length - MAX} mais</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg transition-all ${toastError ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast}
        </div>
      )}
    </div>
  )
}
