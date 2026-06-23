import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
  const publicPaths = ['/login', '/aguardando', '/reset-senha']
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

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js)).*)'],
}
