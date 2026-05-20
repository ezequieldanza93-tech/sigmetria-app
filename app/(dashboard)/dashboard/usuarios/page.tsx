import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { canManageUsers, ROLE_LABELS, ROLE_COLORS, UserRole } from '@/lib/types'
import { InviteModal } from '@/components/invite-modal'
import { EquipoSection } from '@/components/equipo-section'

export default async function UsuariosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: myMembership }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase
      .from('consultoras_members')
      .select('role, consultora_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  if (!canManageUsers(myMembership?.role as UserRole ?? null, profile?.system_role ?? 'user')) {
    redirect('/dashboard')
  }

  const consultoraId = myMembership?.consultora_id

  const [{ data: members }, { data: consultora }] = await Promise.all([
    supabase
      .from('consultoras_members')
      .select('id, role, is_active, user_id, profiles(full_name, system_role)')
      .eq('consultora_id', consultoraId!)
      .order('role'),
    supabase
      .from('consultoras')
      .select('seats_max')
      .eq('id', consultoraId!)
      .single(),
  ])

  const seatsMax = consultora?.seats_max ?? 3
  const seatsUsed = members?.filter(m => m.is_active).length ?? 0
  const isMainAdmin = myMembership?.role === 'full_access_main' || profile?.system_role === 'developer'

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Usuarios</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {seatsUsed} de {seatsMax} seats · {members?.length ?? 0} miembro{members?.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isMainAdmin && (
          <InviteModal seatsUsed={seatsUsed} seatsMax={seatsMax} />
        )}
      </div>

      {/* Banner de límite de seats */}
      {isMainAdmin && seatsUsed >= seatsMax && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 flex items-center justify-between text-sm">
          <p className="text-orange-700">
            Alcanzaste el límite de {seatsMax} seats de tu plan.
          </p>
          <a
            href="/dashboard/billing"
            className="text-orange-700 font-semibold underline underline-offset-2 hover:text-orange-800 transition-colors whitespace-nowrap ml-4"
          >
            Agregar seats →
          </a>
        </div>
      )}

      {/* Access table */}
      <div className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-text-primary">Acceso y permisos</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border-subtle bg-surface-sunken">
            <tr className="text-left">
              <th className="px-5 py-3 text-text-tertiary font-medium">Nombre</th>
              <th className="px-5 py-3 text-text-tertiary font-medium">Rol en consultora</th>
              <th className="px-5 py-3 text-text-tertiary font-medium">Nivel sistema</th>
              <th className="px-5 py-3 text-text-tertiary font-medium">Estado</th>
              <th className="px-5 py-3 text-text-tertiary font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {members?.map(m => {
              const memberProfile = m.profiles as { full_name?: string; system_role?: string } | null
              const isDev = memberProfile?.system_role === 'developer'
              const displayRole = isDev ? 'developer' : m.role
              return (
                <tr key={m.id} className="hover:bg-surface-base transition-colors">
                  <td className="px-5 py-4 font-medium text-text-primary">
                    {memberProfile?.full_name ?? 'Sin nombre'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[displayRole as keyof typeof ROLE_COLORS] ?? 'bg-surface-elevated text-text-secondary'}`}>
                      {ROLE_LABELS[m.role as UserRole]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-text-tertiary">
                    {isDev ? (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                        Developer
                      </span>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.is_active ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-surface-elevated text-text-tertiary'}`}>
                      {m.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/dashboard/usuarios/${m.user_id}/acceso`}
                      className="text-xs text-brand-primary hover:underline"
                    >
                      Gestionar acceso
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Equipo / perfiles profesionales */}
      <EquipoSection />
    </div>
  )
}
