'use client'

import { useState, useEffect, useActionState, useTransition, useRef, Fragment, memo, useMemo, type FormEvent } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'
import { useCanWrite, useGestionesEstablecimiento, useRegistrosGestion, useCatalogo } from '@/lib/queries/agenda'
import { calcularEstadoGestion } from '@/lib/types'
import type { EstadoGestion, Gestion, CategoriaGestion, GrupoGestion, RegistroGestion, Riesgo } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { MultiFilter } from '@/components/ui/multi-filter'
import {
  Plus, Camera, BarChart3, FileCheck,
  ClipboardCheck, GraduationCap, Heart, FileText, AlertTriangle,
  ClipboardList, UserPlus, Dumbbell, Kanban, HelpCircle,
  Play, Upload, Download, BookMarked,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import {
  planificarGestion,
  planificarGestionNueva,
  createGrupoGestion,
  createCategoriaGestion,
} from '@/lib/actions/gestion-establecimiento'
import { ejecutarGestion, crearObservaciones } from '@/lib/actions/registro-gestion'
import { useShortcutAction } from '@/lib/contexts/shortcuts-context'


const CATEGORIA_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; abbr: string }> = {
  Checklists: { icon: ClipboardCheck, abbr: 'CHK' },
  Capacitaciones: { icon: GraduationCap, abbr: 'CAP' },
  'Campañas de Salud': { icon: Heart, abbr: 'SAL' },
  Formularios: { icon: FileText, abbr: 'FRM' },
  Simulacros: { icon: AlertTriangle, abbr: 'SIM' },
  Planes: { icon: ClipboardList, abbr: 'PLN' },
  Inducciones: { icon: UserPlus, abbr: 'IND' },
  Entrenamientos: { icon: Dumbbell, abbr: 'ENT' },
  Programas: { icon: Kanban, abbr: 'PRG' },
  'Reporte Fotográfico': { icon: Camera, abbr: 'FOT' },
  'Revisión por la dirección': { icon: BarChart3, abbr: 'REV' },
  Auditoría: { icon: FileCheck, abbr: 'AUD' },
}

const CategoriaIcon = memo(function CategoriaIcon({ nombre, size = 14 }: { nombre?: string | null; size?: number }) {
  const meta = nombre ? CATEGORIA_META[nombre] : undefined
  const Icon = meta?.icon ?? HelpCircle
  return <span title={nombre ?? ''}><Icon size={size} className="text-text-secondary" /></span>
})

const CategoriaAbbr = memo(function CategoriaAbbr({ nombre }: { nombre?: string | null }) {
  if (!nombre) return <span className="text-text-tertiary">—</span>
  const meta = CATEGORIA_META[nombre]
  const abbr = meta?.abbr ?? nombre.slice(0, 3).toUpperCase()
  return (
    <span title={nombre} className="text-[10px] font-semibold text-text-secondary tracking-wider">
      {abbr}
    </span>
  )
})

const ReporteFotograficoModal = dynamic(
  () => import('@/components/reporte-fotografico-modal').then(m => m.ReporteFotograficoModal),
  { ssr: false }
)
const FormularioEjecucion = dynamic(
  () => import('@/components/formulario-ejecucion').then(m => m.FormularioEjecucion),
  { ssr: false }
)

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const COL_WIDTHS_KEY = 'gestiones_col_widths'
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  categoria: 140, gestion: 180, fecha_plan: 100, fecha_ejec: 100,
  responsable: 130, indice: 70, acciones: 130,
}
const COL_MIN_WIDTHS: Record<string, number> = {
  categoria: 80, gestion: 80, fecha_plan: 80, fecha_ejec: 80,
  responsable: 80, indice: 50, acciones: 100,
}

const ROW_BG_COLORS: Record<EstadoGestion, string> = {
  Realizado: 'bg-success-bg hover:bg-green-200',
  Pendiente: 'bg-danger-bg hover:bg-red-200',
  Planificado: 'bg-sky-100 hover:bg-sky-200',
}


interface FullRegistro extends RegistroGestion {
  ge_gestion_nombre?: string
  ge_categoria_nombre?: string
  ge_grupo_nombre?: string
  ge_id?: string
  ge_gestion_id?: string
  ge_tiene_formulario?: boolean
  ge_tiene_entregable?: boolean
  ge_mostrar_lt?: boolean
  ge_firmada?: boolean
  responsable_nombre?: string
  aprobado_nombre?: string
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
          className="flex-1 border border-border-default rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
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
          className="text-xs border border-border-subtle rounded-lg px-3 py-1.5 text-text-secondary hover:bg-surface-base"
        >
          ✕
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
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

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => {
    if (state?.success) {
      const month = fechaValue ? new Date(fechaValue + 'T00:00:00').getMonth() : undefined
      onSuccessRef.current(month)
    }
    }, [state, fechaValue, onSuccess])
  
  const grupos = Array.from(
    new Set(todasGestiones.map(g => g.gestiones_categorias?.gestiones_grupos?.nombre ?? '').filter(Boolean))
  ).sort()
 
  const cats = Array.from(
    new Set(
      todasGestiones
        .filter(g => !filterGrupo || g.gestiones_categorias?.gestiones_grupos?.nombre === filterGrupo)
        .map(g => g.gestiones_categorias?.nombre ?? '')
        .filter(Boolean)
    )
  ).sort()
 
  const gestionesFiltradas = todasGestiones.filter(g => {
    if (filterGrupo && g.gestiones_categorias?.gestiones_grupos?.nombre !== filterGrupo) return false
    if (filterCat && g.gestiones_categorias?.nombre !== filterCat) return false
    return true
  })

  function handleGrupoChange(v: string) {
    setFilterGrupo(v)
    setFilterCat('')
  }

  const selectCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500'

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="establecimiento_id" value={establecimientoId} />

      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}

      {todasGestiones.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-3 py-2">
          No se encontraron gestiones en la librería.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Grupo</label>
              <select value={filterGrupo} onChange={e => handleGrupoChange(e.target.value)} className={selectCls}>
                <option value="">Todos</option>
                {grupos.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Categoría</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className={selectCls}>
                <option value="">Todas</option>
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Gestión *</label>
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
        <label className="text-sm font-medium text-text-secondary block mb-1">Fecha Planificada *</label>
        <input
          type="date"
          name="fecha_planificada"
          required
          value={fechaValue}
          onChange={e => setFechaValue(e.target.value)}
          className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Notas</label>
        <textarea
          name="notas"
          rows={2}
          className="w-full border border-border-default rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={pending || todasGestiones.length === 0}>
          {pending ? 'Guardando…' : 'Planificar'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
      </div>

      <div className="border-t border-border-subtle pt-3">
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

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => {
    if (state?.success) {
      const month = fechaValue ? new Date(fechaValue + 'T00:00:00').getMonth() : undefined
      onSuccessRef.current(month)
    }
    }, [state, fechaValue, onSuccess])
 
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

  const selectCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500'
  const selectErrCls = 'border-red-300 bg-danger-bg'
  const hasSubmitError = state && !state.success

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="establecimiento_id" value={establecimientoId} />
      <input type="hidden" name="categoria_id" value={selectedCatId} />

      {hasSubmitError && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Nombre de la gestión *</label>
        <input
          type="text"
          name="gestion_nombre"
          required
          placeholder="Ej: Simulacro de Evacuación"
          className={selectCls}
        />
        <p className="text-xs text-text-tertiary mt-1">Se agregará a la librería global de gestiones.</p>
      </div>

      {/* Grupo */}
      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Grupo *</label>
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
          <p className="text-xs text-danger mt-1">Grupo requerido</p>
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
        <label className="text-sm font-medium text-text-secondary block mb-1">Categoría *</label>
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
          <p className="text-xs text-danger mt-1">Categoría requerida</p>
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
        <label className="text-sm font-medium text-text-secondary block mb-1">Fecha Planificada *</label>
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
        <label className="text-sm font-medium text-text-secondary block mb-1">Notas</label>
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
  categoria_id: string
  clasificacion_id: string
  responsable_id: string
  fecha_subsanacion: string
}

interface CategoriaObs {
  id: string
  nombre: string
  nivel: number
  color: string
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
  const [categorias, setCategorias] = useState<CategoriaObs[]>([])
  const [observaciones, setObservaciones] = useState<ObsDraft[]>([])
  const obsKeyRef = useRef(0)

  const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500'

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('personas_establecimientos')
      .select('personas_directorio!persona_id(id, nombre, apellido)')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ps = ((data ?? []) as any[])
          .map(pe => pe.personas_directorio)
          .filter(Boolean)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => a.apellido.localeCompare(b.apellido))
        setPersonas(ps)
      })
    supabase
      .from('observaciones_clasificaciones')
      .select('id, nombre')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setClasificaciones((data ?? []) as { id: string; nombre: string }[]))
    supabase
      .from('observaciones_categorias')
      .select('id, nombre, nivel, color')
      .eq('is_active', true)
      .order('nivel')
      .then(({ data }) => setCategorias((data ?? []) as CategoriaObs[]))
  }, [establecimientoId])

  function addObs() {
    setObservaciones(prev => [...prev, {
      key: obsKeyRef.current++,
      descripcion: '',
      categoria_id: '',
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
      const sinCategoria = validObs.filter(o => !o.categoria_id)
      if (sinCategoria.length > 0) {
        setError('Toda observación requiere una categoría.')
        return
      }
      if (validObs.length > 0) {
        const obsResult = await crearObservaciones(registro.id, validObs)
        if (!obsResult.success) { setError(obsResult.error); return }
      }

      onSuccess()
    })
  }

  return (
    <Modal open title={registro.ge_gestion_nombre ?? 'Cargar Evidencia'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="registro_id" value={registro.id} />

        {error && (
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-surface-base rounded-lg px-3 py-2 text-sm text-text-secondary">
          <span className="font-medium">{registro.ge_gestion_nombre ?? '—'}</span>
          {registro.ge_categoria_nombre && (
            <span className="text-text-tertiary"> · {registro.ge_categoria_nombre}</span>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Fecha de Ejecución *</label>
          <input
            type="date"
            name="fecha_ejecutada"
            required
            defaultValue={registro.fecha_ejecutada ?? new Date().toISOString().split('T')[0]}
            className={inputCls}
          />
        </div>

        {registro.ge_tiene_entregable && (
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">
              Fecha de Vencimiento del Entregable
              <span className="text-xs text-text-tertiary font-normal ml-1">(opcional)</span>
            </label>
            <input
              type="date"
              name="fecha_vencimiento"
              defaultValue={registro.fecha_vencimiento ?? ''}
              className={inputCls}
            />
            <p className="text-xs text-text-tertiary mt-1">Fecha en que vence el protocolo, certificado o permiso generado.</p>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Índice *</label>
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
          <label className="text-sm font-medium text-text-secondary block mb-1">Responsable</label>
          <select name="responsable_id" defaultValue={registro.responsable_id ?? ''} className={inputCls}>
            <option value="">Sin asignar</option>
            {personas.map(p => (
              <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Evidencia</label>
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
            className="w-full text-sm text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sig-50 file:text-sig-700 hover:file:bg-sig-100 cursor-pointer"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Notas</label>
          <textarea
            name="notas"
            rows={2}
            defaultValue={registro.notas ?? ''}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* ── Observaciones ─────────────────────────────────────── */}
        <div className="border-t border-border-subtle pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-secondary">
              Observaciones
              {observaciones.length > 0 && (
                <span className="ml-2 text-xs font-normal text-text-tertiary">({observaciones.length})</span>
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
          {observaciones.length === 0 ? (<p className="text-xs text-text-tertiary text-center py-3 border border-dashed border-border-subtle rounded-lg">
              Sin observaciones. Hacé clic en &quot;+ Agregar&quot; para registrar una.
            </p>
          ) : (
            <div className="space-y-2">
              {observaciones.map((obs, idx) => (
                <div key={obs.key} className="border border-border-subtle rounded-lg p-3 space-y-2 bg-gray-50/50">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-text-tertiary mt-2 w-4 shrink-0">{idx + 1}.</span>
                    <textarea
                      value={obs.descripcion}
                      onChange={e => updateObs(obs.key, 'descripcion', e.target.value)}
                      placeholder="Descripción de la observación…"
                      rows={2}
                      className="flex-1 border border-border-default rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeObs(obs.key)}
                      className="text-text-tertiary hover:text-red-400 mt-1 text-base leading-none shrink-0"
                      title="Eliminar observación"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pl-0 sm:pl-6">
                    <div>
                      <label className="text-xs text-text-secondary block mb-0.5">
                        Categoría <span className="text-danger">*</span>
                      </label>
                      <select
                        required
                        value={obs.categoria_id}
                        onChange={e => updateObs(obs.key, 'categoria_id', e.target.value)}
                        className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                        style={obs.categoria_id ? { backgroundColor: categorias.find(c => c.id === obs.categoria_id)?.color, color: '#000' } : {}}
                      >
                        <option value="">Seleccionar…</option>
                        {categorias.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-text-secondary block mb-0.5">Tipo de riesgo</label>
                      <select
                        value={obs.clasificacion_id}
                        onChange={e => updateObs(obs.key, 'clasificacion_id', e.target.value)}
                        className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                      >
                        <option value="">Sin clasificar</option>
                        {clasificaciones.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-text-secondary block mb-0.5">Responsable</label>
                      <select
                        value={obs.responsable_id}
                        onChange={e => updateObs(obs.key, 'responsable_id', e.target.value)}
                        className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                      >
                        <option value="">Sin asignar</option>
                        {personas.map(p => (
                          <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-text-secondary block mb-0.5">Fecha subsanación</label>
                      <input
                        type="date"
                        value={obs.fecha_subsanacion}
                        onChange={e => updateObs(obs.key, 'fecha_subsanacion', e.target.value)}
                        className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sig-500"
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




// ─── Main component ────────────────────────────────────────────────────────────
export function GestionesAgenda({ establecimientoId, canWrite: canWriteProp, riesgos: _riesgos }: GestionesAgendaProps) {
  const queryClient = useQueryClient()
  const { data: canWriteData } = useCanWrite(establecimientoId)
  const canWrite = canWriteProp || (canWriteData ?? false)
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  // Task 1: default = current month
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(
    () => new Set([new Date().getMonth()])
  )

  // Task 2: collapsed months for group view
  const [collapsedMonths, setCollapsedMonths] = useState<Set<number>>(new Set())

  const [searchText, setSearchText] = useState('')
  const [filterEstado, setFilterEstado] = useState<Set<string> | null>(null)
  const [filterCategoria, setFilterCategoria] = useState<Set<string> | null>(null)
  const [filterGrupo, setFilterGrupo] = useState<Set<string> | null>(null)
  const [filterResponsable, setFilterResponsable] = useState<Set<string> | null>(null)
  const [orderByCategoria, setOrderByCategoria] = useState(false)
  const [editingRegistro, setEditingRegistro] = useState<FullRegistro | null>(null)
  const [executingFormulario, setExecutingFormulario] = useState<FullRegistro | null>(null)
  const [showPlanificarModal, setShowPlanificarModal] = useState(false)
  const [showReporteModal, setShowReporteModal] = useState(false)

  // Ctrl+Shift+P → Planificar Gestión (only active while this view is mounted)
  useShortcutAction('plan-gestion', () => setShowPlanificarModal(true))
  // Ctrl+Shift+F → Reporte Fotográfico (camera button equivalent)
  useShortcutAction('open-reporte-fotografico', () => setShowReporteModal(true))


  // Task 4: resizable columns with localStorage
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COL_WIDTHS_KEY)
      if (stored) setColWidths(JSON.parse(stored))
    } catch {}
  }, [])
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
        try { localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(next)) } catch { console.error('[columnWidths] Error al guardar en localStorage') }
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

  const { data: gestionesEst = [], isPending: isGestionesPending } = useGestionesEstablecimiento(establecimientoId, year)
  const geIds = gestionesEst?.map(g => g.id) ?? []
  const { data: rawRegistros } = useRegistrosGestion(geIds.length > 0 ? geIds : undefined, year)
  const { data: catalogo } = useCatalogo()

  const todasGestiones = (catalogo?.gestiones ?? []) as unknown as Gestion[]
  const grupos = (catalogo?.grupos ?? []) as unknown as GrupoGestion[]
  const categorias = (catalogo?.categorias ?? []) as unknown as CategoriaGestion[]

  const { data: gestionesConForm } = useQuery({
    queryKey: ['formularios-secciones', geIds],
    queryFn: async () => {
      const supabase = createClient()
      const gestionIds = gestionesEst
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map(ge => (ge as any).gestiones?.id)
        .filter(Boolean) as string[]
      if (gestionIds.length === 0) return []
      const { data } = await supabase
        .from('formularios_secciones')
        .select('gestion_id')
        .in('gestion_id', gestionIds)
      return (data ?? []).map(s => s.gestion_id)
    },
    enabled: geIds.length > 0,
  })

  const geMap = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, any>()
    for (const ge of gestionesEst) map.set(ge.id, ge)
    return map
  }, [gestionesEst])

  const registros: FullRegistro[] | null = useMemo(() => {
    if (isGestionesPending) return null
    if (gestionesEst.length === 0) return []
    if (rawRegistros === undefined) return null
    if (rawRegistros.length === 0) return []

    type RegRaw = RegistroGestion & {
      responsable: { nombre: string; apellido: string } | null
      aprobado_por: { nombre: string; apellido: string } | null
    }

    const formList = gestionesConForm ?? []

    return (rawRegistros as unknown as RegRaw[]).map(r => {
      const ge = geMap.get(r.gestion_establecimiento_id)
      return {
        ...r,
        ge_id: ge?.id,
        ge_gestion_id: ge?.gestiones?.id,
        ge_tiene_formulario: ge?.gestiones?.id ? formList.includes(ge.gestiones.id) : false,
        ge_tiene_entregable: ge?.gestiones?.tiene_entregable ?? false,
        ge_mostrar_lt: ge?.mostrar_lt ?? false,
        ge_firmada: ge?.firmada ?? false,
        ge_gestion_nombre: ge?.gestiones?.nombre,
        ge_categoria_nombre: ge?.gestiones?.gestiones_categorias?.nombre,
        ge_grupo_nombre: ge?.gestiones?.gestiones_categorias?.gestiones_grupos?.nombre,
        responsable_nombre: r.responsable
          ? `${r.responsable.nombre} ${r.responsable.apellido}`
          : undefined,
        aprobado_nombre: r.aprobado_por
          ? `${r.aprobado_por.nombre} ${r.aprobado_por.apellido}`
          : undefined,
      } as FullRegistro
    })
  }, [rawRegistros, geMap, gestionesConForm, isGestionesPending, gestionesEst])

  // ── Filtering & sorting ─────────────────────────────────────────────────────
  const monthCounts = MONTHS.map((_, i) => {
    if (!registros) return 0
    const m = String(i + 1).padStart(2, '0')
    return registros.filter(r => r.fecha_planificada?.startsWith(`${year}-${m}`)).length
  })

  const q = searchText.toLowerCase().trim()
  const filteredRegistros = (registros ?? []).filter(r => {
    const month = parseInt(r.fecha_planificada?.split('-')[1] ?? '0') - 1
    if (!selectedMonths.has(month)) return false
    const estado = calcularEstadoGestion(r.fecha_ejecutada ?? null, r.fecha_planificada)
    if (filterEstado && filterEstado.size > 0 && !filterEstado.has(estado)) return false
    if (filterCategoria && filterCategoria.size > 0 && !filterCategoria.has(r.ge_categoria_nombre ?? '')) return false
    if (filterGrupo && filterGrupo.size > 0 && !filterGrupo.has(r.ge_grupo_nombre ?? '')) return false
    if (filterResponsable && filterResponsable.size > 0 && !filterResponsable.has(r.responsable_nombre ?? '')) return false
    if (q && !r.ge_gestion_nombre?.toLowerCase().includes(q) && !r.ge_categoria_nombre?.toLowerCase().includes(q)) return false
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

  const totalCols = 7

  // ── Row renderer ────────────────────────────────────────────────────────────
  function renderRows(regs: FullRegistro[]) {
    return regs.map((r, _idx) => {
      const estado = calcularEstadoGestion(r.fecha_ejecutada ?? null, r.fecha_planificada)

      return (
        <tr key={r.id} className={`${ROW_BG_COLORS[estado]} cursor-pointer`} onClick={() => setEditingRegistro(r)}>
          <td className="hidden md:table-cell px-4 py-1.5" style={{ maxWidth: colW('categoria'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span className="flex items-center gap-1.5">
              <CategoriaIcon nombre={r.ge_categoria_nombre} size={14} />
              <CategoriaAbbr nombre={r.ge_categoria_nombre} />
            </span>
          </td>
          <td className="px-4 py-1.5 font-medium text-text-primary" style={{ maxWidth: colW('gestion'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.ge_gestion_nombre ?? '—'}
          </td>
          <td className="px-4 py-1.5 text-text-secondary tabular-nums text-xs">{r.fecha_planificada}</td>
          <td className="hidden md:table-cell px-4 py-1.5 text-text-secondary tabular-nums text-xs">
            {r.fecha_ejecutada ?? <span className="text-text-tertiary">—</span>}
          </td>
          <td className="hidden md:table-cell px-4 py-1.5 text-text-secondary text-xs" style={{ maxWidth: colW('responsable'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.responsable_nombre ?? <span className="text-text-tertiary">—</span>}
          </td>
          <td className="px-4 py-1.5 text-center text-sm tabular-nums text-text-secondary">
            {r.index != null ? r.index : <span className="text-text-tertiary">—</span>}
          </td>
          <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1 justify-center">
              {r.ge_tiene_formulario && (
                <button
                  title="Ejecutar formulario"
                  onClick={() => setExecutingFormulario(r)}
                  className={`p-1.5 rounded-lg transition-colors ${r.fecha_ejecutada ? 'text-success hover:bg-success-bg' : 'text-text-tertiary hover:bg-surface-elevated hover:text-text-secondary'}`}
                >
                  <Play size={14} />
                </button>
              )}
              {canWrite && (
                <button
                  title="Cargar evidencia"
                  onClick={() => setEditingRegistro(r)}
                  className="p-1.5 rounded-lg text-text-tertiary hover:bg-surface-elevated hover:text-text-secondary transition-colors"
                >
                  <Upload size={14} />
                </button>
              )}
              {r.evidencia_url ? (
                <a
                  href={r.evidencia_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Descargar adjunto"
                  className="p-1.5 rounded-lg text-sig-600 hover:bg-sig-50 transition-colors"
                >
                  <Download size={14} />
                </a>
              ) : (
                <span className="p-1.5 text-text-tertiary cursor-not-allowed" title="Sin adjunto">
                  <Download size={14} />
                </span>
              )}
              <button
                title={r.ge_mostrar_lt ? 'Quitar del Legajo Técnico' : 'Habilitar en Legajo Técnico'}
                onClick={() => {
                  const supabase = createClient()
                  supabase.from('gestiones_establecimientos').update({ mostrar_lt: !r.ge_mostrar_lt }).eq('id', r.ge_id)
                  queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento', establecimientoId, year] })
                }}
                className={`p-1.5 rounded-lg transition-colors ${r.ge_mostrar_lt ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'text-text-tertiary hover:bg-surface-elevated hover:text-text-secondary'}`}
              >
                <BookMarked size={14} />
              </button>
            </div>
          </td>
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
        <th style={{ width: colW('categoria') }} className="hidden md:table-cell px-4 py-1.5 font-medium relative select-none">
          Categoría{rh('categoria')}
        </th>
        <th style={{ width: colW('gestion') }} className="px-4 py-1.5 font-medium relative select-none">
          Gestión{rh('gestion')}
        </th>
        <th style={{ width: colW('fecha_plan') }} className="px-4 py-1.5 font-medium relative select-none">
          Fecha Plan.{rh('fecha_plan')}
        </th>
        <th style={{ width: colW('fecha_ejec') }} className="hidden md:table-cell px-4 py-1.5 font-medium relative select-none">
          Fecha Ejec.{rh('fecha_ejec')}
        </th>
        <th style={{ width: colW('responsable') }} className="hidden md:table-cell px-4 py-1.5 font-medium relative select-none">
          Responsable{rh('responsable')}
        </th>
        <th style={{ width: colW('indice') }} className="px-4 py-1.5 font-medium text-center relative select-none">
          Índice{rh('indice')}
        </th>
        <th style={{ width: colW('acciones') }} className="px-4 py-1.5 font-medium text-center relative select-none">
          Acciones{rh('acciones')}
        </th>
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
        <td colSpan={totalCols} className="bg-surface-base px-4 py-2.5 border-y border-border-subtle">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary text-xs">{collapsed ? '▶' : '▼'}</span>
            <span className="font-semibold text-sm text-text-secondary">{MONTHS_FULL[monthIdx]}</span>
            <span className="text-xs bg-surface-sunken text-text-secondary rounded-full px-2 py-0.5">{count}</span>
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
        <button onClick={() => setYear(y => y - 1)} className="text-text-tertiary hover:text-white text-sm font-medium w-12">
          {year - 1}
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(y => y - 1)} className="text-text-tertiary hover:text-white text-lg leading-none">‹‹</button>
          <span className="text-base font-semibold tracking-wide">Gestiones {year}</span>
          <button onClick={() => setYear(y => y + 1)} className="text-text-tertiary hover:text-white text-lg leading-none">››</button>
        </div>
        <button onClick={() => setYear(y => y + 1)} className="text-text-tertiary hover:text-white text-sm font-medium w-12 text-right">
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
                isSelected ? 'bg-sig-500 text-white' : 'bg-surface-elevated text-text-secondary hover:bg-surface-sunken'
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
              ? 'bg-success-bg border-green-300 text-success'
              : 'border-border-subtle text-text-secondary hover:bg-surface-base'
          }`}
        >
          Mes actual
        </button>
        <button
          onClick={() => setSelectedMonths(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))}
          className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
            selectedMonths.size === 12
              ? 'bg-success-bg border-green-300 text-success'
              : 'border-border-subtle text-text-secondary hover:bg-surface-base'
          }`}
        >
          Todos los meses
        </button>
        <button
          onClick={() => setSelectedMonths(new Set())}
          className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
            selectedMonths.size === 0
              ? 'bg-success-bg border-green-300 text-success'
              : 'border-border-subtle text-text-secondary hover:bg-surface-base'
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
          className="text-xs border border-border-subtle rounded-lg px-3 py-1.5 text-text-secondary hover:bg-surface-base"
        >
          Invertir selección
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-0.5 shrink-0">
        <input
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Buscar gestión..."
          className="text-xs border border-border-subtle rounded-lg px-2 py-1.5 bg-surface-base text-text-secondary focus:outline-none w-[140px] shrink-0"
        />
        {gruposFiltro.length > 0 && (
          <MultiFilter
            label="Grupo"
            options={gruposFiltro.map(g => ({ value: g, label: g }))}
            selected={filterGrupo ?? new Set(gruposFiltro)}
            onChange={setFilterGrupo}
          />
        )}
        {categoriasFiltro.length > 0 && (
          <MultiFilter
            label="Categoría"
            options={categoriasFiltro.map(c => ({ value: c, label: c }))}
            selected={filterCategoria ?? new Set(categoriasFiltro)}
            onChange={setFilterCategoria}
          />
        )}
        {responsablesFiltro.length > 0 && (
          <MultiFilter
            label="Responsable"
            options={responsablesFiltro.map(r => ({ value: r, label: r }))}
            selected={filterResponsable ?? new Set(responsablesFiltro)}
            onChange={setFilterResponsable}
          />
        )}
        <MultiFilter
          label="Estado"
          options={[
            { value: 'Planificado', label: 'Planificado' },
            { value: 'Pendiente', label: 'Pendiente' },
            { value: 'Realizado', label: 'Realizado' },
          ]}
          selected={filterEstado ?? new Set(['Planificado', 'Pendiente', 'Realizado'])}
          onChange={setFilterEstado}
        />
        <button
          onClick={() => { setFilterEstado(null); setFilterCategoria(null); setFilterGrupo(null); setFilterResponsable(null); setOrderByCategoria(false) }}
          className="text-xs border border-border-subtle rounded-lg px-2 py-1.5 text-text-secondary hover:bg-surface-base shrink-0"
        >
          Rest.
        </button>

        <button
          onClick={() => setOrderByCategoria(v => !v)}
          className={`text-xs border rounded-lg px-2 py-1.5 transition-colors shrink-0 ${
            orderByCategoria
              ? 'border-sig-300 bg-sig-50 text-sig-700'
              : 'border-border-subtle text-text-secondary hover:bg-surface-base'
          }`}
        >
          Ordenar Categoría
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-text-tertiary">
            {registros !== null ? `${filteredRegistros.length} gestiones` : ''}
          </span>
        </div>
      </div>

      {/* Gestiones table */}
      {registros === null ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary text-sm">
          Cargando…
        </div>
      ) : filteredRegistros.length === 0 ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary text-sm">
          No hay gestiones para el período seleccionado.
        </div>
      ) : (
        <div className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ tableLayout: 'fixed', width: '100%', minWidth: 500 }}>
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



      {/* FAB — Floating Action Buttons (apilados arriba del chat widget) */}
      {canWrite && (
        <div style={{ position: 'fixed', bottom: '6rem', right: '1rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            style={{ position: 'relative' }}
            onMouseEnter={e => { const t = e.currentTarget.querySelector('.fab-tooltip') as HTMLElement; if (t) t.style.opacity = '1' }}
            onMouseLeave={e => { const t = e.currentTarget.querySelector('.fab-tooltip') as HTMLElement; if (t) t.style.opacity = '0' }}
          >
            <button
              type="button"
              onClick={() => setShowReporteModal(true)}
              style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#4CAF50', color: 'white', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', transition: 'transform 0.15s, background-color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#43A047'; e.currentTarget.style.transform = 'scale(1.1)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              <Camera size={20} strokeWidth={2} />
            </button>
            <span className="fab-tooltip" style={{ position: 'absolute', right: '64px', top: '50%', transform: 'translateY(-50%)', backgroundColor: '#111827', color: 'white', fontSize: '12px', borderRadius: '8px', padding: '6px 10px', whiteSpace: 'nowrap', opacity: 0, transition: 'opacity 0.2s', pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              Generar reporte fotográfico
            </span>
          </div>
          <div
            style={{ position: 'relative' }}
            onMouseEnter={e => { const t = e.currentTarget.querySelector('.fab-tooltip') as HTMLElement; if (t) t.style.opacity = '1' }}
            onMouseLeave={e => { const t = e.currentTarget.querySelector('.fab-tooltip') as HTMLElement; if (t) t.style.opacity = '0' }}
          >
            <button
              type="button"
              onClick={() => setShowPlanificarModal(true)}
              style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#4CAF50', color: 'white', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', transition: 'transform 0.15s, background-color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#43A047'; e.currentTarget.style.transform = 'scale(1.1)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              <Plus size={22} strokeWidth={2.5} />
            </button>
            <span className="fab-tooltip" style={{ position: 'absolute', right: '64px', top: '50%', transform: 'translateY(-50%)', backgroundColor: '#111827', color: 'white', fontSize: '12px', borderRadius: '8px', padding: '6px 10px', whiteSpace: 'nowrap', opacity: 0, transition: 'opacity 0.2s', pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              Planificar nueva gestión
            </span>
          </div>
        </div>
      )}

      {/* Modals */}
      {executingFormulario && (
        <FormularioEjecucion
          registro={executingFormulario}
          establecimientoId={establecimientoId}
          onClose={() => setExecutingFormulario(null)}
          onSuccess={() => { setExecutingFormulario(null); queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento', establecimientoId, year] }); queryClient.invalidateQueries({ queryKey: ['registros-gestion'] }) }}
        />
      )}
      {editingRegistro && (
        <EjecucionModal
          registro={editingRegistro}
          establecimientoId={establecimientoId}
          onClose={() => setEditingRegistro(null)}
          onSuccess={() => { setEditingRegistro(null); queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento', establecimientoId, year] }); queryClient.invalidateQueries({ queryKey: ['registros-gestion'] }) }}
        />
      )}

      {showPlanificarModal && (
        <Modal open title="Planificar nueva gestión" onClose={() => setShowPlanificarModal(false)}>
          <PlanificarFlow
            establecimientoId={establecimientoId}
            grupos={grupos}
            categorias={categorias}
            todasGestiones={todasGestiones}
            onClose={() => setShowPlanificarModal(false)}
            onSuccess={() => { setShowPlanificarModal(false); queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento', establecimientoId, year] }); queryClient.invalidateQueries({ queryKey: ['registros-gestion'] }); queryClient.invalidateQueries({ queryKey: ['catalogo-gestiones'] }) }}
          />
        </Modal>
      )}

      {showReporteModal && (
        <ReporteFotograficoModal
          establecimientoId={establecimientoId}
          onClose={() => setShowReporteModal(false)}
          onSuccess={() => { setShowReporteModal(false); queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento', establecimientoId, year] }); queryClient.invalidateQueries({ queryKey: ['registros-gestion'] }) }}
        />
      )}

    </div>
  )
}

// ─── PlanificarFlow ─────────────────────────────────────────────────────────
function PlanificarFlow({
  establecimientoId, grupos, categorias, todasGestiones, onClose, onSuccess,
}: {
  establecimientoId: string
  grupos: GrupoGestion[]
  categorias: CategoriaGestion[]
  todasGestiones: Gestion[]
  onClose: () => void
  onSuccess: (month?: number) => void
}) {
  const [mode, setMode] = useState<'biblioteca' | 'nueva'>('biblioteca')
  return mode === 'nueva' ? (
    <NuevaGestionForm
      establecimientoId={establecimientoId}
      grupos={grupos}
      categorias={categorias}
      onClose={() => {}}
      onSuccess={onSuccess}
    />
  ) : (
    <BibliotecaForm
      establecimientoId={establecimientoId}
      todasGestiones={todasGestiones}
      onClose={onClose}
      onSuccess={onSuccess}
      onSwitchToNueva={() => setMode('nueva')}
    />
  )
}
