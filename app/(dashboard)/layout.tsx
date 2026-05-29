import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppHeader } from '@/components/app-header'
import { SidebarWrapper } from '@/components/layout/sidebar-wrapper'
import { DevicePreviewPanel } from '@/components/layout/device-preview-panel'
import { ContextualBottomNav } from '@/components/layout/contextual-bottom-nav'
import { FloatingAvatar } from '@/components/layout/floating-avatar'
import { ChatWidget } from '@/components/agent/chat-widget'
import { BannerPastDueWrapper } from '@/components/billing/banner-past-due-wrapper'
import { PreviewProvider } from '@/lib/contexts/preview-context'
import { UserRole, SystemRole } from '@/lib/types'
import { getSimulatedRole, type SwitchableRole } from '@/lib/actions/change-role'
import 'leaflet/dist/leaflet.css'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('full_name, system_role, is_super_admin').eq('id', user.id).single(),
    supabase
      .from('consultoras_members')
      .select('role, consultora_id, consultoras(nombre)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const consultoraNombre = (membership?.consultoras as { nombre?: string } | null)?.nombre ?? null

  // Role simulation: super admins can test the app as any role via a cookie.
  // Never changes the DB — safe to switch freely.
  const isSuperAdmin = profile?.is_super_admin ?? false
  const realSystemRole = (profile?.system_role ?? 'user') as SystemRole
  const realUserRole = (membership?.role as UserRole) ?? null

  const simRole: SwitchableRole | null = isSuperAdmin || realSystemRole === 'developer'
    ? await getSimulatedRole()
    : null

  const effectiveSystemRole: SystemRole = simRole === 'developer' || (!simRole && realSystemRole === 'developer')
    ? 'developer'
    : 'user'
  const effectiveUserRole: UserRole | null = simRole && simRole !== 'developer'
    ? simRole as UserRole
    : realUserRole

  // Checkear si la suscripción está en past_due para mostrar banner
  let isPastDue = false
  let pastDueGraceUntil: string | null = null
  if (membership) {
    try {
      const admin = createAdminClient()
      const { data: sub } = await admin
        .from('subscriptions')
        .select('estado, past_due_grace_until')
        .eq('consultora_id', membership.consultora_id)
        .single()

      if (sub?.estado === 'past_due') {
        isPastDue = true
        pastDueGraceUntil = sub.past_due_grace_until
          ? typeof sub.past_due_grace_until === 'string'
            ? sub.past_due_grace_until
            : sub.past_due_grace_until.toISOString()
          : null
      }
    } catch {
      // Si no hay sub, ignorar
    }
  }

  return (
    <PreviewProvider>
    <SidebarWrapper
      header={
        <AppHeader
          fullName={profile?.full_name ?? user.email ?? 'Usuario'}
          email={user.email ?? ''}
          userRole={effectiveUserRole}
          systemRole={effectiveSystemRole}
          consultoraNombre={consultoraNombre}
          isSuperAdmin={isSuperAdmin}
          simulatedRole={simRole}
        />
      }
    >
      {isPastDue && (
        <BannerPastDueWrapper graceUntil={pastDueGraceUntil} />
      )}
      <DevicePreviewPanel>{children}</DevicePreviewPanel>
      <ContextualBottomNav />
      <div className="hidden lg:block">
        <ChatWidget />
      </div>
    </SidebarWrapper>
    <FloatingAvatar
      fullName={profile?.full_name ?? user.email ?? 'Usuario'}
      email={user.email ?? ''}
      userRole={effectiveUserRole}
      systemRole={effectiveSystemRole}
      consultoraNombre={consultoraNombre}
      isSuperAdmin={isSuperAdmin}
      simulatedRole={simRole}
    />
    </PreviewProvider>
  )
}
