const DESPACHA_APP_URL = 'https://despachaapp.com.br'

// Aviso simples (read-only): apenas sinaliza que entraram novas solicitações
// via QR Code. A tratativa é feita no próprio DespachaApp.
export function AlertaTarefas({ novas, titulos }: { novas: number; titulos: string[] }) {
  if (!novas) return null

  return (
    <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '2px solid #dc2626', background: '#fef2f2', boxShadow: '0 0 0 3px rgba(220,38,38,0.15)' }}>
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: '#dc2626' }}>
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          <span className="text-lg">📋</span>
          {novas} nova(s) solicitação(ões) via QR Code — trate no DespachaApp
        </span>
        <a
          href={DESPACHA_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white whitespace-nowrap"
          style={{ color: '#b91c1c' }}
        >
          Abrir DespachaApp →
        </a>
      </div>
      {titulos.length > 0 && (
        <div className="px-4 py-3">
          <ul className="space-y-1">
            {titulos.map((t, i) => (
              <li key={i} className="text-xs" style={{ color: '#374151' }}>• {t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
