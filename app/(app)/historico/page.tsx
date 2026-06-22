import { getHistorico } from '@/app/actions'

export const dynamic = 'force-dynamic'

const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const hora = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

export default async function HistoricoPage() {
  const historico = await getHistorico(150)

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Histórico de checklists</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Checklists realizados e operações encerradas, com paradas, abastecimentos e consumo.</p>
      </div>

      {historico.length === 0 ? (
        <p className="text-sm" style={{ color: '#9ca3af' }}>Nenhum checklist registrado ainda.</p>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {historico.map(({ checklist: c, eventos }) => {
            const noks = (c.itens || []).filter(i => i.status === 'nok')
            const encerrada = c.status === 'encerrada'
            const horas = encerrada && c.horimetro != null && c.horimetro_final != null
              ? Math.round((c.horimetro_final - c.horimetro) * 100) / 100
              : null
            return (
              <div key={c.id} className="bg-white rounded-lg p-4" style={{ border: '1px solid #e5e7eb' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>{c.equipamento} · {c.operador}</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>{dataHora(c.created_at)} · {c.turno}</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={encerrada ? { background: '#eef2ff', color: '#4338ca' } : { background: '#ecfdf5', color: '#047857' }}>
                    {encerrada ? 'encerrada' : 'aberta'}
                  </span>
                </div>

                <p className="text-xs mt-2" style={{ color: '#6b7280' }}>
                  Horímetro: <strong style={{ color: '#1a2a3a' }}>{c.horimetro ?? '—'}</strong>
                  {c.horimetro_final != null && <> → <strong style={{ color: '#1a2a3a' }}>{c.horimetro_final}</strong></>}
                  {horas != null && <> · <strong style={{ color: '#1a2a3a' }}>{horas}h</strong> trabalhadas</>}
                </p>

                {noks.length > 0 && (
                  <ul className="mt-2 text-xs" style={{ color: '#b91c1c' }}>
                    {noks.map((i, idx) => (
                      <li key={idx}>
                        • {i.item}{i.obs ? ` — ${i.obs}` : ''}
                        {i.foto && <a href={i.foto} target="_blank" rel="noopener noreferrer" className="ml-1 underline font-semibold">ver foto</a>}
                      </li>
                    ))}
                  </ul>
                )}

                {eventos.length > 0 && (
                  <ul className="mt-2 text-xs space-y-0.5" style={{ color: '#6b7280' }}>
                    {eventos.map(e => (
                      <li key={e.id}>
                        • {hora(e.created_at)} — {e.tipo}{e.motivo ? ` (${e.motivo})` : ''}
                        {e.horimetro != null ? ` · ${e.horimetro}h` : ''}
                        {e.litros != null && <span style={{ color: '#9a3412' }}> · ⛽ {e.litros}L{e.consumo_lh != null ? ` · ${e.consumo_lh} L/h` : ''}</span>}
                      </li>
                    ))}
                  </ul>
                )}

                {c.observacoes && <p className="mt-2 text-xs" style={{ color: '#6b7280' }}>Obs: {c.observacoes}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
