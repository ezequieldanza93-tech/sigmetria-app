'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { deleteOrganizacion } from '@/lib/actions/organizacion'
import type { Organizacion, TipoOrganizacion } from '@/lib/types'

export default function OrganizacionesExternasPage() {
  const [organizaciones, setOrganizaciones] = useState<Organizacion[] | null>(null)
  const [tiposOrg, setTiposOrg] = useState<TipoOrganizacion[]>([])
  const [activeTipo, setActiveTipo] = useState<string>('todos')

  function load() {
    createClient()
      .from('organizaciones_externas')
      .select('*, organizaciones_tipos(nombre)')
      .eq('is_active', true)
      .range(0, 99)
      .order('nombre')
      .then(({ data }) => setOrganizaciones((data as unknown as Organizacion[]) ?? []))
  }

  useEffect(() => {
    load()
    createClient().from('organizaciones_tipos').select('*').order('nombre')
      .then(({ data }) => setTiposOrg(data ?? []))
  }, [])

  const filtered = organizaciones === null
    ? null
    : activeTipo === 'todos'
      ? organizaciones
      : organizaciones.filter(o => o.tipo_id === activeTipo)

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta organización?')) return
    await deleteOrganizacion(id)
    setOrganizaciones(prev => prev?.filter(o => o.id !== id) ?? null)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizaciones Externas</h1>
          <p className="text-sm text-gray-500 mt-1">Proveedores, subcontratistas, marcas y organismos externos</p>
        </div>
        <Link href="/dashboard/organizaciones-externas/nueva">
          <Button>+ Nueva Organización</Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        <button
          onClick={() => setActiveTipo('todos')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          Todos {organizaciones !== null && `(${organizaciones.length})`}
        </button>
        {tiposOrg.map(t => {
          const count = organizaciones?.filter(o => o.tipo_id === t.id).length ?? 0
          return (
            <button
              key={t.id}
              onClick={() => setActiveTipo(t.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === t.id ? 'bg-sig-500 text-white border-sig-500' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {t.nombre} ({count})
            </button>
          )
        })}
      </div>

      {filtered === null ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No hay organizaciones registradas{activeTipo !== 'todos' ? ' de este tipo' : ''}.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Nombre</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Email</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Teléfono</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{o.nombre}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {o.organizaciones_tipos?.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{o.email ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">{o.telefono ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleDelete(o.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
