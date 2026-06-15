const LETTER_VALUES: Record<string, number> = (() => {
  const m: Record<string, number> = {}
  let v = 10
  for (let i = 0; i < 26; i++) {
    m[String.fromCharCode(65 + i)] = v++
    if (v % 11 === 0) v++
  }
  return m
})()

export function checkDigit(owner3: string, cat: string, ser6: string): number {
  const s = owner3 + cat + ser6.padStart(6, '0')
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const c = s[i]
    const v = isNaN(Number(c)) ? LETTER_VALUES[c] : parseInt(c)
    sum += v * Math.pow(2, i)
  }
  const cd = sum % 11
  return cd === 10 ? 0 : cd
}

export function makeContainerNumber(owner3: string, cat: string, serial: number): string {
  const ser = serial.toString().padStart(6, '0')
  const cd = checkDigit(owner3, cat, ser)
  return `${owner3}${cat} ${ser} ${cd}`
}
