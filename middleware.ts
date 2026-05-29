import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { verifyMfaCookie, MFA_COOKIE_NAME } from '@/lib/mfa-cookie'

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

  // ── MFA enforcement por email — Art. 4.5 Res. SRT 48/2025 ───────────────
  // Segundo factor via OTP por email. Sin app externa requerida.
  // Roles obligatorios: full_access_main, responsable_estandares
  // Cookie mfa_verified: HMAC firmada (MFA_COOKIE_SECRET), TTL 24h
  const isMfaPage = pathname.startsWith('/mfa/')

  if (user && !pathname.startsWith('/login')) {
    const mfaCookieValue = request.cookies.get(MFA_COOKIE_NAME)?.value
    const isMfaVerified = mfaCookieValue
      ? await verifyMfaCookie(mfaCookieValue, user.id).catch(() => false)
      : false

    // Ya verificado — no necesita estar en página MFA
    if (isMfaPage && isMfaVerified) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (!isMfaPage && !isMfaVerified) {
      try {
        const { data: member } = await supabase
          .from('consultoras_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()

        if (member && ['full_access_main', 'responsable_estandares'].includes(member.role)) {
          return NextResponse.redirect(new URL('/mfa/verify', request.url))
        }
      } catch {
        // Si la consulta falla, no bloqueamos el acceso
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
