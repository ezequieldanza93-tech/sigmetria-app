import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { canWrite, UserRole } from '@/lib/types'
import { EstablecimientoTabs } from '@/components/establecimiento-tabs'
import { EstablecimientoLocation } from '@/components/establecimiento-location'
import { TIPO_ESTABLECIMIENTO_LABELS } from '@/lib/constants'
import type { TipoEstablecimiento } from '@/lib/types'

interface Props {
  params: Promise<{ id: string; estId: string }>
  searchParams: Promise<{ tab?: string }>
}

const VALID_TABS = ['sectores', 'personas', 'asistencia', 'siniestros', 'inspecciones', 'riesgos', 'documentos'] as const
type Tab = typeof VALID_TABS[number]

export default async function EstablecimientoDetailPage({ params, searchParams }: Props) {
  const { id, estId } = await params
  const { tab } = await searchParams
  const defaultTab = (VALID_TABS as readonly string[]).includes(tab ?? '') ? tab as Tab : undefined
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: membership },
    { data: establecimiento },
    { data: empresa },
  ] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultora_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('establecimientos').select('*').eq('id', estId).single(),
    supabase.from('empresas').select('id, razon_social').eq('id', id).single(),
  ])

  if (!establecimiento || !empresa) notFound()

  const userCanWrite = canWrite(
    membership?.role as UserRole ?? null,
    profile?.system_role ?? 'user'
  )

  // Fetch all tab data in parallel
  const [
    { data: sectores },
    { data: siniestros },
    { data: inspecciones },
    { data: riesgos },
    { data: documentos },
    { data: documentTypes },
  ] = await Promise.all([
    supabase
      .from('sectores_establecimiento')
      .select('*')
      .eq('establecimiento_id', estId)
      .eq('is_active', true)
      .order('es_custom')
      .order('nombre'),
    supabase
      .from('siniestros')
      .select('*')
      .eq('establecimiento_id', estId)
      .order('fecha_ocurrencia', { ascending: false }),
    supabase
      .from('inspecciones')
      .select('*')
      .eq('establecimiento_id', estId)
      .order('fecha_programada', { ascending: false }),
    supabase
      .from('riesgos')
      .select('*')
      .eq('establecimiento_id', estId)
      .order('fecha_identificacion', { ascending: false }),
    supabase
      .from('establecimiento_documentos')
      .select('*, documento_tipos(nombre)')
      .eq('establecimiento_id', estId)
      .order('created_at', { ascending: false }),
    supabase
      .from('documento_tipos')
      .select('id, nombre, aplica_empresa, aplica_establecimiento, aplica_empleado, is_active')
      .eq('is_active', true)
      .eq('aplica_establecimiento', true)
      .order('nombre'),
  ])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
        <Link href="/dashboard/empresas" className="hover:text-gray-900">Empresas</Link>
        <span>/</span>
        <Link href={`/dashboard/empresas/${id}`} className="hover:text-gray-900">{empresa.razon_social}</Link>
        <span>/</span>
        <span className="text-gray-900">{establecimiento.nombre}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{establecimiento.nombre}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {establecimiento.tipo && (
              <span className="text-gray-500 text-sm">
                {TIPO_ESTABLECIMIENTO_LABELS[establecimiento.tipo as TipoEstablecimiento]}
              </span>
            )}
            {establecimiento.localidad && (
              <span className="text-gray-500 text-sm">
                {[establecimiento.localidad, establecimiento.provincia].filter(Boolean).join(', ')}
              </span>
            )}
            {establecimiento.cantidad_trabajadores !== null && (
              <span className="text-gray-500 text-sm">
                {establecimiento.cantidad_trabajadores} trabajadores
              </span>
            )}
          </div>
        </div>
        {userCanWrite && (
          <Link
            href={`/dashboard/empresas/${id}/establecimientos/${estId}/editar`}
            className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Editar establecimiento
          </Link>
        )}
      </div>

      {/* Location widget */}
      {establecimiento.latitude != null && establecimiento.longitude != null && (
        <EstablecimientoLocation
          lat={establecimiento.latitude}
          lng={establecimiento.longitude}
          nombre={establecimiento.nombre}
          fotoUrl={establecimiento.photo_site}
        />
      )}

      {/* Info */}
      {establecimiento.actividad_principal && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <p className="text-xs text-gray-500 font-medium mb-1">Actividad Principal</p>
          <p className="text-sm text-gray-900">{establecimiento.actividad_principal}</p>
        </div>
      )}

      {/* Tabs */}
      <EstablecimientoTabs
        establecimientoId={estId}
        empresaId={id}
        canWrite={userCanWrite}
        sectores={sectores ?? []}
        siniestros={siniestros ?? []}
        inspecciones={inspecciones ?? []}
        riesgos={riesgos ?? []}
        documentos={documentos ?? []}
        documentTypes={documentTypes ?? []}
        defaultTab={defaultTab}
      />
    </div>
  )
}
