'use server'

import crypto from 'crypto'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmailChangeCode } from '@/lib/email/email-change'
import { canManageUsers } from '@/lib/types'
import type { ActionResult, SystemRole, UserRole } from '@/lib/types'
import { authRatelimit, checkRateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

const emailSchema = z.string().email()

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role, consultora_id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
  ])
  const systemRole = (profile?.system_role ?? 'user') as SystemRole
  const role = (membership?.role as UserRole | undefined) ?? null
  if (!canManageUsers(role, systemRole)) return null
  return { user, consultoraId: membership?.consultora_id ?? null, isDev: systemRole === 'developer' }
}

/**
 * Paso 1: el Admin solicita cambiar el email de un usuario. Se envía un código
 * de 6 dígitos al NUEVO email para validar que la persona controla ese buzón.
 */
export async function requestEmailChange(targetUserId: string, newEmail: string): Promise<ActionResult<{ sentTo: string }>> {
  const ctx = await assertAdmin()
  if (!ctx) return { success: false, error: 'Solo el Admin Principal puede cambiar emails' }

  const parsed = emailSchema.safeParse(newEmail.trim().toLowerCase())
  if (!parsed.success) return { success: false, error: 'Email inválido' }
  const email = parsed.data

  const rl = await checkRateLimit(authRatelimit, `email-change:${ctx.user.id}`)
  if (!rl.allowed) return { success: false, error: 'Demasiados intentos. Esperá un minuto.' }

  const service = createServiceClient()

  // El target debe pertenecer a la consultora del admin (salvo developer).
  if (!ctx.isDev) {
    const { data: targetMember } = await service
      .from('consultoras_members')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('consultora_id', ctx.consultoraId ?? '')
      .eq('is_active', true)
      .maybeSingle()
    if (!targetMember) return { success: false, error: 'Ese usuario no pertenece a tu consultora' }
  }

  // Invalidar desafíos anteriores.
  await service
    .from('email_change_challenges')
    .update({ used_at: new Date().toISOString() })
    .eq('target_user_id', targetUserId)
    .is('used_at', null)

  const code = String(crypto.randomInt(100000, 999999))
  const { error: insertError } = await service.from('email_change_challenges').insert({
    target_user_id: targetUserId,
    requested_by: ctx.user.id,
    consultora_id: ctx.consultoraId,
    new_email: email,
    code_hash: hashCode(code),
  })
  if (insertError) return { success: false, error: insertError.message }

  const { data: targetProfile } = await service
    .from('profiles').select('full_name').eq('id', targetUserId).maybeSingle()

  try {
    await sendEmailChangeCode({ email, code, userName: targetProfile?.full_name ?? email })
  } catch (e) {
    console.error('[EmailChange] Error enviando email:', e)
    return { success: false, error: 'No se pudo enviar el email. Intentá de nuevo.' }
  }

  return { success: true, data: { sentTo: email } }
}

/**
 * Paso 2: con el código del nuevo buzón, se confirma el cambio. Se actualiza el
 * email en la PERSONA del directorio (dueña del dato) y en auth.users (login).
 */
export async function confirmEmailChange(targetUserId: string, code: string): Promise<ActionResult<{ email: string }>> {
  const ctx = await assertAdmin()
  if (!ctx) return { success: false, error: 'Solo el Admin Principal puede cambiar emails' }
  if (!/^\d{6}$/.test(code)) return { success: false, error: 'Código inválido' }

  const service = createServiceClient()
  const { data: challenge } = await service
    .from('email_change_challenges')
    .select('id, new_email')
    .eq('target_user_id', targetUserId)
    .eq('code_hash', hashCode(code))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!challenge) return { success: false, error: 'Código incorrecto o expirado' }

  const admin = createAdminClient()
  const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, {
    email: challenge.new_email,
    email_confirm: true,
  })
  if (updateError) return { success: false, error: updateError.message }

  // La persona del directorio es dueña del email: la mantenemos en sync.
  await service.from('personas_directorio').update({ email: challenge.new_email }).eq('user_id', targetUserId)

  // Revoca las sesiones activas del usuario: las sesiones viejas dejan de servir
  // tras el cambio de email (control de acceso, Art. 4.5). Best-effort.
  try { await service.rpc('revocar_sesiones_usuario', { p_user_id: targetUserId }) } catch { /* no crítico */ }

  await service.from('email_change_challenges').update({ used_at: new Date().toISOString() }).eq('id', challenge.id)

  revalidatePath('/dashboard/usuarios')
  return { success: true, data: { email: challenge.new_email } }
}
