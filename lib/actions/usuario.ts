'use server'

import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { ActionResult, UserRole } from '@/lib/types'
import { canManageUsers } from '@/lib/types'
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

export async function inviteUsuario(_prevState: ActionResult<null> | null, formData: FormData): Promise<ActionResult<null>> {
  const ctx = await assertCanManage()
  if (!ctx) return { success: false, error: 'Sin permisos para invitar usuarios' }

  const parsed = validateFormData(inviteUsuarioSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { email, full_name: fullName, role } = parsed.data
  const consultoraId = ctx.membership?.consultora_id

  if (!consultoraId) return { success: false, error: 'No se encontró consultora' }

  // Check if full_access_main role (only they can invite)
  if (ctx.membership?.role !== 'full_access_main' && ctx.profile?.system_role !== 'developer') {
    return { success: false, error: 'Solo el Admin Principal puede agregar miembros' }
  }

  // Check seat availability
  const supabaseCheck = await createServerClient()
  const [{ count: activeCount }, { data: consultora }] = await Promise.all([
    supabaseCheck
      .from('consultoras_members')
      .select('*', { count: 'exact', head: true })
      .eq('consultora_id', consultoraId)
      .eq('is_active', true),
    supabaseCheck
      .from('consultoras')
      .select('seats_max')
      .eq('id', consultoraId)
      .single(),
  ])

  const seatsMax = consultora?.seats_max ?? 3
  const seatsUsed = activeCount ?? 0
  if (seatsUsed >= seatsMax) {
    return { success: false, error: `SEATS_LIMIT:${seatsUsed}:${seatsMax}` }
  }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`

  const response = await fetch(`${baseUrl}/api/admin/invite-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, full_name: fullName, role }),
  })

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Error al invitar usuario' }))
    return { success: false, error }
  }

  revalidatePath('/dashboard/usuarios')
  return { success: true, data: null }
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
