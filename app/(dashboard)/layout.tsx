import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppHeader } from '@/components/app-header'
import { SidebarWrapper } from '@/components/layout/sidebar-wrapper'
import { DevicePreviewPanel } from '@/components/layout/device-preview-panel'
import { ContextualBottomNav } from '@/components/layout/contextual-bottom-nav'
import { FloatingAvatar } from '@/components/layout/floating-avatar'
import { ChatWidget } from '@/components/agent/chat-widget'
import { GestionLauncher } from '@/components/gestion-launcher'
import { FloatingReportButtons } from '@/components/feedback/floating-report-buttons'
import { BannerPastDueWrapper } from '@/components/billing/banner-past-due-wrapper'
import { TrialCountdown } from '@/components/billing/trial-countdown'
import { GeoConsentModal } from '@/components/legal/geo-consent-modal'
import { PreviewProvider } from '@/lib/contexts/preview-context'
import { EffectiveRoleProvider } from '@/lib/contexts/effective-role-context'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { isCrmAdmin } from '@/lib/auth/crm-access'
import { canAccessContenido } from '@/lib/contenido/access'
import 'leaflet/dist/leaflet.css'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, effective] = await Promise.all([
    supabase.from('profiles').select('full_name, accepted_geo_consent_at').eq('id', user.id).single(),
    getEffectiveRole(),
  ])

  if (!effective) redirect('/login')

  // Usuario autenticado pero sin consultora (y que no es staff de Sigmetría):
  // es un cliente nuevo → al onboarding autoservicio.
  if (!effective.consultoraId && !effective.isSuperAdmin && effective.realSystemRole !== 'developer') {
    redirect('/onboarding')
  }

  const {
    isSuperAdmin,
    canSwitchRole,
    simulatedRole: simRole,
    effectiveSystemRole,
    effectiveUserRole,
    consultoraNombre,
    consultoraId: membershipConsultoraId,
    email,
  } = effective

  const membership = membershipConsultoraId ? { consultora_id: membershipConsultoraId } : null

  // Roles que completan gestiones y por lo tanto deben ver el aviso de geo-sello.
  const ROLES_OPERATIVOS = new Set(['full_access_main', 'full_access_branch', 'colaborador'])
  const mostrarGeoConsent =
    !!membership &&
    !!effectiveUserRole &&
    ROLES_OPERATIVOS.has(effectiveUserRole) &&
    !profile?.accepted_geo_consent_at

  // Checkear si la suscripción está en past_due para mostrar banner
  let isPastDue = false
  let pastDueGraceUntil: string | null = null
  let trialEndsAt: string | null = null
  if (membership) {
    try {
      const admin = createAdminClient()
      const { data: sub } = await admin
        .from('subscriptions')
        .select('estado, past_due_grace_until, trial_ends_at')
        .eq('consultora_id', membership.consultora_id)
        .single()

      if (sub?.estado === 'trialing' && sub.trial_ends_at) {
        trialEndsAt = typeof sub.trial_ends_at === 'string'
          ? sub.trial_ends_at
          : sub.trial_ends_at.toISOString()
      }

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
    <EffectiveRoleProvider
      value={{
        userRole: effectiveUserRole,
        systemRole: effectiveSystemRole,
        simulatedRole: simRole,
        isSuperAdmin,
        canSwitchRole,
        email,
      }}
    >
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
          canSwitchRole={canSwitchRole}
        />
      }
    >
      {isPastDue && (
        <BannerPastDueWrapper graceUntil={pastDueGraceUntil} />
      )}
      {trialEndsAt && <TrialCountdown endsAt={trialEndsAt} />}
      <DevicePreviewPanel>{children}</DevicePreviewPanel>
      <ContextualBottomNav
            showContenido={canAccessContenido(effectiveUserRole, effectiveSystemRole)}
            showCrm={isCrmAdmin(email)}
            canManageCursos={
              isSuperAdmin ||
              effectiveUserRole === 'full_access_main' ||
              effectiveUserRole === 'full_access_branch'
            }
          />
      <GestionLauncher />
      <ChatWidget />
      <FloatingReportButtons />
      {mostrarGeoConsent && <GeoConsentModal />}
    </SidebarWrapper>
    <FloatingAvatar
      fullName={profile?.full_name ?? user.email ?? 'Usuario'}
      email={user.email ?? ''}
      userRole={effectiveUserRole}
      systemRole={effectiveSystemRole}
      consultoraNombre={consultoraNombre}
      isSuperAdmin={isSuperAdmin}
      simulatedRole={simRole}
      canSwitchRole={canSwitchRole}
    />
    </EffectiveRoleProvider>
    </PreviewProvider>
  )
}
