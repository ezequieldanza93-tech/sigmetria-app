// ╔════════════════════════════════════════════════════════════════════════╗
// ║  TEMPORARY — TESTING BYPASS                                           ║
// ║  Pre-setea la cookie `mfa_verified` para cuentas @sigmetria.app que   ║
// ║  no tienen buzón real y no pueden recibir el código OTP.              ║
// ║                                                                        ║
// ║  REMOVER cuando termine la etapa de testing:                          ║
// ║    1. Borrar este archivo                                             ║
// ║    2. Quitar los imports y la llamada en:                             ║
// ║         - app/api/auth/login/route.ts                                 ║
// ║         - lib/actions/login.ts                                        ║
// ║                                                                        ║
// ║  La lógica de enforcement en middleware.ts NO se toca: el bypass      ║
// ║  simplemente fabrica la misma cookie HMAC que produce el flow normal  ║
// ║  de verificación.                                                     ║
// ╚════════════════════════════════════════════════════════════════════════╝

import { createMfaCookie, MFA_COOKIE_NAME, MFA_COOKIE_TTL_MS } from '@/lib/mfa-cookie'

const TEST_DOMAIN_SUFFIX = '@sigmetria.app'

export function isTestBypassAccount(email: string | null | undefined): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(TEST_DOMAIN_SUFFIX)
}

export interface BypassCookie {
  name: string
  value: string
  options: {
    httpOnly: true
    secure: boolean
    sameSite: 'lax'
    maxAge: number
    path: '/'
  }
}

// Devuelve la cookie firmada lista para setear, o null si la cuenta no aplica.
// El caller la setea usando su propio mecanismo (NextResponse.cookies o next/headers cookies()).
export async function getTestMfaBypassCookie(
  email: string | null | undefined,
  userId: string,
): Promise<BypassCookie | null> {
  if (!isTestBypassAccount(email)) return null

  const value = await createMfaCookie(userId)
  return {
    name: MFA_COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: MFA_COOKIE_TTL_MS / 1000,
      path: '/',
    },
  }
}
