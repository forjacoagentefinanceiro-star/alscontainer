'use client'

import { useState, useTransition } from 'react'
import { testarAlertaTelegram } from '@/app/actions'

export function TestarTelegramButton() {
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; txt: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function testar() {
    setMsg(null)
    startTransition(async () => {
      const res = await testarAlertaTelegram()
      if (res.error) setMsg({ tipo: 'erro', txt: res.error })
      else setMsg({ tipo: 'ok', txt: '✓ Mensagem enviada! Confira o Telegram.' })
    })
  }

  return (
    <div className="bg-white rounded-xl mb-5 max-w-2xl p-4 flex items-center gap-3 flex-wrap" style={{ border: '1px solid #e5e7eb' }}>
      <button onClick={testar} disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#229ED9' }}>
        {isPending ? 'Enviando…' : '📲 Testar alerta Telegram'}
      </button>
      <span className="text-xs" style={{ color: '#6b7280' }}>Envia uma mensagem de teste para o chat configurado.</span>
      {msg && (
        <p className="text-sm w-full px-3 py-2 rounded" style={{ background: msg.tipo === 'ok' ? '#ecfdf5' : '#fef2f2', color: msg.tipo === 'ok' ? '#047857' : '#b91c1c' }}>
          {msg.txt}
        </p>
      )}
    </div>
  )
}
