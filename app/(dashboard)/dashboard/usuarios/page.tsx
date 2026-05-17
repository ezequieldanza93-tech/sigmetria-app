import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { canManageUsers, ROLE_LABELS, ROLE_COLORS, UserRole } from '@/lib/types'
import { InviteModal } from '@/components/invite-modal'

export default async function UsuariosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: myMembership }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultora_members').select('role, consultora_id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
  ])

  if (!canManageUsers(myMembership?.role as UserRole ?? null, profile?.system_role ?? 'user')) {
    redirect('/dashboard')
  }

  const { data: members } = await supabase
    .from('consultora_members')
    .select('id, role, is_active, user_id, profiles(full_name, system_role)')
    .order('role')

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">
            {members?.length ?? 0} usuario{members?.length !== 1 ? 's' : ''} en la consultora
          </p>
        </div>
        <InviteModal />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr className="text-left">
              <th className="px-5 py-3.5 text-gray-500 font-medium">Nombre</th>
              <th className="px-5 py-3.5 text-gray-500 font-medium">Rol en consultora</th>
              <th className="px-5 py-3.5 text-gray-500 font-medium">Nivel sistema</th>
              <th className="px-5 py-3.5 text-gray-500 font-medium">Estado</th>
              <th className="px-5 py-3.5 text-gray-500 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {members?.map(m => {
              const memberProfile = m.profiles as { full_name?: string; system_role?: string } | null
              const isDev = memberProfile?.system_role === 'developer'
              const displayRole = isDev ? 'developer' : m.role
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-medium text-gray-900">
                    {memberProfile?.full_name ?? 'Sin nombre'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[displayRole as keyof typeof ROLE_COLORS] ?? 'bg-gray-100 text-gray-700'}`}>
                      {ROLE_LABELS[m.role as UserRole]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {isDev ? (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                        Developer
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/dashboard/usuarios/${m.user_id}/acceso`}
                      className="text-xs text-sig-500 hover:underline"
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

      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
        Solo los usuarios con rol <strong>Admin Principal</strong> pueden gestionar permisos y crear nuevos usuarios.
      </div>
    </div>
  )
}
