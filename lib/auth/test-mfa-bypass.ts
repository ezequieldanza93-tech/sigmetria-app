// ╔════════════════════════════════════════════════════════════════════════╗
// ║  TEMPORARY — TESTING BYPASS                                           ║
// ║  Pre-setea la cookie `mfa_verified` para cuentas @sigmetria.app que   ║
// ║  no tienen buzón real y no pueden recibir el código OTP.              ║
// ║                                                                        ║
// ║  GATE (Art. 4.5 Res. SRT 48/2025 — Prompt 4): el bypass SOLO está     ║
// ║  activo si la env var `ALLOW_MFA_TEST_BYPASS === 'true'`. Por DEFAULT ║
// ║  (y en producción, donde no debe setearse) queda DESACTIVADO: el MFA  ║
// ║  real por OTP se exige a TODAS las cuentas, incluidas @sigmetria.app. ║
// ║                                                                        ║
// ║  REMOVER cuando termine la etapa de testing:                          ║
// ║    1. Borrar este archivo                                             ║
// ║    2. Quitar los imports y la llamada en:                             ║
// ║         - app/api/auth/login/route.ts                                 ║
// ║         - lib/actions/login.ts                                        ║
// ║         - middleware.ts                                               ║
// ║                                                                        ║
// ║  La lógica de enforcement en middleware.ts NO se toca: el bypass      ║
// ║  simplemente fabrica la misma cookie HMAC que produce el flow normal  ║
// ║  de verificación.                                                     ║
// ╚════════════════════════════════════════════════════════════════════════╝

import { createMfaCookie, MFA_COOKIE_NAME, MFA_COOKIE_TTL_MS } from '@/lib/mfa-cookie'

const TEST_DOMAIN_SUFFIX = '@sigmetria.app'

// El bypass está cerrado por defecto. Solo se abre con la env var explícita
// `ALLOW_MFA_TEST_BYPASS=true` (entornos de testing/preview). Si la var no
// existe o tiene cualquier otro valor → el bypass NO aplica y rige el MFA real.
function isBypassEnabled(): boolean {
  return process.env.ALLOW_MFA_TEST_BYPASS === 'true'
}

export function isTestBypassAccount(email: string | null | undefined): boolean {
  if (!isBypassEnabled()) return false
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
