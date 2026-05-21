import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { canWrite, UserRole } from '@/lib/types'
import { formatCUIT } from '@/lib/utils'

export async function EmpresasList() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: profile },
    { data: membership },
    { data: empresas },
  ] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase
      .from('empresas')
      .select(`id, razon_social, cuit, empresas_rubros(nombre), localidades(nombre, provincia), is_active, establecimientos(count)`)
      .range(0, 99)
      .order('razon_social'),
  ])

  const puedeCrear = canWrite(
    membership?.role as UserRole ?? null,
    profile?.system_role ?? 'user'
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {empresas?.length ?? 0} empresa{empresas?.length !== 1 ? 's' : ''} con acceso
          </p>
        </div>
        {puedeCrear && (
          <Link
            href="/dashboard/empresas/nueva"
            className="inline-flex items-center gap-2 bg-sig-500 hover:bg-sig-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span>+</span> Nueva Empresa
          </Link>
        )}
      </div>

      {!empresas?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-4xl mb-3">🏢</p>
          <p className="text-gray-500 font-medium">No tenés empresas asignadas aún</p>
          {puedeCrear && (
            <Link
              href="/dashboard/empresas/nueva"
              className="mt-4 inline-block text-sig-500 hover:underline text-sm"
            >
              Crear la primera empresa
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3.5 text-gray-500 font-medium">Razón Social</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium">CUIT</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium">Rubro</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium">Ubicación</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium text-center">Establec.</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {empresas.map(e => {
                const count = (e.establecimientos as unknown as { count: number }[])?.[0]?.count ?? 0
                return (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-medium text-gray-900">
                      <Link href={`/dashboard/empresas/${e.id}`} className="hover:text-sig-500 transition-colors">
                        {e.razon_social}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-gray-500 font-mono text-xs">{formatCUIT(e.cuit)}</td>
                    <td className="px-5 py-4 text-gray-500">{(e.empresas_rubros as any)?.nombre ?? '—'}</td>
                    <td className="px-5 py-4 text-gray-500">
                      {e.localidades ? [(e.localidades as any).nombre, (e.localidades as any).provincia].join(', ') : '—'}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-center">{count}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${e.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {e.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
