'use client'

import { useMemo, useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { addChecklist, type ChecklistItem } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import { HorimetroInput } from '@/components/HorimetroInput'

// Mapeia nome da empilhadeira → chave de maquina na tabela telemetria_maquinas
function nomeParaMaquina(nome: string): string | null {
  const n = nome.toUpperCase()
  if (n.includes('FERRARI')) return 'ferrari'
  if (n.includes('KONE'))    return 'kone'
  if (n.includes('LINDE'))   return 'linde'
  return null
}

type TelemetriaStatus = 'carregando' | 'ativo' | 'atrasado' | 'sem_dados' | 'sem_gps'

const ITENS = [
  'Nível de óleo do motor',
  'Nível de óleo hidráulico',
  'Nível de arrefecimento (água)',
  'Combustível / carga da bateria',
  'Vazamentos (óleo / hidráulico / combustível)',
  'Pneus (calibragem, desgaste, danos)',
  'Freios (serviço e estacionamento)',
  'Direção',
  'Buzina e alarme de ré',
  'Faróis, luzes e giroflex',
  'Espelhos retrovisores',
  'Cinto de segurança',
  'Garfos / spreader (travas e condição)',
  'Mastro, correntes e mangueiras hidráulicas',
  'Sistema de elevação / inclinação',
  'Extintor e limpeza da cabine',
]

type St = 'ok' | 'nok' | 'na'
const OPCOES: { v: St; label: string; on: string }[] = [
  { v: 'ok', label: 'OK', on: '#16a34a' },
  { v: 'nok', label: 'Não OK', on: '#dc2626' },
  { v: 'na', label: 'N/A', on: '#6b7280' },
]

export function ChecklistForm({ operadorPadrao = '', empilhadeiras = [] }: { operadorPadrao?: string; empilhadeiras?: string[] }) {
  const [operador, setOperador] = useState(operadorPadrao)
  const [equipamento, setEquipamento] = useState('')
  const [horimetro, setHorimetro] = useState<number | null>(null)
  const [horimKey, setHorimKey] = useState(0)
  const [status, setStatus] = useState<Record<string, St>>(() => Object.fromEntries(ITENS.map(i => [i, 'ok'])))
  const [obs, setObs] = useState<Record<string, string>>({})
  const [fotos, setFotos] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [observacoes, setObservacoes] = useState('')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; txt: string } | null>(null)
  const [confirmarParada, setConfirmarParada] = useState(false)
  const [isPending, startTransition] = useTransition()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [telStatus, setTelStatus] = useState<TelemetriaStatus | null>(null)
  const [telUltima, setTelUltima] = useState<string | null>(null)

  const verificarTelemetria = useCallback(async (nome: string) => {
    const maquina = nomeParaMaquina(nome)
    if (!maquina) { setTelStatus(null); return }
    setTelStatus('carregando')
    const sb = createClient()
    const { data } = await sb
      .from('telemetria_maquinas')
      .select('created_at, latitude')
      .eq('maquina', maquina)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) { setTelStatus('sem_dados'); setTelUltima(null); return }
    if (!data.latitude) { setTelStatus('sem_gps'); setTelUltima(null); return }
    const minutos = (Date.now() - new Date(data.created_at).getTime()) / 60000
    setTelUltima(new Date(data.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))
    setTelStatus(minutos <= 65 ? 'ativo' : 'atrasado')
  }, [])

  useEffect(() => {
    if (!equipamento) { setTelStatus(null); setTelUltima(null); return }
    verificarTelemetria(equipamento)
  }, [equipamento, verificarTelemetria])

  const pendencias = ITENS.filter(i => status[i] === 'nok').length

  function marcar(item: string, v: St) {
    setStatus(p => ({ ...p, [item]: v }))
  }

  async function enviarFoto(item: string, file: File | undefined) {
    if (!file) return
    setUploading(p => ({ ...p, [item]: true }))
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('checklist-fotos').upload(path, file, { upsert: false })
    if (error) setMsg({ tipo: 'erro', txt: 'Erro ao enviar foto: ' + error.message })
    else {
      const { data } = supabase.storage.from('checklist-fotos').getPublicUrl(path)
      setFotos(p => ({ ...p, [item]: data.publicUrl }))
    }
    setUploading(p => ({ ...p, [item]: false }))
  }

  function validar(): boolean {
    if (!operador.trim() || !equipamento.trim()) {
      setMsg({ tipo: 'erro', txt: 'Preencha o operador e o equipamento.' })
      return false
    }
    const semFoto = ITENS.filter(i => status[i] === 'nok' && !fotos[i])
    if (semFoto.length) {
      setMsg({ tipo: 'erro', txt: `Anexe a foto do(s) item(ns) em desacordo: ${semFoto.join(', ')}` })
      return false
    }
    return true
  }

  function salvar() {
    if (!validar()) return
    if (pendencias > 0) { setMsg(null); setConfirmarParada(true); return }
    enviar(null)
  }

  function enviar(parado: boolean | null) {
    setConfirmarParada(false)
    const itens: ChecklistItem[] = ITENS.map(item => ({ item, status: status[item], obs: obs[item]?.trim() || undefined, foto: fotos[item] || undefined }))
    startTransition(async () => {
      const res = await addChecklist({
        operador: operador.trim(),
        equipamento: equipamento.trim(),
        horimetro,
        itens,
        observacoes: observacoes.trim(),
        parado,
      })
      if (res.error) setMsg({ tipo: 'erro', txt: 'Erro ao salvar: ' + res.error })
      else {
        setMsg({ tipo: 'ok', txt: '✓ Checklist registrado com sucesso!' })
        setStatus(Object.fromEntries(ITENS.map(i => [i, 'ok'])))
        setObs({})
        setFotos({})
        setObservacoes('')
        setHorimetro(null)
        setHorimKey(k => k + 1)
        router.refresh()
      }
    })
  }

  const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none'
  const inputStyle = { borderColor: '#d1d5db', color: '#1a2a3a' } as const

  return (
    <>
    {confirmarParada && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center" style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
          <div className="text-4xl mb-2">⚠️</div>
          <h3 className="text-lg font-bold" style={{ color: '#b91c1c' }}>Item(ns) em desacordo</h3>
          <p className="text-sm mt-2" style={{ color: '#6b7280' }}>
            O equipamento vai ficar <strong>parado</strong> aguardando manutenção, ou vai <strong>operar</strong> aguardando manutenção?
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button onClick={() => enviar(true)} disabled={isPending}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#b91c1c' }}>
              Vai ficar parado
            </button>
            <button onClick={() => enviar(false)} disabled={isPending}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#92400e' }}>
              Vai operar aguardando manutenção
            </button>
            <button onClick={() => setConfirmarParada(false)} className="w-full py-2 rounded-lg text-sm font-semibold" style={{ color: '#6b7280' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="bg-white rounded-xl max-w-3xl" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {/* Cabeçalho */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
        <div>
          <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Operador *</label>
          <input className={inputCls} style={inputStyle} value={operador} onChange={e => setOperador(e.target.value)} placeholder="Nome do operador" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Equipamento *</label>
          {empilhadeiras.length ? (
            <select className={inputCls} style={inputStyle} value={equipamento} onChange={e => setEquipamento(e.target.value)}>
              <option value="">Selecione o equipamento…</option>
              {empilhadeiras.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          ) : (
            <input className={inputCls} style={inputStyle} value={equipamento} onChange={e => setEquipamento(e.target.value)} placeholder="Nº / placa da empilhadeira" />
          )}
          {/* Banner de telemetria */}
          {telStatus === 'carregando' && (
            <p className="mt-1.5 text-xs" style={{ color: '#9ca3af' }}>⏳ Verificando telemetria…</p>
          )}
          {telStatus === 'ativo' && (
            <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#15803d' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0, display: 'inline-block' }} />
              Telemetria ativa · última posição: {telUltima}
            </div>
          )}
          {telStatus === 'atrasado' && (
            <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', flexShrink: 0, display: 'inline-block' }} />
              Telemetria atrasada · última posição: {telUltima} — verifique se o app está rodando no tablet
            </div>
          )}
          {telStatus === 'sem_dados' && (
            <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', flexShrink: 0, display: 'inline-block' }} />
              Sem dados de telemetria — app não está rodando neste equipamento
            </div>
          )}
          {telStatus === 'sem_gps' && (
            <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#f3f4f6', border: '1px solid #d1d5db', color: '#6b7280' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9ca3af', flexShrink: 0, display: 'inline-block' }} />
              GPS sem sinal na última leitura
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Horímetro</label>
          <HorimetroInput key={horimKey} className={inputCls} style={inputStyle} value={horimetro} onChange={setHorimetro} placeholder="ex.: 12345.0" />
        </div>
      </div>

      {/* Itens */}
      <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
        {ITENS.map(item => (
          <div key={item} className="px-4 py-3">
            <span className="text-sm font-medium block mb-2" style={{ color: '#1a2a3a' }}>{item}</span>
            <div className="grid grid-cols-3 gap-2">
              {OPCOES.map(op => {
                const active = status[item] === op.v
                return (
                  <button key={op.v} type="button" onClick={() => marcar(item, op.v)}
                    className="py-3 rounded-lg text-sm font-semibold border transition-colors active:scale-95"
                    style={{
                      background: active ? op.on : '#fff',
                      color: active ? '#fff' : '#6b7280',
                      borderColor: active ? op.on : '#d1d5db',
                    }}>
                    {op.label}
                  </button>
                )
              })}
            </div>
            {status[item] === 'nok' && (
              <div className="mt-2 space-y-2 p-3 rounded-lg" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                <input className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#fecaca', color: '#1a2a3a' }}
                  value={obs[item] || ''} onChange={e => setObs(p => ({ ...p, [item]: e.target.value }))}
                  placeholder="Descreva o problema" />
                {fotos[item] ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotos[item]} alt="foto do item" className="h-20 w-20 rounded-lg object-cover" style={{ border: '1px solid #fecaca' }} />
                    <label className="text-xs font-semibold cursor-pointer" style={{ color: '#1d4ed8' }}>
                      trocar foto
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => enviarFoto(item, e.target.files?.[0])} />
                    </label>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-semibold cursor-pointer"
                    style={{ background: '#fff', border: '1px dashed #f87171', color: '#b91c1c' }}>
                    {uploading[item] ? 'Enviando foto…' : '📷 Anexar foto (obrigatória)'}
                    <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploading[item]} onChange={e => enviarFoto(item, e.target.files?.[0])} />
                  </label>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Observações + salvar */}
      <div className="p-5" style={{ borderTop: '1px solid #f3f4f6' }}>
        <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Observações gerais</label>
        <textarea className={inputCls} style={inputStyle} rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />

        {msg && (
          <p className="text-sm mt-3 px-3 py-2 rounded"
            style={{ background: msg.tipo === 'ok' ? '#ecfdf5' : '#fef2f2', color: msg.tipo === 'ok' ? '#047857' : '#b91c1c' }}>
            {msg.txt}
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 gap-3">
          <span className="text-xs" style={{ color: pendencias ? '#b91c1c' : '#047857' }}>
            {pendencias ? `${pendencias} item(ns) marcado(s) como "Não OK"` : 'Nenhuma pendência marcada'}
          </span>
          <button onClick={salvar} disabled={isPending}
            className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-semibold text-white transition-colors active:scale-95 disabled:opacity-50"
            style={{ background: '#1B4F8A' }}>
            {isPending ? 'Salvando…' : 'Registrar checklist'}
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
