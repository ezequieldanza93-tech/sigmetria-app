import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/types'

async function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: membership }, { count: empresasCount }, { count: establCount }] =
    await Promise.all([
      supabase.from('profiles').select('full_name, system_role').eq('id', user.id).single(),
      supabase.from('consultora_members').select('role, consultoras(nombre)').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      supabase.from('empresas').select('*', { count: 'exact', head: true }),
      supabase.from('establecimientos').select('*', { count: 'exact', head: true }),
    ])

  const isDeveloper = profile?.system_role === 'developer'
  const role = membership?.role
  const displayRole = isDeveloper ? 'developer' : role
  const consultoraNombre = (membership?.consultoras as { nombre?: string } | null)?.nombre

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <div className="flex items-center gap-3 mt-2">
          {consultoraNombre && (
            <p className="text-gray-500 text-sm">{consultoraNombre}</p>
          )}
          {displayRole && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[displayRole as keyof typeof ROLE_COLORS] ?? 'bg-gray-100 text-gray-700'}`}>
              {ROLE_LABELS[displayRole]}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Empresas" value={empresasCount ?? 0} sub="con acceso" />
        <StatCard label="Establecimientos" value={establCount ?? 0} sub="habilitados" />
        <StatCard label="Tu rol" value={displayRole ? ROLE_LABELS[displayRole] : '—'} />
        <StatCard label="Estado" value="Activo" sub="sesión en curso" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Acceso según tu rol</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Ver empresas y establecimientos', allowed: true },
            { label: 'Crear / editar / borrar datos', allowed: isDeveloper || role === 'full_access_main' || role === 'full_access_branch' || role === 'colaborador' },
            { label: 'Gestionar usuarios y permisos', allowed: isDeveloper || role === 'full_access_main' },
            { label: 'Acceso a todas las empresas', allowed: isDeveloper || role === 'full_access_main' || role === 'full_access_branch' || role === 'full_viewer' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className={`text-base ${item.allowed ? 'text-green-500' : 'text-gray-300'}`}>
                {item.allowed ? '✓' : '✗'}
              </span>
              <span className={item.allowed ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
