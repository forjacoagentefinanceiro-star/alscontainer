import { logout } from '@/app/actions'

export default function AguardandoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f0f2f5' }}>
      <div className="w-full max-w-sm text-center">
        <div className="inline-block rounded-xl overflow-hidden mb-6"
          style={{ background: '#1B4F8A', boxShadow: '0 4px 24px rgba(27,79,138,0.3)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ALS" style={{ width: 200, height: 'auto', display: 'block' }} />
        </div>

        <div className="bg-white rounded-xl p-8" style={{ border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="text-4xl mb-4">⏳</div>
          <h1 className="text-lg font-bold mb-2" style={{ color: '#1a2a3a' }}>Cadastro em análise</h1>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            Seu acesso está aguardando aprovação do administrador.
            Você será notificado assim que seu cadastro for liberado.
          </p>
          <form action={logout}>
            <button type="submit"
              className="w-full rounded py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
              Sair
            </button>
          </form>
        </div>

        <p className="text-xs mt-4" style={{ color: '#9ca3af' }}>
          ALS Logística · Sistema interno
        </p>
      </div>
    </div>
  )
}
