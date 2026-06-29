'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Checklist, OperacaoEvento } from '@/app/actions'
import { addEvento, encerrarOperacao, updateChecklistHorimetro, reportarProblema } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import { ProblemaTratativa } from '@/components/ProblemaTratativa'
import { HorimetroInput } from '@/components/HorimetroInput'
import { EventoEditor } from '@/components/EventoEditor'

type Op = { checklist: Checklist; eventos: OperacaoEvento[] }
type Tipo = 'parada' | 'retorno' | 'encerramento'
type UiTipo = Tipo | 'abastecimento' | 'problema'

export function OperacoesAbertas({ operacoes, podeEditar = false }: { operacoes: Op[]; podeEditar?: boolean }) {
  const [list, setList] = useState(operacoes)
  const [acao, setAcao] = useState<{ id: string; tipo: UiTipo } | null>(null)
  const [horim, setHorim] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')
  const [litros, setLitros] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [edit, setEdit] = useState<{ kind: 'inicial'; id: string } | null>(null)
  const [editVal, setEditVal] = useState<number | null>(null)
  const [confirmRetorno, setConfirmRetorno] = useState<{ id: string; h: number; paradaH: number; litros: number | null } | null>(null)
  const [descricaoProblema, setDescricaoProblema] = useState('')
  const [parado, setParado] = useState<boolean | null>(null)
  const [fotosProblema, setFotosProblema] = useState<string[]>([])
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // re-sincroniza com o servidor (LiveRefresh) — pega lançamentos feitos por outro usuário
  useEffect(() => { setList(operacoes) }, [operacoes])

  async function enviarFotoProblema(file: File | undefined) {
    if (!file) return
    setUploadingFoto(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('checklist-fotos').upload(path, file, { upsert: false })
    if (error) setErro('Erro ao enviar foto: ' + error.message)
    else {
      const { data } = supabase.storage.from('checklist-fotos').getPublicUrl(path)
      setFotosProblema(prev => [...prev, data.publicUrl])
    }
    setUploadingFoto(false)
  }

  const hora = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const num = (v: string) => (v.trim() === '' ? null : parseFloat(v.replace(',', '.')))

  function executar(id: string, tipo: Tipo, h: number | null, motivoTxt: string, usoSemChecklist: boolean, abastecimento = false, litrosVal: number | null = null) {
    startTransition(async () => {
      if (tipo === 'encerramento') {
        const res = await encerrarOperacao(id, h)
        if (res.error) setErro(res.error)
        else { setList(prev => prev.filter(o => o.checklist.id !== id)); setAcao(null); router.refresh() }
      } else {
        const res = await addEvento(id, tipo, h, motivoTxt, usoSemChecklist, abastecimento, litrosVal)
        if (res.error) setErro(res.error)
        else {
          setList(prev => prev.map(o => o.checklist.id === id
            ? { ...o, eventos: [...o.eventos, { id: crypto.randomUUID(), checklist_id: id, tipo, motivo: motivoTxt || null, horimetro: h, origem: 'app', abastecimento, litros: litrosVal, consumo_lh: null, created_at: new Date().toISOString() }] }
            : o))
          setAcao(null)
          router.refresh()
        }
      }
    })
  }

  function confirmarProblema() {
    if (!acao) return
    setErro(null)
    const h = horim
    if (!descricaoProblema.trim()) { setErro('Descreva o problema.'); return }
    if (parado == null) { setErro('Indique se o equipamento está parado por causa do problema.'); return }
    if (h == null) { setErro('Informe o horímetro.'); return }
    const { id } = acao
    startTransition(async () => {
      const res = await reportarProblema(id, descricaoProblema, parado, fotosProblema, h)
      if (res.error) { setErro(res.error); return }
      setList(prev => prev.map(o => o.checklist.id === id
        ? { ...o, eventos: [...o.eventos, { id: crypto.randomUUID(), checklist_id: id, tipo: 'problema', motivo: null, horimetro: h, origem: 'app', descricao: descricaoProblema.trim(), parado, fotos: fotosProblema, resolvido: false, created_at: new Date().toISOString() }] }
        : o))
      setAcao(null)
      router.refresh()
    })
  }

  function confirmar() {
    if (!acao) return
    setErro(null)
    if (acao.tipo === 'problema') { confirmarProblema(); return }
    const h = horim
    const { id, tipo } = acao
    const op = list.find(o => o.checklist.id === id)
    const ultimoEv = op?.eventos[op.eventos.length - 1]
    const aguardandoAbastecimento = ultimoEv?.tipo === 'parada' && !!ultimoEv?.abastecimento

    if (tipo === 'abastecimento') { executar(id, 'parada', h, 'Abastecimento', false, true, null); return }

    if (tipo === 'retorno') {
      let litrosVal: number | null = null
      if (aguardandoAbastecimento) {
        litrosVal = num(litros)
        if (litrosVal == null || litrosVal <= 0) { setErro('Informe os litros abastecidos.'); return }
      }
      // retorno com horímetro diferente da última parada → confirmar (máquina usada na parada)
      const ultimaParada = [...(op?.eventos ?? [])].reverse().find(e => e.tipo === 'parada' && e.horimetro != null)
      if (h != null && ultimaParada && h !== Number(ultimaParada.horimetro)) {
        setConfirmRetorno({ id, h, paradaH: Number(ultimaParada.horimetro), litros: litrosVal })
        return
      }
      executar(id, 'retorno', h, '', false, false, litrosVal)
      return
    }

    executar(id, tipo, h, motivo, false)
  }

  function salvarEdit() {
    if (!edit) return
    setErro(null)
    const v = editVal
    const { id } = edit
    startTransition(async () => {
      const res = await updateChecklistHorimetro(id, 'horimetro', v)
      if (res.error) { setErro(res.error); return }
      setList(prev => prev.map(o => o.checklist.id === id ? { ...o, checklist: { ...o.checklist, horimetro: v } } : o))
      setEdit(null)
      router.refresh()
    })
  }

  function abrirEdit(id: string, atual: number | null) {
    setEdit({ kind: 'inicial', id }); setEditVal(atual); setErro(null)
  }

  if (!list.length) return null

  const editInput = (
    <span className="inline-flex items-center gap-1.5">
      <HorimetroInput key={`${edit?.kind}-${edit?.id}`} value={editVal} onChange={setEditVal} placeholder="0.0" autoFocus
        className="rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: '#1B4F8A', color: '#1a2a3a', width: 90 }} />
      <button onClick={salvarEdit} disabled={isPending} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border text-white disabled:opacity-50" style={{ background: '#047857', borderColor: '#047857' }}>Salvar</button>
      <button onClick={() => setEdit(null)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: '#6b7280', borderColor: '#e5e7eb' }}>Cancelar</button>
    </span>
  )

  return (
    <div className="max-w-3xl mb-6">
      {confirmRetorno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center" style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <div className="text-4xl mb-2">⚠️</div>
            <h3 className="text-lg font-bold" style={{ color: '#b45309' }}>Horímetro diferente da parada</h3>
            <p className="text-sm mt-2" style={{ color: '#6b7280' }}>
              O retorno (<strong>{confirmRetorno.h}h</strong>) é diferente da parada (<strong>{confirmRetorno.paradaH}h</strong>).
              Isso indica que a máquina <strong>foi usada durante a parada, sem checklist</strong>. O horímetro está correto?
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={() => { const c = confirmRetorno; setConfirmRetorno(null); executar(c.id, 'retorno', c.h, '', true, false, c.litros) }} disabled={isPending}
                className="w-full py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#b45309' }}>
                Sim, está correto (avisar o admin)
              </button>
              <button onClick={() => setConfirmRetorno(null)} className="w-full py-2 rounded-lg text-sm font-semibold" style={{ color: '#6b7280' }}>
                Não, corrigir o valor
              </button>
            </div>
          </div>
        </div>
      )}
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1a2a3a' }}>Operações em andamento</h2>
      {erro && <p className="text-sm mb-3 px-3 py-2 rounded" style={{ background: '#fef2f2', color: '#b91c1c' }}>{erro}</p>}
      <div className="space-y-3">
        {list.map(({ checklist: c, eventos }) => (
          <div key={c.id} className="bg-white rounded-lg p-4" style={{ border: '1px solid #e5e7eb' }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-medium" style={{ color: '#1a2a3a' }}>
                  <span className="font-mono" style={{ color: '#1B4F8A' }}>#{c.numero}</span> · {c.equipamento} · {c.operador}
                </p>
                <p className="text-xs flex items-center gap-1" style={{ color: '#9ca3af' }}>
                  aberta {dataHora(c.created_at)} · horímetro inicial{' '}
                  {edit?.kind === 'inicial' && edit.id === c.id ? editInput : (
                    <>
                      <strong style={{ color: '#1a2a3a' }}>{c.horimetro ?? '—'}</strong>
                      {podeEditar && <button onClick={() => abrirEdit(c.id, c.horimetro)} className="text-xs font-semibold px-2 py-1 rounded-lg border" style={{ color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}>Editar</button>}
                    </>
                  )}
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: '#ecfdf5', color: '#047857' }}>aberta</span>
            </div>

            {eventos.length > 0 && (
              <ul className="mt-2 text-xs space-y-1" style={{ color: '#6b7280' }}>
                {eventos.map(e => e.tipo === 'problema' ? (
                  <li key={e.id} className="py-2" style={{ borderTop: '1px dashed #fecaca', borderBottom: '1px dashed #fecaca' }}>
                    <div className="flex items-start gap-1 flex-wrap">
                      <span style={{ color: '#b91c1c' }}>⚠️ {hora(e.created_at)} — problema reportado:</span>
                      <span>{e.descricao}</span>
                      <span className="font-semibold" style={{ color: e.parado ? '#b91c1c' : '#92400e' }}>
                        {e.parado ? '· máquina parada' : '· operando normalmente'}
                      </span>
                      <EventoEditor evento={e} podeEditar={podeEditar} prefixo={false} permitirExcluir={false}
                        onDeleted={() => setList(prev => prev.map(o => o.checklist.id === c.id ? { ...o, eventos: o.eventos.filter(x => x.id !== e.id) } : o))} />
                      {(e.fotos ?? []).map((f, i) => (
                        <a key={i} href={f} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#1d4ed8' }}>foto{(e.fotos?.length ?? 0) > 1 ? ` ${i + 1}` : ''}</a>
                      ))}
                    </div>
                    <ProblemaTratativa evento={e} podeAcionar={podeEditar} />
                  </li>
                ) : (
                  <EventoEditor key={e.id} evento={e} podeEditar={podeEditar} onDeleted={() => setList(prev => prev.map(o => o.checklist.id === c.id ? { ...o, eventos: o.eventos.filter(x => x.id !== e.id) } : o))} />
                ))}
              </ul>
            )}

            {acao?.id === c.id && acao.tipo === 'problema' ? (
              <div className="mt-3 p-3 rounded-lg space-y-2" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                <textarea value={descricaoProblema} onChange={e => setDescricaoProblema(e.target.value)} placeholder="Descreva o problema" rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: '#fecaca', color: '#1a2a3a' }} />
                <div className="flex items-center gap-2 flex-wrap">
                  <HorimetroInput key={`problema-${c.id}`} value={horim} onChange={setHorim} placeholder="Horímetro"
                    className="rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: '#d1d5db', color: '#1a2a3a', width: 130 }} />
                  <span className="text-xs font-medium" style={{ color: '#6b7280' }}>Equipamento parado?</span>
                  <button onClick={() => setParado(true)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                    style={{ background: parado === true ? '#b91c1c' : '#fff', color: parado === true ? '#fff' : '#b91c1c', borderColor: '#fecaca' }}>Sim, parada</button>
                  <button onClick={() => setParado(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                    style={{ background: parado === false ? '#92400e' : '#fff', color: parado === false ? '#fff' : '#92400e', borderColor: '#fde68a' }}>Não, operando</button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {fotosProblema.map((f, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={f} alt="foto do problema" className="h-16 w-16 rounded-lg object-cover" style={{ border: '1px solid #fecaca' }} />
                  ))}
                  <label className="text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer" style={{ background: '#fff', border: '1px dashed #f87171', color: '#b91c1c' }}>
                    {uploadingFoto ? 'Enviando…' : '📷 Adicionar foto'}
                    <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploadingFoto} onChange={e => enviarFotoProblema(e.target.files?.[0])} />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={confirmar} disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#b91c1c' }}>
                    Reportar problema
                  </button>
                  <button onClick={() => { setAcao(null); setErro(null) }} className="px-3 py-2 rounded-lg text-sm" style={{ color: '#6b7280' }}>Cancelar</button>
                </div>
              </div>
            ) : acao?.id === c.id ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <HorimetroInput key={`${c.id}-${acao.tipo}`} value={horim} onChange={setHorim} placeholder="Horímetro" autoFocus
                  className="rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: '#d1d5db', color: '#1a2a3a', width: 130 }} />
                {acao.tipo === 'parada' && (
                  <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo (ex.: almoço)"
                    className="rounded-lg border px-3 py-2 text-sm outline-none flex-1" style={{ borderColor: '#d1d5db', color: '#1a2a3a' }} />
                )}
                {acao.tipo === 'retorno' && eventos[eventos.length - 1]?.tipo === 'parada' && eventos[eventos.length - 1]?.abastecimento && (
                  <input value={litros} onChange={e => setLitros(e.target.value)} placeholder="Litros abastecidos" inputMode="decimal"
                    className="rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: '#fdba74', color: '#1a2a3a', width: 160 }} />
                )}
                <button onClick={confirmar} disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#1B4F8A' }}>
                  Confirmar {acao.tipo === 'encerramento' ? 'encerramento' : acao.tipo}
                </button>
                <button onClick={() => { setAcao(null); setErro(null) }} className="px-3 py-2 rounded-lg text-sm" style={{ color: '#6b7280' }}>Cancelar</button>
              </div>
            ) : (
              <div className="mt-3 flex gap-2 flex-wrap">
                <button onClick={() => { setAcao({ id: c.id, tipo: 'parada' }); setHorim(null); setMotivo(''); setLitros(''); setErro(null) }} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: '#fde68a', color: '#92400e', background: '#fffbeb' }}>Parada</button>
                <button onClick={() => { setAcao({ id: c.id, tipo: 'abastecimento' }); setHorim(null); setMotivo(''); setLitros(''); setErro(null) }} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: '#fdba74', color: '#9a3412', background: '#fff7ed' }}>⛽ Abastecimento</button>
                <button onClick={() => { setAcao({ id: c.id, tipo: 'retorno' }); setHorim(null); setMotivo(''); setLitros(''); setErro(null) }} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: '#bfdbfe', color: '#1d4ed8', background: '#eff6ff' }}>Retorno</button>
                <button onClick={() => { setAcao({ id: c.id, tipo: 'problema' }); setHorim(null); setDescricaoProblema(''); setParado(null); setFotosProblema([]); setErro(null) }} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: '#fecaca', color: '#b91c1c', background: '#fef2f2' }}>⚠️ Reportar problema</button>
                <button onClick={() => { setAcao({ id: c.id, tipo: 'encerramento' }); setHorim(null); setMotivo(''); setLitros(''); setErro(null) }} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: '#fecaca', color: '#b91c1c', background: '#fef2f2' }}>Encerrar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
