'use client'

import { useState, useEffect, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { createOrganizacion, deleteOrganizacion } from '@/lib/actions/organizacion'
import type { Organizacion, TipoOrganizacion, ActionResult } from '@/lib/types'

function OrganizacionForm({
  tiposOrg,
  onSuccess,
}: {
  tiposOrg: TipoOrganizacion[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(
    createOrganizacion,
    null as ActionResult<null> | null
  )
  useEffect(() => { if (state?.success) onSuccess() }, [state])

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{state.error}</div>
      )}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Nombre *</label>
        <input name="nombre" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Nombre de la organización" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Tipo *</label>
        <select name="tipo_id" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Seleccioná un tipo…</option>
          {tiposOrg.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
          <input name="email" type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="correo@ejemplo.com" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Teléfono</label>
          <input name="telefono" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="+54 11 0000-0000" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Notas</label>
        <textarea name="notas" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Opcional…" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}

export default function OrganizacionesExternasPage() {
  const [organizaciones, setOrganizaciones] = useState<Organizacion[] | null>(null)
  const [tiposOrg, setTiposOrg] = useState<TipoOrganizacion[]>([])
  const [activeTipo, setActiveTipo] = useState<string>('todos')
  const [showModal, setShowModal] = useState(false)

  function load() {
    const supabase = createClient()
    supabase
      .from('organizaciones_externas')
      .select('*, tipo_organizaciones(nombre)')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setOrganizaciones((data as unknown as Organizacion[]) ?? []))
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.from('tipo_organizaciones').select('*').order('nombre')
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
        <Button onClick={() => setShowModal(true)}>+ Nueva Organización</Button>
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
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === t.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
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
                      {o.tipo_organizaciones?.nombre ?? '—'}
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva Organización Externa">
        <OrganizacionForm
          tiposOrg={tiposOrg}
          onSuccess={() => { setShowModal(false); load() }}
        />
      </Modal>
    </div>
  )
}
