// Funções de captação de lead do site (rodam só no navegador). Usam o mesmo endpoint e CRM da landing.
type W = Window & { fbq?: (...a: unknown[]) => void; ttq?: { track: (...a: unknown[]) => void } }

let fila: Promise<unknown> = Promise.resolve()

export function gerarRef() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => c[Math.floor(Math.random() * c.length)]).join('')
}
export function mascara(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
export const soDigitos = (v: string) => v.replace(/\D/g, '')

function origem(pagina: string): Record<string, string | null> {
  let q = new URLSearchParams(window.location.search)
  try {
    if ([...q.keys()].some(k => k.startsWith('utm_') || k === 'fbclid' || k === 'ttclid')) sessionStorage.setItem('mla-origem', q.toString())
    else { const g = sessionStorage.getItem('mla-origem'); if (g) q = new URLSearchParams(g) }
  } catch { /* modo privado */ }
  const temUtm = q.get('utm_source')
  return {
    utm_source: temUtm ?? 'site', utm_medium: q.get('utm_medium') ?? (temUtm ? null : 'organico'), utm_campaign: q.get('utm_campaign'),
    utm_content: q.get('utm_content') ?? (temUtm ? null : pagina), fbclid: q.get('fbclid'), ttclid: q.get('ttclid'),
  }
}

export function enviarLead(ref: string, pagina: string, corpo: Record<string, unknown>) {
  const dados = JSON.stringify({ ref, ...origem(pagina), ...corpo })
  fila = fila.then(() => fetch('/api/containers/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: dados, keepalive: true })).catch(() => {})
  return fila
}

export function rastrear(evento: 'form' | 'whats', nome: string) {
  const w = window as W
  try { if (evento === 'form') w.fbq?.('track', 'Lead', { content_name: nome }); else w.fbq?.('track', 'Contact') } catch { /* */ }
  try { w.ttq?.track(evento === 'form' ? 'SubmitForm' : 'Contact', { content_name: nome }) } catch { /* */ }
}

export function urlWhats(numero: string, texto: string) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}
