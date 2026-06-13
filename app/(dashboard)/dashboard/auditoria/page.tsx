import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserRole, SystemRole } from '@/lib/types'
import { AuditoriaPanel } from '@/components/auditoria/auditoria-panel'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Auditoría — Sigmetría HyS',
}

// Roles con acceso a la auditoría (espejo del gate de la action y el nav).
const AUDIT_ROLES: UserRole[] = [
  'full_access_main',
  'full_access_branch',
  'responsable_estandares',
]

/**
 * Panel de Auditoría y cadena de custodia — SRT Disp. 15/2026, Estándar 8.
 * El Responsable de Estándares (y los admins) verifican la integridad del
 * audit_log y consultan el historial inmutable desde la app, sin tocar SQL.
 */
export default async function AuditoriaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('system_role, is_super_admin').eq('id', user.id).single(),
    supabase
      .from('consultoras_members')
      .select('role, consultora_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const userRole = (membership?.role as UserRole | undefined) ?? null
  const systemRole = (profile?.system_role ?? 'user') as SystemRole
  const isSuperAdmin = profile?.is_super_admin === true

  const authorized =
    isSuperAdmin ||
    systemRole === 'developer' ||
    (userRole != null && AUDIT_ROLES.includes(userRole))

  if (!authorized) redirect('/dashboard')

  return <AuditoriaPanel />
}
