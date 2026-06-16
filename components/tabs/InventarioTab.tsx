'use client'

import { useState, useTransition } from 'react'
import type { Container } from '@/app/actions'
import { addContainer, updateContainer, deleteContainer } from '@/app/actions'

const TAMANHOS = ['20GP', '40GP', '40HC', '20OT', '40OT', '20TK', '20RF', '40RF', '45HC']

type Form = {
  numero: string
  tipo: 'nacional' | 'importado'
  tamanho: string
  fornecedor: string
  data_compra: string
  valor_usd: string
  cotacao: string
  extras_brl: string
  valor_brl: string
  obs: string
  iso_valido: boolean
}

const emptyForm = (): Form => ({
  numero: '', tipo: 'nacional', tamanho: '40GP', fornecedor: '',
  data_compra: '', valor_usd: '', cotacao: '', extras_brl: '0', valor_brl: '', obs: '', iso_valido: true
})

function validateISO(num: string): boolean {
  const clean = num.replace(/\s+/g, '')
  if (!/^[A-Z]{4}\d{7}$/.test(clean)) return false
  const VALS: Record<string, number> = {}
  let v = 10
  for (let i = 0; i < 26; i++) {
    VALS[String.fromCharCode(65 + i)] = v++
    if (v % 11 === 0) v++
  }
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const c = clean[i]
    const val = isNaN(+c) ? VALS[c] : +c
    sum += val * Math.pow(2, i)
  }
  const cd = sum % 11 === 10 ? 0 : sum % 11
  return cd === +clean[10]
}

function calcTotal(form: Form): number {
  if (form.tipo === 'importado') {
    const usd = parseFloat(form.valor_usd) || 0
    const cot = parseFloat(form.cotacao) || 0
    const ext = parseFloat(form.extras_brl) || 0
    return usd * cot + ext
  }
  return parseFloat(form.valor_brl) || 0
}

const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtUSD = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── Input helper ───────────────────────────────────────────────────────────
const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="w-full rounded border px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
    style={{ borderColor: '#d1d5db', background: '#fff', ...props.style }}
  />
)

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-medium text-gray-500 mb-1">{children}</label>
)

export function InventarioTab({ initialContainers, role = 'viewer' }: { initialContainers: Container[], role?: 'admin' | 'editor' | 'viewer' }) {
  const canEdit = role === 'admin' || role === 'editor'
  const [containers, setContainers] = useState<Container[]>(initialContainers)
  const [form, setForm] = useState<Form>(emptyForm())
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState<'todos' | 'nacional' | 'importado'>('todos')
  const [filterSize, setFilterSize] = useState('todos')

  const iso = form.numero.replace(/\s/g, '').length >= 11
    ? validateISO(form.numero.toUpperCase().replace(/\s/g, ''))
    : null

  function setField<K extends keyof Form>(k: K, v: Form[K]) {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (['valor_usd', 'cotacao', 'extras_brl'].includes(k as string) && next.tipo === 'importado') {
        const total = calcTotal(next)
        return { ...next, valor_brl: total > 0 ? total.toFixed(2) : next.valor_brl }
      }
      return next
    })
  }

  function openAdd() {
    setForm(emptyForm())
    setEditId(null)
    setError('')
    setShowForm(true)
  }

  function openEdit(c: Container) {
    setForm({
      numero: c.numero,
      tipo: c.tipo,
      tamanho: c.tamanho,
      fornecedor: c.fornecedor ?? '',
      data_compra: c.data_compra ?? '',
      valor_usd: c.valor_usd != null ? String(c.valor_usd) : '',
      cotacao: c.cotacao != null ? String(c.cotacao) : '',
      extras_brl: c.extras_brl != null ? String(c.extras_brl) : '0',
      valor_brl: c.valor_brl != null ? String(c.valor_brl) : '',
      obs: c.obs ?? '',
      iso_valido: c.iso_valido,
    })
    setEditId(c.id)
    setError('')
    setShowForm(true)
  }

  function buildPayload(): Omit<Container, 'id' | 'user_id' | 'created_at'> {
    const num = form.numero.toUpperCase().replace(/\s+/g, '')
    return {
      numero: num,
      tipo: form.tipo,
      tamanho: form.tamanho,
      fornecedor: form.fornecedor,
      data_compra: form.data_compra || null,
      valor_usd: form.tipo === 'importado' ? (parseFloat(form.valor_usd) || null) : null,
      cotacao: form.tipo === 'importado' ? (parseFloat(form.cotacao) || null) : null,
      extras_brl: form.tipo === 'importado' ? (parseFloat(form.extras_brl) || 0) : null,
      valor_brl: parseFloat(form.valor_brl) || null,
      obs: form.obs,
      iso_valido: validateISO(num),
    }
  }

  function handleSave() {
    if (!form.numero.trim()) { setError('Número do container é obrigatório.'); return }
    setError('')
    startTransition(async () => {
      const payload = buildPayload()
      if (editId) {
        const res = await updateContainer(editId, payload)
        if (res.error) { setError(res.error); return }
        setContainers(prev => prev.map(c => c.id === editId ? { ...c, ...payload } : c))
      } else {
        const res = await addContainer(payload)
        if (res.error) { setError(res.error); return }
        setContainers(prev => [...prev, {
          id: crypto.randomUUID(), user_id: '', created_at: new Date().toISOString(), ...payload
        }])
      }
      setShowForm(false)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Excluir este container?')) return
    startTransition(async () => {
      const res = await deleteContainer(id)
      if (!res.error) setContainers(prev => prev.filter(c => c.id !== id))
    })
  }

  function handleExportXLS() {
    const rows = [
      ['Número', 'Tipo', 'Tamanho', 'Fornecedor', 'Data Compra', 'Valor USD', 'Cotação', 'Extras BRL', 'Valor BRL', 'Obs'],
      ...containers.map(c => [
        c.numero, c.tipo, c.tamanho, c.fornecedor ?? '',
        c.data_compra ?? '', c.valor_usd ?? '', c.cotacao ?? '',
        c.extras_brl ?? '', c.valor_brl ?? '', c.obs ?? ''
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `als_depot_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const sizes = ['todos', ...Array.from(new Set(containers.map(c => c.tamanho)))]

  const filtered = containers.filter(c => {
    const matchTipo = filterTipo === 'todos' || c.tipo === filterTipo
    const matchSize = filterSize === 'todos' || c.tamanho === filterSize
    const matchSearch = !search ||
      c.numero.toLowerCase().includes(search.toLowerCase()) ||
      (c.fornecedor ?? '').toLowerCase().includes(search.toLowerCase())
    return matchTipo && matchSize && matchSearch
  })

  const totalBRL = containers.reduce((s, c) => s + (c.valor_brl ?? 0), 0)
  const nacionais = containers.filter(c => c.tipo === 'nacional').length
  const importados = containers.filter(c => c.tipo === 'importado').length

  return (
    <div>
      {/* Métricas — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', value: String(containers.length), accent: '#1B4F8A' },
          { label: 'Nacionais', value: String(nacionais), accent: '#7DC242' },
          { label: 'Importados', value: String(importados), accent: '#1B4F8A' },
          { label: 'Valor Total', value: fmtBRL(totalBRL), accent: '#7DC242', small: true },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl p-3 md:p-4"
            style={{ border: '1px solid #e5e7eb', borderLeft: `4px solid ${m.accent}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6b7280' }}>{m.label}</p>
            <p className={`font-bold leading-tight ${m.small ? 'text-base md:text-lg' : 'text-2xl md:text-3xl'}`}
              style={{ color: '#1a2a3a' }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Barra de filtros — empilhada no mobile */}
      <div className="space-y-2 md:space-y-0 md:flex md:flex-wrap md:gap-2 md:items-center mb-4">
        {/* Linha 1 mobile: busca */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar número ou fornecedor..."
          className="w-full md:flex-1 md:min-w-40 rounded border px-3 py-2 text-sm outline-none focus:border-blue-500"
          style={{ borderColor: '#d1d5db', background: '#fff', color: '#374151' }}
        />
        {/* Linha 2 mobile: filtros lado a lado */}
        <div className="flex gap-2">
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value as typeof filterTipo)}
            className="flex-1 rounded border px-2 py-2 text-sm outline-none"
            style={{ borderColor: '#d1d5db', background: '#fff', color: '#374151' }}>
            <option value="todos">Todos os tipos</option>
            <option value="nacional">Nacional</option>
            <option value="importado">Importado</option>
          </select>
          <select value={filterSize} onChange={e => setFilterSize(e.target.value)}
            className="flex-1 rounded border px-2 py-2 text-sm outline-none"
            style={{ borderColor: '#d1d5db', background: '#fff', color: '#374151' }}>
            {sizes.map(s => <option key={s} value={s}>{s === 'todos' ? 'Todos tam.' : s}</option>)}
          </select>
        </div>
        {/* Linha 3 mobile: botões lado a lado */}
        <div className="flex gap-2">
          <button onClick={handleExportXLS}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#7DC242' }}>
            ≡ Exportar XLS
          </button>
          {canEdit && (
            <button onClick={openAdd}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#1B4F8A' }}>
              + Novo container
            </button>
          )}
        </div>
      </div>

      {/* Modal de formulário — tela cheia no mobile, centrado no desktop */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white w-full md:rounded-xl shadow-2xl md:max-w-lg overflow-y-auto"
            style={{ maxHeight: '92dvh', borderRadius: '16px 16px 0 0' }}>

            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#e5e7eb' }}>
              <h3 className="font-bold text-base" style={{ color: '#1a2a3a' }}>
                {editId ? 'Editar Container' : 'Novo Container'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Tipo toggle */}
              <div className="flex rounded overflow-hidden border" style={{ borderColor: '#d1d5db' }}>
                {(['nacional', 'importado'] as const).map(t => (
                  <button key={t} onClick={() => setField('tipo', t)}
                    className="flex-1 py-2 text-sm font-semibold transition-all capitalize"
                    style={{
                      background: form.tipo === t ? (t === 'importado' ? '#1B4F8A' : '#7DC242') : '#f9fafb',
                      color: form.tipo === t ? '#fff' : '#6b7280',
                    }}>
                    {t === 'nacional' ? '🇧🇷 Nacional' : '🌍 Importado'}
                  </button>
                ))}
              </div>

              {/* Número */}
              <div>
                <Label>
                  Número ISO 6346
                  {iso !== null && (
                    <span className="ml-2 font-normal" style={{ color: iso ? '#7DC242' : '#ef4444' }}>
                      {iso ? '✓ válido' : '✗ inválido'}
                    </span>
                  )}
                </Label>
                <Input
                  value={form.numero}
                  onChange={e => setField('numero', e.target.value.toUpperCase())}
                  placeholder="ALSU0000010"
                  style={{ borderColor: iso === false ? '#ef4444' : '#d1d5db', fontFamily: 'monospace', letterSpacing: '0.05em' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tamanho</Label>
                  <select value={form.tamanho} onChange={e => setField('tamanho', e.target.value)}
                    className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-500"
                    style={{ borderColor: '#d1d5db', color: '#374151' }}>
                    {TAMANHOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Data Compra</Label>
                  <Input type="date" value={form.data_compra}
                    onChange={e => setField('data_compra', e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Fornecedor</Label>
                <Input value={form.fornecedor} onChange={e => setField('fornecedor', e.target.value)}
                  placeholder="Nome do fornecedor" />
              </div>

              {form.tipo === 'importado' ? (
                <div className="space-y-3">
                  <div className="rounded p-3" style={{ background: '#f0f5ff', border: '1px solid #dbeafe' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#1B4F8A' }}>Financeiro — Importado (USD)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Valor USD ($)</Label>
                        <Input type="number" step="0.01" value={form.valor_usd}
                          onChange={e => setField('valor_usd', e.target.value)}
                          onBlur={() => setField('valor_brl', calcTotal({ ...form }).toFixed(2))}
                          placeholder="0.00" />
                      </div>
                      <div>
                        <Label>Cotação (R$/USD)</Label>
                        <Input type="number" step="0.0001" value={form.cotacao}
                          onChange={e => setField('cotacao', e.target.value)}
                          onBlur={() => setField('valor_brl', calcTotal({ ...form }).toFixed(2))}
                          placeholder="5.0000" />
                      </div>
                      <div>
                        <Label>Custos Extras (R$)</Label>
                        <Input type="number" step="0.01" value={form.extras_brl}
                          onChange={e => setField('extras_brl', e.target.value)}
                          onBlur={() => setField('valor_brl', calcTotal({ ...form }).toFixed(2))}
                          placeholder="0.00" />
                      </div>
                      <div>
                        <Label>Total BRL (calculado)</Label>
                        <div className="rounded border px-3 py-2 text-sm font-bold"
                          style={{ borderColor: '#7DC242', background: '#f0fff4', color: '#166534' }}>
                          {fmtBRL(calcTotal({ ...form }))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <Label>Valor de Compra (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_brl}
                    onChange={e => setField('valor_brl', e.target.value)}
                    placeholder="0.00" />
                </div>
              )}

              <div>
                <Label>Observações</Label>
                <textarea rows={2} value={form.obs}
                  onChange={e => setField('obs', e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm resize-none outline-none focus:border-blue-500"
                  style={{ borderColor: '#d1d5db', color: '#374151' }}
                />
              </div>

              {error && (
                <div className="rounded px-3 py-2 text-xs" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowForm(false)}
                className="flex-1 rounded border py-2.5 text-sm font-medium"
                style={{ borderColor: '#d1d5db', color: '#6b7280' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={isPending}
                className="flex-1 rounded py-2.5 text-sm font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: '#1B4F8A' }}>
                {isPending ? 'Salvando...' : editId ? 'Salvar alterações' : 'Adicionar container'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vazio */}
      {filtered.length === 0 && (
        <div className="bg-white rounded-xl text-center py-16" style={{ border: '1px solid #e5e7eb' }}>
          <p className="text-4xl mb-3">📦</p>
          <p className="text-sm" style={{ color: '#9ca3af' }}>
            {containers.length === 0 ? 'Nenhum container cadastrado.' : 'Nenhum resultado para os filtros.'}
          </p>
          {containers.length === 0 && (
            <button onClick={openAdd} className="mt-3 px-4 py-2 rounded text-sm font-semibold text-white"
              style={{ background: '#1B4F8A' }}>+ Adicionar primeiro container</button>
          )}
        </div>
      )}

      {/* MOBILE: cards (oculto em md+) */}
      {filtered.length > 0 && (
        <div className="md:hidden space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              {/* Linha 1: número + badge */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm" style={{ color: '#1a2a3a' }}>{c.numero}</span>
                  <span style={{ color: c.iso_valido ? '#7DC242' : '#ef4444', fontSize: 13 }}>
                    {c.iso_valido ? '✓' : '✗'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-semibold"
                  style={c.tipo === 'nacional'
                    ? { background: '#f0fff4', color: '#166534', border: '1px solid #bbf7d0' }
                    : { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                  {c.tipo === 'nacional' ? 'Nacional' : 'Importado'}
                </span>
              </div>

              {/* Linha 2: tamanho + fornecedor + data */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                <span className="text-xs" style={{ color: '#6b7280' }}>
                  <span className="font-medium" style={{ color: '#374151' }}>Tam:</span> {c.tamanho}
                </span>
                {c.fornecedor && (
                  <span className="text-xs" style={{ color: '#6b7280' }}>
                    <span className="font-medium" style={{ color: '#374151' }}>Forn:</span> {c.fornecedor}
                  </span>
                )}
                {c.data_compra && (
                  <span className="text-xs" style={{ color: '#6b7280' }}>
                    <span className="font-medium" style={{ color: '#374151' }}>Data:</span>{' '}
                    {new Date(c.data_compra).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </span>
                )}
              </div>

              {/* Linha 3: financeiro */}
              <div className="rounded-lg px-3 py-2 mb-3 flex flex-wrap gap-x-4 gap-y-1"
                style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                {c.tipo === 'importado' && c.valor_usd != null && (
                  <>
                    <span className="text-xs" style={{ color: '#6b7280' }}>
                      <span className="font-medium" style={{ color: '#374151' }}>USD:</span> $ {fmtUSD(c.valor_usd)}
                    </span>
                    <span className="text-xs" style={{ color: '#6b7280' }}>
                      <span className="font-medium" style={{ color: '#374151' }}>Cotação:</span> R$ {Number(c.cotacao ?? 0).toFixed(2)}
                    </span>
                  </>
                )}
                <span className="text-sm font-bold" style={{ color: '#1B4F8A' }}>
                  {fmtBRL(c.valor_brl)}
                </span>
              </div>

              {/* Obs */}
              {c.obs && (
                <p className="text-xs italic mb-3" style={{ color: '#9ca3af' }}>{c.obs}</p>
              )}

              {/* Ações */}
              {canEdit && (
                <div className="flex gap-2">
                  <button onClick={() => openEdit(c)}
                    className="flex-1 py-2 rounded text-xs font-semibold border transition-colors"
                    style={{ borderColor: '#1B4F8A', color: '#1B4F8A' }}>
                    Editar
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="flex-1 py-2 rounded text-xs font-semibold border transition-colors"
                    style={{ borderColor: '#fecaca', color: '#ef4444', background: '#fef2f2' }}>
                    Excluir
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* DESKTOP: tabela completa (oculta no mobile) */}
      {filtered.length > 0 && (
        <div className="hidden md:block bg-white rounded-lg overflow-hidden" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['NÚMERO', 'TIPO', 'TAMANHO', 'FORNECEDOR', 'DATA COMPRA', 'VALOR USD', 'COTAÇÃO', 'VALOR R$', 'OBSERVAÇÕES', 'AÇÕES'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wide"
                    style={{ color: '#6b7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}
                  className="hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-xs" style={{ color: '#1a2a3a' }}>
                    {c.numero} {c.iso_valido ? <span style={{ color: '#7DC242' }}>✓</span> : <span style={{ color: '#ef4444' }}>✗</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={c.tipo === 'nacional'
                        ? { background: '#f0fff4', color: '#166534', border: '1px solid #bbf7d0' }
                        : { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                      {c.tipo === 'nacional' ? 'Nacional' : 'Importado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#374151' }}>{c.tamanho}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#374151' }}>
                    {c.fornecedor ? (c.fornecedor.length > 16 ? c.fornecedor.slice(0, 16) + '…' : c.fornecedor) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#374151' }}>
                    {c.data_compra ? new Date(c.data_compra).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: '#374151' }}>
                    {c.valor_usd != null ? `$ ${fmtUSD(c.valor_usd)}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: '#374151' }}>
                    {c.cotacao != null ? `R$ ${Number(c.cotacao).toFixed(2)}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono font-semibold" style={{ color: '#1a2a3a' }}>
                    {fmtBRL(c.valor_brl)}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>
                    {c.obs ? (c.obs.length > 14 ? c.obs.slice(0, 14) + '…' : c.obs) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(c)}
                          className="px-2.5 py-1 rounded text-xs font-medium border transition-colors hover:bg-blue-50"
                          style={{ borderColor: '#d1d5db', color: '#374151' }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(c.id)}
                          className="px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50 transition-colors"
                          title="Excluir">
                          ···
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
