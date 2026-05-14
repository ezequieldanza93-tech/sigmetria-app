import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function EmpresasPage() {
  const supabase = await createClient()

  const { data: empresas } = await supabase
    .from('empresas')
    .select(`
      id, razon_social, cuit, rubro, localidad, provincia, is_active,
      establecimientos(count)
    `)
    .order('razon_social')

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-gray-500 text-sm mt-1">{empresas?.length ?? 0} empresa{empresas?.length !== 1 ? 's' : ''} con acceso</p>
        </div>
      </div>

      {!empresas?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-4xl mb-3">🏢</p>
          <p className="text-gray-500">No tenés empresas asignadas aún</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-left">
                <th className="px-5 py-3.5 text-gray-500 font-medium">Razón Social</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium">CUIT</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium">Rubro</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium">Ubicación</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium">Establec.</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {empresas.map(e => {
                const count = (e.establecimientos as unknown as { count: number }[])?.[0]?.count ?? 0
                return (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-medium text-gray-900">
                      <Link href={`/dashboard/empresas/${e.id}`} className="hover:text-blue-600">
                        {e.razon_social}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-gray-500 font-mono text-xs">{e.cuit ?? '—'}</td>
                    <td className="px-5 py-4 text-gray-500">{e.rubro ?? '—'}</td>
                    <td className="px-5 py-4 text-gray-500">
                      {[e.localidad, e.provincia].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-5 py-4 text-gray-500">{count}</td>
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
