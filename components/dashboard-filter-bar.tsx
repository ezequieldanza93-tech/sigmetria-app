'use client'

import { useRouter, usePathname } from 'next/navigation'

interface Props {
  empresas: { id: string; razon_social: string }[]
  establecimientos: { id: string; nombre: string; empresa_id: string }[]
  selectedEmpresaId: string
  selectedEstId: string
}

export function DashboardFilterBar({ empresas, establecimientos, selectedEmpresaId, selectedEstId }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const filteredEsts = selectedEmpresaId
    ? establecimientos.filter(e => e.empresa_id === selectedEmpresaId)
    : []

  function handleEmpresaChange(value: string) {
    const params = new URLSearchParams()
    if (value) params.set('empresa', value)
    router.push(params.size ? `${pathname}?${params}` : pathname)
  }

  function handleEstChange(value: string) {
    const params = new URLSearchParams()
    if (selectedEmpresaId) params.set('empresa', selectedEmpresaId)
    if (value) params.set('est', value)
    router.push(params.size ? `${pathname}?${params}` : pathname)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap mb-6">
      <select
        value={selectedEmpresaId}
        onChange={e => handleEmpresaChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px] bg-white"
      >
        <option value="">Todas las empresas</option>
        {empresas.map(e => (
          <option key={e.id} value={e.id}>{e.razon_social}</option>
        ))}
      </select>

      <select
        value={selectedEstId}
        onChange={e => handleEstChange(e.target.value)}
        disabled={!selectedEmpresaId || filteredEsts.length === 0}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px] bg-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Todos los establecimientos</option>
        {filteredEsts.map(e => (
          <option key={e.id} value={e.id}>{e.nombre}</option>
        ))}
      </select>

      {(selectedEmpresaId || selectedEstId) && (
        <button
          onClick={() => router.push(pathname)}
          className="text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          × Limpiar
        </button>
      )}
    </div>
  )
}
