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

  // ── MFA enforcement — Art. 4.5 Res. SRT 48/2025 ──────────────────────────
  // SETUP MANUAL REQUERIDO: Supabase Dashboard → Authentication → MFA → Enable TOTP
  // Roles obligatorios: full_access_main, responsable_estandares
  const isMfaPage = pathname.startsWith('/mfa/')

  if (user && !pathname.startsWith('/login')) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (aalData) {
      const { currentLevel, nextLevel } = aalData

      // Ya verificado en esta sesión — no necesita estar en página MFA
      if (isMfaPage && currentLevel === 'aal2') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      if (!isMfaPage) {
        // Tiene factor configurado pero no verificado en esta sesión
        if (nextLevel === 'aal2' && currentLevel === 'aal1') {
          return NextResponse.redirect(new URL('/mfa/verify', request.url))
        }

        // Sin factor configurado → verificar si el rol lo exige
        if (currentLevel === 'aal1' && nextLevel === 'aal1') {
          try {
            const { data: member } = await supabase
              .from('consultoras_members')
              .select('role')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .maybeSingle()

            if (member && ['full_access_main', 'responsable_estandares'].includes(member.role)) {
              return NextResponse.redirect(new URL('/mfa/setup', request.url))
            }
          } catch {
            // Si la consulta falla, no bloqueamos el acceso
          }
        }
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const isLoginPage = request.nextUrl.pathname.startsWith('/login')

  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image).*)'],
}
