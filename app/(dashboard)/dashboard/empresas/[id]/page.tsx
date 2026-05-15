import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { canWrite, UserRole } from '@/lib/types'
import { formatCUIT } from '@/lib/utils'
import { TIPO_ESTABLECIMIENTO_LABELS } from '@/lib/constants'
import { EmpresaDocumentosSection } from '@/components/empresa-documentos-section'
import type { TipoEstablecimiento, DocumentType, Documento } from '@/lib/types'

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
    supabase
      .from('empresas')
      .select('*')
      .eq('id', id)
      .single(),
  ])

  if (!empresa) notFound()

  const [{ data: establecimientos }, { data: documentos }, { data: documentTypes }] = await Promise.all([
    supabase
      .from('establecimientos')
      .select('id, nombre, tipo, localidad, provincia, cantidad_trabajadores, latitude, longitude, is_active')
      .eq('empresa_id', id)
      .eq('is_active', true)
      .order('nombre'),
    supabase
      .from('documentos')
      .select('*, document_types(name)')
      .eq('empresa_id', id)
      .is('establecimiento_id', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('document_types')
      .select('id, name, applies_to, is_active')
      .eq('is_active', true)
      .order('name'),
  ])

  const puedeEditar = canWrite(
    membership?.role as UserRole ?? null,
    profile?.system_role ?? 'user'
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard/empresas" className="hover:text-gray-900">Empresas</Link>
        <span>/</span>
        <span className="text-gray-900">{empresa.razon_social}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{empresa.razon_social}</h1>
          <div className="flex items-center gap-3 mt-1">
            {empresa.cuit && (
              <span className="text-gray-500 text-sm font-mono">{formatCUIT(empresa.cuit)}</span>
            )}
            {empresa.rubro && (
              <span className="text-gray-500 text-sm">— {empresa.rubro}</span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${empresa.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {empresa.is_active ? 'Activa' : 'Inactiva'}
            </span>
          </div>
        </div>
        {puedeEditar && (
          <Link
            href={`/dashboard/empresas/${id}/editar`}
            className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Editar empresa
          </Link>
        )}
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-500 text-xs font-medium mb-1">Domicilio</p>
          <p className="text-gray-900">{empresa.domicilio ?? '—'}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs font-medium mb-1">Localidad</p>
          <p className="text-gray-900">{empresa.localidad ?? '—'}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs font-medium mb-1">Provincia</p>
          <p className="text-gray-900">{empresa.provincia ?? '—'}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs font-medium mb-1">CP</p>
          <p className="text-gray-900">{empresa.codigo_postal ?? '—'}</p>
        </div>
      </div>


      {/* Establecimientos */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Establecimientos
          <span className="ml-2 text-sm font-normal text-gray-500">({establecimientos?.length ?? 0})</span>
        </h2>
        {puedeEditar && (
          <Link
            href={`/dashboard/empresas/${id}/establecimientos/nuevo`}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
              className="mt-4 inline-block text-blue-600 hover:underline text-sm"
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
                      className="hover:text-blue-600 transition-colors"
                    >
                      {est.nombre}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {est.tipo ? (TIPO_ESTABLECIMIENTO_LABELS[est.tipo as TipoEstablecimiento] ?? est.tipo) : '—'}
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {[est.localidad, est.provincia].filter(Boolean).join(', ') || '—'}
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
      {/* Documentos de la empresa */}
      <div className="mt-8">
        <EmpresaDocumentosSection
          empresaId={id}
          documentos={(documentos ?? []) as Documento[]}
          documentTypes={(documentTypes ?? []) as DocumentType[]}
          canWrite={puedeEditar}
        />
      </div>
    </div>
  )
}
