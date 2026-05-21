'use client'

import { useState, useEffect, useActionState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { addGestionToEstablecimiento } from '@/lib/actions/gestion-establecimiento'
import { getGestionesAplicables } from '@/lib/actions/aplicabilidad'
import { createRegistroGestion, ejecutarGestion } from '@/lib/actions/registro-gestion'
import { createObservacionGestion, cerrarObservacion } from '@/lib/actions/observacion-gestion'
import { calcularEstadoGestion } from '@/lib/types'
import type {
  GestionEstablecimiento,
  Gestion,
  RegistroGestion,
  ObservacionGestion,
  EstadoGestion,
} from '@/lib/types'

function AddGestionTree({
  gestionsNotAdded,
  onAdd,
}: {
  gestionsNotAdded: Gestion[]
  onAdd: (gestionId: string) => void
}) {
  const [openGrupos, setOpenGrupos] = useState<Set<string>>(new Set())
  const [openCategorias, setOpenCategorias] = useState<Set<string>>(new Set())

  const byGrupo = new Map<string, Map<string, Gestion[]>>()
  for (const g of gestionsNotAdded) {
    const grupoNombre = g.gestiones_categorias?.gestiones_grupos?.nombre ?? 'Sin grupo'
    const catNombre = g.gestiones_categorias?.nombre ?? 'Sin categoría'
    if (!byGrupo.has(grupoNombre)) byGrupo.set(grupoNombre, new Map())
    const byCat = byGrupo.get(grupoNombre)!
    if (!byCat.has(catNombre)) byCat.set(catNombre, [])
    byCat.get(catNombre)!.push(g)
  }

  function toggleGrupo(nombre: string) {
    setOpenGrupos(prev => { const s = new Set(prev); s.has(nombre) ? s.delete(nombre) : s.add(nombre); return s })
  }
  function toggleCategoria(key: string) {
    setOpenCategorias(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }

  if (gestionsNotAdded.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <p className="text-xs text-gray-400">Todas las gestiones ya fueron agregadas.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 mb-4">
      <p className="text-xs font-medium text-gray-600 mb-2">Seleccioná gestiones para agregar:</p>
      <div className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
        {Array.from(byGrupo.entries()).map(([grupoNombre, byCat]) => {
          const isOpen = openGrupos.has(grupoNombre)
          const total = Array.from(byCat.values()).reduce((s, g) => s + g.length, 0)
          return (
            <div key={grupoNombre}>
              <button
                onClick={() => toggleGrupo(grupoNombre)}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs font-semibold text-gray-700 dark:text-white hover:bg-white rounded-lg transition-colors"
              >
                <svg className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {grupoNombre}
                <span className="text-gray-400 font-normal ml-1">({total})</span>
              </button>
              {isOpen && Array.from(byCat.entries()).map(([catNombre, gestiones]) => {
                const catKey = `${grupoNombre}:${catNombre}`
                const isCatOpen = openCategorias.has(catKey)
                return (
                  <div key={catNombre} className="ml-4">
                    <button
                      onClick={() => toggleCategoria(catKey)}
                      className="flex items-center gap-2 w-full text-left px-2 py-1 text-xs text-gray-600 hover:bg-white rounded transition-colors"
                    >
                      <svg className={`w-2.5 h-2.5 text-gray-400 transition-transform shrink-0 ${isCatOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      {catNombre}
                      <span className="text-gray-400 font-normal">({gestiones.length})</span>
                    </button>
                    {isCatOpen && (
                      <div className="ml-4 py-0.5 space-y-0.5">
                        {gestiones.map(g => (
                          <button
                            key={g.id}
                            onClick={() => onAdd(g.id)}
                            className="block w-full text-left text-xs py-1 px-2 text-gray-700 hover:bg-sig-50 hover:text-sig-700 rounded transition-colors"
                          >
                            {g.nombre}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RegistroGestionForm({
  gestionEstablecimientoId,
  personas,
  onSuccess,
}: {
  gestionEstablecimientoId: string
  personas: { id: string; nombre: string; apellido: string }[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(createRegistroGestion, null)
  useEffect(() => { if (state?.success) onSuccess() }, [state])
  return (
    <form action={formAction} className="bg-white border border-gray-200 rounded-lg p-3 mt-2 space-y-2">
      <input type="hidden" name="gestion_establecimiento_id" value={gestionEstablecimientoId} />
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Fecha planificada *</label>
          <input name="fecha_planificada" type="date" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Responsable</label>
          <select name="responsable_id" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
            <option value="">—</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Planificar'}</Button>
      </div>
    </form>
  )
}

function ObservacionForm({
  registroGestionId,
  personas,
  onSuccess,
}: {
  registroGestionId: string
  personas: { id: string; nombre: string; apellido: string }[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(createObservacionGestion, null)
  const [categorias, setCategorias] = useState<{ id: string; nombre: string; nivel: number }[]>([])
  useEffect(() => { if (state?.success) onSuccess() }, [state])

  useEffect(() => {
    createClient().from('observaciones_categorias').select('id, nombre, nivel').order('nivel').then(({ data }) => {
      setCategorias((data ?? []) as { id: string; nombre: string; nivel: number }[])
    })
  }, [])

  return (
    <form action={formAction} className="bg-white border border-gray-200 rounded-lg p-3 mt-2 space-y-2">
      <input type="hidden" name="registro_gestion_id" value={registroGestionId} />
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Categoría</label>
        <select name="categoria_id" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
          <option value="">Seleccionar...</option>
          {categorias.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Descripción *</label>
        <textarea name="descripcion" required rows={2} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs resize-none" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Fecha límite *</label>
          <input name="fecha_planificada" type="date" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Responsable cierre</label>
          <select name="responsable_cierre_id" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
            <option value="">—</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar observación'}</Button>
      </div>
    </form>
  )
}

interface GestionesTabProps {
  establecimientoId: string
  canWrite: boolean
}

export function GestionesTab({ establecimientoId, canWrite }: GestionesTabProps) {
  type PHVASection = 'planificar' | 'hacer' | 'verificar' | 'actuar'
  const [activeSection, setActiveSection] = useState<PHVASection>('planificar')
  const [gestionesEstablecimiento, setGestionesEstablecimiento] = useState<GestionEstablecimiento[] | null>(null)
  const [todasGestiones, setTodasGestiones] = useState<Gestion[]>([])
  const [registros, setRegistros] = useState<RegistroGestion[] | null>(null)
  const [observaciones, setObservaciones] = useState<ObservacionGestion[] | null>(null)
  const [personas, setPersonas] = useState<{ id: string; nombre: string; apellido: string }[]>([])
  const [showAddGestion, setShowAddGestion] = useState(false)
  const [showRegistroForm, setShowRegistroForm] = useState<string | null>(null)
  const [showObsForm, setShowObsForm] = useState<string | null>(null)

  async function loadRegistros(geIds: string[]) {
    if (geIds.length === 0) { setRegistros([]); return [] }
    const supabase = createClient()
    const { data } = await supabase
      .from('gestiones_registros')
      .select('id, gestion_establecimiento_id, fecha_planificada, fecha_ejecutada, notas, personas_directorio(nombre, apellido)')
      .in('gestion_establecimiento_id', geIds)
      .order('fecha_planificada')
    const regData = (data as unknown as RegistroGestion[]) ?? []
    setRegistros(regData)
    return regData
  }

  async function loadObservaciones(registroIds: string[]) {
    if (registroIds.length === 0) { setObservaciones([]); return [] }
    const supabase = createClient()
    const { data } = await supabase
      .from('gestiones_observaciones')
      .select('id, registro_gestion_id, descripcion, fecha_planificada, fecha_cierre, personas_directorio!responsable_id(nombre, apellido)')
      .in('registro_gestion_id', registroIds)
      .order('fecha_planificada')
    const obsData = (data as unknown as ObservacionGestion[]) ?? []
    setObservaciones(obsData)
    return obsData
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const [geResult, personasResult] = await Promise.all([
        supabase
          .from('gestiones_establecimientos')
          .select('id, gestion_id, gestiones(nombre, categoria_id, gestiones_categorias(nombre, gestiones_grupos(nombre)))')
          .eq('establecimiento_id', establecimientoId),
        supabase
          .from('personas_directorio')
          .select('id, nombre, apellido')
          .range(0, 99)
          .eq('is_active', true)
          .order('apellido'),
      ])
      const geData = (geResult.data as unknown as GestionEstablecimiento[]) ?? []
      setPersonas((personasResult.data ?? []) as { id: string; nombre: string; apellido: string }[])
      setGestionesEstablecimiento(geData)

      const regData = await loadRegistros(geData.map(ge => ge.id))
      await loadObservaciones(regData.map(r => r.id))
    }
    init()
    getGestionesAplicables(establecimientoId).then(data => setTodasGestiones(data)).catch(() => setTodasGestiones([]))
  }, [establecimientoId])

  const PHVA_ITEMS: { id: PHVASection; label: string; icon: string }[] = [
    { id: 'planificar', label: 'Planificar', icon: 'P' },
    { id: 'hacer', label: 'Hacer', icon: 'H' },
    { id: 'verificar', label: 'Verificar', icon: 'V' },
    { id: 'actuar', label: 'Actuar', icon: 'A' },
  ]

  const estadoColors: Record<EstadoGestion, string> = {
    Realizado: 'bg-green-100 text-green-700',
    Pendiente: 'bg-red-100 text-red-700',
    Planificado: 'bg-sky-100 text-sky-700',
  }

  const gestionsNotAdded = todasGestiones.filter(
    g => !gestionesEstablecimiento?.some(ge => ge.gestion_id === g.id)
  )

  return (
    <div className="flex gap-0 min-h-[400px]">
      <nav className="w-44 shrink-0 border-r border-gray-200 pr-0 mr-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ciclo PHVA</p>
        <div className="flex flex-col gap-1">
          {PHVA_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left w-full ${
                activeSection === item.id
                  ? 'bg-sig-50 text-sig-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                activeSection === item.id ? 'bg-sig-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 min-w-0">
        {activeSection === 'planificar' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-white">Gestiones del Establecimiento</h3>
              {canWrite && (
                <button onClick={() => setShowAddGestion(v => !v)} className="text-xs text-sig-500 hover:text-sig-700 font-medium">
                  {showAddGestion ? 'Cancelar' : '+ Agregar gestión'}
                </button>
              )}
            </div>

            {showAddGestion && (
              <AddGestionTree
                gestionsNotAdded={gestionsNotAdded}
                onAdd={async (gestionId) => {
                  await addGestionToEstablecimiento(gestionId, establecimientoId)
                  const supabase = createClient()
                  supabase
                    .from('gestiones_establecimientos')
                    .select('id, gestion_id, gestiones(nombre, categoria_id, gestiones_categorias(nombre, gestiones_grupos(nombre)))')
                    .eq('establecimiento_id', establecimientoId)
                    .then(({ data }) => setGestionesEstablecimiento((data as unknown as GestionEstablecimiento[]) ?? []))
                }}
              />
            )}

            {gestionesEstablecimiento === null ? (
              <p className="text-sm text-gray-400">Cargando…</p>
            ) : gestionesEstablecimiento.length === 0 ? (
              <p className="text-sm text-gray-400">No hay gestiones asignadas a este establecimiento.</p>
            ) : (() => {
              const byGrupo = new Map<string, GestionEstablecimiento[]>()
              for (const ge of gestionesEstablecimiento) {
                const g = ge.gestiones?.gestiones_categorias?.gestiones_grupos?.nombre ?? 'Sin grupo'
                if (!byGrupo.has(g)) byGrupo.set(g, [])
                byGrupo.get(g)!.push(ge)
              }
              return (
                <div className="space-y-5">
                  {Array.from(byGrupo.entries()).map(([grupoNombre, items]) => (
                    <div key={grupoNombre}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{grupoNombre}</p>
                      <div className="space-y-2">
                        {items.map(ge => {
                          const geRegistros = registros?.filter(r => r.gestion_establecimiento_id === ge.id) ?? []
                          return (
                            <div key={ge.id} className="bg-white border border-gray-200 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{ge.gestiones?.nombre ?? '—'}</p>
                                  {ge.gestiones?.gestiones_categorias && (
                                    <p className="text-xs text-gray-400">{ge.gestiones.gestiones_categorias.nombre}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400">{geRegistros.length} registros</span>
                                  {canWrite && (
                                    <button
                                      onClick={() => setShowRegistroForm(showRegistroForm === ge.id ? null : ge.id)}
                                      className="text-xs text-sig-500 hover:text-sig-700 font-medium"
                                    >
                                      + Planificar
                                    </button>
                                  )}
                                </div>
                              </div>
                              {showRegistroForm === ge.id && (
                                <RegistroGestionForm
                                  gestionEstablecimientoId={ge.id}
                                  personas={personas}
                                  onSuccess={() => {
                                    setShowRegistroForm(null)
                                    loadRegistros(gestionesEstablecimiento.map(x => x.id)).then(setRegistros)
                                  }}
                                />
                              )}
                              {geRegistros.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {geRegistros.map(r => {
                                    const estado = calcularEstadoGestion(r.fecha_ejecutada, r.fecha_planificada)
                                    return (
                                      <div key={r.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                                        <span className="text-gray-600">{r.fecha_planificada}</span>
                                        <span className={`px-2 py-0.5 rounded-full font-medium ${estadoColors[estado]}`}>{estado}</span>
                                        {r.personas_directorio && (
                                          <span className="text-gray-400">{r.personas_directorio.apellido}</span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {activeSection === 'hacer' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-white mb-4">Ejecución de Gestiones</h3>
            {registros === null ? (
              <p className="text-sm text-gray-400">Cargando…</p>
            ) : (
              <div className="space-y-2">
                {registros
                  .filter(r => calcularEstadoGestion(r.fecha_ejecutada, r.fecha_planificada) !== 'Realizado')
                  .map(r => {
                    const estado = calcularEstadoGestion(r.fecha_ejecutada, r.fecha_planificada)
                    const ge = gestionesEstablecimiento?.find(ge => ge.id === r.gestion_establecimiento_id)
                    return (
                      <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{ge?.gestiones?.nombre ?? '—'}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Planificado: {r.fecha_planificada}</p>
                            {r.personas_directorio && (
                              <p className="text-xs text-gray-400">{r.personas_directorio.apellido}, {r.personas_directorio.nombre}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[estado]}`}>{estado}</span>
                            {canWrite && (
                              <button
                                onClick={async () => {
                                  const hoy = new Date().toISOString().split('T')[0]
                                  const fd = new FormData()
                                  fd.set('registro_id', r.id)
                                  fd.set('fecha_ejecutada', hoy)
                                  if (r.notas) fd.set('notas', r.notas)
                                  await ejecutarGestion(null, fd)
                                  loadRegistros(gestionesEstablecimiento?.map(ge => ge.id) ?? []).then(setRegistros)
                                }}
                                className="text-xs bg-sig-500 hover:bg-sig-700 text-white px-3 py-1 rounded-lg font-medium transition-colors"
                              >
                                Ejecutar
                              </button>
                            )}
                          </div>
                        </div>
                        {canWrite && (
                          <div className="mt-2">
                            <button
                              onClick={() => setShowObsForm(showObsForm === r.id ? null : r.id)}
                              className="text-xs text-sig-500 hover:text-sig-700 font-medium"
                            >
                              + Agregar observación
                            </button>
                            {showObsForm === r.id && (
                              <ObservacionForm
                                registroGestionId={r.id}
                                personas={personas}
                                onSuccess={() => {
                                  setShowObsForm(null)
                                  loadObservaciones(registros.map(x => x.id)).then(setObservaciones)
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                {registros.filter(r => calcularEstadoGestion(r.fecha_ejecutada, r.fecha_planificada) !== 'Realizado').length === 0 && (
                  <p className="text-sm text-gray-400">No hay gestiones pendientes de ejecución.</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeSection === 'verificar' && (
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <p className="text-sm font-medium text-gray-500">Dashboard de Verificación</p>
            <p className="text-xs text-gray-400 mt-1">En construcción — próxima versión.</p>
          </div>
        )}

        {activeSection === 'actuar' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-white mb-4">Observaciones — Seguimiento y Cierre</h3>
            {observaciones === null ? (
              <p className="text-sm text-gray-400">Cargando…</p>
            ) : observaciones.length === 0 ? (
              <p className="text-sm text-gray-400">No hay observaciones registradas.</p>
            ) : (
              <div className="space-y-2">
                {observaciones.map(obs => {
                  const hoy = new Date(); hoy.setHours(0,0,0,0)
                  const planDate = new Date(obs.fecha_planificada); planDate.setHours(0,0,0,0)
                  const estado = obs.fecha_cierre ? 'Cerrado' : planDate < hoy ? 'Pendiente' : 'Planificado'
                  const obsColors: Record<string, string> = { Cerrado: 'bg-sig-50 text-sig-700', Pendiente: 'bg-red-100 text-red-700', Planificado: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={obs.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-white">{obs.descripcion}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Planificado: {obs.fecha_planificada}</p>
                          {obs.personas_directorio && (
                            <p className="text-xs text-gray-400">Responsable: {obs.personas_directorio.apellido}</p>
                          )}
                          {obs.fecha_cierre && (
                            <p className="text-xs text-sig-500 mt-0.5">Cerrado: {obs.fecha_cierre}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${obsColors[estado]}`}>{estado}</span>
                          {canWrite && estado !== 'Cerrado' && (
                            <button
                              onClick={async () => {
                                const hoyStr = new Date().toISOString().split('T')[0]
                                await cerrarObservacion(obs.id, hoyStr, null)
                                loadObservaciones(registros?.map(r => r.id) ?? []).then(setObservaciones)
                              }}
                              className="text-xs bg-sig-500 hover:bg-sig-700 text-white px-3 py-1 rounded-lg font-medium transition-colors"
                            >
                              Cerrar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
