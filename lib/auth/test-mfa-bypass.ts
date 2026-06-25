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

// Fase de armado: el bypass está ACTIVO por defecto. Se desactiva (MFA real para
// todas las cuentas) seteando `ALLOW_MFA_TEST_BYPASS=false`.
function isBypassEnabled(): boolean {
  return process.env.ALLOW_MFA_TEST_BYPASS !== 'false'
}

// FASE DE ARMADO (decisión Ezequiel 2026-06-25): TODOS los usuarios actuales son de
// prueba → bypass TOTAL del MFA mientras dure el armado (no se discrimina por dominio
// ni allowlist). Cuando se pague/verifique el dominio de envío en Resend, se setea
// `ALLOW_MFA_TEST_BYPASS=false` y rige el MFA real por OTP para TODAS las cuentas
// (la exención permanente de `@sigmetria.app` se implementa en el fast-follow de MFA).
export function isTestBypassAccount(email: string | null | undefined): boolean {
  return isBypassEnabled() && Boolean(email)
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
