'use client'

import { useState, useTransition } from 'react'
import { importContainers } from '@/app/actions'
import type { Container } from '@/app/actions'

type ParsedContainer = Omit<Container, 'id' | 'user_id' | 'created_at'>

function parseDateBR(s: string): string | null {
  if (!s) return null
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function parseXML(xml: string): { items: ParsedContainer[], errors: string[] } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) return { items: [], errors: ['XML inválido: ' + parseError.textContent?.slice(0, 200)] }

  const containerEls = doc.querySelectorAll('container')
  if (containerEls.length === 0) return { items: [], errors: ['Nenhum elemento <container> encontrado.'] }

  const items: ParsedContainer[] = []
  const errors: string[] = []

  containerEls.forEach((el, idx) => {
    try {
      const numero = el.querySelector('numero')?.textContent?.trim() ?? ''
      const isoValido = el.querySelector('numero')?.getAttribute('iso6346_valido') !== 'false'
      const tipo = (el.getAttribute('tipo') ?? 'nacional') as 'nacional' | 'importado'
      const tamanho = el.querySelector('tamanho')?.textContent?.trim() ?? '20GP'
      const fornecedor = el.querySelector('fornecedor')?.textContent?.trim() ?? ''
      const dataRaw = el.querySelector('data_compra')?.textContent?.trim() ?? ''
      const data_compra = parseDateBR(dataRaw)
      const obs = el.querySelector('observacoes')?.textContent?.trim() ?? ''
      const fin = el.querySelector('financeiro')

      let valor_usd: number | null = null
      let cotacao: number | null = null
      let extras_brl: number | null = null
      let valor_brl: number | null = null

      if (fin) {
        const moeda = fin.getAttribute('moeda_origem')
        if (moeda === 'USD') {
          valor_usd = parseFloat(fin.querySelector('valor_usd')?.textContent ?? '0') || null
          cotacao = parseFloat(fin.querySelector('cotacao_dolar')?.textContent ?? '0') || null
          extras_brl = parseFloat(fin.querySelector('custos_extras_brl')?.textContent ?? '0') || 0
          valor_brl = parseFloat(fin.querySelector('valor_total_brl')?.textContent ?? '0') || null
        } else {
          valor_brl = parseFloat(fin.querySelector('valor_compra_brl')?.textContent ?? '0') || null
        }
      }

      items.push({ numero, tipo, tamanho, fornecedor, data_compra, valor_usd, cotacao, extras_brl, valor_brl, obs, iso_valido: isoValido })
    } catch (e) {
      errors.push(`Container #${idx + 1}: ${String(e)}`)
    }
  })

  return { items, errors }
}

const fmtBRL = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ImportTab({ onImported }: { onImported: () => void }) {
  const [xmlText, setXmlText] = useState('')
  const [preview, setPreview] = useState<ParsedContainer[] | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ count: number; error: string | null } | null>(null)

  function handleParse() {
    setResult(null)
    const { items, errors } = parseXML(xmlText.trim())
    setPreview(items)
    setParseErrors(errors)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setXmlText((ev.target?.result as string) ?? '')
      setPreview(null); setParseErrors([]); setResult(null)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleImport() {
    if (!preview || preview.length === 0) return
    startTransition(async () => {
      const res = await importContainers(preview)
      setResult(res)
      if (!res.error) {
        setXmlText(''); setPreview(null)
        setTimeout(onImported, 1200)
      }
    })
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="bg-white rounded-lg p-6" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 className="font-bold text-base mb-1" style={{ color: '#1a2a3a' }}>Importar do HTML (XML)</h2>
        <p className="text-sm mb-5" style={{ color: '#6b7280' }}>
          No arquivo <strong>als_containers.html</strong>, use o botão <em>Exportar XML</em>, salve o arquivo
          e selecione abaixo — ou cole o conteúdo diretamente.
        </p>

        {/* Upload */}
        <label className="flex items-center gap-3 cursor-pointer rounded-lg px-4 py-4 border-2 border-dashed mb-4 transition-colors hover:border-blue-400 hover:bg-blue-50"
          style={{ borderColor: '#d1d5db' }}>
          <span className="text-2xl">📁</span>
          <div>
            <p className="text-sm font-medium" style={{ color: '#374151' }}>Selecionar arquivo XML</p>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Clique para escolher ou arraste aqui</p>
          </div>
          <input type="file" accept=".xml,text/xml" className="hidden" onChange={handleFile} />
        </label>

        {/* Textarea */}
        <textarea
          rows={7}
          value={xmlText}
          onChange={e => { setXmlText(e.target.value); setPreview(null); setParseErrors([]); setResult(null) }}
          placeholder="…ou cole o conteúdo XML aqui"
          className="w-full rounded border px-3 py-2 text-xs font-mono resize-y outline-none focus:border-blue-500"
          style={{ borderColor: '#d1d5db', color: '#374151' }}
        />

        <div className="flex gap-3 mt-4">
          <button onClick={handleParse} disabled={!xmlText.trim()}
            className="flex-1 rounded border py-2.5 text-sm font-semibold disabled:opacity-40 transition-opacity hover:bg-gray-50"
            style={{ borderColor: '#d1d5db', color: '#374151' }}>
            Validar XML
          </button>
          <button onClick={handleImport} disabled={!preview || preview.length === 0 || isPending}
            className="flex-1 rounded py-2.5 text-sm font-bold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#1B4F8A' }}>
            {isPending ? 'Importando...' : `Importar ${preview ? preview.length : 0} containers`}
          </button>
        </div>
      </div>

      {/* Erros */}
      {parseErrors.length > 0 && (
        <div className="rounded-lg p-4" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: '#dc2626' }}>Erros de validação:</p>
          {parseErrors.map((e, i) => <p key={i} className="text-xs" style={{ color: '#dc2626' }}>{e}</p>)}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="rounded-lg p-4" style={{
          background: result.error ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${result.error ? '#fecaca' : '#bbf7d0'}`
        }}>
          <p className="text-sm font-semibold" style={{ color: result.error ? '#dc2626' : '#166534' }}>
            {result.error ? `Erro: ${result.error}` : `✓ ${result.count} container${result.count !== 1 ? 's' : ''} importado${result.count !== 1 ? 's' : ''} com sucesso!`}
          </p>
        </div>
      )}

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="px-5 py-3 border-b" style={{ background: '#f9fafb', borderColor: '#e5e7eb' }}>
            <p className="text-xs font-semibold" style={{ color: '#6b7280' }}>
              PREVIEW — {preview.length} containers encontrados
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {['Número', 'Tipo', 'Tamanho', 'Fornecedor', 'Data', 'Valor Total BRL'].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-semibold" style={{ color: '#6b7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td className="px-4 py-2 font-mono font-semibold" style={{ color: '#1a2a3a' }}>{c.numero}</td>
                    <td className="px-4 py-2">
                      <span className="px-1.5 py-0.5 rounded font-semibold"
                        style={c.tipo === 'nacional'
                          ? { background: '#f0fff4', color: '#166534', border: '1px solid #bbf7d0' }
                          : { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                        {c.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2" style={{ color: '#374151' }}>{c.tamanho}</td>
                    <td className="px-4 py-2" style={{ color: '#374151' }}>{c.fornecedor || '—'}</td>
                    <td className="px-4 py-2" style={{ color: '#374151' }}>{c.data_compra || '—'}</td>
                    <td className="px-4 py-2 font-semibold" style={{ color: '#1B4F8A' }}>{fmtBRL(c.valor_brl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
