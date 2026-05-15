import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/types'
import { DashboardFilterBar } from '@/components/dashboard-filter-bar'
import { PHVADiagram } from '@/components/phva-diagram'
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
    { data: empresas },
    { data: allEstablecimientos },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name, system_role').eq('id', user.id).single(),
    supabase.from('consultora_members').select('role, consultoras(nombre)').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('empresas').select('id, razon_social').eq('is_active', true).order('razon_social'),
    supabase.from('establecimientos').select('id, nombre, empresa_id').eq('is_active', true).order('nombre'),
  ])

  const isDeveloper = profile?.system_role === 'developer'
  const role = membership?.role
  const displayRole = isDeveloper ? 'developer' : role

  // Contextual info panel when filters are active
  let contextLabel: string | null = null
  let contextHref: string | null = null
  let contextStats: { label: string; value: number; highlight?: boolean }[] = []

  if (estId && empresaId) {
    const [
      { count: openRisks },
      { count: pendingInspecciones },
      { data: docsExpirando },
      { data: est },
    ] = await Promise.all([
      supabase.from('riesgos').select('*', { count: 'exact', head: true }).eq('establecimiento_id', estId).eq('resuelto', false),
      supabase.from('inspecciones').select('*', { count: 'exact', head: true }).eq('establecimiento_id', estId).eq('estado', 'programada'),
      supabase.from('documentos').select('id')
        .eq('establecimiento_id', estId)
        .not('fecha_vencimiento', 'is', null)
        .lte('fecha_vencimiento', new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])
        .gte('fecha_vencimiento', new Date().toISOString().split('T')[0]),
      supabase.from('establecimientos').select('nombre').eq('id', estId).single(),
    ])
    contextLabel = est?.nombre ?? null
    contextHref = `/dashboard/empresas/${empresaId}/establecimientos/${estId}`
    contextStats = [
      { label: 'Riesgos abiertos', value: openRisks ?? 0, highlight: (openRisks ?? 0) > 0 },
      { label: 'Inspecciones prog.', value: pendingInspecciones ?? 0 },
      { label: 'Docs vencen 30d', value: docsExpirando?.length ?? 0, highlight: (docsExpirando?.length ?? 0) > 0 },
    ]
  } else if (empresaId) {
    const { data: empresa } = await supabase.from('empresas').select('razon_social').eq('id', empresaId).single()
    contextLabel = empresa?.razon_social ?? null
    contextHref = `/dashboard/empresas/${empresaId}`
  }

  return (
    <div className="min-h-full flex flex-col">

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-5xl mx-auto">
          <DashboardFilterBar
            empresas={empresas ?? []}
            establecimientos={allEstablecimientos ?? []}
            selectedEmpresaId={empresaId ?? ''}
            selectedEstId={estId ?? ''}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-2xl">

          {/* Context label when filter active */}
          {contextLabel && (
            <div className="mb-6 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1" style={{ fontFamily: 'Poppins, system-ui' }}>
                {estId ? 'Establecimiento' : 'Empresa'}
              </p>
              <Link
                href={contextHref ?? '#'}
                className="text-lg font-bold text-gray-800 hover:text-green-700 transition-colors"
                style={{ fontFamily: 'Montserrat, system-ui' }}
              >
                {contextLabel} →
              </Link>

              {/* Stats row */}
              {contextStats.length > 0 && (
                <div className="flex justify-center gap-6 mt-4">
                  {contextStats.map((s) => (
                    <div key={s.label} className="text-center">
                      <p className={`text-2xl font-bold ${s.highlight ? 'text-red-500' : 'text-gray-700'}`} style={{ fontFamily: 'Montserrat, system-ui' }}>
                        {s.value}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Poppins, system-ui' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No filter hint */}
          {!contextLabel && (
            <div className="mb-6 text-center">
              <p className="text-xs uppercase tracking-widest text-gray-300 mb-1" style={{ fontFamily: 'Poppins, system-ui' }}>
                Sistema de gestión de la SST
              </p>
              <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: 'Montserrat, system-ui' }}>
                Ciclo PHVA · ISO 45001
              </h1>
              {(!empresaId && !estId) && (
                <p className="text-xs text-gray-400 mt-2" style={{ fontFamily: 'Poppins, system-ui' }}>
                  Seleccioná una empresa y establecimiento para ver el detalle de cada fase
                </p>
              )}
            </div>
          )}

          {/* PHVA Diagram */}
          <PHVADiagram empresaId={empresaId} establecimientoId={estId} />

          {/* Quick links (no filter active) */}
          {!empresaId && !estId && (
            <div className="mt-8 flex justify-center gap-4 flex-wrap">
              <Link
                href="/dashboard/empresas"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:text-green-700 hover:border-green-200 hover:bg-green-50 transition-colors"
                style={{ fontFamily: 'Poppins, system-ui' }}
              >
                Ver todas las empresas →
              </Link>
              {(isDeveloper || role === 'full_access_main' || role === 'full_access_branch') && (
                <Link
                  href="/dashboard/empresas/nueva"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 rounded-lg text-sm text-white hover:bg-green-700 transition-colors"
                  style={{ fontFamily: 'Poppins, system-ui' }}
                >
                  + Nueva empresa
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
