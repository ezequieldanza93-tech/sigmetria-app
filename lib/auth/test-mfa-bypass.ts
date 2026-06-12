// ╔════════════════════════════════════════════════════════════════════════╗
// ║  TEMPORARY — TESTING BYPASS (FASE DE ARMADO)                          ║
// ║  Saltea el MFA por OTP para cuentas de prueba (sin buzón real / sin   ║
// ║  Resend configurado). Cubre el dominio @sigmetria.app y una allowlist ║
// ║  puntual (la cuenta del fundador para probar flujos).                 ║
// ║                                                                        ║
// ║  ESTADO: la app está EN ARMADO (sin suscriptores ni datos reales), por║
// ║  eso el bypass está ACTIVO POR DEFECTO. KILL-SWITCH para compliance / ║
// ║  launch: setear `ALLOW_MFA_TEST_BYPASS=false` → rige el MFA real por   ║
// ║  OTP para TODAS las cuentas (Art. 4.5 Res. SRT 48/2025).              ║
// ║                                                                        ║
// ║  ANTES DEL LAUNCH con usuarios reales:                                ║
// ║    1. `ALLOW_MFA_TEST_BYPASS=false` (o borrar este archivo + llamadas ║
// ║       en lib/actions/login.ts, app/api/auth/login/route.ts, middleware)║
// ║    2. Vaciar EXTRA_BYPASS_EMAILS / MFA_BYPASS_EMAILS.                  ║
// ╚════════════════════════════════════════════════════════════════════════╝

import { createMfaCookie, MFA_COOKIE_NAME, MFA_COOKIE_TTL_MS } from '@/lib/mfa-cookie'

const TEST_DOMAIN_SUFFIX = '@sigmetria.app'

// Cuentas puntuales (sin dominio @sigmetria.app) que también bypassean en fase de
// armado. La del fundador va hardcodeada para no depender de env; se pueden sumar
// más con `MFA_BYPASS_EMAILS` (coma-separadas). TEMPORAL — quitar antes del launch.
const EXTRA_BYPASS_EMAILS = ['ezequieldanza93@gmail.com']

function extraBypassEmails(): string[] {
  const fromEnv = (process.env.MFA_BYPASS_EMAILS ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  return [...EXTRA_BYPASS_EMAILS, ...fromEnv]
}

// Fase de armado: el bypass está ACTIVO por defecto. Se desactiva (MFA real para
// todas las cuentas) seteando `ALLOW_MFA_TEST_BYPASS=false`.
function isBypassEnabled(): boolean {
  return process.env.ALLOW_MFA_TEST_BYPASS !== 'false'
}

export function isTestBypassAccount(email: string | null | undefined): boolean {
  if (!isBypassEnabled()) return false
  if (!email) return false
  const e = email.toLowerCase()
  return e.endsWith(TEST_DOMAIN_SUFFIX) || extraBypassEmails().includes(e)
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
