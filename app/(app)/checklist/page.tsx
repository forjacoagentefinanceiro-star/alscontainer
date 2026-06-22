import Link from 'next/link'
import { getChecklists, getMyProfile, getEmpilhadeiras, getOperacoesAbertas } from '@/app/actions'
import { ChecklistForm } from '@/components/ChecklistForm'
import { OperacoesAbertas } from '@/components/OperacoesAbertas'

export const dynamic = 'force-dynamic'

export default async function ChecklistPage() {
  const [checklists, profile, empilhadeiras, operacoes] = await Promise.all([getChecklists(20), getMyProfile(), getEmpilhadeiras(), getOperacoesAbertas()])
  const podeGerenciar = profile?.role === 'admin' || profile?.role === 'editor'
  const operadorPadrao = profile?.name || profile?.email || ''

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Checklist — Empilhadeira de grande porte</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Inspeção pré-operação. Marque cada item e registre.</p>
      </div>

      {podeGerenciar && empilhadeiras.length === 0 && (
        <div className="max-w-3xl mb-4 text-sm px-4 py-3 rounded-lg" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
          Nenhuma empilhadeira cadastrada. <Link href="/cadastros" className="font-semibold underline">Cadastre em Cadastros →</Link>
        </div>
      )}

      <OperacoesAbertas operacoes={operacoes} podeEditar={podeGerenciar} />

      <ChecklistForm operadorPadrao={operadorPadrao} empilhadeiras={empilhadeiras.map(e => e.nome)} />

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
                      {noks.map((i, idx) => (
                        <li key={idx}>
                          • {i.item}{i.obs ? ` — ${i.obs}` : ''}
                          {i.foto && <a href={i.foto} target="_blank" rel="noopener noreferrer" className="ml-1 underline font-semibold">ver foto</a>}
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
    </div>
  )
}
