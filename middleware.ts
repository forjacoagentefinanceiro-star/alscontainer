import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { ehHostDaLanding, PAGINAS_SITE } from '@/lib/site/host'

export async function middleware(request: NextRequest) {
  // favicon: o endereço da landing usa o ícone da MLA Containers; o sistema segue com o dele, sem checar login
  if (request.nextUrl.pathname === '/favicon.ico') {
    return ehHostDaLanding(request.headers.get('host') ?? '')
      ? NextResponse.rewrite(new URL('/containers/mla-favicon.ico', request.url))
      : NextResponse.next()
  }
  if (ehHostDaLanding(request.headers.get('host') ?? '')) {
    const p = request.nextUrl.pathname.replace(/(.)\/$/, '$1')
    if (PAGINAS_SITE[p]) return NextResponse.rewrite(new URL(PAGINAS_SITE[p], request.url))   // site: endereços limpos (/venda, /locacao…)
    if (p === '/robots.txt' || p === '/sitemap.xml') return NextResponse.next()
    if (p === '/containers' || p.startsWith('/containers/') || p.startsWith('/api/containers') || p.startsWith('/mla') || p.startsWith('/site/')) return NextResponse.next()
    return NextResponse.redirect(new URL('/', request.url))
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Rotas públicas — sem verificação
  const publicPaths = ['/login', '/aguardando', '/reset-senha', '/api/barra/update', '/containers', '/api/containers', '/mla', '/site']
  const isPublic = publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (isPublic) {
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/inventario', request.url))
    }
    return supabaseResponse
  }

  // Não autenticado → login
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  // Verifica perfil e aprovação
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.approved) {
    return NextResponse.redirect(new URL('/aguardando', request.url))
  }

  // Troca de senha obrigatória no primeiro acesso
  if (profile.must_change_password && !pathname.startsWith('/trocar-senha')) {
    return NextResponse.redirect(new URL('/trocar-senha', request.url))
  }

  // Operador → só enxerga o Checklist (e a troca de senha obrigatória)
  if (profile.role === 'operador' && !pathname.startsWith('/checklist') && !pathname.startsWith('/trocar-senha')) {
    return NextResponse.redirect(new URL('/checklist', request.url))
  }

  // /cadastros → apenas admin e editor
  if (pathname.startsWith('/cadastros') && profile.role !== 'admin' && profile.role !== 'editor') {
    return NextResponse.redirect(new URL('/inventario', request.url))
  }

  // /usuarios → apenas admin
  if (pathname.startsWith('/usuarios') && profile.role !== 'admin') {
    return NextResponse.redirect(new URL('/inventario', request.url))
  }

  // /tarefas (DespachaApp) → apenas admin
  if (pathname.startsWith('/tarefas') && profile.role !== 'admin') {
    return NextResponse.redirect(new URL('/inventario', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/favicon.ico', '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|mp4|webm)).*)'],
}
