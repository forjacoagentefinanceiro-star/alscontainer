'use client'

export function ExportarCsvButton({ filename, headers, rows }: { filename: string; headers: string[]; rows: (string | number)[][] }) {
  function exportar() {
    const esc = (v: string | number) => {
      const s = String(v ?? '')
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={exportar} className="text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: '#cbd5e1', color: '#475569', background: '#fff' }}>
      ⬇ Exportar CSV
    </button>
  )
}
