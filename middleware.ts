import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { verifyMfaCookie, MFA_COOKIE_NAME } from '@/lib/mfa-cookie'
import { isTestBypassAccount } from '@/lib/auth/test-mfa-bypass'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const publicPaths = ['/manifest.json', '/service-worker', '/sw.js', '/robots.txt', '/sitemap.xml', '/favicon.svg', '/favicon.ico', '/offline']
  if (
    publicPaths.some(p => pathname === p) ||
    pathname.startsWith('/offline') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/verificar-certificado/') ||
    pathname.startsWith('/verificar/') ||
    // Capacitación por token: el participante entra SIN login.
    // El registro general (/capacitacion/registro/...) queda con auth.
    (pathname.startsWith('/capacitacion/') && !pathname.startsWith('/capacitacion/registro'))
  ) {
    return NextResponse.next()
  }

  // Rutas de desarrollo (/dev/*): accesibles sin auth, SOLO en desarrollo.
  // En producción no aplica (NODE_ENV) y la página además se auto-bloquea.
  if (process.env.NODE_ENV !== 'production' && pathname.startsWith('/dev/')) {
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
  // Roles obligatorios: full_access_main, responsable_estandares, auditor_externo
  // Cookie mfa_verified: HMAC firmada (MFA_COOKIE_SECRET), TTL 24h
  const isMfaPage = pathname.startsWith('/mfa/')

  if (user && !pathname.startsWith('/login')) {
    // ── TESTING BYPASS — cuentas @sigmetria.app ──────────────────────────────
    // Cuentas de prueba sin buzón real: saltean el MFA directamente en el
    // enforcement, SIN depender de la cookie firmada ni de MFA_COOKIE_SECRET
    // (que se configura a mano en Vercel y no siempre se hereda en Preview).
    // Acotado ESTRICTAMENTE al sufijo @sigmetria.app — el MFA real de cuentas
    // productivas (Res. SRT 48/2025) queda intacto.
    if (isTestBypassAccount(user.email)) {
      if (isMfaPage) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      return supabaseResponse
    }
    // ─────────────────────────────────────────────────────────────────────────

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

        if (member && ['full_access_main', 'responsable_estandares', 'auditor_externo', 'trabajador'].includes(member.role)) {
          return NextResponse.redirect(new URL('/mfa/verify', request.url))
        }
      } catch {
        // Si la consulta falla, no bloqueamos el acceso
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Cambio de contraseña OBLIGATORIO (primer ingreso del trabajador) ─────
  // Entró con password=DNI; debe elegir una propia antes de usar la app. El MFA
  // de arriba ya corrió: primero posesión (código), después credencial real.
  // El DNI es semipúblico, así que sin este paso no hay no-repudio.
  if (
    user &&
    (user.user_metadata as Record<string, unknown> | undefined)?.must_change_password === true &&
    !pathname.startsWith('/cambiar-password') &&
    !pathname.startsWith('/mfa/') &&
    !pathname.startsWith('/login')
  ) {
    return NextResponse.redirect(new URL('/cambiar-password', request.url))
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
