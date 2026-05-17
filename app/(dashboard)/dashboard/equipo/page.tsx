'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DirectorioPersona } from '@/lib/types'

export default function EquipoPage() {
  const [equipo, setEquipo] = useState<DirectorioPersona[] | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('directorio_personas')
      .select('*, tipo_personas(nombre)')
      .eq('is_active', true)
      .order('apellido')
      .then(({ data }) => {
        const all = (data as unknown as DirectorioPersona[]) ?? []
        setEquipo(all.filter(p => p.tipo_personas?.nombre === 'Consultor'))
      })
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipo Consultora</h1>
          <p className="text-sm text-gray-500 mt-1">Consultores y profesionales habilitados para operar en campo</p>
        </div>
      </div>

      {equipo === null ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Cargando…</div>
      ) : equipo.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No hay consultores registrados. Agregá personas con tipo &quot;Consultor&quot; desde la sección Personas.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Apellido y nombre</th>
                <th className="px-5 py-3 text-gray-500 font-medium">DNI</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Legajo</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Teléfono</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {equipo.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{p.apellido}, {p.nombre}</td>
                  <td className="px-5 py-3.5 text-gray-500">{p.dni ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">{p.legajo ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">{p.telefono ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">{p.email ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
