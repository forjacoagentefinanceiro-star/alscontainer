'use client'

import { useState } from 'react'

// máscara tipo "dinheiro": o operador só digita números, o ponto decimal (1 casa) entra sozinho.
// Evita o erro clássico de digitar "134695" pensando em 13469,5h e gravar um valor 10x maior.
function digitsToDisplay(digits: string): string {
  if (!digits) return ''
  const n = digits.replace(/^0+(?=\d)/, '')
  if (n.length <= 1) return `0.${n.padStart(1, '0')}`
  return `${n.slice(0, -1)}.${n.slice(-1)}`
}

function valueToDigits(value: number | null | undefined): string {
  if (value == null) return ''
  return String(Math.round(value * 10))
}

export function HorimetroInput({
  value, onChange, placeholder = 'Horímetro', autoFocus, className, style,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const [digits, setDigits] = useState(() => valueToDigits(value))

  function handleChange(raw: string) {
    const onlyDigits = raw.replace(/\D/g, '')
    setDigits(onlyDigits)
    if (!onlyDigits) { onChange(null); return }
    const n = Number(digitsToDisplay(onlyDigits))
    onChange(Number.isFinite(n) ? n : null)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      value={digitsToDisplay(digits)}
      onChange={e => handleChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      style={style}
    />
  )
}
