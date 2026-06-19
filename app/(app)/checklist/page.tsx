import { getChecklists } from '@/app/actions'
import { ChecklistForm } from '@/components/ChecklistForm'

export const dynamic = 'force-dynamic'

export default async function ChecklistPage() {
  const checklists = await getChecklists(20)

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Checklist — Empilhadeira de grande porte</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Inspeção pré-operação. Marque cada item e registre.</p>
      </div>

      <ChecklistForm />

      <div className="max-w-3xl mt-8">
        <h2 className="text-sm font-bold mb-3" style={{ color: '#1a2a3a' }}>Últimos registros</h2>
        {checklists.length === 0 ? (
          <p className="text-sm" style={{ color: '#9ca3af' }}>Nenhum checklist registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {checklists.map(c => {
              const noks = (c.itens || []).filter(i => i.status === 'nok')
              return (
                <div key={c.id} className="bg-white rounded-lg p-4" style={{ border: '1px solid #e5e7eb' }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#1a2a3a' }}>{c.equipamento} · {c.operador}</p>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>
                        {new Date(c.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · {c.turno}
                        {c.horimetro != null ? ` · ${c.horimetro}h` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={c.tem_pendencia ? { background: '#fef2f2', color: '#b91c1c' } : { background: '#ecfdf5', color: '#047857' }}>
                      {c.tem_pendencia ? `${noks.length} pendência(s)` : 'Sem pendência'}
                    </span>
                  </div>
                  {noks.length > 0 && (
                    <ul className="mt-2 text-xs" style={{ color: '#b91c1c' }}>
                      {noks.map((i, idx) => <li key={idx}>• {i.item}{i.obs ? ` — ${i.obs}` : ''}</li>)}
                    </ul>
                  )}
                  {c.observacoes && <p className="mt-2 text-xs" style={{ color: '#6b7280' }}>Obs: {c.observacoes}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
