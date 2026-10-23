// Endereço público do site/landing (sem o nome do sistema): qualquer host que não seja o do sistema
// (contém "alscontainer") nem local é tratado como o site da MLA Containers.
export function ehHostDaLanding(host: string) {
  const h = host.toLowerCase().split(':')[0]
  const extras = (process.env.LANDING_HOSTS ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
  if (extras.includes(h)) return true
  if (!h || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost')) return false
  return !h.includes('alscontainer')
}

// Páginas do site: caminho público → rota interna (o endereço fica limpo, sem /mla)
export const PAGINAS_SITE: Record<string, string> = {
  '/': '/mla',
  '/venda': '/mla/venda',
  '/locacao': '/mla/locacao',
  '/como-funciona': '/mla/como-funciona',
  '/sobre': '/mla/sobre',
  '/contato': '/mla/contato',
}
