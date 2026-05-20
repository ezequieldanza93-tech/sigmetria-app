import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/app-header'
import { SidebarWrapper } from '@/components/layout/sidebar-wrapper'
import { UserRole } from '@/lib/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('full_name, system_role').eq('id', user.id).single(),
    supabase
      .from('consultoras_members')
      .select('role, consultora_id, consultoras(nombre)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const consultoraNombre = (membership?.consultoras as { nombre?: string } | null)?.nombre ?? null

  return (
    <SidebarWrapper
      header={
        <AppHeader
          fullName={profile?.full_name ?? user.email ?? 'Usuario'}
          email={user.email ?? ''}
          userRole={(membership?.role as UserRole) ?? null}
          systemRole={profile?.system_role ?? 'user'}
          consultoraNombre={consultoraNombre}
        />
      }
    >
      {children}
    </SidebarWrapper>
  )
}
