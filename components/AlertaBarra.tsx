import type { BarraStatus } from '@/app/actions'

// Banner removido — semáforo agora fica no TopBar (hover para ver detalhes)
export function AlertaBarra(_: { barra: BarraStatus | null }) {
  return null
}
