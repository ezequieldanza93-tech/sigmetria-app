'use client'

import { useState, useEffect, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { createPersona, deletePersona } from '@/lib/actions/persona'
import type { DirectorioPersona, TipoPersona, Empresa, Establecimiento, ActionResult } from '@/lib/types'

function PersonaForm({
  tiposPersona,
  empresas,
  onSuccess,
}: {
  tiposPersona: TipoPersona[]
  empresas: Empresa[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(
    createPersona,
    null as ActionResult<null> | null
  )
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([])

  useEffect(() => { if (state?.success) onSuccess() }, [state])

  useEffect(() => {
    if (!selectedEmpresaId) {
      setEstablecimientos([])
      return
    }
    const supabase = createClient()
    supabase
      .from('establecimientos')
      .select('*')
      .eq('empresa_id', selectedEmpresaId)
      .order('nombre')
      .then(({ data }) => setEstablecimientos((data as unknown as Establecimiento[]) ?? []))
  }, [selectedEmpresaId])

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{state.error}</div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Nombre *</label>
          <input name="nombre" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Nombre" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Apellido *</label>
          <input name="apellido" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Apellido" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Tipo de persona *</label>
        <select name="tipo_id" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Seleccioná un tipo…</option>
          {tiposPersona.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Empresa *</label>
        <select
          value={selectedEmpresaId}
          onChange={e => setSelectedEmpresaId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Seleccioná una empresa…</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Establecimiento *</label>
        <select
          name="establecimiento_id"
          required
          disabled={!selectedEmpresaId}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50"
        >
          <option value="">{selectedEmpresaId ? 'Seleccioná un establecimiento…' : 'Primero seleccioná una empresa'}</option>
          {establecimientos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">DNI</label>
          <input name="dni" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="00.000.000" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Legajo</label>
          <input name="legajo" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Nro. de legajo" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Fecha de nacimiento</label>
          <input name="fecha_nacimiento" type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Fecha de ingreso</label>
          <input name="fecha_ingreso" type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Teléfono</label>
          <input name="telefono" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="+54 11 0000-0000" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
          <input name="email" type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="correo@ejemplo.com" />
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

export default function PersonasPage() {
  const [personas, setPersonas] = useState<DirectorioPersona[] | null>(null)
  const [tiposPersona, setTiposPersona] = useState<TipoPersona[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [activeTipo, setActiveTipo] = useState<string>('todos')
  const [showModal, setShowModal] = useState(false)

  function load() {
    const supabase = createClient()
    supabase
      .from('personas_directorio')
      .select('*, personas_tipos(nombre)')
      .eq('is_active', true)
      .range(0, 99)
      .order('apellido')
      .then(({ data }) => setPersonas((data as unknown as DirectorioPersona[]) ?? []))
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.from('personas_tipos').select('*').order('nombre')
      .then(({ data }) => setTiposPersona(data ?? []))
    supabase.from('empresas').select('*').eq('is_active', true).order('razon_social')
      .then(({ data }) => setEmpresas((data as unknown as Empresa[]) ?? []))
  }, [])

  const filtered = personas === null
    ? null
    : activeTipo === 'todos'
      ? personas
      : personas.filter(p => p.tipo_id === activeTipo)

  async function handleDelete(id: string) {
    if (!confirm('¿Dar de baja a esta persona?')) return
    await deletePersona(id)
    setPersonas(prev => prev?.filter(p => p.id !== id) ?? null)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personas</h1>
          <p className="text-sm text-gray-500 mt-1">Directorio global de personas vinculadas a la consultora</p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ Nueva Persona</Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        <button
          onClick={() => setActiveTipo('todos')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          Todos {personas !== null && `(${personas.length})`}
        </button>
        {tiposPersona.map(t => {
          const count = personas?.filter(p => p.tipo_id === t.id).length ?? 0
          if (personas !== null && count === 0) return null
          return (
            <button
              key={t.id}
              onClick={() => setActiveTipo(t.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === t.id ? 'bg-sig-500 text-white border-sig-500' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {t.nombre} <span className="opacity-60">({count})</span>
            </button>
          )
        })}
      </div>

      {filtered === null ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No hay personas registradas{activeTipo !== 'todos' ? ' de este tipo' : ''}.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Apellido y nombre</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                <th className="px-5 py-3 text-gray-500 font-medium">DNI</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Legajo</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Teléfono</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{p.apellido}, {p.nombre}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {p.personas_tipos?.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{p.dni ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">{p.legajo ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">{p.telefono ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Dar de baja
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva Persona">
        <PersonaForm
          tiposPersona={tiposPersona}
          empresas={empresas}
          onSuccess={() => { setShowModal(false); load() }}
        />
      </Modal>
    </div>
  )
}
