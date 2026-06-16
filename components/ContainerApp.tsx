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

  // ALS colors
  const C = {
    card:        '#132140',
    cardBorder:  '#1e3560',
    bg:          '#0f1b2e',
    label:       '#8ca5c8',
    input:       '#0f1b2e',
    inputBorder: '#1e3560',
    green:       '#7AB800',
    blue:        '#1B3A6B',
    text:        '#d4e4f7',
    muted:       '#4a6a9a',
    numColor:    '#7dd3fc',
    cdColor:     '#7AB800',
  }

  const inputStyle = { background: C.input, border: `1px solid ${C.inputBorder}`, color: C.text }
  const cardStyle  = { background: C.card, border: `1px solid ${C.cardBorder}` }

  return (
    <div className="space-y-5">

      {/* CONFIG */}
      <div className="rounded-2xl p-6" style={cardStyle}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: C.green }}>Configuração</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Prefixo (3 letras)', id: 'owner' },
            { label: 'Categoria', id: 'cat' },
            { label: 'Número inicial', id: 'start' },
            { label: 'Quantidade', id: 'qty' },
          ].map(({ label, id }) => (
            <div key={id}>
              <label className="block text-xs mb-1.5" style={{ color: C.label }}>{label}</label>
              {id === 'cat' ? (
                <select value={cat} onChange={e => setCat(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none font-mono"
                  style={inputStyle}>
                  {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              ) : id === 'owner' ? (
                <input value={owner} maxLength={3}
                  onChange={e => setOwner(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none font-mono"
                  style={inputStyle} placeholder="ALS" />
              ) : (
                <input type="number" min={id === 'qty' ? 1 : 0} max={id === 'qty' ? 5000 : 999999}
                  value={id === 'qty' ? qty : start}
                  onChange={e => id === 'qty'
                    ? setQty(Math.min(parseInt(e.target.value) || 1, 5000))
                    : setStart(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none font-mono"
                  style={inputStyle} />
              )}
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="mt-4 rounded-xl px-4 py-3 text-center font-mono text-xl tracking-widest"
          style={conflictCount > 0
            ? { background: '#2d0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }
            : { background: C.bg, border: `1px solid ${C.cardBorder}`, color: C.numColor }}>
          {validOwner
            ? <>{owner}{cat} {ser0} <span style={{ color: C.cdColor, fontWeight: 700 }}>{cd0}</span></>
            : <span style={{ color: C.muted }}>—</span>}
        </div>

        {conflictCount > 0 && (
          <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#2d0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
            ⚠️ <strong>{conflictCount} número(s) já usados</strong> neste range — serão marcados em vermelho.
          </div>
        )}

        <p className="mt-3 text-xs" style={{ color: C.muted }}>
          Formato: <span style={{ color: C.label }}>OOOO NNNNNN <span style={{ color: C.green }}>C</span></span> — prefixo 3 letras + categoria · serial 6 dígitos · <span style={{ color: C.green }}>C = dígito verificador ISO 6346</span>
        </p>

        <div className="flex gap-3 mt-4 flex-wrap">
          <button onClick={generate} disabled={isPending}
            className="font-bold rounded-lg px-5 py-2.5 text-sm transition-opacity disabled:opacity-50"
            style={{ background: C.green, color: '#0f1b2e' }}>
            {isPending ? 'Salvando...' : 'Gerar e registrar'}
          </button>
          <button onClick={() => { setShowResult(false); setGenerated([]) }}
            className="font-semibold rounded-lg px-5 py-2.5 text-sm"
            style={{ background: C.blue, color: '#d4e4f7' }}>
            Limpar resultado
          </button>
        </div>
      </div>

      {/* RESULTADO */}
      {showResult && generated.length > 0 && (
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.green }}>Números gerados agora</p>
            <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: C.blue, color: '#d4e4f7' }}>
              {generated.length} containers{generated.filter(n => n.dup).length > 0 ? ` · ${generated.filter(n => n.dup).length} dup.` : ''}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap mb-4">
            <button onClick={copyAll} className="text-xs font-bold rounded-lg px-4 py-2"
              style={{ background: C.green, color: '#0f1b2e' }}>Copiar todos</button>
            <button onClick={downloadTxt} className="text-xs font-semibold rounded-lg px-4 py-2"
              style={{ background: C.blue, color: '#d4e4f7' }}>Baixar .txt</button>
            <button onClick={downloadCsv} className="text-xs font-semibold rounded-lg px-4 py-2"
              style={{ background: C.blue, color: '#d4e4f7' }}>Baixar .csv</button>
          </div>
          <div className="rounded-xl max-h-80 overflow-y-auto divide-y" style={{ background: C.bg, borderColor: C.cardBorder, border: `1px solid ${C.cardBorder}` }}>
            {generated.map((n, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5"
                style={n.dup ? { background: '#2d0a0a' } : {}}>
                <span className="text-xs w-9 shrink-0" style={{ color: C.muted }}>{String(i + 1).padStart(4, '0')}</span>
                <span className="font-mono text-sm flex-1" style={{ color: n.dup ? '#f87171' : C.numColor, textDecoration: n.dup ? 'line-through' : 'none' }}>
                  {n.full.slice(0, -1)}<span style={{ color: C.green, fontWeight: 700 }}>{n.cd}</span>
                  {n.dup && <span className="ml-2 text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#7f1d1d', color: '#fca5a5', textDecoration: 'none' }}>JÁ USADO</span>}
                </span>
                <button
                  onClick={e => { navigator.clipboard.writeText(n.full); const b = e.currentTarget; b.textContent = '✓'; setTimeout(() => { b.textContent = 'copiar' }, 1500) }}
                  className="text-xs rounded px-2 py-0.5 shrink-0"
                  style={{ color: C.muted, border: `1px solid ${C.cardBorder}` }}>copiar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HISTÓRICO */}
      <div className="rounded-2xl p-6" style={cardStyle}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.green }}>Histórico de numerações</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: '#1a3a00', color: C.green }}>{usedKeys.size} únicos</span>
            <button onClick={exportHistory} className="text-xs rounded-lg px-3 py-1.5"
              style={{ color: C.label, border: `1px solid ${C.cardBorder}` }}>Exportar</button>
            <button onClick={handleClearAll} className="text-xs rounded-lg px-3 py-1.5"
              style={{ color: '#f87171', border: '1px solid #7f1d1d' }}>Apagar tudo</button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: C.muted }}>Nenhuma numeração gerada ainda.</div>
        ) : (
          <div className="rounded-xl max-h-[480px] overflow-y-auto" style={{ background: C.bg, border: `1px solid ${C.cardBorder}` }}>
            {sessions.map(s => {
              const MAX = 12
              const date = new Date(s.created_at).toLocaleString('pt-BR')
              return (
                <div key={s.id} className="px-4 py-4" style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                    <div>
                      <span className="font-mono text-sm" style={{ color: C.numColor }}>{s.owner}{s.cat}</span>
                      <span className="text-sm" style={{ color: C.label }}> — {s.qty} número{s.qty !== 1 ? 's' : ''}</span>
                      <div className="text-xs mt-0.5" style={{ color: C.muted }}>{date}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {s.dup_count > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2d0a0a', color: '#f87171' }}>{s.dup_count} dup.</span>}
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1a3a00', color: C.green }}>{s.new_count} novos</span>
                      <button onClick={() => copySession(s)} className="text-xs rounded px-2 py-0.5"
                        style={{ color: C.label, border: `1px solid ${C.cardBorder}` }}>copiar</button>
                      <button onClick={() => handleDeleteSession(s.id)} className="text-xs rounded px-2 py-0.5"
                        style={{ color: '#f87171', border: '1px solid #7f1d1d' }}>×</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {s.nums.slice(0, MAX).map((n, i) => (
                      <span key={i} className="font-mono text-xs rounded px-2 py-1"
                        style={n.dup
                          ? { border: '1px solid #7f1d1d', color: '#f87171', textDecoration: 'line-through', background: '#2d0a0a' }
                          : { border: `1px solid ${C.cardBorder}`, color: C.numColor, background: C.card }}>
                        {s.owner}{s.cat} {n.ser} <span style={{ color: C.green, fontWeight: 700 }}>{n.cd}</span>
                      </span>
                    ))}
                    {s.nums.length > MAX && (
                      <span className="text-xs self-center px-1" style={{ color: C.muted }}>+{s.nums.length - MAX} mais</span>
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
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{ background: toastError ? '#dc2626' : C.green, color: toastError ? '#fff' : '#0f1b2e' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
