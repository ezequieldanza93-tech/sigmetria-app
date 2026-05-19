import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { canWrite, UserRole } from '@/lib/types'
import { formatCUIT } from '@/lib/utils'
import { EmpresaDocumentosSection } from '@/components/empresa-documentos-section'
import { EmpresaRightPanel } from '@/components/empresa-right-panel'
import type { DocumentType, Documento } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EmpresaDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }, { data: empresa }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('empresas').select('*, localidades(nombre, provincia), organizaciones_externas!art_id(nombre)').eq('id', id).single(),
  ])

  if (!empresa) notFound()

  const [{ data: establecimientos }, { data: documentos }, { data: documentTypes }] = await Promise.all([
    supabase
      .from('establecimientos')
      .select('id, nombre, establecimientos_tipos(nombre), localidades!localidad_id(nombre, provincia), cantidad_trabajadores')
      .eq('empresa_id', id)
      .neq('status', 'cancelled')
      .order('nombre'),
    supabase
      .from('empresas_documentos')
      .select('*, documentos_tipos(nombre)')
      .eq('empresa_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('documentos_tipos')
      .select('id, nombre, aplica_empresa, aplica_establecimiento, aplica_empleado, is_active')
      .eq('is_active', true)
      .eq('aplica_empresa', true)
      .order('nombre'),
  ])

  const estIds = (establecimientos ?? []).map(e => e.id)
  const [{ data: personasLinks }, { data: orgsLinks }] = estIds.length > 0
    ? await Promise.all([
        supabase
          .from('personas_establecimientos')
          .select('persona_id, establecimiento_id, personas_directorio!persona_id(id, nombre, apellido, dni, fecha_ingreso, personas_tipos!tipo_id(nombre)), establecimientos!establecimiento_id(id, nombre)')
          .in('establecimiento_id', estIds),
        supabase
          .from('organizaciones_establecimientos')
          .select('organizacion_id, establecimiento_id, organizaciones!organizacion_id(id, nombre, email, telefono, organizaciones_tipos!tipo_id(nombre)), establecimientos!establecimiento_id(id, nombre)')
          .in('establecimiento_id', estIds),
      ])
    : [{ data: [] }, { data: [] }]

  const puedeEditar = canWrite(
    membership?.role as UserRole ?? null,
    profile?.system_role ?? 'user'
  )

  return (
    <div className="flex min-h-screen">
      {/* Left panel — 30% */}
      <aside className="w-80 shrink-0 border-r border-gray-200 bg-white flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="p-6 flex-1">
          {/* Company identity */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h1 className="text-base font-bold text-gray-900 leading-tight">{empresa.razon_social}</h1>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${empresa.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {empresa.is_active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            {empresa.cuit && (
              <p className="text-xs text-gray-400 font-mono">{formatCUIT(empresa.cuit)}</p>
            )}
            {empresa.rubro && (
              <p className="text-xs text-gray-400 mt-0.5">{empresa.rubro}</p>
            )}
          </div>

          {/* Info fields */}
          <div className="space-y-3 text-sm border-t border-gray-100 pt-4 mb-6">
            {empresa.domicilio && (
              <div>
                <p className="text-gray-400 text-xs font-medium mb-0.5">Domicilio</p>
                <p className="text-gray-800">{empresa.domicilio}</p>
              </div>
            )}
            {empresa.localidades && (
              <div>
                <p className="text-gray-400 text-xs font-medium mb-0.5">Ubicación</p>
                <p className="text-gray-800">{empresa.localidades.nombre}, {empresa.localidades.provincia}</p>
              </div>
            )}
            {empresa.codigo_postal && (
              <div>
                <p className="text-gray-400 text-xs font-medium mb-0.5">CP</p>
                <p className="text-gray-800">{empresa.codigo_postal}</p>
              </div>
            )}
            {empresa.organizaciones_externas && (
              <div>
                <p className="text-gray-400 text-xs font-medium mb-0.5">ART</p>
                <p className="text-gray-800">{empresa.organizaciones_externas.nombre}</p>
              </div>
            )}
          </div>

          {/* Edit button */}
          {puedeEditar && (
            <Link
              href={`/dashboard/empresas/${id}/editar`}
              className="flex items-center justify-center w-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 text-xs font-medium px-3 py-2 rounded-lg transition-colors mb-6"
            >
              Editar información
            </Link>
          )}

          {/* Documentación */}
          <div className="border-t border-gray-100 pt-4">
            <EmpresaDocumentosSection
              empresaId={id}
              documentos={(documentos ?? []) as Documento[]}
              documentTypes={(documentTypes ?? []) as DocumentType[]}
              canWrite={puedeEditar}
            />
          </div>
        </div>
      </aside>

      <EmpresaRightPanel
        empresaId={id}
        establecimientos={(establecimientos ?? []) as any}
        personasLinks={(personasLinks ?? []) as any}
        orgsLinks={(orgsLinks ?? []) as any}
        puedeEditar={puedeEditar}
      />
    </div>
  )
}
