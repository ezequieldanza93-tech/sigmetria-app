import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { canWrite, UserRole } from '@/lib/types'
import { formatCUIT } from '@/lib/utils'
import { EmpresaDocumentosSection } from '@/components/empresa-documentos-section'
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
    supabase.from('consultora_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('empresas').select('*, localidades(nombre, provincia), organizaciones_externas!art_id(nombre)').eq('id', id).single(),
  ])

  if (!empresa) notFound()

  const [{ data: establecimientos }, { data: documentos }, { data: documentTypes }] = await Promise.all([
    supabase
      .from('establecimientos')
      .select('id, nombre, tipos_establecimiento(nombre), localidades!localidad_id(nombre, provincia), cantidad_trabajadores')
      .eq('empresa_id', id)
      .neq('status', 'cancelled')
      .order('nombre'),
    supabase
      .from('empresa_documentos')
      .select('*, documento_tipos(nombre)')
      .eq('empresa_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('documento_tipos')
      .select('id, nombre, aplica_empresa, aplica_establecimiento, aplica_empleado, is_active')
      .eq('is_active', true)
      .eq('aplica_empresa', true)
      .order('nombre'),
  ])

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

      {/* Right panel — 70% */}
      <div className="flex-1 min-w-0 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Establecimientos
            <span className="ml-2 text-sm font-normal text-gray-400">({establecimientos?.length ?? 0})</span>
          </h2>
          {puedeEditar && (
            <Link
              href={`/dashboard/empresas/${id}/establecimientos/nuevo`}
              className="inline-flex items-center gap-1.5 bg-sig-500 hover:bg-sig-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <span>+</span> Nuevo Establecimiento
            </Link>
          )}
        </div>

        {!establecimientos?.length ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-4xl mb-3">🏭</p>
            <p className="text-gray-500">No hay establecimientos registrados</p>
            {puedeEditar && (
              <Link
                href={`/dashboard/empresas/${id}/establecimientos/nuevo`}
                className="mt-4 inline-block text-sig-500 hover:underline text-sm"
              >
                Agregar el primero
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr className="text-left">
                  <th className="px-5 py-3.5 text-gray-500 font-medium">Nombre</th>
                  <th className="px-5 py-3.5 text-gray-500 font-medium">Tipo</th>
                  <th className="px-5 py-3.5 text-gray-500 font-medium">Ubicación</th>
                  <th className="px-5 py-3.5 text-gray-500 font-medium text-center">Trabajadores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {establecimientos.map(est => (
                  <tr key={est.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-medium text-gray-900">
                      <Link
                        href={`/dashboard/empresas/${id}/establecimientos/${est.id}`}
                        className="hover:text-sig-500 transition-colors"
                      >
                        {est.nombre}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {(est.tipos_establecimiento as { nombre: string }[])?.[0]?.nombre ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {est.localidades ? [(est.localidades as any).nombre, (est.localidades as any).provincia].join(', ') : '—'}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-center">
                      {est.cantidad_trabajadores ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
