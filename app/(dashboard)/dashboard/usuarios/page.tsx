import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  canManageUsers,
  canInviteViewers,
  isFreeViewerRole,
  roleToFriendly,
  type UserRole,
  type SystemRole,
} from '@/lib/types'
import { InviteModal } from '@/components/invite-modal'
import { MemberActions } from '@/components/usuarios/member-actions'
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

  const systemRole = (profile?.system_role ?? 'user') as SystemRole
  const myRole = (myMembership?.role as UserRole) ?? null

  // Colaboradores entran para crear visualizadores; un viewer puro no puede.
  if (!canInviteViewers(myRole, systemRole)) {
    redirect('/dashboard')
  }

  const isMainAdmin = canManageUsers(myRole, systemRole)
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

  // Personas del directorio sin cuenta — para linkear al Viewer de Observaciones.
  const { data: personasRaw } = await supabase
    .from('personas_directorio')
    .select('id, nombre, apellido, email')
    .is('user_id', null)
    .eq('is_active', true)
    .eq('created_in_consultora_id', consultoraId!)
    .order('apellido')
  const personas = personasRaw ?? []

  const seatsMax = consultora?.seats_max ?? 3
  const activos = members?.filter(m => m.is_active) ?? []
  const seatsUsed = activos.filter(m => !isFreeViewerRole(m.role as UserRole)).length
  const viewersCount = activos.filter(m => isFreeViewerRole(m.role as UserRole)).length

  // ── Vista reducida para colaboradores: solo invitar visualizadores ──────────
  if (!isMainAdmin) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Invitar visualizador</h1>
          <p className="text-sm text-text-tertiary mt-1">
            Podés sumar usuarios que solo ven y comentan, sin cargo. Para crear Administradores o
            Colaboradores, pedíselo al Admin de la consultora.
          </p>
        </div>
        <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 flex items-center justify-between gap-4">
          <p className="text-sm text-text-secondary">
            Los visualizadores no consumen seats de tu plan y no pueden modificar, borrar ni planificar nada.
          </p>
          <InviteModal seatsUsed={seatsUsed} seatsMax={seatsMax} viewerOnly personas={personas} />
        </div>
      </div>
    )
  }

  // ── Vista completa para el Admin Principal ──────────────────────────────────
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Usuarios</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {seatsUsed} de {seatsMax} seats · {viewersCount} visualizador{viewersCount !== 1 ? 'es' : ''} sin cargo
          </p>
        </div>
        <InviteModal seatsUsed={seatsUsed} seatsMax={seatsMax} personas={personas} />
      </div>

      {/* Banner de límite de seats */}
      {seatsUsed >= seatsMax && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 flex items-center justify-between text-sm">
          <p className="text-orange-700">
            Alcanzaste el límite de {seatsMax} seats de tu plan. Los visualizadores siguen siendo sin cargo.
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
              <th className="px-5 py-3 text-text-tertiary font-medium">Rol</th>
              <th className="px-5 py-3 text-text-tertiary font-medium">Seat</th>
              <th className="px-5 py-3 text-text-tertiary font-medium">Estado</th>
              <th className="px-5 py-3 text-text-tertiary font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {members?.map(m => {
              const memberProfile = m.profiles as { full_name?: string; system_role?: string } | null
              const isDev = memberProfile?.system_role === 'developer'
              const friendly = roleToFriendly(isDev ? 'developer' : (m.role as UserRole))
              const free = isFreeViewerRole(m.role as UserRole)
              return (
                <tr key={m.id} className="hover:bg-surface-base transition-colors">
                  <td className="px-5 py-4 font-medium text-text-primary">
                    {memberProfile?.full_name ?? 'Sin nombre'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${friendly.color}`}>
                      {friendly.label}
                    </span>
                    {friendly.scope && (
                      <span className="block text-[11px] text-text-tertiary mt-1">{friendly.scope}</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {free ? (
                      <span className="text-xs text-success">Sin cargo</span>
                    ) : (
                      <span className="text-xs text-text-tertiary">Consume 1</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.is_active ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-surface-elevated text-text-tertiary'}`}>
                      {m.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1.5">
                      <Link
                        href={`/dashboard/usuarios/${m.user_id}/acceso`}
                        className="text-xs text-brand-primary hover:underline"
                      >
                        Gestionar acceso
                      </Link>
                      {m.user_id !== user.id && (
                        <MemberActions
                          memberId={m.id}
                          userId={m.user_id}
                          fullName={memberProfile?.full_name ?? 'Usuario'}
                        />
                      )}
                    </div>
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
