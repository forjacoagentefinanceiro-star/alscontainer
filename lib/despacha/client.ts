// Cliente server-only para a API pública do DespachaApp (https://despachaapp.vercel.app/api/v1).
// A X-API-Key nunca deve ser importada em componentes 'use client'.

export type DespachaResponse<T> = { success: true; data: T; total?: number } | { success: false; error: string }

export async function despachaFetch<T>(path: string, init?: RequestInit): Promise<DespachaResponse<T>> {
  const baseUrl = process.env.DESPACHA_API_BASE_URL
  const apiKey = process.env.DESPACHA_API_KEY

  if (!baseUrl || !apiKey) {
    return { success: false, error: 'not_configured' }
  }

  const isRead = !init?.method || init.method === 'GET'

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      ...(isRead ? { next: { revalidate: 60 } } : { cache: 'no-store' }),
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
    const body = await res.json()
    if (!res.ok || !body.success) {
      return { success: false, error: body?.error ?? `Erro ${res.status}` }
    }
    return body as DespachaResponse<T>
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Falha de rede' }
  }
}
