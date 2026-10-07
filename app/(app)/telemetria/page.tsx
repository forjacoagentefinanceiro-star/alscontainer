import { TelemetriaAoVivo } from '@/components/telemetria/TelemetriaAoVivo'

export const dynamic = 'force-dynamic'

export default function TelemetriaPage() {
  return (
    <div style={{ background: '#0d1b2e', borderRadius: 18, padding: 'clamp(14px,3vw,24px)', minHeight: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: '#e6eef7', fontSize: 'clamp(18px,4vw,22px)', fontWeight: 700, margin: 0 }}>Telemetria — Ao Vivo</h1>
        <p style={{ color: '#5f7da0', fontSize: 13, marginTop: 4 }}>Posição GPS das máquinas · atualiza a cada 30 segundos</p>
      </div>
      <TelemetriaAoVivo />
    </div>
  )
}
