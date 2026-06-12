import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getSimulatedRole, type SwitchableRole } from '@/lib/actions/change-role'
import type { UserRole, SystemRole } from '@/lib/types'

// Emails autorizados a simular roles, además de super admins y system_role='developer'.
// El rol simulado vive en la cookie httpOnly `__role_sim` (ver lib/actions/change-role.ts).
// (Se sacó la cuenta del fundador: ahora prueba como CLIENTE real, sin el simulador de roles.)
const DEV_EMAILS = new Set<string>([])

export interface EffectiveRole {
  userId: string
  email: string
  isSuperAdmin: boolean
  canSwitchRole: boolean
  realSystemRole: SystemRole
  realUserRole: UserRole | null
  simulatedRole: SwitchableRole | null
  effectiveSystemRole: SystemRole
  effectiveUserRole: UserRole | null
  consultoraId: string | null
  consultoraNombre: string | null
}

export async function getEffectiveRole(): Promise<EffectiveRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('system_role, is_super_admin').eq('id', user.id).single(),
    supabase
      .from('consultoras_members')
      .select('role, consultora_id, consultoras(nombre)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const isSuperAdmin = profile?.is_super_admin === true
  const realSystemRole = (profile?.system_role ?? 'user') as SystemRole
  const realUserRole = (membership?.role as UserRole | undefined) ?? null
  const email = user.email ?? ''
  const canSwitchRole = isSuperAdmin || realSystemRole === 'developer' || DEV_EMAILS.has(email)

  const simulatedRole = canSwitchRole ? await getSimulatedRole() : null

  const effectiveSystemRole: SystemRole =
    simulatedRole === 'developer' || (!simulatedRole && realSystemRole === 'developer')
      ? 'developer'
      : 'user'

  const effectiveUserRole: UserRole | null =
    simulatedRole && simulatedRole !== 'developer'
      ? (simulatedRole as UserRole)
      : realUserRole

  const consultoraNombre =
    (membership?.consultoras as { nombre?: string } | null)?.nombre ?? null
  const consultoraId = (membership?.consultora_id as string | null) ?? null

  return {
    userId: user.id,
    email,
    isSuperAdmin,
    canSwitchRole,
    realSystemRole,
    realUserRole,
    simulatedRole,
    effectiveSystemRole,
    effectiveUserRole,
    consultoraId,
    consultoraNombre,
  }
}
