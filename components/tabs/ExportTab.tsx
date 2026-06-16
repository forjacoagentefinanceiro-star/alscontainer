'use client'

import { useState } from 'react'
import type { Container } from '@/app/actions'

function generateXML(containers: Container[]): string {
  const now = new Date().toISOString()
  const total = containers.reduce((s, c) => s + (c.valor_brl ?? 0), 0)
  const nacionais = containers.filter(c => c.tipo === 'nacional')
  const importados = containers.filter(c => c.tipo === 'importado')

  const fmtDate = (iso: string | null) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  const contEls = containers.map((c, i) => {
    const fin = c.tipo === 'importado'
      ? `      <financeiro moeda_origem="USD">
        <valor_usd>${(c.valor_usd ?? 0).toFixed(2)}</valor_usd>
        <cotacao_dolar>${(c.cotacao ?? 0).toFixed(4)}</cotacao_dolar>
        <custos_extras_brl>${(c.extras_brl ?? 0).toFixed(2)}</custos_extras_brl>
        <valor_total_brl>${(c.valor_brl ?? 0).toFixed(2)}</valor_total_brl>
      </financeiro>`
      : `      <financeiro moeda_origem="BRL">
        <valor_compra_brl>${(c.valor_brl ?? 0).toFixed(2)}</valor_compra_brl>
      </financeiro>`

    return `    <container id="${c.id}" tipo="${c.tipo}" sequencia="${i + 1}">
      <numero iso6346_valido="${c.iso_valido}">${c.numero}</numero>
      <tamanho>${c.tamanho}</tamanho>
      <fornecedor>${c.fornecedor ?? ''}</fornecedor>
      <data_compra>${fmtDate(c.data_compra)}</data_compra>
${fin}
      <observacoes>${c.obs ?? ''}</observacoes>
    </container>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<inventario_containers xmlns:als="https://alslog.com.br/depot/schema" versao="1.0" gerado_em="${now}" sistema="ALS Depot Itajai">
  <resumo>
    <total_containers>${containers.length}</total_containers>
    <nacionais>${nacionais.length}</nacionais>
    <importados>${importados.length}</importados>
    <valor_total_brl>${total.toFixed(2)}</valor_total_brl>
  </resumo>
  <containers>
${contEls}
  </containers>
</inventario_containers>`
}

function highlight(xml: string) {
  return xml
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(&lt;\/?[\w:]+)/g, '<span style="color:#1B4F8A;font-weight:600">$1</span>')
    .replace(/(&gt;)/g, '<span style="color:#1B4F8A;font-weight:600">$1</span>')
    .replace(/([\w:]+)=/g, '<span style="color:#7c3aed">$1</span>=')
    .replace(/"([^"]*)"/g, '"<span style="color:#166534">$1</span>"')
    .replace(/(&lt;\?xml[^?]*\?&gt;)/g, '<span style="color:#6b7280">$1</span>')
}

export function ExportTab({ containers }: { containers: Container[] }) {
  const [xml, setXml] = useState<string | null>(null)

  function handleGenerate() { setXml(generateXML(containers)) }

  function handleDownload() {
    if (!xml) return
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `als_depot_${new Date().toISOString().slice(0, 10)}.xml`
    a.click(); URL.revokeObjectURL(url)
  }

  function handleCSV() {
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
    const a = document.createElement('a')
    a.href = url; a.download = `als_depot_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="bg-white rounded-lg p-6" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 className="font-bold text-base mb-4" style={{ color: '#1a2a3a' }}>Exportar Inventário</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleGenerate} disabled={containers.length === 0}
            className="px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-40 border transition-colors hover:bg-gray-50"
            style={{ borderColor: '#d1d5db', color: '#374151' }}>
            Gerar XML
          </button>
          {xml && (
            <button onClick={handleDownload}
              className="px-5 py-2.5 rounded text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: '#1B4F8A' }}>
              ⬇ Baixar XML
            </button>
          )}
          <button onClick={handleCSV} disabled={containers.length === 0}
            className="px-5 py-2.5 rounded text-sm font-bold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#7DC242' }}>
            ⬇ Exportar XLS/CSV
          </button>
        </div>
        {containers.length === 0 && (
          <p className="text-sm mt-3" style={{ color: '#9ca3af' }}>Nenhum container no inventário.</p>
        )}
      </div>

      {xml && (
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ background: '#f9fafb', borderColor: '#e5e7eb' }}>
            <span className="text-xs font-semibold" style={{ color: '#6b7280' }}>
              XML — {containers.length} containers
            </span>
            <button onClick={() => navigator.clipboard.writeText(xml)}
              className="text-xs font-semibold px-3 py-1 rounded border transition-colors hover:bg-gray-100"
              style={{ borderColor: '#d1d5db', color: '#374151' }}>
              Copiar
            </button>
          </div>
          <pre
            className="p-5 text-xs overflow-x-auto leading-relaxed"
            style={{ background: '#f8fafc', maxHeight: 500, color: '#374151' }}
            dangerouslySetInnerHTML={{ __html: highlight(xml) }}
          />
        </div>
      )}
    </div>
  )
}
