'use client'

import { useState, useEffect, useActionState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createPersona } from '@/lib/actions/persona'
import { addOrganizacionToEstablecimiento } from '@/lib/actions/organizacion'
import { TrabajadorModal } from '@/components/trabajador-modal'
import type { DirectorioPersona, Organizacion, ActionResult } from '@/lib/types'

function AgregarPersonaStakeholderForm({
  establecimientoId,
  tiposPersona,
  onSuccess,
  onCancel,
}: {
  establecimientoId: string
  tiposPersona: { id: string; nombre: string }[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState(createPersona, null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])
  return (
    <form action={formAction} className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
      <p className="text-xs font-semibold text-gray-700 dark:text-white uppercase tracking-wider">Nueva persona</p>
      <input type="hidden" name="establecimiento_id" value={establecimientoId} />
      <div className="grid grid-cols-2 gap-2">
        <input name="nombre" placeholder="Nombre *" required className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
        <input name="apellido" placeholder="Apellido *" required className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select name="tipo_id" required className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
          <option value="">Tipo *</option>
          {tiposPersona.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <input name="dni" placeholder="DNI" className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
      </div>
      <input name="fecha_ingreso" type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600" />
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Agregar'}</Button>
      </div>
    </form>
  )
}

function AgregarOrgStakeholderForm({
  action,
  tiposOrg,
  onSuccess,
  onCancel,
}: {
  action: (prev: ActionResult<null> | null, fd: FormData) => Promise<ActionResult<null>>
  tiposOrg: { id: string; nombre: string }[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])
  return (
    <form action={formAction} className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
      <p className="text-xs font-semibold text-gray-700 dark:text-white uppercase tracking-wider">Nueva organización externa</p>
      <input name="nombre" placeholder="Nombre *" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
      <select name="tipo_id" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
        <option value="">Tipo *</option>
        {tiposOrg.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input name="email" type="email" placeholder="Email" className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
        <input name="telefono" placeholder="Teléfono" className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
      </div>
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Agregar'}</Button>
      </div>
    </form>
  )
}

interface StakeholdersTabProps {
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}

export function StakeholdersTab({ establecimientoId, empresaId, canWrite }: StakeholdersTabProps) {
  const [personas, setPersonas] = useState<DirectorioPersona[] | null>(null)
  const [tiposPersona, setTiposPersona] = useState<{ id: string; nombre: string }[]>([])
  const [tiposOrg, setTiposOrg] = useState<{ id: string; nombre: string }[]>([])
  const [activeTipo, setActiveTipo] = useState<string>('todos')
  const [selectedPersona, setSelectedPersona] = useState<DirectorioPersona | null>(null)
  const [orgExternas, setOrgExternas] = useState<Organizacion[] | null>(null)
  const [personasOpen, setPersonasOpen] = useState(true)
  const [orgsOpen, setOrgsOpen] = useState(true)
  const [showAddPersona, setShowAddPersona] = useState(false)
  const [showAddOrg, setShowAddOrg] = useState(false)

  const loadPersonas = useCallback(() => {
    return createClient()
      .from('personas_establecimientos')
      .select('personas_directorio(id, nombre, apellido, dni, fecha_nacimiento, fecha_ingreso, legajo, telefono, email, tipo_id, personas_tipos(nombre), organizacion_id, notas, is_active)')
      .eq('establecimiento_id', establecimientoId)
      .order('personas_directorio(apellido)', { ascending: true })
      .then(({ data }) => {
        const list = ((data ?? []) as unknown as { personas_directorio: DirectorioPersona }[]).map(r => r.personas_directorio).filter(Boolean)
        list.sort((a, b) => {
          const cmp = a.apellido.localeCompare(b.apellido, 'es')
          if (cmp !== 0) return cmp
          return a.nombre.localeCompare(b.nombre, 'es')
        })
        setPersonas(list)
      })
  }, [establecimientoId])

  const loadOrgs = useCallback(() => {
    return createClient()
      .from('organizaciones_establecimientos')
      .select('organizaciones(id, nombre, email, telefono, notas, is_active, organizaciones_tipos(nombre))')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        const list = ((data ?? []) as unknown as { organizaciones: Organizacion }[])
          .map(r => r.organizaciones)
          .filter(o => o?.is_active)
        setOrgExternas(list as Organizacion[])
      })
  }, [establecimientoId])

  const orgAction = addOrganizacionToEstablecimiento.bind(null, establecimientoId, empresaId)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      loadPersonas(),
      supabase.from('personas_tipos').select('id, nombre').order('nombre').then(({ data }) => setTiposPersona(data ?? [])),
      loadOrgs(),
      supabase.from('organizaciones_tipos').select('id, nombre').order('nombre').then(({ data }) => setTiposOrg(data ?? [])),
    ])
  }, [establecimientoId, loadPersonas, loadOrgs])

  const filtered = personas === null
    ? null
    : activeTipo === 'todos'
      ? personas
      : personas.filter(p => p.tipo_id === activeTipo)

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={() => setPersonasOpen(o => !o)}
            className="flex items-center gap-3 hover:opacity-75 transition-opacity"
          >
            <span className="font-semibold text-gray-900 dark:text-white">Personas</span>
            {personas !== null && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {personas.length}
              </span>
            )}
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${personasOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
            >
              <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {canWrite && (
            <button
              onClick={() => { setShowAddPersona(true); setPersonasOpen(true) }}
              className="text-xs font-medium text-sig-600 hover:text-sig-800"
            >
              + Agregar persona
            </button>
          )}
        </div>

        {personasOpen && (
          <div className="border-t border-gray-100">
            <div className="flex gap-1 px-5 py-3 flex-wrap border-b border-gray-100">
              <button
                onClick={() => setActiveTipo('todos')}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                Todos {personas !== null && `(${personas.length})`}
              </button>
              {tiposPersona.map(t => {
                const count = personas?.filter(p => p.tipo_id === t.id).length ?? 0
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTipo(t.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === t.id ? 'bg-sig-500 text-white border-sig-500' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {t.nombre} {personas !== null && `(${count})`}
                  </button>
                )
              })}
            </div>

            {filtered === null ? (
              <div className="p-8 text-center text-gray-400 text-sm">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No hay personas registradas{activeTipo !== 'todos' ? ' de este tipo' : ''}.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 dark:border-border-subtle bg-gray-50 dark:bg-surface-sunken">
                  <tr className="text-left">
                    <th className="px-5 py-3 text-gray-500 font-medium">Nombre</th>
                    <th className="px-5 py-3 text-gray-500 font-medium">DNI</th>
                    <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                    <th className="px-5 py-3 text-gray-500 font-medium">Ingreso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setSelectedPersona(p)}
                          className="text-sig-500 hover:text-sig-700 font-medium text-left"
                        >
                          {p.apellido}, {p.nombre}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{p.dni ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {p.personas_tipos?.nombre ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{p.fecha_ingreso ? formatDate(p.fecha_ingreso) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {showAddPersona && canWrite && (
              <div className="px-5 pb-4">
                <AgregarPersonaStakeholderForm
                  establecimientoId={establecimientoId}
                  tiposPersona={tiposPersona}
                  onSuccess={() => { setShowAddPersona(false); loadPersonas() }}
                  onCancel={() => setShowAddPersona(false)}
                />
              </div>
            )}
          </div>
        )}

        {selectedPersona && (
          <TrabajadorModal
            persona={selectedPersona}
            open={!!selectedPersona}
            onClose={() => setSelectedPersona(null)}
            establecimientoId={establecimientoId}
            empresaId={empresaId}
            canWrite={canWrite}
          />
        )}
      </div>

      <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={() => setOrgsOpen(o => !o)}
            className="flex items-center gap-3 hover:opacity-75 transition-opacity"
          >
            <span className="font-semibold text-gray-900 dark:text-white">Organizaciones Externas</span>
            {orgExternas !== null && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {orgExternas.length}
              </span>
            )}
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${orgsOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
            >
              <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {canWrite && (
            <button
              onClick={() => { setShowAddOrg(true); setOrgsOpen(true) }}
              className="text-xs font-medium text-sig-600 hover:text-sig-800"
            >
              + Agregar organización
            </button>
          )}
        </div>

        {orgsOpen && (
          <div className="border-t border-gray-100">
            {orgExternas === null ? (
              <div className="p-8 text-center text-gray-400 text-sm">Cargando…</div>
            ) : orgExternas.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No hay organizaciones externas vinculadas a este establecimiento.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 dark:border-border-subtle bg-gray-50 dark:bg-surface-sunken">
                  <tr className="text-left">
                    <th className="px-5 py-3 text-gray-500 font-medium">Nombre</th>
                    <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                    <th className="px-5 py-3 text-gray-500 font-medium">Email</th>
                    <th className="px-5 py-3 text-gray-500 font-medium">Teléfono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
                  {orgExternas.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{o.nombre}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {o.organizaciones_tipos?.nombre ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{o.email ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500">{o.telefono ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {showAddOrg && canWrite && (
              <div className="px-5 pb-4">
                <AgregarOrgStakeholderForm
                  action={orgAction}
                  tiposOrg={tiposOrg}
                  onSuccess={() => { setShowAddOrg(false); loadOrgs() }}
                  onCancel={() => setShowAddOrg(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
