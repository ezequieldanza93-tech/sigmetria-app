import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import { UserRole } from '@/lib/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('full_name, system_role').eq('id', user.id).single(),
    supabase
      .from('consultora_members')
      .select('role, consultora_id, consultoras(nombre)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const consultoraNombre = (membership?.consultoras as { nombre?: string } | null)?.nombre ?? null

  return (
    <div className="flex min-h-screen">
      <Sidebar
        fullName={profile?.full_name ?? user.email ?? 'Usuario'}
        email={user.email ?? ''}
        userRole={(membership?.role as UserRole) ?? null}
        systemRole={profile?.system_role ?? 'user'}
        consultoraNombre={consultoraNombre}
      />
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
