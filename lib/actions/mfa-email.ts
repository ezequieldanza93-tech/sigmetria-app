'use server'

import crypto from 'crypto'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveMfaChannel, sendMfaCodeVia } from '@/lib/auth/mfa-channels'
import { createMfaCookie, MFA_COOKIE_NAME, MFA_COOKIE_TTL_MS } from '@/lib/mfa-cookie'

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function sendMfaEmailCode(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'No autenticado' }

  const service = createServiceClient()

  // Invalidar desafíos anteriores activos
  await service
    .from('mfa_email_challenges')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('used_at', null)

  // Generar código de 6 dígitos criptográficamente seguro
  const code = String(crypto.randomInt(100000, 999999))

  await service.from('mfa_email_challenges').insert({
    user_id: user.id,
    code_hash: hashCode(code),
  })

  const [{ data: profile }, { data: persona }] = await Promise.all([
    service.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    service.from('personas_directorio').select('telefono').eq('user_id', user.id).maybeSingle(),
  ])

  // Canal enchufable: email hoy; WhatsApp cuando esté configurado (ver mfa-channels.ts).
  const channel = resolveMfaChannel({ hasPhone: !!persona?.telefono })

  try {
    await sendMfaCodeVia({
      channel,
      code,
      userName: profile?.full_name ?? user.email,
      email: user.email,
      phone: persona?.telefono ?? null,
    })
  } catch (e) {
    console.error('[MFA] Error enviando código:', e)
    return { error: 'No se pudo enviar el código. Intentá de nuevo.' }
  }

  return {}
}

export async function verifyMfaEmailCode(code: string): Promise<{ error?: string }> {
  if (!/^\d{6}$/.test(code)) return { error: 'Código inválido.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const service = createServiceClient()
  const { data: challenge } = await service
    .from('mfa_email_challenges')
    .select('id')
    .eq('user_id', user.id)
    .eq('code_hash', hashCode(code))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!challenge) return { error: 'Código incorrecto o expirado.' }

  // Marcar como usado
  await service
    .from('mfa_email_challenges')
    .update({ used_at: new Date().toISOString() })
    .eq('id', challenge.id)

  // Setear cookie de sesión MFA verificada
  const token = await createMfaCookie(user.id)
  const cookieStore = await cookies()
  cookieStore.set(MFA_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MFA_COOKIE_TTL_MS / 1000,
    path: '/',
  })

  return {}
}
