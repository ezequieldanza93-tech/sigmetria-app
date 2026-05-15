import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/types'
import { StatCard } from '@/components/ui/stat-card'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: profile },
    { data: membership },
    { count: empresasCount },
    { count: establCount },
    { count: membersCount },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name, system_role').eq('id', user.id).single(),
    supabase
      .from('consultora_members')
      .select('role, consultoras(nombre)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
    supabase.from('empresas').select('*', { count: 'exact', head: true }),
    supabase.from('establecimientos').select('*', { count: 'exact', head: true }),
    supabase.from('consultora_members').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ])

  const isDeveloper = profile?.system_role === 'developer'
  const role = membership?.role
  const displayRole = isDeveloper ? 'developer' : role
  const consultoraNombre = (membership?.consultoras as { nombre?: string } | null)?.nombre

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuario'

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {firstName}
        </h1>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {consultoraNombre && (
            <p className="text-gray-500 text-sm">{consultoraNombre}</p>
          )}
          {displayRole && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${(ROLE_COLORS as Record<string, string>)[displayRole] ?? 'bg-gray-100 text-gray-700'}`}>
              {(ROLE_LABELS as Record<string, string>)[displayRole]}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Empresas" value={empresasCount ?? 0} sub="con acceso" />
        <StatCard label="Establecimientos" value={establCount ?? 0} sub="habilitados" />
        {(isDeveloper || role === 'full_access_main' || role === 'full_access_branch') && (
          <StatCard label="Usuarios en consultora" value={membersCount ?? 0} sub="activos" />
        )}
        <StatCard label="Tu rol" value={displayRole ? (ROLE_LABELS as Record<string, string>)[displayRole] : '—'} />
      </div>

      {/* Permisos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Acceso según tu rol</h2>
          <div className="space-y-2.5 text-sm">
            {[
              { label: 'Ver empresas y establecimientos', allowed: true },
              {
                label: 'Crear / editar datos',
                allowed: isDeveloper || role === 'full_access_main' || role === 'full_access_branch' || role === 'colaborador',
              },
              {
                label: 'Gestionar usuarios y permisos',
                allowed: isDeveloper || role === 'full_access_main',
              },
              {
                label: 'Acceso a todas las empresas',
                allowed: isDeveloper || role === 'full_access_main' || role === 'full_access_branch' || role === 'full_viewer',
              },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className={`text-base font-bold ${item.allowed ? 'text-green-500' : 'text-gray-200'}`}>
                  {item.allowed ? '✓' : '✗'}
                </span>
                <span className={item.allowed ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Accesos Rápidos</h2>
          <div className="space-y-2">
            <Link
              href="/dashboard/empresas"
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors text-sm text-gray-700 hover:text-gray-900"
            >
              <span>🏢</span> Ver todas las empresas
            </Link>
            {(isDeveloper || role === 'full_access_main' || role === 'full_access_branch') && (
              <Link
                href="/dashboard/empresas/nueva"
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors text-sm text-gray-700 hover:text-gray-900"
              >
                <span>➕</span> Nueva empresa
              </Link>
            )}
            {(isDeveloper || role === 'full_access_main') && (
              <Link
                href="/dashboard/usuarios"
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors text-sm text-gray-700 hover:text-gray-900"
              >
                <span>👥</span> Gestionar usuarios
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
