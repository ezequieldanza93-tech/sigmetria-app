'use server'

import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { ActionResult, UserRole, SystemRole } from '@/lib/types'
import { canManageUsers, canInviteViewers, isFreeViewerRole, consumesSeat } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'
import { userRole } from '@/lib/validation/schemas'

const inviteUsuarioSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  full_name: z.string().min(1, { message: 'El nombre es obligatorio' }),
  role: userRole,
})

async function assertCanManage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role, consultora_id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
  ])

  if (!canManageUsers(membership?.role as UserRole ?? null, profile?.system_role ?? 'user')) return null
  return { user, profile, membership }
}

export type InviteResult = { link: string; role: string }

export async function inviteUsuario(_prevState: ActionResult<InviteResult> | null, formData: FormData): Promise<ActionResult<InviteResult>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role, consultora_id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
  ])
  const systemRole = (profile?.system_role ?? 'user') as SystemRole
  const myRole = (membership?.role as UserRole | undefined) ?? null

  const parsed = validateFormData(inviteUsuarioSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { email, full_name: fullName, role } = parsed.data
  const personaId = (formData.get('persona_id') as string | null)?.trim() || null
  const consultoraId = membership?.consultora_id

  if (!consultoraId && systemRole !== 'developer') {
    return { success: false, error: 'No se encontró consultora' }
  }

  const targetIsViewer = isFreeViewerRole(role)

  // Viewers (sin cargo): los puede crear el Admin o un colaborador.
  // Cualquier otro rol (Admin / Colaborador con cargo): solo el Admin Principal.
  if (targetIsViewer) {
    if (!canInviteViewers(myRole, systemRole)) {
      return { success: false, error: 'Sin permisos para invitar usuarios' }
    }
  } else if (!canManageUsers(myRole, systemRole)) {
    return { success: false, error: 'Solo el Admin Principal puede crear Administradores o Colaboradores' }
  }

  // Control de seats: solo cuentan los roles con cargo. El auditor del organismo de
  // control (solo lectura) NO consume seat, igual que los viewers.
  if (consumesSeat(role) && consultoraId) {
    const [{ data: members }, { data: consultora }] = await Promise.all([
      supabase.from('consultoras_members').select('role').eq('consultora_id', consultoraId).eq('is_active', true),
      supabase.from('consultoras').select('seats_max').eq('id', consultoraId).single(),
    ])
    const seatsMax = consultora?.seats_max ?? 3
    const seatsUsed = (members ?? []).filter(m => consumesSeat(m.role as UserRole)).length
    if (seatsUsed >= seatsMax) {
      return { success: false, error: `SEATS_LIMIT:${seatsUsed}:${seatsMax}` }
    }
  }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`

  const response = await fetch(`${baseUrl}/api/admin/invite-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, full_name: fullName, role, ...(personaId ? { persona_id: personaId } : {}) }),
  })

  if (!response.ok) {
    let errorMsg = `Error al invitar usuario (HTTP ${response.status})`
    try {
      const body = await response.json()
      if (body?.error) errorMsg = body.error
    } catch {
      // el body no es JSON — el mensaje genérico con status es suficiente
    }
    console.error('[inviteUsuario] API error:', errorMsg)
    return { success: false, error: errorMsg }
  }

  let payload: { link?: string; role?: string } | null = null
  try {
    payload = await response.json()
  } catch {
    console.error('[inviteUsuario] no se pudo parsear la respuesta JSON del API')
  }
  if (!payload?.link) {
    return { success: false, error: 'No se pudo generar el link de invitación' }
  }

  revalidatePath('/dashboard/usuarios')
  return { success: true, data: { link: payload.link, role: payload.role ?? role } }
}

export async function updateRol(memberId: string, role: UserRole): Promise<ActionResult<null>> {
  const ctx = await assertCanManage()
  if (!ctx) return { success: false, error: 'Sin permisos' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('consultoras_members')
    .update({ role })
    .eq('id', memberId)
    .eq('consultora_id', ctx.membership?.consultora_id ?? '')

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/usuarios')
  return { success: true, data: null }
}

export async function revokeAcceso(memberId: string): Promise<ActionResult<null>> {
  const ctx = await assertCanManage()
  if (!ctx) return { success: false, error: 'Sin permisos' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('consultoras_members')
    .update({ is_active: false })
    .eq('id', memberId)
    .eq('consultora_id', ctx.membership?.consultora_id ?? '')

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/usuarios')
  return { success: true, data: null }
}

/**
 * Reemplaza a una persona del equipo: da de baja al miembro actual e invita a
 * uno nuevo con el MISMO rol. Lo correcto cuando rota el equipo (historial del
 * anterior queda intacto y trazable; el nuevo arranca con su propia cuenta).
 */
export async function replaceMember(memberId: string, newFullName: string, newEmail: string): Promise<ActionResult<InviteResult>> {
  const ctx = await assertCanManage()
  if (!ctx) return { success: false, error: 'Solo el Admin Principal puede reemplazar usuarios' }

  const fullName = newFullName.trim()
  const email = newEmail.trim().toLowerCase()
  if (!fullName) return { success: false, error: 'Nombre requerido' }

  const supabase = await createServerClient()
  const { data: member } = await supabase
    .from('consultoras_members')
    .select('role, user_id')
    .eq('id', memberId)
    .eq('consultora_id', ctx.membership?.consultora_id ?? '')
    .maybeSingle()
  if (!member) return { success: false, error: 'Usuario no encontrado' }
  if (member.user_id === ctx.user.id) return { success: false, error: 'No podés reemplazarte a vos mismo' }

  // Baja del anterior (libera el seat si lo consumía).
  const { error: deactivateError } = await supabase
    .from('consultoras_members')
    .update({ is_active: false })
    .eq('id', memberId)
  if (deactivateError) return { success: false, error: deactivateError.message }

  // Invitación del reemplazo con el mismo rol.
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`
  const response = await fetch(`${baseUrl}/api/admin/invite-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, full_name: fullName, role: member.role }),
  })
  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Error al invitar al reemplazo' }))
    return { success: false, error }
  }
  const payload = await response.json().catch(() => null) as { link?: string; role?: string } | null
  if (!payload?.link) return { success: false, error: 'No se pudo generar el link de invitación' }

  revalidatePath('/dashboard/usuarios')
  return { success: true, data: { link: payload.link, role: payload.role ?? member.role } }
}
