'use client'

import { useState, useEffect, useActionState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcularEstadoGestion } from '@/lib/types'
import type { EstadoGestion, Gestion, CategoriaGestion, GrupoGestion, GestionEstablecimiento, RegistroGestion, Riesgo, RiesgoNivel } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { planificarGestion, planificarGestionNueva } from '@/lib/actions/gestion-establecimiento'
import { ejecutarGestion } from '@/lib/actions/registro-gestion'
import { RIESGO_NIVEL_LABELS } from '@/lib/constants'
import { RIESGO_NIVEL_COLORS } from '@/lib/types'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const ESTADO_COLORS: Record<EstadoGestion, string> = {
  Ejecutado: 'bg-sig-50 text-sig-700',
  Pendiente: 'bg-red-100 text-red-700',
  Planificado: 'bg-gray-100 text-gray-600',
}

function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round(
    (new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime()) / 86400000
  )
}

function todayYMD() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface FullRegistro extends RegistroGestion {
  ge_gestion_nombre?: string
  ge_categoria_nombre?: string
  ge_grupo_nombre?: string
  ge_id?: string
  responsable_nombre?: string
  aprobado_nombre?: string
}

interface GestionConJoin extends Omit<GestionEstablecimiento, 'gestiones'> {
  gestiones?: {
    id: string
    nombre: string
    categoria_gestiones?: {
      nombre: string
      grupo_gestiones?: { nombre: string } | null
    } | null
  } | null
}

interface GestionesAgendaProps {
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  riesgos: Riesgo[]
}

// ---- BibliotecaForm ----
function BibliotecaForm({
  establecimientoId,
  todasGestiones,
  onClose,
  onSuccess,
}: {
  establecimientoId: string
  todasGestiones: Gestion[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(planificarGestion, null)
  const [filterGrupo, setFilterGrupo] = useState('')
  const [filterCat, setFilterCat] = useState('')

  useEffect(() => {
    if (state?.success) onSuccess()
  }, [state])

  const grupos = Array.from(
    new Set(todasGestiones.map(g => g.categoria_gestiones?.grupo_gestiones?.nombre ?? '').filter(Boolean))
  ).sort()

  const cats = Array.from(
    new Set(
      todasGestiones
        .filter(g => !filterGrupo || g.categoria_gestiones?.grupo_gestiones?.nombre === filterGrupo)
        .map(g => g.categoria_gestiones?.nombre ?? '')
        .filter(Boolean)
    )
  ).sort()

  const gestionesFiltradas = todasGestiones.filter(g => {
    if (filterGrupo && g.categoria_gestiones?.grupo_gestiones?.nombre !== filterGrupo) return false
    if (filterCat && g.categoria_gestiones?.nombre !== filterCat) return false
    return true
  })

  function handleGrupoChange(v: string) {
    setFilterGrupo(v)
    setFilterCat('')
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="establecimiento_id" value={establecimientoId} />

      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}

      {todasGestiones.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-3 py-2">
          No se encontraron gestiones en la librería. Usá la pestaña "Nueva gestión" para crear una.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Grupo</label>
              <select
                value={filterGrupo}
                onChange={e => handleGrupoChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
              >
                <option value="">Todos</option>
                {grupos.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Categoría</label>
              <select
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
              >
                <option value="">Todas</option>
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Gestión *</label>
            <select
              name="gestion_id"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
            >
              <option value="">Seleccionar gestión…</option>
              {gestionesFiltradas.map(g => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Fecha Planificada *</label>
        <input
          type="date"
          name="fecha_planificada"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Notas</label>
        <textarea
          name="notas"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={pending || todasGestiones.length === 0}>
          {pending ? 'Guardando…' : 'Planificar'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// ---- NuevaGestionForm ----
function NuevaGestionForm({
  establecimientoId,
  grupos,
  categorias,
  onClose,
  onSuccess,
}: {
  establecimientoId: string
  grupos: GrupoGestion[]
  categorias: CategoriaGestion[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(planificarGestionNueva, null)
  const [selectedGrupoId, setSelectedGrupoId] = useState('')

  useEffect(() => {
    if (state?.success) onSuccess()
  }, [state])

  const categoriasFiltradas = selectedGrupoId
    ? categorias.filter(c => c.grupo_id === selectedGrupoId)
    : []

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="establecimiento_id" value={establecimientoId} />

      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Nombre de la gestión *</label>
        <input
          type="text"
          name="gestion_nombre"
          required
          placeholder="Ej: Simulacro de Evacuación"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
        <p className="text-xs text-gray-400 mt-1">Se agregará a la librería global de gestiones.</p>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Grupo *</label>
        <select
          value={selectedGrupoId}
          onChange={e => setSelectedGrupoId(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
        >
          <option value="">Seleccionar grupo…</option>
          {grupos.map(g => (
            <option key={g.id} value={g.id}>{g.nombre}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Categoría *</label>
        <select
          name="categoria_id"
          required
          disabled={!selectedGrupoId}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">{selectedGrupoId ? 'Seleccionar categoría…' : 'Seleccioná un grupo primero'}</option>
          {categoriasFiltradas.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Fecha Planificada *</label>
        <input
          type="date"
          name="fecha_planificada"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Notas</label>
        <textarea
          name="notas"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Crear y planificar'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// ---- EjecucionModal ----
function EjecucionModal({
  registro,
  establecimientoId,
  onClose,
  onSuccess,
}: {
  registro: FullRegistro
  establecimientoId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(ejecutarGestion, null)
  const [personas, setPersonas] = useState<{ id: string; nombre: string; apellido: string }[]>([])

  useEffect(() => {
    if (state?.success) onSuccess()
  }, [state])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('persona_establecimiento')
      .select('directorio_personas!persona_id(id, nombre, apellido)')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        const ps = ((data ?? []) as any[])
          .map(pe => pe.directorio_personas)
          .filter(Boolean)
          .sort((a: any, b: any) => a.apellido.localeCompare(b.apellido))
        setPersonas(ps)
      })
  }, [establecimientoId])

  return (
    <Modal open title="Cargar Evidencia" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="registro_id" value={registro.id} />

        {state && !state.success && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {state.error}
          </div>
        )}

        <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
          <span className="font-medium">{registro.ge_gestion_nombre ?? '—'}</span>
          {registro.ge_categoria_nombre && (
            <span className="text-gray-400"> · {registro.ge_categoria_nombre}</span>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Fecha de Ejecución *</label>
          <input
            type="date"
            name="fecha_ejecutada"
            required
            defaultValue={registro.fecha_ejecutada ?? ''}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Índice *</label>
          <input
            type="number"
            name="index"
            required
            step="any"
            defaultValue={registro.index ?? ''}
            placeholder="Ej: 85, 4.5, 3"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Responsable</label>
          <select
            name="responsable_id"
            defaultValue={registro.responsable_id ?? ''}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
          >
            <option value="">Sin asignar</option>
            {personas.map(p => (
              <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Notas</label>
          <textarea
            name="notas"
            rows={2}
            defaultValue={registro.notas ?? ''}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ---- PlanificarModal ----
function PlanificarModal({
  establecimientoId,
  todasGestiones,
  grupos,
  categorias,
  onClose,
  onSuccess,
}: {
  establecimientoId: string
  todasGestiones: Gestion[]
  grupos: GrupoGestion[]
  categorias: CategoriaGestion[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [mode, setMode] = useState<'biblioteca' | 'nueva'>('biblioteca')

  return (
    <Modal open title="Planificar Gestión" onClose={onClose}>
      <div className="flex border-b border-gray-200 mb-5 -mx-6 px-6">
        <button
          type="button"
          onClick={() => setMode('biblioteca')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            mode === 'biblioteca'
              ? 'border-sig-500 text-sig-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Desde biblioteca
        </button>
        <button
          type="button"
          onClick={() => setMode('nueva')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            mode === 'nueva'
              ? 'border-sig-500 text-sig-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Nueva gestión
        </button>
      </div>

      {mode === 'biblioteca' ? (
        <BibliotecaForm
          establecimientoId={establecimientoId}
          todasGestiones={todasGestiones}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      ) : (
        <NuevaGestionForm
          establecimientoId={establecimientoId}
          grupos={grupos}
          categorias={categorias}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  )
}

// ---- Main component ----
export function GestionesAgenda({ establecimientoId, canWrite, riesgos }: GestionesAgendaProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  )
  const [filterEstado, setFilterEstado] = useState<'' | EstadoGestion>('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [orderByCategoria, setOrderByCategoria] = useState(false)
  const [registros, setRegistros] = useState<FullRegistro[] | null>(null)
  const [todasGestiones, setTodasGestiones] = useState<Gestion[]>([])
  const [grupos, setGrupos] = useState<GrupoGestion[]>([])
  const [categorias, setCategorias] = useState<CategoriaGestion[]>([])
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showRiesgos, setShowRiesgos] = useState(false)
  const [editingRegistro, setEditingRegistro] = useState<FullRegistro | null>(null)

  function loadRegistros() {
    const supabase = createClient()
    supabase
      .from('gestion_establecimiento')
      .select('id, gestiones(id, nombre, categoria_gestiones(nombre, grupo_gestiones(nombre)))')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data: geData, error: geError }) => {
        if (geError) console.error('[GestionesAgenda] gestion_establecimiento:', geError.message)
        const ges = (geData ?? []) as unknown as GestionConJoin[]
        const geIds = ges.map(ge => ge.id)
        if (geIds.length === 0) { setRegistros([]); return }
        const geMap = new Map<string, GestionConJoin>()
        for (const ge of ges) geMap.set(ge.id, ge)

        supabase
          .from('registro_gestiones')
          .select('*, responsable:directorio_personas!responsable_id(nombre, apellido), aprobado_por:directorio_personas!aprobado_por_id(nombre, apellido)')
          .in('gestion_establecimiento_id', geIds)
          .gte('fecha_planificada', `${year}-01-01`)
          .lte('fecha_planificada', `${year}-12-31`)
          .order('fecha_planificada')
          .then(({ data: regData, error }) => {
            if (error) console.error('[GestionesAgenda] registros:', error.message)
            type RegRaw = RegistroGestion & {
              responsable: { nombre: string; apellido: string } | null
              aprobado_por: { nombre: string; apellido: string } | null
            }
            const full: FullRegistro[] = ((regData ?? []) as unknown as RegRaw[]).map(r => {
              const ge = geMap.get(r.gestion_establecimiento_id)
              return {
                ...r,
                ge_id: ge?.id,
                ge_gestion_nombre: ge?.gestiones?.nombre,
                ge_categoria_nombre: ge?.gestiones?.categoria_gestiones?.nombre,
                ge_grupo_nombre: ge?.gestiones?.categoria_gestiones?.grupo_gestiones?.nombre,
                responsable_nombre: r.responsable
                  ? `${r.responsable.nombre} ${r.responsable.apellido}`
                  : undefined,
                aprobado_nombre: r.aprobado_por
                  ? `${r.aprobado_por.nombre} ${r.aprobado_por.apellido}`
                  : undefined,
              }
            })
            setRegistros(full)
          })
      })
  }

  useEffect(() => {
    loadRegistros()
    const supabase = createClient()

    supabase
      .from('gestiones')
      .select('*, categoria_gestiones(id, nombre, grupo_gestiones(nombre))')
      .order('nombre')
      .then(({ data, error }) => {
        if (error) console.error('[GestionesAgenda] gestiones:', error.message)
        setTodasGestiones((data as unknown as Gestion[]) ?? [])
      })

    supabase
      .from('grupo_gestiones')
      .select('*')
      .order('nombre')
      .then(({ data, error }) => {
        if (error) console.error('[GestionesAgenda] grupos:', error.message)
        setGrupos((data as unknown as GrupoGestion[]) ?? [])
      })

    supabase
      .from('categoria_gestiones')
      .select('*')
      .order('nombre')
      .then(({ data, error }) => {
        if (error) console.error('[GestionesAgenda] categorias:', error.message)
        setCategorias((data as unknown as CategoriaGestion[]) ?? [])
      })
  }, [establecimientoId, year])

  const monthCounts = MONTHS.map((_, i) => {
    if (!registros) return 0
    const m = String(i + 1).padStart(2, '0')
    return registros.filter(r => r.fecha_planificada?.startsWith(`${year}-${m}`)).length
  })

  const filteredRegistros = (registros ?? []).filter(r => {
    const month = parseInt(r.fecha_planificada?.split('-')[1] ?? '0') - 1
    if (!selectedMonths.has(month)) return false
    const estado = calcularEstadoGestion(r.fecha_ejecutada ?? null, r.fecha_planificada)
    if (filterEstado && estado !== filterEstado) return false
    if (filterCategoria && r.ge_categoria_nombre !== filterCategoria) return false
    return true
  })

  const sortedRegistros = orderByCategoria
    ? [...filteredRegistros].sort((a, b) =>
        (a.ge_categoria_nombre ?? '').localeCompare(b.ge_categoria_nombre ?? '')
      )
    : filteredRegistros

  const categoriasFiltro = Array.from(
    new Set((registros ?? []).map(r => r.ge_categoria_nombre).filter(Boolean))
  ).sort() as string[]

  const activeMonthLabel =
    selectedMonths.size === 12
      ? null
      : selectedMonths.size === 1
      ? MONTHS[Array.from(selectedMonths)[0]]
      : `${selectedMonths.size} meses`

  const activeRiesgos = riesgos.filter(r => !r.resuelto)
  const today = todayYMD()

  return (
    <div>
      {/* Year navigation */}
      <div className="bg-gray-800 text-white rounded-xl px-6 py-4 mb-4 flex items-center justify-between">
        <button
          onClick={() => setYear(y => y - 1)}
          className="text-gray-400 hover:text-white text-sm font-medium w-12"
        >
          {year - 1}
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(y => y - 1)} className="text-gray-300 hover:text-white text-lg leading-none">
            ‹‹
          </button>
          <span className="text-base font-semibold tracking-wide">Agenda de Gestiones {year}</span>
          <button onClick={() => setYear(y => y + 1)} className="text-gray-300 hover:text-white text-lg leading-none">
            ››
          </button>
        </div>
        <button
          onClick={() => setYear(y => y + 1)}
          className="text-gray-400 hover:text-white text-sm font-medium w-12 text-right"
        >
          {year + 1}
        </button>
      </div>

      {/* Month tiles */}
      <div className="grid grid-cols-12 gap-1.5 mb-3">
        {MONTHS.map((m, i) => {
          const isSelected = selectedMonths.has(i)
          return (
            <button
              key={m}
              onClick={() =>
                setSelectedMonths(prev => {
                  const next = new Set(prev)
                  if (next.has(i)) next.delete(i)
                  else next.add(i)
                  return next
                })
              }
              className={`rounded-lg py-2 text-center transition-colors ${
                isSelected
                  ? 'bg-sig-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <div className="text-xs font-medium">{m}</div>
              <div className="text-xs opacity-80">{monthCounts[i]}</div>
            </button>
          )
        })}
      </div>

      {/* Select / Deselect all */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSelectedMonths(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          Seleccionar todos los meses
        </button>
        <button
          onClick={() => setSelectedMonths(new Set())}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          Deseleccionar todos los meses
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value as '' | EstadoGestion)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none"
        >
          <option value="">Seleccione Estado</option>
          <option value="Planificado">Planificado</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Ejecutado">Ejecutado</option>
        </select>

        <select
          value={filterCategoria}
          onChange={e => setFilterCategoria(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none"
        >
          <option value="">Seleccione Categorías</option>
          {categoriasFiltro.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <button
          onClick={() => { setFilterEstado(''); setFilterCategoria(''); setOrderByCategoria(false) }}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          Restablecer filtros
        </button>

        <button
          onClick={() => setOrderByCategoria(v => !v)}
          className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
            orderByCategoria
              ? 'border-sig-300 bg-sig-50 text-sig-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Ordenar por Categoría
        </button>

        {activeMonthLabel && (
          <span className="text-xs bg-sig-50 text-sig-700 border border-sig-200 rounded-lg px-3 py-1.5 font-medium">
            {activeMonthLabel}
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-400">
            {registros !== null ? `${filteredRegistros.length} gestiones` : ''}
          </span>
          {canWrite && (
            <button
              onClick={() => setShowPlanModal(true)}
              className="text-sm font-semibold bg-gray-900 text-white rounded-lg px-4 py-2 hover:bg-gray-700 transition-colors"
            >
              Planificar Nueva Gestión
            </button>
          )}
        </div>
      </div>

      {/* Gestiones table */}
      {registros === null ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Cargando…
        </div>
      ) : filteredRegistros.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No hay gestiones para el período seleccionado.
          {canWrite && (
            <button
              onClick={() => setShowPlanModal(true)}
              className="block mx-auto mt-3 text-sig-500 hover:text-sig-700 font-medium text-sm"
            >
              + Planificar una gestión
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-white text-left">
                  <th className="px-4 py-3 font-medium text-xs w-10">#</th>
                  <th className="px-4 py-3 font-medium min-w-[180px]">Gestión</th>
                  <th className="px-4 py-3 font-medium min-w-[130px]">Categoría</th>
                  <th className="px-4 py-3 font-medium min-w-[100px]">Fecha Plan.</th>
                  <th className="px-4 py-3 font-medium min-w-[100px]">Fecha Ejec.</th>
                  <th className="px-4 py-3 font-medium w-16 text-center">Días</th>
                  <th className="px-4 py-3 font-medium min-w-[130px]">Responsable</th>
                  <th className="px-4 py-3 font-medium min-w-[130px]">Aprobado Por</th>
                  <th className="px-4 py-3 font-medium min-w-[160px]">Observaciones</th>
                  <th className="px-4 py-3 font-medium w-20 text-center">Índice</th>
                  {canWrite && <th className="px-4 py-3 font-medium w-36">Evidencia</th>}
                  <th className="px-4 py-3 font-medium min-w-[90px]">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedRegistros.map((r, idx) => {
                  const estado = calcularEstadoGestion(r.fecha_ejecutada ?? null, r.fecha_planificada)
                  const dias = r.fecha_ejecutada
                    ? diffDays(r.fecha_ejecutada, r.fecha_planificada)
                    : diffDays(today, r.fecha_planificada)
                  const diasLabel = r.fecha_ejecutada
                    ? dias === 0 ? '0' : `${dias > 0 ? '+' : ''}${dias}`
                    : estado === 'Planificado' ? `${dias}d` : `+${dias}d`
                  const diasColor = r.fecha_ejecutada
                    ? dias <= 0 ? 'text-sig-600 font-medium' : 'text-orange-500 font-medium'
                    : estado === 'Planificado' ? 'text-gray-400' : 'text-red-500 font-medium'

                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs text-center">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {r.ge_gestion_nombre ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {r.ge_categoria_nombre ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 tabular-nums">
                        {r.fecha_planificada}
                      </td>
                      <td className="px-4 py-3 text-gray-500 tabular-nums">
                        {r.fecha_ejecutada ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`px-4 py-3 text-xs text-center tabular-nums ${diasColor}`}>
                        {diasLabel}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {r.responsable_nombre ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {r.aprobado_nombre ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px]">
                        {r.observaciones ? (
                          <span title={r.observaciones} className="truncate block max-w-[150px]">
                            {r.observaciones}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums text-gray-700">
                        {r.index != null ? r.index : <span className="text-gray-300">—</span>}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setEditingRegistro(r)}
                            className="text-xs font-medium text-sig-600 hover:text-sig-800 underline underline-offset-2"
                          >
                            {r.fecha_ejecutada ? 'Editar evidencia' : 'Cargar evidencia'}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_COLORS[estado]}`}>
                          {estado}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Riesgos section */}
      <div className="border-t border-gray-200 pt-6">
        <button
          onClick={() => setShowRiesgos(v => !v)}
          className="flex items-center justify-between w-full text-left mb-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Riesgos</span>
            {activeRiesgos.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
                {activeRiesgos.length} activos
              </span>
            )}
          </div>
          <span className="text-gray-400 text-sm">{showRiesgos ? '▲' : '▼'}</span>
        </button>

        {showRiesgos && (
          riesgos.length === 0 ? (
            <p className="text-sm text-gray-400">No hay riesgos registrados.</p>
          ) : (
            <div className="space-y-2">
              {riesgos.map(r => (
                <div
                  key={r.id}
                  className={`bg-white border rounded-xl px-4 py-3 flex items-start justify-between gap-4 ${
                    r.resuelto ? 'opacity-60 border-gray-100' : 'border-gray-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          RIESGO_NIVEL_COLORS[r.nivel as RiesgoNivel]
                        }`}
                      >
                        {RIESGO_NIVEL_LABELS[r.nivel as RiesgoNivel]}
                      </span>
                      {r.resuelto && (
                        <span className="text-xs text-gray-400">Resuelto</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 font-medium">{r.descripcion}</p>
                    {r.medida_correctiva && (
                      <p className="text-xs text-gray-500 mt-0.5">{r.medida_correctiva}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 shrink-0">{r.fecha_identificacion}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {editingRegistro && (
        <EjecucionModal
          registro={editingRegistro}
          establecimientoId={establecimientoId}
          onClose={() => setEditingRegistro(null)}
          onSuccess={() => {
            setEditingRegistro(null)
            loadRegistros()
          }}
        />
      )}

      {showPlanModal && (
        <PlanificarModal
          establecimientoId={establecimientoId}
          todasGestiones={todasGestiones}
          grupos={grupos}
          categorias={categorias}
          onClose={() => setShowPlanModal(false)}
          onSuccess={() => {
            setShowPlanModal(false)
            loadRegistros()
          }}
        />
      )}
    </div>
  )
}
