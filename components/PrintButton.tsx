'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: '#1B4F8A' }}
    >
      🖨 Imprimir / Salvar PDF
    </button>
  )
}
