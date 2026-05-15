import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/types'
import { StatCard } from '@/components/ui/stat-card'
import { DashboardFilterBar } from '@/components/dashboard-filter-bar'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ empresa?: string; est?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const { empresa: empresaId, est: estId } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: profile },
    { data: membership },
    { count: empresasCount },
    { count: establCount },
    { count: membersCount },
    { data: empresas },
    { data: allEstablecimientos },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name, system_role').eq('id', user.id).single(),
    supabase.from('consultora_members').select('role, consultoras(nombre)').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('empresas').select('*', { count: 'exact', head: true }),
    supabase.from('establecimientos').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('consultora_members').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('empresas').select('id, razon_social').eq('is_active', true).order('razon_social'),
    supabase.from('establecimientos').select('id, nombre, empresa_id').eq('is_active', true).order('nombre'),
  ])

  const isDeveloper = profile?.system_role === 'developer'
  const role = membership?.role
  const displayRole = isDeveloper ? 'developer' : role
  const consultoraNombre = (membership?.consultoras as { nombre?: string } | null)?.nombre
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuario'

  // Contextual stats when filters are active
  let contextPanel = null

  if (estId) {
    const [
      { count: openRisks },
      { count: pendingInspecciones },
      { data: docsExpirando },
      { data: establecimiento },
    ] = await Promise.all([
      supabase.from('riesgos').select('*', { count: 'exact', head: true }).eq('establecimiento_id', estId).eq('resuelto', false),
      supabase.from('inspecciones').select('*', { count: 'exact', head: true }).eq('establecimiento_id', estId).eq('estado', 'programada'),
      supabase.from('documentos').select('id, fecha_vencimiento, document_types(name), archivo_url, file_url')
        .eq('establecimiento_id', estId)
        .not('fecha_vencimiento', 'is', null)
        .lte('fecha_vencimiento', new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])
        .gte('fecha_vencimiento', new Date().toISOString().split('T')[0])
        .order('fecha_vencimiento'),
      supabase.from('establecimientos').select('id, nombre, empresa_id').eq('id', estId).single(),
    ])

    if (establecimiento) {
      contextPanel = (
        <div className="bg-white rounded-xl border border-blue-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wider mb-1">Establecimiento seleccionado</p>
              <h2 className="text-lg font-bold text-gray-900">{establecimiento.nombre}</h2>
            </div>
            <Link
              href={`/dashboard/empresas/${establecimiento.empresa_id}/establecimientos/${establecimiento.id}`}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Ver detalle →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold ${(openRisks ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{openRisks ?? 0}</p>
              <p className="text-gray-500 text-xs mt-1">Riesgos abiertos</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{pendingInspecciones ?? 0}</p>
              <p className="text-gray-500 text-xs mt-1">Inspecciones pendientes</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold ${(docsExpirando?.length ?? 0) > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>{docsExpirando?.length ?? 0}</p>
              <p className="text-gray-500 text-xs mt-1">Docs vencen en 30 días</p>
            </div>
          </div>
          {(docsExpirando?.length ?? 0) > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Documentos por vencer</p>
              <div className="space-y-1">
                {docsExpirando!.map(d => {
                  const typeName = (d.document_types as { name?: string } | null)?.name ?? '—'
                  const days = Math.ceil((new Date(d.fecha_vencimiento!).getTime() - Date.now()) / 86400000)
                  return (
                    <div key={d.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">{typeName}</span>
                      <span className={`font-medium ${days <= 7 ? 'text-red-600' : 'text-yellow-600'}`}>
                        {days === 0 ? 'Hoy' : `${days}d`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )
    }
  } else if (empresaId) {
    const [{ data: empresa }, { data: ests }] = await Promise.all([
      supabase.from('empresas').select('id, razon_social').eq('id', empresaId).single(),
      supabase.from('establecimientos').select('id, nombre, localidad, provincia, cantidad_trabajadores')
        .eq('empresa_id', empresaId).eq('is_active', true).order('nombre'),
    ])

    if (empresa) {
      contextPanel = (
        <div className="bg-white rounded-xl border border-blue-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wider mb-1">Empresa seleccionada</p>
              <h2 className="text-lg font-bold text-gray-900">{empresa.razon_social}</h2>
            </div>
            <Link
              href={`/dashboard/empresas/${empresa.id}`}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Ver detalle →
            </Link>
          </div>
          {ests && ests.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {ests.map(e => (
                <Link
                  key={e.id}
                  href={`/dashboard/empresas/${empresaId}/establecimientos/${e.id}`}
                  className="flex items-center justify-between py-2.5 hover:text-blue-600 transition-colors group"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600">{e.nombre}</span>
                    {(e.localidad || e.provincia) && (
                      <span className="text-xs text-gray-400 ml-2">{[e.localidad, e.provincia].filter(Boolean).join(', ')}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {e.cantidad_trabajadores != null ? `${e.cantidad_trabajadores} trab.` : '→'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin establecimientos registrados</p>
          )}
        </div>
      )
    }
  }

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

      {/* Filtros */}
      <DashboardFilterBar
        empresas={empresas ?? []}
        establecimientos={allEstablecimientos ?? []}
        selectedEmpresaId={empresaId ?? ''}
        selectedEstId={estId ?? ''}
      />

      {/* Panel contextual */}
      {contextPanel}

      {/* Stats generales */}
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
