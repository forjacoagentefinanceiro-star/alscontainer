import { TelemetriaHistorico } from '@/components/telemetria/TelemetriaHistorico'
import { TelemetriaCalor } from '@/components/telemetria/TelemetriaCalor'

export const dynamic = 'force-dynamic'

export default function TelemetriaHistoricoPage() {
  return (
    <div style={{ background: '#0d1b2e', borderRadius: 18, padding: 'clamp(14px,3vw,24px)', minHeight: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: '#e6eef7', fontSize: 'clamp(18px,4vw,22px)', fontWeight: 700, margin: 0 }}>Telemetria — Histórico</h1>
        <p style={{ color: '#5f7da0', fontSize: 13, marginTop: 4 }}>Trilha de movimentação e mapa de calor por período</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        <TelemetriaHistorico />
        <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />
        <TelemetriaCalor />
      </div>
    </div>
  )
}
