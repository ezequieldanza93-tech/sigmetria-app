'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { ActionResult, UserRole } from '@/lib/types'
import { canManageUsers } from '@/lib/types'

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

  const email = formData.get('email') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as UserRole
  const consultoraId = ctx.membership?.consultora_id

  if (!email?.trim()) return { success: false, error: 'El email es obligatorio' }
  if (!role) return { success: false, error: 'El rol es obligatorio' }
  if (!consultoraId) return { success: false, error: 'No se encontró consultora' }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email.trim(),
    { data: { full_name: fullName } }
  )

  if (inviteError) return { success: false, error: inviteError.message }

  if (invited.user) {
    await adminClient.from('profiles').upsert({
      id: invited.user.id,
      full_name: fullName?.trim() || email,
      system_role: 'user',
    }, { onConflict: 'id' })

    const { error: memberError } = await adminClient.from('consultoras_members').insert({
      consultora_id: consultoraId,
      user_id: invited.user.id,
      role,
      invited_by: ctx.user.id,
    })

    if (memberError) return { success: false, error: memberError.message }
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

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/usuarios')
  return { success: true, data: null }
}
