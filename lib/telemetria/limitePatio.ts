export type Ponto = [number, number] // [latitude, longitude]

// Contorno do terreno do pátio. Vazio = sem limite. Desenhe em Telemetria > Ao Vivo > "Desenhar limite" e cole o JSON aqui.
export const LIMITE_PATIO: Ponto[] = []

function dentro(p: Ponto, poly: Ponto[]): boolean {
  let in_ = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i]
    const [yj, xj] = poly[j]
    if ((yi > p[0]) !== (yj > p[0]) && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) in_ = !in_
  }
  return in_
}

// Ponto mais próximo de p no segmento a-b (com a longitude escalada por cos(lat) para distâncias coerentes).
function projetarNoSegmento(p: Ponto, a: Ponto, b: Ponto, k: number): Ponto {
  const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p[1] * k, py = p[0]
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return [ay + t * dy, (ax + t * dx) / k]
}

// Se p estiver fora do limite, devolve o ponto mais próximo na borda; senão, o próprio p.
export function ajustarAoLimite(p: Ponto, poly: Ponto[] = LIMITE_PATIO): Ponto {
  if (poly.length < 3 || dentro(p, poly)) return p
  const k = Math.cos((p[0] * Math.PI) / 180)
  let melhor = poly[0]
  let menor = Infinity
  for (let i = 0; i < poly.length; i++) {
    const q = projetarNoSegmento(p, poly[i], poly[(i + 1) % poly.length], k)
    const d = (q[0] - p[0]) ** 2 + ((q[1] - p[1]) * k) ** 2
    if (d < menor) { menor = d; melhor = q }
  }
  return melhor
}
