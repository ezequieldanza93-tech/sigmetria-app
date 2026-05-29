import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const publicPaths = ['/manifest.json', '/service-worker', '/sw.js', '/robots.txt', '/sitemap.xml', '/favicon.svg', '/favicon.ico', '/offline']
  if (
    publicPaths.some(p => pathname === p) ||
    pathname.startsWith('/offline') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/verificar-certificado/') ||
    pathname.startsWith('/verificar/')
  ) {
    return NextResponse.next()
  }

  // Webhooks de Mercado Pago son públicos (protegidos por HMAC)
  if (pathname === '/api/mercadopago/webhook') {
    return NextResponse.next()
  }

  // API v1: autenticada por API key (Bearer), no por cookie de sesión
  if (pathname.startsWith('/api/v1/')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isLoginPage = pathname.startsWith('/login')
  const isMfaPage = pathname.startsWith('/mfa/')

  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // MFA enforcement — Control A2, Res. SRT 48/2025
  // SETUP MANUAL: Supabase Dashboard → Authentication → MFA → Enable TOTP
  // Roles obligatorios: full_access_main, responsable_estandares
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (aal) {
      const { currentLevel, nextLevel } = aal

      // Ya verificado en esta sesión → salir de páginas MFA
      if (isMfaPage && currentLevel === 'aal2') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      if (!isMfaPage) {
        // Factor TOTP enrollado pero no verificado en esta sesión → forzar verify
        if (nextLevel === 'aal2' && currentLevel === 'aal1') {
          return NextResponse.redirect(new URL('/mfa/verify', request.url))
        }

        // Sin factores enrollados → consultar si el rol requiere MFA → forzar setup
        if (nextLevel === 'aal1') {
          try {
            const { data: mfaRequired } = await supabase.rpc('requires_mfa')
            if (mfaRequired) {
              return NextResponse.redirect(new URL('/mfa/setup', request.url))
            }
          } catch {
            // Si la consulta falla, no bloqueamos el acceso
          }
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image).*)'],
}
