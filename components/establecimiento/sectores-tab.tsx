'use client'

import { useState, useEffect, useTransition, useActionState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { SectorForm } from '@/components/forms/sector-form'
import { updateSectorTrabajadores, createSectorCustom, deleteSector } from '@/lib/actions/sector'
import { createPuesto, deletePuesto } from '@/lib/actions/puesto'
import { removeTrabajadorFromPuesto, assignTrabajadorToPuesto } from '@/lib/actions/trabajador'
import { addEppToPuesto, removeEppFromPuesto } from '@/lib/actions/epp-por-puesto'
import { TrabajadorModal } from '@/components/trabajador-modal'
import type {
  SectorEstablecimiento,
  PuestoDeTrabajo,
  TrabajadorPuesto,
  EppPorPuesto,
  Producto,
  ActionResult,
} from '@/lib/types'

// ---- TrabajadorSearchPicker ----
function TrabajadorSearchPicker({
  establecimientoId,
  puestoId,
  empresaId,
  onAssigned,
  onCancel,
}: {
  establecimientoId: string
  puestoId: string
  empresaId: string
  onAssigned: () => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [available, setAvailable] = useState<{ id: string; nombre: string; apellido: string; dni: string | null }[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [personasResult, sectorsResult] = await Promise.all([
        supabase
          .from('personas_establecimientos')
          .select('persona_id')
          .eq('establecimiento_id', establecimientoId),
        supabase
          .from('establecimientos_sectores')
          .select('id, puestos_de_trabajo(id, puestos_personas(persona_id))')
          .eq('establecimiento_id', establecimientoId),
      ])

      const assignedIds = new Set<string>()
      for (const sector of (sectorsResult.data ?? [])) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const puesto of ((sector as any).puestos_de_trabajo ?? [])) {
          for (const ep of (puesto.puestos_personas ?? [])) {
            assignedIds.add(ep.persona_id)
          }
        }
      }

      const availableIds = (personasResult.data?.map(l => l.persona_id) ?? []).filter(id => !assignedIds.has(id))

      if (availableIds.length === 0) {
        setAvailable([])
        return
      }

      const { data: persons } = await supabase
        .from('personas_directorio')
        .select('id, nombre, apellido, dni')
        .in('id', availableIds)
        .eq('is_active', true)
        .order('apellido')

      setAvailable((persons as { id: string; nombre: string; apellido: string; dni: string | null }[]) ?? [])
    }
    load()
  }, [establecimientoId])

  const filtered = (available ?? []).filter(p => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      p.apellido?.toLowerCase().includes(q) ||
      p.nombre?.toLowerCase().includes(q) ||
      p.dni?.includes(q)
    )
  })

  function assign(personaId: string) {
    setError(null)
    startTransition(async () => {
      const result = await assignTrabajadorToPuesto(puestoId, personaId, establecimientoId, empresaId)
      if (result.success) {
        onAssigned()
      } else {
        setError(result.error ?? 'Error al asignar trabajador')
      }
    })
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 mt-2 space-y-2">
      <input
        type="search"
        placeholder="Buscar por apellido, nombre o DNI…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoFocus
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sig-400"
      />
      {available === null ? (
        <p className="text-xs text-gray-400 py-2 text-center">Cargando trabajadores…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-400 py-2 text-center">
          {query ? 'Sin resultados para esa búsqueda.' : 'No hay trabajadores sin sector asignado.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-48 overflow-y-auto rounded border border-gray-200 bg-white">
          {filtered.map(p => (
            <li key={p.id}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => assign(p.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-sig-50 transition-colors disabled:opacity-50"
              >
                <span className="font-medium text-gray-800 dark:text-white">{p.apellido}, {p.nombre}</span>
                {p.dni && <span className="text-gray-400 text-xs ml-2">DNI {p.dni}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  )
}

// ---- PuestoInlineForm ----
function PuestoInlineForm({
  action,
  onSuccess,
  onCancel,
}: {
  action: (prev: ActionResult<null> | null, fd: FormData) => Promise<ActionResult<null>>
  onSuccess: () => void
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])
  return (
    <form action={formAction} className="mt-2 space-y-2 bg-gray-50 rounded-lg p-3">
      <div className="flex gap-2">
        <input
          name="nombre"
          placeholder="Nombre del puesto *"
          required
          className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
        />
        <select
          name="tipo"
          required
          className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="">Tipo *</option>
          <option value="operativo">Operativo</option>
          <option value="administrativo">Administrativo</option>
        </select>
      </div>
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" type="submit" disabled={pending}>{pending ? '…' : 'Agregar'}</Button>
      </div>
    </form>
  )
}

// ---- EppInlineForm ----
function EppInlineForm({
  action,
  onSuccess,
  onCancel,
}: {
  action: (prev: ActionResult<null> | null, fd: FormData) => Promise<ActionResult<null>>
  onSuccess: () => void
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const [productos, setProductos] = useState<Producto[] | null>(null)

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('productos')
      .select('id, nombre, tamano, unidad_id, unidades(simbolo), productos_categorias(nombre)')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setProductos((data as unknown as Producto[]) ?? []))
  }, [])

  return (
    <form action={formAction} className="bg-sig-50 rounded-lg p-3 mt-2 space-y-2">
      <p className="text-xs font-semibold text-sig-700 mb-1">Agregar EPP</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-600 block mb-1">Producto *</label>
          <select name="producto_id" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
            <option value="">Seleccioná…</option>
            {productos === null ? (
              <option disabled>Cargando…</option>
            ) : (
              productos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.tamano ? ` ${p.tamano}${p.unidades?.simbolo ?? ''}` : ''}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Vida útil (hs)</label>
          <input name="horas_vida_util" type="number" min="0" step="0.5" placeholder="Opcional" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" type="submit" disabled={pending}>{pending ? '…' : 'Agregar'}</Button>
      </div>
    </form>
  )
}

// ---- PuestoRow ----
function PuestoRow({
  puesto,
  establecimientoId,
  empresaId,
  canWrite,
  canDelete,
  onDeleted,
}: {
  puesto: PuestoDeTrabajo
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  canDelete: boolean
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [personas, setPersonas] = useState<TrabajadorPuesto[] | null>(null)
  const [epp, setEpp] = useState<EppPorPuesto[] | null>(null)
  const [showAddPersona, setShowAddPersona] = useState(false)
  const [showAddEpp, setShowAddEpp] = useState(false)
  const [selectedEp, setSelectedEp] = useState<TrabajadorPuesto | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    if (personas === null) {
      supabase
        .from('puestos_personas')
        .select('id, persona_id, fecha_desde, personas_directorio(id, nombre, apellido, dni, fecha_ingreso, legajo, telefono, email, tipo_id, personas_tipos(nombre))')
        .eq('puesto_id', puesto.id)
        .then(({ data }) => setPersonas((data as unknown as TrabajadorPuesto[]) ?? []))
    }
    if (epp === null) {
      supabase
        .from('puestos_epp')
        .select('id, puesto_id, producto_id, horas_vida_util, productos(id, nombre, tamano, unidad_id, unidades(simbolo), productos_categorias(nombre))')
        .eq('puesto_id', puesto.id)
        .then(({ data }) => setEpp((data as unknown as EppPorPuesto[]) ?? []))
    }
  }, [open, personas, epp, puesto.id])

  function handleRemovePersona(epId: string) {
    startTransition(async () => {
      await removeTrabajadorFromPuesto(epId, establecimientoId, empresaId)
      setPersonas(prev => prev?.filter(e => e.id !== epId) ?? null)
    })
  }

  function handleRemoveEpp(eppId: string) {
    startTransition(async () => {
      await removeEppFromPuesto(eppId, establecimientoId, empresaId)
      setEpp(prev => prev?.filter(e => e.id !== eppId) ?? null)
    })
  }

  function handleDeletePuesto() {
    startTransition(async () => {
      await deletePuesto(puesto.id, establecimientoId, empresaId)
      onDeleted()
    })
  }

  const eppAction = addEppToPuesto.bind(null, puesto.id, establecimientoId, empresaId)

  return (
    <div className="border border-gray-100 rounded-lg">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 flex-1 text-left text-sm font-medium text-gray-800 dark:text-white hover:text-gray-900"
        >
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {puesto.nombre}
          {puesto.tipo && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              puesto.tipo === 'operativo'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-purple-50 text-purple-700'
            }`}>
              {puesto.tipo === 'operativo' ? 'Op.' : 'Admin.'}
            </span>
          )}
          {personas !== null && (
            <span className="text-xs text-gray-400 font-normal">({personas.length} trabajador{personas.length !== 1 ? 'es' : ''})</span>
          )}
          {epp !== null && epp.length > 0 && (
            <span className="text-xs bg-sig-50 text-sig-700 font-medium px-1.5 py-0.5 rounded">{epp.length} EPP</span>
          )}
        </button>
        {canDelete && (
          <button
            onClick={handleDeletePuesto}
            disabled={isPending}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Eliminar
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-3 border-t border-gray-50 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2 mb-1">Trabajadores</p>
            {personas === null ? (
              <p className="text-xs text-gray-400 py-1">Cargando…</p>
            ) : personas.length === 0 && !showAddPersona ? (
              <p className="text-xs text-gray-400 py-1">Sin trabajadores en este puesto.</p>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-border-subtle">
                {personas.map(ep => (
                  <li key={ep.id} className="flex items-center justify-between py-1.5 text-sm">
                    <button
                      onClick={() => setSelectedEp(ep)}
                      className="text-left text-sig-500 hover:text-sig-700 font-medium"
                    >
                      {ep.personas_directorio?.apellido}, {ep.personas_directorio?.nombre}
                      {ep.personas_directorio?.dni && <span className="text-gray-400 text-xs font-normal ml-2">DNI {ep.personas_directorio.dni}</span>}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleRemovePersona(ep.id)}
                        disabled={isPending}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Quitar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canWrite && !showAddPersona && (
              <button
                onClick={() => setShowAddPersona(true)}
                className="mt-1 text-xs text-sig-500 hover:text-sig-700 font-medium"
              >
                + Agregar trabajador
              </button>
            )}
            {showAddPersona && (
              <TrabajadorSearchPicker
                puestoId={puesto.id}
                establecimientoId={establecimientoId}
                empresaId={empresaId}
                onAssigned={() => { setShowAddPersona(false); setPersonas(null) }}
                onCancel={() => setShowAddPersona(false)}
              />
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">EPP Requerido</p>
            {epp === null ? (
              <p className="text-xs text-gray-400 py-1">Cargando…</p>
            ) : epp.length === 0 && !showAddEpp ? (
              <p className="text-xs text-gray-400 py-1">Sin EPP definido.</p>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-border-subtle">
                 {epp.map(e => {
                   // eslint-disable-next-line @typescript-eslint/no-explicit-any
                   const unidadSimbolo = (e.productos as any).unidades?.simbolo ?? ''
                   return (
                   <li key={e.id} className="flex items-center justify-between py-1.5 text-sm">
                     <span className="text-gray-800">
                       {e.productos?.nombre}
                       {e.productos?.tamano && <span className="text-gray-500 ml-1">{e.productos.tamano}{unidadSimbolo}</span>}
                       {e.horas_vida_util && <span className="text-gray-400 text-xs ml-2">{e.horas_vida_util}hs vida útil</span>}
                     </span>
                     {canDelete && (
                       <button
                         onClick={() => handleRemoveEpp(e.id)}
                         disabled={isPending}
                         className="text-xs text-red-400 hover:text-red-600"
                       >
                         Quitar
                       </button>
                     )}
                   </li>
                   )
                 })}
              </ul>
            )}
            {canWrite && !showAddEpp && (
              <button
                onClick={() => setShowAddEpp(true)}
                className="mt-1 text-xs text-sig-500 hover:text-sig-700 font-medium"
              >
                + Agregar EPP
              </button>
            )}
            {showAddEpp && (
              <EppInlineForm
                action={eppAction}
                onSuccess={() => { setShowAddEpp(false); setEpp(null) }}
                onCancel={() => setShowAddEpp(false)}
              />
            )}
          </div>
        </div>
      )}

      {selectedEp?.personas_directorio && (
        <TrabajadorModal
          persona={selectedEp.personas_directorio}
          open={!!selectedEp}
          onClose={() => setSelectedEp(null)}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
    </div>
  )
}

// ---- SectorRow ----
function SectorRow({
  sector,
  establecimientoId,
  empresaId,
  canWrite,
  canDelete,
  onDeleted,
}: {
  sector: SectorEstablecimiento
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  canDelete: boolean
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [puestos, setPuestos] = useState<PuestoDeTrabajo[] | null>(null)
  const [showAddPuesto, setShowAddPuesto] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingVal, setEditingVal] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || puestos !== null) return
    const supabase = createClient()
    supabase
      .from('puestos_de_trabajo')
      .select('id, nombre, tipo')
      .eq('sector_id', sector.id)
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setPuestos((data as PuestoDeTrabajo[]) ?? []))
  }, [open, puestos, sector.id])

  function saveWorkers(sectorId: string) {
    const val = parseInt(editingVal, 10)
    if (isNaN(val) || val < 0) return
    startTransition(async () => {
      await updateSectorTrabajadores(sectorId, val, establecimientoId, empresaId)
      setEditingId(null)
    })
  }

  function handleDeleteSector() {
    startTransition(async () => {
      await deleteSector(sector.id, establecimientoId, empresaId)
      onDeleted()
    })
  }

  const puestoAction = createPuesto.bind(null, sector.id, establecimientoId, empresaId)

  return (
    <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle">
      <div className="flex items-center gap-3 px-5 py-3.5">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-gray-900 text-sm">{sector.nombre}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sector.es_custom ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
            {sector.es_custom ? 'Custom' : 'Predefinido'}
          </span>
          {puestos !== null && (
            <span className="text-xs text-gray-400">{puestos.length} puesto{puestos.length !== 1 ? 's' : ''}</span>
          )}
        </button>

        {canWrite && editingId === sector.id ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number" min="0" value={editingVal}
              onChange={e => setEditingVal(e.target.value)}
              className="w-16 border border-gray-300 rounded px-2 py-1 text-xs text-center"
              autoFocus
            />
            <Button size="sm" onClick={() => saveWorkers(sector.id)} disabled={isPending}>OK</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>×</Button>
          </div>
        ) : (
          <button
            onClick={() => canWrite && (setEditingId(sector.id), setEditingVal(sector.cantidad_trabajadores.toString()))}
            className={`text-sm text-gray-500 ${canWrite ? 'hover:text-sig-500 cursor-pointer' : 'cursor-default'}`}
            title={canWrite ? 'Click para editar trabajadores' : undefined}
          >
            {sector.cantidad_trabajadores} trabajadores
          </button>
        )}

        {canDelete && sector.es_custom && (
          <button
            onClick={handleDeleteSector}
            disabled={isPending}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Eliminar
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-gray-100 px-5 py-3 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Puestos de trabajo</p>

          {puestos === null ? (
            <p className="text-xs text-gray-400">Cargando…</p>
          ) : puestos.length === 0 && !showAddPuesto ? (
            <p className="text-xs text-gray-400">Sin puestos definidos.</p>
          ) : (
            <div className="space-y-1.5">
              {puestos.map(puesto => (
                <PuestoRow
                  key={puesto.id}
                  puesto={puesto}
                  establecimientoId={establecimientoId}
                  empresaId={empresaId}
                  canWrite={canWrite}
                  canDelete={canDelete}
                  onDeleted={() => setPuestos(prev => prev?.filter(p => p.id !== puesto.id) ?? null)}
                />
              ))}
            </div>
          )}

          {canWrite && !showAddPuesto && (
            <button
              onClick={() => setShowAddPuesto(true)}
              className="text-xs text-sig-500 hover:text-sig-700 font-medium mt-1"
            >
              + Agregar puesto
            </button>
          )}

          {showAddPuesto && (
            <PuestoInlineForm
              action={puestoAction}
              onSuccess={() => { setShowAddPuesto(false); setPuestos(null) }}
              onCancel={() => setShowAddPuesto(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ---- SectoresTab (main export) ----
interface SectoresTabProps {
  sectores: SectorEstablecimiento[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  canDelete: boolean
}

export function SectoresTab({ sectores, establecimientoId, empresaId, canWrite, canDelete }: SectoresTabProps) {
  const [showModal, setShowModal] = useState(false)
  const [localSectores, setLocalSectores] = useState(sectores)
  const [workerCounts, setWorkerCounts] = useState<{ operativo: number; administrativo: number } | null>(null)
  const sectorAction = createSectorCustom.bind(null, establecimientoId, empresaId)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('establecimientos_sectores')
      .select('id, puestos_de_trabajo(tipo, puestos_personas(persona_id))')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        const ops = new Set<string>()
        const adm = new Set<string>()
        /* eslint-disable @typescript-eslint/no-explicit-any */
        ;(data ?? []).forEach((s: any) => {
          ;(s.puestos_de_trabajo ?? []).filter((p: any) => p.tipo !== null).forEach((p: any) => {
            ;(p.puestos_personas ?? []).forEach((ep: any) => {
              if (p.tipo === 'operativo') ops.add(ep.persona_id)
              else adm.add(ep.persona_id)
            })
          })
        })
        /* eslint-enable @typescript-eslint/no-explicit-any */
        setWorkerCounts({ operativo: ops.size, administrativo: adm.size })
      })
  }, [establecimientoId])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Sectores del Establecimiento</h3>
          {workerCounts !== null && (workerCounts.operativo > 0 || workerCounts.administrativo > 0) && (
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="text-blue-600 font-medium">{workerCounts.operativo} operativo{workerCounts.operativo !== 1 ? 's' : ''}</span>
              <span className="text-gray-300 mx-1.5">·</span>
              <span className="text-purple-600 font-medium">{workerCounts.administrativo} administrativo{workerCounts.administrativo !== 1 ? 's' : ''}</span>
            </p>
          )}
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>
            + Sector Personalizado
          </Button>
        )}
      </div>

      {localSectores.length === 0 ? (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle p-8 text-center text-gray-400 text-sm">
          No hay sectores registrados
        </div>
      ) : (
        <div className="space-y-2">
          {localSectores.map(sector => (
            <SectorRow
              key={sector.id}
              sector={sector}
              establecimientoId={establecimientoId}
              empresaId={empresaId}
              canWrite={canWrite}
              canDelete={canDelete}
              onDeleted={() => setLocalSectores(prev => prev.filter(s => s.id !== sector.id))}
            />
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Agregar Sector Personalizado">
        <SectorForm
          action={sectorAction}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}
