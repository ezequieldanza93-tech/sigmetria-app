'use client'

import { useState, useEffect, useActionState, useTransition, useRef, Fragment, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcularEstadoGestion } from '@/lib/types'
import type { EstadoGestion, Gestion, CategoriaGestion, GrupoGestion, GestionEstablecimiento, RegistroGestion, Riesgo, RiesgoNivel } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import {
  planificarGestion,
  planificarGestionNueva,
  createGrupoGestion,
  createCategoriaGestion,
} from '@/lib/actions/gestion-establecimiento'
import { ejecutarGestion, crearObservaciones } from '@/lib/actions/registro-gestion'
import { RIESGO_NIVEL_LABELS } from '@/lib/constants'
import { RIESGO_NIVEL_COLORS } from '@/lib/types'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const COL_WIDTHS_KEY = 'gestiones_col_widths'
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  gestion: 180, fecha_plan: 100, fecha_ejec: 100,
  responsable: 130, indice: 70, evidencia: 120,
}
const COL_MIN_WIDTHS: Record<string, number> = {
  gestion: 80, fecha_plan: 80, fecha_ejec: 80,
  responsable: 80, indice: 50, evidencia: 80,
}

const ROW_BG_COLORS: Record<EstadoGestion, string> = {
  Realizado: 'bg-green-100 hover:bg-green-200',
  Pendiente: 'bg-red-100 hover:bg-red-200',
  Planificado: 'bg-sky-100 hover:bg-sky-200',
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

// ─── InlineCreator ─────────────────────────────────────────────────────────────
// Shared inline input + confirm/cancel for creating grupo or categoría
function InlineCreator({
  placeholder,
  onConfirm,
  onCancel,
  error,
}: {
  placeholder: string
  onConfirm: (nombre: string) => Promise<void>
  onCancel: () => void
  error: string
}) {
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)

  async function handle() {
    if (!nombre.trim()) return
    setSaving(true)
    await onConfirm(nombre.trim())
    setSaving(false)
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-2">
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handle() } }}
          placeholder={placeholder}
          autoFocus
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
        <button
          type="button"
          onClick={handle}
          disabled={saving || !nombre.trim()}
          className="text-xs bg-sig-500 text-white rounded-lg px-3 py-1.5 hover:bg-sig-700 disabled:opacity-50"
        >
          {saving ? '…' : 'Crear'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          ✕
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─── BibliotecaForm ────────────────────────────────────────────────────────────
function BibliotecaForm({
  establecimientoId,
  todasGestiones,
  onClose,
  onSuccess,
  onSwitchToNueva,
}: {
  establecimientoId: string
  todasGestiones: Gestion[]
  onClose: () => void
  onSuccess: (month?: number) => void
  onSwitchToNueva: () => void
}) {
  const [state, formAction, pending] = useActionState(planificarGestion, null)
  const [filterGrupo, setFilterGrupo] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [fechaValue, setFechaValue] = useState('')

  useEffect(() => {
    if (state?.success) {
      const month = fechaValue ? new Date(fechaValue + 'T00:00:00').getMonth() : undefined
      onSuccess(month)
    }
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

  const selectCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500'

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
          No se encontraron gestiones en la librería.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Grupo</label>
              <select value={filterGrupo} onChange={e => handleGrupoChange(e.target.value)} className={selectCls}>
                <option value="">Todos</option>
                {grupos.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Categoría</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className={selectCls}>
                <option value="">Todas</option>
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Gestión *</label>
            <select name="gestion_id" required className={selectCls}>
              <option value="">Seleccionar gestión…</option>
              {gestionesFiltradas.map(g => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
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
          value={fechaValue}
          onChange={e => setFechaValue(e.target.value)}
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
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={onSwitchToNueva}
          className="text-xs text-sig-600 hover:text-sig-800 hover:underline"
        >
          ¿No encontrás la gestión? → Crear nueva gestión
        </button>
      </div>
    </form>
  )
}

// ─── NuevaGestionForm ──────────────────────────────────────────────────────────
function NuevaGestionForm({
  establecimientoId,
  grupos: gruposProp,
  categorias: categoriasProp,
  onClose,
  onSuccess,
}: {
  establecimientoId: string
  grupos: GrupoGestion[]
  categorias: CategoriaGestion[]
  onClose: () => void
  onSuccess: (month?: number) => void
}) {
  const [state, formAction, pending] = useActionState(planificarGestionNueva, null)
  const [localGrupos, setLocalGrupos] = useState(gruposProp)
  const [localCategorias, setLocalCategorias] = useState(categoriasProp)
  const [selectedGrupoId, setSelectedGrupoId] = useState('')
  const [selectedCatId, setSelectedCatId] = useState('')
  const [fechaValue, setFechaValue] = useState('')

  const [creandoGrupo, setCreandoGrupo] = useState(false)
  const [errorGrupo, setErrorGrupo] = useState('')
  const [creandoCat, setCreandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState('')

  useEffect(() => {
    if (state?.success) {
      const month = fechaValue ? new Date(fechaValue + 'T00:00:00').getMonth() : undefined
      onSuccess(month)
    }
  }, [state])

  const catsFiltradas = selectedGrupoId
    ? localCategorias.filter(c => c.grupo_id === selectedGrupoId)
    : []

  async function handleCrearGrupo(nombre: string) {
    setErrorGrupo('')
    const res = await createGrupoGestion(nombre)
    if (!res.success) { setErrorGrupo(res.error ?? 'Error'); return }
    const newG = res.data!
    setLocalGrupos(prev => [...prev, newG].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setSelectedGrupoId(newG.id)
    setSelectedCatId('')
    setCreandoGrupo(false)
  }

  async function handleCrearCat(nombre: string) {
    if (!selectedGrupoId) { setErrorCat('Seleccioná un grupo primero'); return }
    setErrorCat('')
    const res = await createCategoriaGestion(nombre, selectedGrupoId)
    if (!res.success) { setErrorCat(res.error ?? 'Error'); return }
    const newC = res.data!
    setLocalCategorias(prev => [...prev, newC].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setSelectedCatId(newC.id)
    setCreandoCat(false)
  }

  function handleGrupoSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === '__create__') {
      setCreandoGrupo(true)
    } else {
      setSelectedGrupoId(e.target.value)
      setSelectedCatId('')
      setCreandoGrupo(false)
    }
  }

  function handleCatSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === '__create__') {
      setCreandoCat(true)
    } else {
      setSelectedCatId(e.target.value)
      setCreandoCat(false)
    }
  }

  const selectCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500'
  const selectErrCls = 'border-red-300 bg-red-50'
  const hasSubmitError = state && !state.success

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="establecimiento_id" value={establecimientoId} />
      <input type="hidden" name="categoria_id" value={selectedCatId} />

      {hasSubmitError && (
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
          className={selectCls}
        />
        <p className="text-xs text-gray-400 mt-1">Se agregará a la librería global de gestiones.</p>
      </div>

      {/* Grupo */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Grupo *</label>
        <select
          value={selectedGrupoId}
          onChange={handleGrupoSelect}
          className={`${selectCls} ${hasSubmitError && !selectedGrupoId ? selectErrCls : ''}`}
        >
          <option value="">Seleccionar grupo…</option>
          {localGrupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          <option value="__create__">+ Crear nuevo grupo</option>
        </select>
        {hasSubmitError && !selectedGrupoId && (
          <p className="text-xs text-red-600 mt-1">Grupo requerido</p>
        )}
        {creandoGrupo && (
          <InlineCreator
            placeholder="Nombre del nuevo grupo"
            onConfirm={handleCrearGrupo}
            onCancel={() => { setCreandoGrupo(false); setErrorGrupo('') }}
            error={errorGrupo}
          />
        )}
      </div>

      {/* Categoría */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Categoría *</label>
        <select
          value={selectedCatId}
          onChange={handleCatSelect}
          disabled={!selectedGrupoId}
          className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed ${hasSubmitError && !selectedCatId ? selectErrCls : ''}`}
        >
          <option value="">{selectedGrupoId ? 'Seleccionar categoría…' : 'Seleccioná un grupo primero'}</option>
          {catsFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          {selectedGrupoId && <option value="__create__">+ Crear nueva categoría</option>}
        </select>
        {hasSubmitError && !selectedCatId && (
          <p className="text-xs text-red-600 mt-1">Categoría requerida</p>
        )}
        {creandoCat && (
          <InlineCreator
            placeholder="Nombre de la nueva categoría"
            onConfirm={handleCrearCat}
            onCancel={() => { setCreandoCat(false); setErrorCat('') }}
            error={errorCat}
          />
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Fecha Planificada *</label>
        <input
          type="date"
          name="fecha_planificada"
          required
          value={fechaValue}
          onChange={e => setFechaValue(e.target.value)}
          className={selectCls}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Notas</label>
        <textarea
          name="notas"
          rows={2}
          className={`${selectCls} resize-none`}
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={pending || !selectedCatId}>
          {pending ? 'Guardando…' : 'Crear y planificar'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
      </div>

      {!selectedCatId && (
        <p className="text-xs text-amber-600">
          {!selectedGrupoId ? 'Seleccioná un Grupo y una Categoría para continuar.' : 'Seleccioná una Categoría para continuar.'}
        </p>
      )}
    </form>
  )
}

// ─── EjecucionModal ────────────────────────────────────────────────────────────

interface ObsDraft {
  key: number
  descripcion: string
  clasificacion_id: string
  responsable_id: string
  fecha_subsanacion: string
}

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
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [personas, setPersonas] = useState<{ id: string; nombre: string; apellido: string }[]>([])
  const [clasificaciones, setClasificaciones] = useState<{ id: string; nombre: string }[]>([])
  const [observaciones, setObservaciones] = useState<ObsDraft[]>([])
  const obsKeyRef = useRef(0)

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500'

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
    supabase
      .from('clasificacion_observaciones')
      .select('id, nombre')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setClasificaciones((data ?? []) as { id: string; nombre: string }[]))
  }, [establecimientoId])

  function addObs() {
    setObservaciones(prev => [...prev, {
      key: obsKeyRef.current++,
      descripcion: '',
      clasificacion_id: '',
      responsable_id: '',
      fecha_subsanacion: '',
    }])
  }

  function removeObs(key: number) {
    setObservaciones(prev => prev.filter(o => o.key !== key))
  }

  function updateObs(key: number, field: keyof Omit<ObsDraft, 'key'>, value: string) {
    setObservaciones(prev => prev.map(o => o.key === key ? { ...o, [field]: value } : o))
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await ejecutarGestion(null, fd)
      if (!result.success) { setError(result.error); return }

      const validObs = observaciones.filter(o => o.descripcion.trim())
      if (validObs.length > 0) {
        const obsResult = await crearObservaciones(registro.id, validObs)
        if (!obsResult.success) { setError(obsResult.error); return }
      }

      onSuccess()
    })
  }

  return (
    <Modal open title="Cargar Evidencia" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="registro_id" value={registro.id} />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
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
            className={inputCls}
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
            className={inputCls}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Responsable</label>
          <select name="responsable_id" defaultValue={registro.responsable_id ?? ''} className={inputCls}>
            <option value="">Sin asignar</option>
            {personas.map(p => (
              <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Evidencia</label>
          {registro.evidencia_url && (
            <a
              href={registro.evidencia_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sig-600 hover:underline block mb-1.5"
            >
              Ver archivo actual ↗
            </a>
          )}
          <input
            type="file"
            name="evidencia"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sig-50 file:text-sig-700 hover:file:bg-sig-100 cursor-pointer"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Notas</label>
          <textarea
            name="notas"
            rows={2}
            defaultValue={registro.notas ?? ''}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* ── Observaciones ─────────────────────────────────────── */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Observaciones
              {observaciones.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">({observaciones.length})</span>
              )}
            </h3>
            <button
              type="button"
              onClick={addObs}
              className="text-xs text-sig-600 hover:text-sig-700 font-medium flex items-center gap-1"
            >
              + Agregar
              </button>
            </div>
          {observaciones.length === 0 ? (<p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg">
              Sin observaciones. Hacé clic en "+ Agregar" para registrar una.
            </p>
          ) : (
            <div className="space-y-2">
              {observaciones.map((obs, idx) => (
                <div key={obs.key} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 mt-2 w-4 shrink-0">{idx + 1}.</span>
                    <textarea
                      value={obs.descripcion}
                      onChange={e => updateObs(obs.key, 'descripcion', e.target.value)}
                      placeholder="Descripción de la observación…"
                      rows={2}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeObs(obs.key)}
                      className="text-gray-300 hover:text-red-400 mt-1 text-base leading-none shrink-0"
                      title="Eliminar observación"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pl-6">
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">Tipo de riesgo</label>
                      <select
                        value={obs.clasificacion_id}
                        onChange={e => updateObs(obs.key, 'clasificacion_id', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
                      >
                        <option value="">Sin clasificar</option>
                        {clasificaciones.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">Responsable</label>
                      <select
                        value={obs.responsable_id}
                        onChange={e => updateObs(obs.key, 'responsable_id', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
                      >
                        <option value="">Sin asignar</option>
                        {personas.map(p => (
                          <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">Fecha subsanación</label>
                      <input
                        type="date"
                        value={obs.fecha_subsanacion}
                        onChange={e => updateObs(obs.key, 'fecha_subsanacion', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sig-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending}>{isPending ? 'Guardando…' : 'Guardar'}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── PlanificarModal ───────────────────────────────────────────────────────────
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
  onSuccess: (month?: number) => void
}) {
  const [mode, setMode] = useState<'biblioteca' | 'nueva'>('biblioteca')

  return (
    <Modal open title="Planificar Gestión" onClose={onClose}>
      <div className="flex border-b border-gray-200 mb-5 -mx-6 px-6">
        {(['biblioteca', 'nueva'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              mode === m
                ? 'border-sig-500 text-sig-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {m === 'biblioteca' ? 'Desde biblioteca' : 'Nueva gestión'}
          </button>
        ))}
      </div>

      {mode === 'biblioteca' ? (
        <BibliotecaForm
          establecimientoId={establecimientoId}
          todasGestiones={todasGestiones}
          onClose={onClose}
          onSuccess={onSuccess}
          onSwitchToNueva={() => setMode('nueva')}
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

// ─── Main component ────────────────────────────────────────────────────────────
export function GestionesAgenda({ establecimientoId, canWrite, riesgos }: GestionesAgendaProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  // Task 1: default = current month
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(
    () => new Set([new Date().getMonth()])
  )

  // Task 2: collapsed months for group view
  const [collapsedMonths, setCollapsedMonths] = useState<Set<number>>(new Set())

  const [filterEstado, setFilterEstado] = useState<'' | EstadoGestion>('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterGrupo, setFilterGrupo] = useState('')
  const [filterResponsable, setFilterResponsable] = useState('')
  const [orderByCategoria, setOrderByCategoria] = useState(false)
  const [registros, setRegistros] = useState<FullRegistro[] | null>(null)
  const [todasGestiones, setTodasGestiones] = useState<Gestion[]>([])
  const [grupos, setGrupos] = useState<GrupoGestion[]>([])
  const [categorias, setCategorias] = useState<CategoriaGestion[]>([])
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showRiesgos, setShowRiesgos] = useState(false)
  const [editingRegistro, setEditingRegistro] = useState<FullRegistro | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Task 4: resizable columns with localStorage
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem(COL_WIDTHS_KEY) ?? '{}') } catch { return {} }
  })
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null)

  function colW(col: string): number {
    return colWidths[col] ?? DEFAULT_COL_WIDTHS[col] ?? 100
  }

  function startResize(col: string, e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const startW = colWidths[col] ?? DEFAULT_COL_WIDTHS[col] ?? 100
    resizingRef.current = { col, startX: e.clientX, startW }

    function onMove(ev: MouseEvent) {
      const r = resizingRef.current
      if (!r) return
      const minW = COL_MIN_WIDTHS[r.col] ?? 50
      const newW = Math.max(minW, r.startW + (ev.clientX - r.startX))
      setColWidths(prev => {
        const next = { ...prev, [r.col]: newW }
        try { localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    }

    function onUp() {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      resizingRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

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

  function loadCatalogo() {
    const supabase = createClient()
    supabase.from('gestiones').select('*, categoria_gestiones(id, nombre, grupo_gestiones(nombre))').order('nombre')
      .then(({ data }) => { if (data) setTodasGestiones(data as unknown as Gestion[]) })
    supabase.from('grupo_gestiones').select('*').order('nombre')
      .then(({ data }) => { if (data) setGrupos(data as unknown as GrupoGestion[]) })
    supabase.from('categoria_gestiones').select('*').order('nombre')
      .then(({ data }) => { if (data) setCategorias(data as unknown as CategoriaGestion[]) })
  }

  useEffect(() => {
    loadRegistros()
    loadCatalogo()
  }, [establecimientoId, year, refreshKey])

  // Refresh catalog when modal opens so new grupos/categorias are available
  useEffect(() => {
    if (showPlanModal) loadCatalogo()
  }, [showPlanModal])

  // ── Filtering & sorting ─────────────────────────────────────────────────────
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
    if (filterGrupo && r.ge_grupo_nombre !== filterGrupo) return false
    if (filterResponsable && r.responsable_nombre !== filterResponsable) return false
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

  const gruposFiltro = Array.from(
    new Set((registros ?? []).map(r => r.ge_grupo_nombre).filter(Boolean))
  ).sort() as string[]

  const responsablesFiltro = Array.from(
    new Set((registros ?? []).map(r => r.responsable_nombre).filter(Boolean))
  ).sort() as string[]

  // Task 2: group by month when multiple months selected
  const grouped = selectedMonths.size > 1
    ? Array.from(selectedMonths).sort((a, b) => a - b).map(mi => ({
        monthIdx: mi,
        regs: sortedRegistros.filter(r => {
          const m = parseInt(r.fecha_planificada?.split('-')[1] ?? '0') - 1
          return m === mi
        }),
      })).filter(g => g.regs.length > 0)
    : []

  const activeMonthLabel =
    selectedMonths.size === 12 ? null
    : selectedMonths.size === 1 ? MONTHS[Array.from(selectedMonths)[0]]
    : `${selectedMonths.size} meses`

  const activeRiesgos = riesgos.filter(r => !r.resuelto)
  const today = todayYMD()

  const totalCols = canWrite ? 7 : 6

  // ── Row renderer ────────────────────────────────────────────────────────────
  function renderRows(regs: FullRegistro[]) {
    return regs.map((r, idx) => {
      const estado = calcularEstadoGestion(r.fecha_ejecutada ?? null, r.fecha_planificada)

      return (
        <tr key={r.id} className={ROW_BG_COLORS[estado]}>
          <td className="px-4 py-3 text-gray-400 text-xs text-center">{idx + 1}</td>
          <td className="px-4 py-3 font-medium text-gray-900" style={{ maxWidth: colW('gestion'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.ge_gestion_nombre ?? '—'}
          </td>
          <td className="px-4 py-3 text-gray-500 tabular-nums text-xs">{r.fecha_planificada}</td>
          <td className="px-4 py-3 text-gray-500 tabular-nums text-xs">
            {r.fecha_ejecutada ?? <span className="text-gray-300">—</span>}
          </td>
          <td className="px-4 py-3 text-gray-500 text-xs" style={{ maxWidth: colW('responsable'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.responsable_nombre ?? <span className="text-gray-300">—</span>}
          </td>
          <td className="px-4 py-3 text-center text-sm tabular-nums text-gray-700">
            {r.index != null ? r.index : <span className="text-gray-300">—</span>}
          </td>
          {canWrite && (
            <td className="px-4 py-3">
              <button
                onClick={() => setEditingRegistro(r)}
                className="text-xs font-medium text-sig-600 hover:text-sig-800 underline underline-offset-2 whitespace-nowrap"
              >
                {r.fecha_ejecutada ? 'Editar evidencia' : 'Cargar evidencia'}
              </button>
            </td>
          )}
        </tr>
      )
    })
  }

  // ── Resize handle helper ────────────────────────────────────────────────────
  function rh(col: string) {
    return (
      <div
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-white/30 select-none"
        onMouseDown={e => startResize(col, e)}
      />
    )
  }

  // ── Table header ────────────────────────────────────────────────────────────
  const tableHead = (
    <thead>
      <tr className="bg-gray-800 text-white text-left text-xs">
        <th className="px-4 py-3 font-medium w-9 shrink-0">#</th>
        <th style={{ width: colW('gestion') }} className="px-4 py-3 font-medium relative select-none">
          Gestión{rh('gestion')}
        </th>
        <th style={{ width: colW('fecha_plan') }} className="px-4 py-3 font-medium relative select-none">
          Fecha Plan.{rh('fecha_plan')}
        </th>
        <th style={{ width: colW('fecha_ejec') }} className="px-4 py-3 font-medium relative select-none">
          Fecha Ejec.{rh('fecha_ejec')}
        </th>
        <th style={{ width: colW('responsable') }} className="px-4 py-3 font-medium relative select-none">
          Responsable{rh('responsable')}
        </th>
        <th style={{ width: colW('indice') }} className="px-4 py-3 font-medium text-center relative select-none">
          Índice{rh('indice')}
        </th>
        {canWrite && (
          <th style={{ width: colW('evidencia') }} className="px-4 py-3 font-medium relative select-none">
            Evidencia{rh('evidencia')}
          </th>
        )}
      </tr>
    </thead>
  )

  // ── Month group header row ──────────────────────────────────────────────────
  function groupHeaderRow(monthIdx: number, count: number) {
    const collapsed = collapsedMonths.has(monthIdx)
    return (
      <tr
        className="cursor-pointer select-none"
        onClick={() => setCollapsedMonths(prev => {
          const next = new Set(prev)
          if (next.has(monthIdx)) next.delete(monthIdx)
          else next.add(monthIdx)
          return next
        })}
      >
        <td colSpan={totalCols} className="bg-gray-50 px-4 py-2.5 border-y border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">{collapsed ? '▶' : '▼'}</span>
            <span className="font-semibold text-sm text-gray-700">{MONTHS_FULL[monthIdx]}</span>
            <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{count}</span>
          </div>
        </td>
      </tr>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Year navigation */}
      <div className="bg-gray-800 text-white rounded-xl px-6 py-4 mb-4 flex items-center justify-between">
        <button onClick={() => setYear(y => y - 1)} className="text-gray-400 hover:text-white text-sm font-medium w-12">
          {year - 1}
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(y => y - 1)} className="text-gray-300 hover:text-white text-lg leading-none">‹‹</button>
          <span className="text-base font-semibold tracking-wide">Agenda de Gestiones {year}</span>
          <button onClick={() => setYear(y => y + 1)} className="text-gray-300 hover:text-white text-lg leading-none">››</button>
        </div>
        <button onClick={() => setYear(y => y + 1)} className="text-gray-400 hover:text-white text-sm font-medium w-12 text-right">
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
              onClick={() => setSelectedMonths(prev => {
                const next = new Set(prev)
                if (next.has(i)) next.delete(i)
                else next.add(i)
                return next
              })}
              className={`rounded-lg py-2 text-center transition-colors ${
                isSelected ? 'bg-sig-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <div className="text-xs font-medium">{m}</div>
              <div className="text-xs opacity-80">{monthCounts[i]}</div>
            </button>
          )
        })}
      </div>

      {/* Month quick-select buttons */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setSelectedMonths(new Set([new Date().getMonth()]))}
          className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
            selectedMonths.size === 1 && selectedMonths.has(new Date().getMonth())
              ? 'bg-green-100 border-green-300 text-green-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Mes actual
        </button>
        <button
          onClick={() => setSelectedMonths(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))}
          className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
            selectedMonths.size === 12
              ? 'bg-green-100 border-green-300 text-green-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Todos los meses
        </button>
        <button
          onClick={() => setSelectedMonths(new Set())}
          className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
            selectedMonths.size === 0
              ? 'bg-green-100 border-green-300 text-green-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Ninguno
        </button>
        <button
          onClick={() => setSelectedMonths(prev => {
            const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
            const inverted = new Set(all.filter(m => !prev.has(m)))
            return inverted
          })}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          Invertir selección
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select
          value={filterGrupo}
          onChange={e => setFilterGrupo(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none"
        >
          <option value="">Seleccione Grupo</option>
          {gruposFiltro.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select
          value={filterCategoria}
          onChange={e => setFilterCategoria(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none"
        >
          <option value="">Seleccione Categoría</option>
          {categoriasFiltro.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={filterResponsable}
          onChange={e => setFilterResponsable(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none"
        >
          <option value="">Seleccione Responsable</option>
          {responsablesFiltro.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value as '' | EstadoGestion)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none"
        >
          <option value="">Seleccione Estado</option>
          <option value="Planificado">Planificado</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Realizado">Realizado</option>
        </select>

        <button
          onClick={() => { setFilterEstado(''); setFilterCategoria(''); setFilterGrupo(''); setFilterResponsable(''); setOrderByCategoria(false) }}
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
            <table className="text-sm" style={{ tableLayout: 'fixed', width: '100%', minWidth: 700 }}>
              {tableHead}

              {/* Task 2: grouped view when multiple months, flat otherwise */}
              {selectedMonths.size > 1 ? (
                grouped.map(group => (
                  <Fragment key={group.monthIdx}>
                    <tbody>
                      {groupHeaderRow(group.monthIdx, group.regs.length)}
                    </tbody>
                    {!collapsedMonths.has(group.monthIdx) && (
                      <tbody className="divide-y divide-gray-50">
                        {renderRows(group.regs)}
                      </tbody>
                    )}
                  </Fragment>
                ))
              ) : (
                <tbody className="divide-y divide-gray-50">
                  {renderRows(sortedRegistros)}
                </tbody>
              )}
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
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RIESGO_NIVEL_COLORS[r.nivel as RiesgoNivel]}`}>
                        {RIESGO_NIVEL_LABELS[r.nivel as RiesgoNivel]}
                      </span>
                      {r.resuelto && <span className="text-xs text-gray-400">Resuelto</span>}
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
          onSuccess={() => { setEditingRegistro(null); setRefreshKey(k => k + 1) }}
        />
      )}

      {showPlanModal && (
        <PlanificarModal
          establecimientoId={establecimientoId}
          todasGestiones={todasGestiones}
          grupos={grupos}
          categorias={categorias}
          onClose={() => setShowPlanModal(false)}
          onSuccess={(month?: number) => {
            setShowPlanModal(false)
            if (month !== undefined) setSelectedMonths(prev => new Set([...prev, month]))
            setRefreshKey(k => k + 1)
          }}
        />
      )}
    </div>
  )
}
