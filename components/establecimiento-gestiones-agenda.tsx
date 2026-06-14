'use client'

import { useState, useEffect, useTransition, useRef, Fragment, memo, useMemo } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'
import { useSignedUrls, signBucketPaths } from '@/lib/storage/sign-client'
import { useCanWrite, useGestionesEstablecimiento, useRegistrosGestion, useCatalogo } from '@/lib/queries/agenda'
import { calcularEstadoGestion } from '@/lib/types'
import type { EstadoGestion, Gestion, CategoriaGestion, GrupoGestion, RegistroGestion, Riesgo } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { MultiSelectFilter } from '@/components/ui/multi-select-filter'
import { ViewSelector } from '@/components/ui/view-selector'
import {
  Camera, BarChart3, FileCheck,
  ClipboardCheck, GraduationCap, Heart, FileText, AlertTriangle,
  ClipboardList, UserPlus, Dumbbell, Kanban, HelpCircle,
  Play, Upload, Download, BookMarked,
  ChevronUp, ChevronDown, Columns, CalendarDays, List, X, Thermometer, Flame, Zap, Volume2, Lightbulb,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { createPortal } from 'react-dom'
import {
  planificarGestionNuevaLote,
  planificarGestionesLote,
  createGrupoGestion,
  createCategoriaGestion,
} from '@/lib/actions/gestion-establecimiento'
import { ejecutarGestion, crearObservaciones } from '@/lib/actions/registro-gestion'
import { PersonaSelector } from '@/components/persona-selector'
import { AuditHistorialLink } from '@/components/auditoria/audit-historial-link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'


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
const ReporteFotograficoEjecutorModal = dynamic(
  () => import('@/components/reporte-fotografico-ejecutor-modal').then(m => m.ReporteFotograficoEjecutorModal),
  { ssr: false }
)
const PresentacionAutoproteccionEjecutorModal = dynamic(
  () => import('@/components/presentacion-autoproteccion-ejecutor-modal').then(m => m.PresentacionAutoproteccionEjecutorModal),
  { ssr: false }
)
const MedicionIluminacionEjecutorModal = dynamic(
  () => import('@/components/medicion-iluminacion-ejecutor-modal').then(m => m.MedicionIluminacionEjecutorModal),
  { ssr: false }
)
const MedicionRuidoEjecutorModal = dynamic(
  () => import('@/components/medicion-ruido-ejecutor-modal').then(m => m.MedicionRuidoEjecutorModal),
  { ssr: false }
)
const MedicionPatEjecutorModal = dynamic(
  () => import('@/components/medicion-pat-ejecutor-modal').then(m => m.MedicionPatEjecutorModal),
  { ssr: false }
)
const CalculoCargaFuegoEjecutorModal = dynamic(
  () => import('@/components/calculo-carga-fuego-ejecutor-modal').then(m => m.CalculoCargaFuegoEjecutorModal),
  { ssr: false }
)
const MedicionCargaTermicaEjecutorModal = dynamic(
  () => import('@/components/medicion-carga-termica-ejecutor-modal').then(m => m.MedicionCargaTermicaEjecutorModal),
  { ssr: false }
)
const EjecutarCapacitacionModal = dynamic(
  () => import('@/components/cursos/ejecutar-capacitacion-modal').then(m => m.EjecutarCapacitacionModal),
  { ssr: false }
)

// Categoría de gestiones que habilita el flujo de capacitación (LMS / campus virtual).
const CATEGORIA_CAPACITACIONES = 'Capacitaciones'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// ─── Generador de fechas en lote (puro, sin timezone) ───────────────────────────
// Días de la semana: 0 = Lunes … 6 = Domingo (orden Lun..Dom para la UI).
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

type PatronLote = 'mensual' | 'porMes' | 'diaSemana'

/** Cantidad de días del mes (month 0-indexed). Construido por componentes. */
function diasEnMes(year: number, month0: number): number {
  // El día 0 del mes siguiente == último día de este mes.
  return new Date(year, month0 + 1, 0).getDate()
}

/** Día de la semana 0=Lun..6=Dom para (year, month0, dia). Sin serialización a string. */
function diaSemanaLun0(year: number, month0: number, dia: number): number {
  const js = new Date(year, month0, dia).getDay() // 0=Dom..6=Sáb
  return (js + 6) % 7 // 0=Lun..6=Dom
}

/** Formatea por componentes: YYYY-MM-DD con padding manual. NO usa toISOString. */
function fmtFecha(year: number, month0: number, dia: number): string {
  const mm = String(month0 + 1).padStart(2, '0')
  const dd = String(dia).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

const MAX_FECHAS_LOTE = 366

/**
 * Genera el set de fechas (YYYY-MM-DD) a partir del año, los meses elegidos y el patrón.
 * - mensual: 1 ocurrencia por mes. Si diaMes === 'ultimo' → último día del mes.
 *   Si es un número 1–31 → ese día específico (clamp al último día del mes si supera).
 * - porMes: N ocurrencias por mes distribuidas parejo → dia_k = round(D * k / N), k=1..N.
 *   (N=1 → último día; N=4, D=30 → 8,15,23,30).
 * - diaSemana: todas las fechas del mes que caen en CUALQUIERA de los días indicados
 *   en diasSemana (array de 0=Lun..6=Dom). Default: [5] (Sábado).
 * Límite: MAX_FECHAS_LOTE (366). Resultado ordenado y deduplicado.
 */
function generarFechasLote(
  year: number,
  meses: number[],
  patron: PatronLote,
  cantidad: number,
  /** @deprecated usar diasSemana[] para patrón diaSemana */
  diaSemana: number,
  diaMes?: number | 'ultimo',
  diasSemana?: number[],
): string[] {
  const mesesOrdenados = [...meses].sort((a, b) => a - b)
  const out: string[] = []

  // Defensa en profundidad: si el patrón es diaSemana y no hay días seleccionados, no generar nada
  if (patron === 'diaSemana' && (!diasSemana || diasSemana.length === 0)) return []

  // Normalizar parámetros para multi-día de semana
  const diasSemanaEfectivos: number[] = diasSemana && diasSemana.length > 0
    ? diasSemana
    : [diaSemana]
  const diasSemanaSet = new Set(diasSemanaEfectivos)

  for (const m of mesesOrdenados) {
    const D = diasEnMes(year, m)

    if (patron === 'mensual') {
      let dia: number
      if (!diaMes || diaMes === 'ultimo') {
        dia = D
      } else {
        dia = Math.min(diaMes as number, D)
      }
      out.push(fmtFecha(year, m, dia))
    } else if (patron === 'porMes') {
      const N = Math.max(1, Math.floor(cantidad))
      const vistos = new Set<number>()
      for (let k = 1; k <= N; k++) {
        let dia = Math.round((D * k) / N)
        if (dia < 1) dia = 1
        if (dia > D) dia = D
        // Evitar duplicados cuando N > D (días colisionan).
        while (vistos.has(dia) && dia < D) dia++
        if (vistos.has(dia)) continue
        vistos.add(dia)
        out.push(fmtFecha(year, m, dia))
      }
    } else {
      for (let dia = 1; dia <= D; dia++) {
        if (diasSemanaSet.has(diaSemanaLun0(year, m, dia))) {
          out.push(fmtFecha(year, m, dia))
        }
      }
    }

    // Cortar si ya llegamos al límite
    if (out.length >= MAX_FECHAS_LOTE) break
  }

  // Deduplicar y ordenar (por si hubiera solapamientos edge-case)
  const deduped = Array.from(new Set(out)).sort()
  return deduped.slice(0, MAX_FECHAS_LOTE)
}

const COL_WIDTHS_KEY = 'gestiones_col_widths'
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  categoria: 140, gestion: 180, fecha_plan: 100, fecha_ejec: 100,
  responsable: 130, indice: 70, acciones: 160,
}
const COL_MIN_WIDTHS: Record<string, number> = {
  categoria: 24, gestion: 24, fecha_plan: 24, fecha_ejec: 24,
  responsable: 24, indice: 15, acciones: 30,
}

const ROW_BG_COLORS: Record<EstadoGestion, string> = {
  Realizado: 'bg-green-200 hover:bg-green-300',
  Pendiente: 'bg-red-200 hover:bg-red-300',
  Planificado: 'bg-white hover:bg-gray-50',
}

const COL_VISIBLE_KEY = 'gestiones_col_visible'
const TOGGLEABLE_COLS = [
  { key: 'categoria', label: 'Categoría' },
  { key: 'fecha_ejec', label: 'Fecha Ejec.' },
  { key: 'responsable', label: 'Responsable' },
  { key: 'indice', label: 'Índice' },
] as const

type SortCol = 'categoria' | 'gestion' | 'fecha_plan' | 'fecha_ejec' | 'responsable' | 'indice'
type ViewMode = 'tabla' | 'calendario' | 'kanban'


interface FullRegistro extends RegistroGestion {
  ge_gestion_nombre?: string
  ge_categoria_nombre?: string
  ge_grupo_nombre?: string
  ge_id?: string
  ge_gestion_id?: string
  ge_tiene_formulario?: boolean
  ge_tiene_entregable?: boolean
  ge_tipo_ejecucion?: string
  ge_firmada?: boolean
  responsable_nombre?: string
  aprobado_nombre?: string
}

interface GestionesAgendaProps {
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  riesgos: Riesgo[]
  /** Nombre del establecimiento, para el título "Gestiones (nombre) {año}". */
  establecimientoNombre?: string
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

// ─── PreviewMesGroup ─────────────────────────────────────────────────────────
// Grupo colapsable de ocurrencias de un mes, cada una con fecha editable + quitar.
function PreviewMesGroup({
  month0,
  fechas,
  onChangeFecha,
  onRemoveFecha,
}: {
  month0: number
  fechas: { id: number; fecha: string }[]
  onChangeFecha: (id: number, fecha: string) => void
  onRemoveFecha: (id: number) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-border-subtle rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-surface-base hover:bg-gray-50 text-sm font-medium text-text-secondary"
      >
        <span>{MONTHS_FULL[month0]} ({fechas.length})</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="p-2 space-y-1.5">
          {fechas.map(f => (
            <div key={f.id} className="flex items-center gap-2">
              <input
                type="date"
                value={f.fecha}
                onChange={e => onChangeFecha(f.id, e.target.value)}
                className="flex-1 border border-border-default rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
              />
              <button
                type="button"
                onClick={() => onRemoveFecha(f.id)}
                title="Quitar esta ocurrencia"
                className="p-1 text-text-tertiary hover:text-danger rounded"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── GeneradorFechasLote ───────────────────────────────────────────────────────
// Sub-componente reutilizable: selector de año + grilla de 12 meses + patrón de
// repetición + preview editable agrupado por mes. Expone las fechas finales
// (YYYY-MM-DD ordenadas) y el primer mes con ocurrencias vía onChange. Lo usan
// BibliotecaForm (planificar gestión existente) y NuevaGestionForm (crear +
// planificar) para no duplicar la lógica del generador.
//
// NOTA: cambiar año/meses/patrón/cantidad REGENERA el preview y pisa cualquier
// edición manual de fechas. Las ediciones individuales (input date / quitar)
// sobreviven hasta el próximo cambio de parámetros.
interface OcurrenciaDraft {
  id: number
  fecha: string // YYYY-MM-DD
}

function GeneradorFechasLote({
  onChange,
}: {
  /** Notifica al padre las fechas válidas (ordenadas) y el primer mes (0-indexed). */
  onChange: (fechas: string[], primerMes?: number) => void
}) {
  // Período
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(anioActual)
  const [meses, setMeses] = useState<Set<number>>(new Set())

  // Patrón
  const [patron, setPatron] = useState<PatronLote>('mensual')
  const [cantidad, setCantidad] = useState(2)
  // Para mensual: día específico o 'ultimo'
  const [diaMes, setDiaMes] = useState<'ultimo' | number>('ultimo')
  // Para diaSemana: multi-select (array de 0=Lun..6=Dom). Default: [5] = Sábado
  const [diasSemana, setDiasSemana] = useState<number[]>([5])

  // Preview editable
  const [ocurrencias, setOcurrencias] = useState<OcurrenciaDraft[]>([])
  const idRef = useRef(0)

  function toggleMes(m: number) {
    setMeses(prev => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  const todosLosMeses = meses.size === 12
  function toggleTodos() {
    setMeses(todosLosMeses ? new Set() : new Set(Array.from({ length: 12 }, (_, i) => i)))
  }

  function toggleDiaSemana(d: number) {
    setDiasSemana(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
  }

  function seleccionarLunesViernes() {
    setDiasSemana([0, 1, 2, 3, 4])
  }

  function seleccionarTodos() {
    setDiasSemana([0, 1, 2, 3, 4, 5, 6])
  }

  // Regenera el preview cuando cambian año/meses/patrón/cantidad/díaMes/diasSemana.
  // Pisa ediciones manuales (documentado arriba).
  const mesesKey = Array.from(meses).sort((a, b) => a - b).join(',')
  const diasSemanaKey = [...diasSemana].sort((a, b) => a - b).join(',')
  useEffect(() => {
    const mesesArr = mesesKey ? mesesKey.split(',').map(Number) : []
    if (mesesArr.length === 0) {
      setOcurrencias([])
      return
    }
    if (patron === 'diaSemana' && diasSemana.length === 0) {
      setOcurrencias([])
      return
    }
    // Pasamos diaSemana=5 como legacy (ignorado en favor de diasSemana[])
    const fechas = generarFechasLote(anio, mesesArr, patron, cantidad, 5, diaMes, diasSemana)
    setOcurrencias(fechas.map(fecha => ({ id: idRef.current++, fecha })))
  }, [anio, mesesKey, patron, cantidad, diaMes, diasSemanaKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChangeFecha(id: number, fecha: string) {
    setOcurrencias(prev => prev.map(o => (o.id === id ? { ...o, fecha } : o)))
  }
  function handleRemoveFecha(id: number) {
    setOcurrencias(prev => prev.filter(o => o.id !== id))
  }

  // Agrupar ocurrencias por mes para el preview (orden cronológico).
  const fechasValidas = ocurrencias.filter(o => /^\d{4}-\d{2}-\d{2}$/.test(o.fecha))
  const fechasOrdenadas = [...fechasValidas].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const grupoPorMes = new Map<number, OcurrenciaDraft[]>()
  for (const o of fechasOrdenadas) {
    const m = Number(o.fecha.slice(5, 7)) - 1
    const arr = grupoPorMes.get(m) ?? []
    arr.push(o)
    grupoPorMes.set(m, arr)
  }
  const mesesPreview = Array.from(grupoPorMes.keys()).sort((a, b) => a - b)
  const total = fechasValidas.length

  // Notificamos al padre las fechas finales cada vez que cambian.
  const fechasFinalesKey = fechasOrdenadas.map(o => o.fecha).join(',')
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    const fechas = fechasFinalesKey ? fechasFinalesKey.split(',') : []
    const primerMes = fechas.length > 0 ? Number(fechas[0].slice(5, 7)) - 1 : undefined
    onChangeRef.current(fechas, primerMes)
  }, [fechasFinalesKey])

  return (
    <>
      {/* PERÍODO */}
      <div className="border-t border-border-subtle pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-secondary">Período</label>
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="border border-border-default rounded-lg px-2 py-1 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
          >
            <option value={anioActual}>{anioActual}</option>
            <option value={anioActual + 1}>{anioActual + 1}</option>
          </select>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {MONTHS.map((m, i) => {
            const sel = meses.has(i)
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMes(i)}
                className={`text-xs rounded-lg py-1.5 border transition-colors ${
                  sel
                    ? 'bg-sig-500 text-white border-sig-500'
                    : 'bg-surface-base text-text-secondary border-border-default hover:bg-gray-50'
                }`}
              >
                {m}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={toggleTodos}
          className="text-xs text-sig-600 hover:text-sig-800 hover:underline"
        >
          {todosLosMeses ? 'Ninguno' : 'Todos'}
        </button>
      </div>

      {/* PATRÓN */}
      <div className="border-t border-border-subtle pt-3 space-y-2">
        <label className="text-sm font-medium text-text-secondary block">Patrón de repetición</label>
        <div className="space-y-3 text-sm">
          {/* 1 vez por mes */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="patron"
                checked={patron === 'mensual'}
                onChange={() => setPatron('mensual')}
                className="accent-sig-500"
              />
              <span>1 vez por mes</span>
            </label>
            {patron === 'mensual' && (
              <div className="mt-2 ml-6 flex items-center gap-2">
                <label className="text-xs text-text-secondary">Día:</label>
                <select
                  value={diaMes === 'ultimo' ? 'ultimo' : String(diaMes)}
                  onChange={e => setDiaMes(e.target.value === 'ultimo' ? 'ultimo' : Number(e.target.value))}
                  className="border border-border-default rounded-lg px-2 py-1 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                >
                  <option value="ultimo">Último día del mes</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>Día {d}</option>
                  ))}
                </select>
                <span className="text-xs text-text-tertiary">(se ajusta si el mes tiene menos días)</span>
              </div>
            )}
          </div>

          {/* N veces por mes */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="patron"
              checked={patron === 'porMes'}
              onChange={() => setPatron('porMes')}
              className="accent-sig-500"
            />
            <span>N veces por mes</span>
            {patron === 'porMes' && (
              <input
                type="number"
                min={1}
                value={cantidad}
                onChange={e => setCantidad(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 border border-border-default rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
              />
            )}
          </label>

          {/* Días de semana (multi) */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="patron"
                checked={patron === 'diaSemana'}
                onChange={() => setPatron('diaSemana')}
                className="accent-sig-500"
              />
              <span>Días de la semana</span>
            </label>
            {patron === 'diaSemana' && (
              <div className="mt-2 ml-6 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {DIAS_SEMANA.map((d, i) => {
                    const sel = diasSemana.includes(i)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDiaSemana(i)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          sel
                            ? 'bg-sig-500 text-white border-sig-500'
                            : 'bg-surface-base text-text-secondary border-border-default hover:bg-gray-50'
                        }`}
                      >
                        {d.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={seleccionarLunesViernes}
                    className="text-xs text-sig-600 hover:text-sig-800 hover:underline"
                  >
                    Lun a Vie
                  </button>
                  <span className="text-text-tertiary text-xs">·</span>
                  <button
                    type="button"
                    onClick={seleccionarTodos}
                    className="text-xs text-sig-600 hover:text-sig-800 hover:underline"
                  >
                    Todos
                  </button>
                  {diasSemana.length > 0 && (
                    <>
                      <span className="text-text-tertiary text-xs">·</span>
                      <button
                        type="button"
                        onClick={() => setDiasSemana([])}
                        className="text-xs text-text-tertiary hover:text-danger hover:underline"
                      >
                        Ninguno
                      </button>
                    </>
                  )}
                </div>
                {diasSemana.length === 0 && (
                  <p className="text-xs text-amber-600">Seleccioná al menos un día.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PREVIEW EDITABLE */}
      {meses.size > 0 && (
        <div className="border-t border-border-subtle pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">Ocurrencias generadas</label>
            <span className="text-sm font-semibold text-sig-600">{total} gestiones a planificar</span>
          </div>
          {total === 0 ? (
            <p className="text-xs text-text-tertiary">No se generaron ocurrencias para los meses elegidos.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {mesesPreview.map(m => (
                <PreviewMesGroup
                  key={m}
                  month0={m}
                  fechas={(grupoPorMes.get(m) ?? []).map(o => ({ id: o.id, fecha: o.fecha }))}
                  onChangeFecha={handleChangeFecha}
                  onRemoveFecha={handleRemoveFecha}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ─── BibliotecaForm ────────────────────────────────────────────────────────────
// Generador de planificación EN LOTE: elegí gestión, año, meses y un patrón de
// repetición (vía GeneradorFechasLote) + un responsable OPCIONAL → genera todas
// las ocurrencias con fechas editables y guarda en un solo submit
// (planificarGestionLote).
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
  const [filterGrupo, setFilterGrupo] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [notas, setNotas] = useState('')
  const [responsableId, setResponsableId] = useState<string | null>(null)

  // Fechas finales + primer mes provistas por el generador.
  const [fechas, setFechas] = useState<string[]>([])
  const [primerMes, setPrimerMes] = useState<number | undefined>(undefined)
  const handleFechasChange = (f: string[], pm?: number) => { setFechas(f); setPrimerMes(pm) }

  // Submit
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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

  function normalizar(s: string) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  }

  const terminoBusqueda = normalizar(busqueda.trim())
  const gestionesVisibles = terminoBusqueda
    ? gestionesFiltradas.filter(g => {
        if (normalizar(g.nombre).includes(terminoBusqueda)) return true
        if (normalizar(g.gestiones_categorias?.nombre ?? '').includes(terminoBusqueda)) return true
        if (normalizar(g.gestiones_categorias?.gestiones_grupos?.nombre ?? '').includes(terminoBusqueda)) return true
        return false
      })
    : gestionesFiltradas

  function handleGrupoChange(v: string) {
    setFilterGrupo(v)
    setFilterCat('')
  }

  // ── Multi-selección de gestiones ──────────────────────────────────────────
  const [gestionIds, setGestionIds] = useState<Set<string>>(new Set())

  function toggleGestion(id: string) {
    setGestionIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Resetear selección al cambiar filtros
  function handleGrupoCambio(v: string) {
    handleGrupoChange(v)
    setGestionIds(new Set())
  }

  function handleCatCambio(v: string) {
    setFilterCat(v)
    setGestionIds(new Set())
  }

  const gestionesSeleccionadas = gestionIds.size
  const total = fechas.length
  const totalRegistros = gestionesSeleccionadas * total

  function handleSubmit() {
    if (gestionIds.size === 0 || total === 0) return
    setError(null)
    startTransition(async () => {
      const ids = Array.from(gestionIds)
      const res = await planificarGestionesLote(ids, establecimientoId, fechas, responsableId, notas.trim() || null)
      if (!res.success) {
        setError(res.error)
        return
      }
      onSuccess(primerMes)
    })
  }

  const selectCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500'

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {todasGestiones.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-3 py-2">
          No se encontraron gestiones en la librería.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Columna izquierda: QUÉ ── */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Qué planificar</p>

            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Grupo</label>
                <select value={filterGrupo} onChange={e => handleGrupoCambio(e.target.value)} className={selectCls}>
                  <option value="">Todos</option>
                  {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Categoría</label>
                <select value={filterCat} onChange={e => handleCatCambio(e.target.value)} className={selectCls}>
                  <option value="">Todas</option>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Lista multi-checkbox de gestiones */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-text-secondary">
                  Gestiones *
                  <span className="text-xs text-text-tertiary font-normal ml-1">(elegí una o más)</span>
                </label>
                {gestionesVisibles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const visiblesIds = new Set(gestionesVisibles.map(g => g.id))
                      const todasVisiblesSeleccionadas = gestionesVisibles.every(g => gestionIds.has(g.id))
                      if (todasVisiblesSeleccionadas) {
                        setGestionIds(prev => {
                          const next = new Set(prev)
                          visiblesIds.forEach(id => next.delete(id))
                          return next
                        })
                      } else {
                        setGestionIds(prev => {
                          const next = new Set(prev)
                          visiblesIds.forEach(id => next.add(id))
                          return next
                        })
                      }
                    }}
                    className="text-xs text-sig-600 hover:text-sig-800 hover:underline"
                  >
                    {gestionesVisibles.every(g => gestionIds.has(g.id)) ? 'Ninguna' : 'Todas'}
                  </button>
                )}
              </div>

              {/* Buscador de texto */}
              <div className="relative mb-2">
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar gestión…"
                  className="w-full border border-border-default rounded-lg pl-3 pr-8 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => setBusqueda('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="border border-border-default rounded-lg divide-y divide-border-subtle max-h-52 overflow-y-auto">
                {gestionesFiltradas.length === 0 ? (
                  <p className="text-xs text-text-tertiary px-3 py-2">Sin gestiones para los filtros elegidos.</p>
                ) : gestionesVisibles.length === 0 ? (
                  <p className="text-xs text-text-tertiary px-3 py-2">No se encontraron gestiones con ese texto.</p>
                ) : (
                  gestionesVisibles.map(g => {
                    const sel = gestionIds.has(g.id)
                    return (
                      <label
                        key={g.id}
                        className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                          sel ? 'bg-sig-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => toggleGestion(g.id)}
                          className="accent-sig-500 shrink-0"
                        />
                        <span className="truncate">{g.nombre}</span>
                      </label>
                    )
                  })
                )}
              </div>
              {gestionesSeleccionadas > 0 && (
                <p className="text-xs text-text-secondary mt-1">
                  <strong className="text-sig-700">{gestionesSeleccionadas} {gestionesSeleccionadas === 1 ? 'gestión seleccionada' : 'gestiones seleccionadas'}</strong>
                  {total > 0 && (
                    <> × {total} {total === 1 ? 'fecha' : 'fechas'} = <strong className="text-sig-700">{totalRegistros} registros</strong></>
                  )}
                </p>
              )}
            </div>

            {/* Responsable */}
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">
                Responsable
                <span className="text-xs text-text-tertiary font-normal ml-1">(opcional)</span>
              </label>
              <PersonaSelector
                name="responsable_id_lote"
                value={responsableId}
                onChange={setResponsableId}
                placeholder="Buscar responsable…"
              />
            </div>

            {/* Notas */}
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Notas</label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={3}
                className="w-full border border-border-default rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
              />
            </div>
          </div>

          {/* ── Columna derecha: CUÁNDO ── */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Cuándo</p>
            <GeneradorFechasLote onChange={handleFechasChange} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-1 border-t border-border-subtle">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || gestionIds.size === 0 || total === 0}
        >
          {isPending
            ? 'Guardando…'
            : gestionesSeleccionadas > 0
              ? `Planificar ${gestionesSeleccionadas} ${gestionesSeleccionadas === 1 ? 'gestión' : 'gestiones'}`
              : 'Planificar gestiones'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <button
          type="button"
          onClick={onSwitchToNueva}
          className="ml-auto text-xs text-sig-600 hover:text-sig-800 hover:underline self-center"
        >
          ¿No encontrás la gestión? → Crear nueva
        </button>
      </div>
    </div>
  )
}

// ─── NuevaGestionForm ──────────────────────────────────────────────────────────
// Define una gestión nueva (nombre + grupo/categoría con creación inline) y la
// planifica EN LOTE usando el mismo GeneradorFechasLote que BibliotecaForm:
// al guardar crea la gestión y planifica TODAS las fechas (planificarGestionNuevaLote).
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
  const [localGrupos, setLocalGrupos] = useState(gruposProp)
  const [localCategorias, setLocalCategorias] = useState(categoriasProp)
  const [selectedGrupoId, setSelectedGrupoId] = useState('')
  const [selectedCatId, setSelectedCatId] = useState('')
  const [nombre, setNombre] = useState('')
  const [notas, setNotas] = useState('')
  const [responsableId, setResponsableId] = useState<string | null>(null)

  // Fechas finales + primer mes provistas por el generador.
  const [fechas, setFechas] = useState<string[]>([])
  const [primerMes, setPrimerMes] = useState<number | undefined>(undefined)
  const handleFechasChange = (f: string[], pm?: number) => { setFechas(f); setPrimerMes(pm) }

  const [creandoGrupo, setCreandoGrupo] = useState(false)
  const [errorGrupo, setErrorGrupo] = useState('')
  const [creandoCat, setCreandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState('')

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false)

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

  const total = fechas.length

  function handleSubmit() {
    setShowValidation(true)
    setError(null)
    if (!nombre.trim() || !selectedCatId || total === 0) return
    startTransition(async () => {
      const res = await planificarGestionNuevaLote(
        nombre.trim(),
        selectedCatId,
        establecimientoId,
        fechas,
        responsableId,
        notas.trim() || null,
      )
      if (!res.success) {
        setError(res.error)
        return
      }
      onSuccess(primerMes)
    })
  }

  const selectCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500'
  const selectErrCls = 'border-red-300 bg-danger-bg'

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Columna izquierda: QUÉ ── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Qué crear</p>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Nombre de la gestión *</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
              placeholder="Ej: Simulacro de Evacuación"
              className={`${selectCls} ${showValidation && !nombre.trim() ? selectErrCls : ''}`}
            />
            <p className="text-xs text-text-tertiary mt-1">Se agregará a la librería global de gestiones.</p>
          </div>

          {/* Grupo */}
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Grupo *</label>
            <select
              value={selectedGrupoId}
              onChange={handleGrupoSelect}
              className={`${selectCls} ${showValidation && !selectedGrupoId ? selectErrCls : ''}`}
            >
              <option value="">Seleccionar grupo…</option>
              {localGrupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              <option value="__create__">+ Crear nuevo grupo</option>
            </select>
            {showValidation && !selectedGrupoId && (
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
              className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed ${showValidation && !selectedCatId ? selectErrCls : ''}`}
            >
              <option value="">{selectedGrupoId ? 'Seleccionar categoría…' : 'Seleccioná un grupo primero'}</option>
              {catsFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              {selectedGrupoId && <option value="__create__">+ Crear nueva categoría</option>}
            </select>
            {showValidation && !selectedCatId && (
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

          {/* Responsable */}
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">
              Responsable
              <span className="text-xs text-text-tertiary font-normal ml-1">(opcional)</span>
            </label>
            <PersonaSelector
              name="responsable_id_nueva"
              value={responsableId}
              onChange={setResponsableId}
              placeholder="Buscar responsable…"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Notas</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              className={`${selectCls} resize-none`}
            />
          </div>

          {!selectedCatId && (
            <p className="text-xs text-amber-600">
              {!selectedGrupoId ? 'Seleccioná un Grupo y una Categoría para continuar.' : 'Seleccioná una Categoría para continuar.'}
            </p>
          )}
        </div>

        {/* ── Columna derecha: CUÁNDO ── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Cuándo</p>
          <GeneradorFechasLote onChange={handleFechasChange} />
        </div>
      </div>

      <div className="flex gap-3 pt-1 border-t border-border-subtle">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !nombre.trim() || !selectedCatId || total === 0}
        >
          {isPending ? 'Guardando…' : `Crear y planificar ${total} ${total === 1 ? 'fecha' : 'fechas'}`}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
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
  const [autoDownload, setAutoDownload] = useState(true)
  const obsKeyRef = useRef(0)
  // Bucket privado `documentos`: firmamos la evidencia actual para el link "Ver".
  const { getUrl } = useSignedUrls('documentos', [registro.evidencia_url])

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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('auto_download_gestion').eq('id', user.id).maybeSingle()
          .then(({ data }) => setAutoDownload(data?.auto_download_gestion ?? true))
      }
    })
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

  function doSave(callback: () => void) {
    setError(null)
    const form = document.getElementById('ejecucion-form') as HTMLFormElement
    if (!form) return
    const fd = new FormData(form)
    startTransition(async () => {
      // Validamos las observaciones ANTES de ejecutar: ejecutarGestion marca el
      // registro como Realizado, así que no conviene persistir la ejecución si las
      // observaciones son inválidas (falta categoría) y después no se guardan.
      const validObs = observaciones.filter(o => o.descripcion.trim())
      const sinCategoria = validObs.filter(o => !o.categoria_id)
      if (sinCategoria.length > 0) {
        setError('Toda observación requiere una categoría.')
        return
      }

      const result = await ejecutarGestion(null, fd)
      if (!result.success) { setError(result.error); return }

      if (validObs.length > 0) {
        const obsResult = await crearObservaciones(registro.id, validObs)
        if (!obsResult.success) { setError(obsResult.error); return }
      }

      callback()
    })
  }

  function handleSaveAndContinue() {
    doSave(onSuccess)
  }

  function handleFinalizar() {
    doSave(() => {
      if (autoDownload && registro.evidencia_url) {
        const evidenciaPath = registro.evidencia_url
        // Firmamos on-demand (bucket privado) antes de descargar.
        signBucketPaths('documentos', [evidenciaPath]).then(map => {
          const signed = map.get(evidenciaPath)
          if (!signed) return
          fetch(signed).then(r => r.blob()).then(blob => {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${registro.ge_gestion_nombre ?? 'gestion'}.pdf`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }).catch(() => {})
        }).catch(() => {})
      }
      onSuccess()
    })
  }

  return (
    <Modal open title={registro.ge_gestion_nombre ?? 'Cargar Evidencia'} onClose={onClose}>
      <form id="ejecucion-form" className="space-y-4">
        <input type="hidden" name="registro_id" value={registro.id} />

        {error && (
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-surface-base rounded-lg px-3 py-2 text-sm text-text-secondary flex items-center justify-between gap-3">
          <div>
            <span className="font-medium">{registro.ge_gestion_nombre ?? '—'}</span>
            {registro.ge_categoria_nombre && (
              <span className="text-text-tertiary"> · {registro.ge_categoria_nombre}</span>
            )}
          </div>
          <AuditHistorialLink tabla="gestiones_registros" id={registro.id} className="shrink-0" />
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
          {registro.evidencia_url && getUrl(registro.evidencia_url) && (
            <a
              href={getUrl(registro.evidencia_url) ?? '#'}
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

        <div className="flex flex-wrap gap-3 pt-1">
          <Button type="button" onClick={handleFinalizar} disabled={isPending}>
            {isPending ? 'Guardando…' : 'Finalizar y guardar'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleSaveAndContinue} disabled={isPending}>
            {isPending ? 'Guardando…' : 'Guardar y continuar luego'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  )
}



// ─── AgendaActionsCell ─────────────────────────────────────────────────────────
// Botón contextual según estado: Pendiente/Planificado → Ejecutar | Cargar.
// Realizado → Ver adjunto + toggle Legajo Técnico.
function AgendaActionsCell({
  registro: r,
  canWrite,
  onExecuteForm,
  onExecuteReporte,
  onExecuteMedicionCargaTermica,
  onExecuteCargaFuego,
  onExecuteMedicionPat,
  onExecuteMedicionRuido,
  onExecuteMedicionIluminacion,
  onExecutePresentacionAutoproteccion,
  onLoadEvidence,
  onToggleLegajo,
  onEjecutarCapacitacion,
}: {
  registro: FullRegistro
  canWrite: boolean
  onExecuteForm: () => void
  onExecuteReporte: () => void
  onExecuteMedicionCargaTermica: () => void
  onExecuteCargaFuego: () => void
  onExecuteMedicionPat: () => void
  onExecuteMedicionRuido: () => void
  onExecuteMedicionIluminacion: () => void
  onExecutePresentacionAutoproteccion: () => void
  onLoadEvidence: () => void
  onToggleLegajo: () => void | Promise<void>
  /** Solo para gestiones de categoría Capacitaciones: abre el flujo de capacitación LMS. */
  onEjecutarCapacitacion?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  // Bucket privado `documentos`: firmamos la evidencia para el link "Ver".
  const { getUrl } = useSignedUrls('documentos', [r.evidencia_url])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  function toggleMenu(e: { currentTarget: HTMLElement }) {
    if (!menuOpen) {
      const rect = e.currentTarget.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, left: rect.right })
    }
    setMenuOpen(v => !v)
  }

  const yaEjecutada = !!(r.fecha_ejecutada || r.evidencia_url)
  const tieneEvidencia = !!r.evidencia_url
  const legajoDisabled = !tieneEvidencia && !r.mostrar_lt

  // Estilos compartidos (touch-friendly: min-h 36px desktop / 44px mobile)
  const primaryBtn = 'inline-flex items-center justify-center gap-1.5 px-3 min-h-[36px] sm:min-h-[36px] rounded-lg text-xs font-medium transition-colors'
  const primaryActive = 'bg-surface-base border border-sig-500 text-sig-500 hover:bg-sig-500/10'
  const toggleBtn = 'inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors'
  const toggleOn = 'bg-sig-500 border-sig-500 text-white hover:bg-sig-700'
  const toggleOff = 'bg-white border-border-default text-text-tertiary hover:bg-surface-base hover:text-text-secondary'

  // Caso: Realizado (con evidencia)
  if (yaEjecutada && tieneEvidencia) {
    return (
      <div className="flex items-center gap-1.5 justify-center">
        <a
          href={getUrl(r.evidencia_url) ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          title="Ver/descargar adjunto"
          className={`${primaryBtn} ${primaryActive}`}
          aria-disabled={!getUrl(r.evidencia_url)}
        >
          <Download size={14} />
          <span className="hidden sm:inline">Ver</span>
        </a>
        <button
          title={r.mostrar_lt ? 'En Legajo Técnico (click para quitar)' : 'Fuera del Legajo Técnico (click para agregar)'}
          onClick={onToggleLegajo}
          aria-pressed={!!r.mostrar_lt}
          className={`${toggleBtn} ${r.mostrar_lt ? toggleOn : toggleOff}`}
        >
          <BookMarked size={14} fill={r.mostrar_lt ? 'currentColor' : 'none'} />
        </button>
      </div>
    )
  }

  // Caso: Realizado SIN evidencia (edge) o sin canWrite
  if (yaEjecutada && !tieneEvidencia) {
    if (!canWrite) {
      return <span className="text-xs text-text-tertiary">—</span>
    }
    return (
      <div className="flex items-center justify-center">
        <button
          title="Cargar evidencia"
          onClick={onLoadEvidence}
          className={`${primaryBtn} ${primaryActive}`}
        >
          <Upload size={14} />
          <span className="hidden sm:inline">Cargar</span>
        </button>
      </div>
    )
  }

  // Caso: Pendiente / Planificado
  if (!canWrite) {
    return <span className="text-xs text-text-tertiary">—</span>
  }

  // Capacitación (LMS) → botón "Capacitar".
  // Aditivo: convive con "Cargar" (carga manual de evidencia) como acción secundaria.
  if (onEjecutarCapacitacion) {
    return (
      <div ref={triggerRef} className="flex items-center justify-center relative">
        <div className="inline-flex rounded-lg overflow-hidden shadow-sm">
          <button
            title="Ejecutar capacitación (campus virtual)"
            onClick={onEjecutarCapacitacion}
            className={`${primaryBtn} ${primaryActive} rounded-r-none pr-2.5 border-r-0`}
          >
            <GraduationCap size={14} />
            <span className="hidden sm:inline">Capacitar</span>
          </button>
          <button
            title="Más opciones"
            onClick={toggleMenu}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`${primaryActive} px-2 min-h-[36px] rounded-l-none ${menuOpen ? 'bg-sig-500/10' : ''}`}
          >
            <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {menuOpen && menuPos && createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)', zIndex: 9999 }}
            className="bg-surface-base border border-border-subtle rounded-xl shadow-xl overflow-hidden min-w-[200px]"
          >
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onEjecutarCapacitacion() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left"
            >
              <GraduationCap size={14} className="text-sig-500" />
              Ejecutar capacitación
            </button>
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onLoadEvidence() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left border-t border-border-subtle"
            >
              <Upload size={14} className="text-text-secondary" />
              Cargar archivo manual
            </button>
          </div>,
          document.body
        )}
      </div>
    )
  }

  // Gestión tipo presentacion_autoproteccion → wizard del Sistema de Autoprotección
  // (trámite vivo: se abre siempre para continuar/ver, esté o no "ejecutado").
  if (r.ge_tipo_ejecucion === 'presentacion_autoproteccion') {
    return (
      <div className="flex items-center justify-center">
        <button
          title="Abrir el trámite del Sistema de Autoprotección"
          onClick={onExecutePresentacionAutoproteccion}
          className={`${primaryBtn} ${primaryActive}`}
        >
          <FileCheck size={14} />
          <span className="hidden sm:inline">{r.fecha_ejecutada ? 'Ver / continuar' : 'Abrir trámite'}</span>
        </button>
      </div>
    )
  }

  // Gestión tipo reporte_fotografico → wizard multi-foto (en vez del flujo estándar).
  if (r.ge_tipo_ejecucion === 'reporte_fotografico') {
    return (
      <div ref={triggerRef} className="flex items-center justify-center relative">
        <div className="inline-flex rounded-lg overflow-hidden shadow-sm">
          <button
            title="Ejecutar reporte fotográfico"
            onClick={onExecuteReporte}
            className={`${primaryBtn} ${primaryActive} rounded-r-none pr-2.5 border-r-0`}
          >
            <Camera size={14} />
            <span className="hidden sm:inline">Ejecutar</span>
          </button>
          <button
            title="Más opciones"
            onClick={toggleMenu}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`${primaryActive} px-2 min-h-[36px] rounded-l-none ${menuOpen ? 'bg-sig-500/10' : ''}`}
          >
            <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {menuOpen && menuPos && createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)', zIndex: 9999 }}
            className="bg-surface-base border border-border-subtle rounded-xl shadow-xl overflow-hidden min-w-[200px]"
          >
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onExecuteReporte() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left"
            >
              <Camera size={14} className="text-sig-500" />
              Ejecutar reporte fotográfico
            </button>
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onLoadEvidence() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left border-t border-border-subtle"
            >
              <Upload size={14} className="text-text-secondary" />
              Cargar archivo manual
            </button>
          </div>,
          document.body
        )}
      </div>
    )
  }

  // Gestión tipo medicion_iluminacion → wizard del Protocolo de Iluminación (SRT 84/2012).
  if (r.ge_tipo_ejecucion === 'medicion_iluminacion') {
    return (
      <div ref={triggerRef} className="flex items-center justify-center relative">
        <div className="inline-flex rounded-lg overflow-hidden shadow-sm">
          <button
            title="Ejecutar protocolo de iluminación"
            onClick={onExecuteMedicionIluminacion}
            className={`${primaryBtn} ${primaryActive} rounded-r-none pr-2.5 border-r-0`}
          >
            <Lightbulb size={14} />
            <span className="hidden sm:inline">Ejecutar</span>
          </button>
          <button
            title="Más opciones"
            onClick={toggleMenu}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`${primaryActive} px-2 min-h-[36px] rounded-l-none ${menuOpen ? 'bg-sig-500/10' : ''}`}
          >
            <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {menuOpen && menuPos && createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)', zIndex: 9999 }}
            className="bg-surface-base border border-border-subtle rounded-xl shadow-xl overflow-hidden min-w-[200px]"
          >
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onExecuteMedicionIluminacion() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left"
            >
              <Lightbulb size={14} className="text-sig-500" />
              Ejecutar protocolo de iluminación
            </button>
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onLoadEvidence() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left border-t border-border-subtle"
            >
              <Upload size={14} className="text-text-secondary" />
              Cargar archivo manual
            </button>
          </div>,
          document.body
        )}
      </div>
    )
  }

  // Gestión tipo medicion_ruido → wizard del Protocolo de Ruido (SRT 85/2012).
  if (r.ge_tipo_ejecucion === 'medicion_ruido') {
    return (
      <div ref={triggerRef} className="flex items-center justify-center relative">
        <div className="inline-flex rounded-lg overflow-hidden shadow-sm">
          <button
            title="Ejecutar protocolo de ruido"
            onClick={onExecuteMedicionRuido}
            className={`${primaryBtn} ${primaryActive} rounded-r-none pr-2.5 border-r-0`}
          >
            <Volume2 size={14} />
            <span className="hidden sm:inline">Ejecutar</span>
          </button>
          <button
            title="Más opciones"
            onClick={toggleMenu}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`${primaryActive} px-2 min-h-[36px] rounded-l-none ${menuOpen ? 'bg-sig-500/10' : ''}`}
          >
            <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {menuOpen && menuPos && createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)', zIndex: 9999 }}
            className="bg-surface-base border border-border-subtle rounded-xl shadow-xl overflow-hidden min-w-[200px]"
          >
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onExecuteMedicionRuido() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left"
            >
              <Volume2 size={14} className="text-sig-500" />
              Ejecutar protocolo de ruido
            </button>
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onLoadEvidence() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left border-t border-border-subtle"
            >
              <Upload size={14} className="text-text-secondary" />
              Cargar archivo manual
            </button>
          </div>,
          document.body
        )}
      </div>
    )
  }

  // Gestión tipo medicion_pat → wizard del Protocolo de Puesta a Tierra (SRT 900/2015).
  if (r.ge_tipo_ejecucion === 'medicion_pat') {
    return (
      <div ref={triggerRef} className="flex items-center justify-center relative">
        <div className="inline-flex rounded-lg overflow-hidden shadow-sm">
          <button
            title="Ejecutar protocolo de puesta a tierra"
            onClick={onExecuteMedicionPat}
            className={`${primaryBtn} ${primaryActive} rounded-r-none pr-2.5 border-r-0`}
          >
            <Zap size={14} />
            <span className="hidden sm:inline">Ejecutar</span>
          </button>
          <button
            title="Más opciones"
            onClick={toggleMenu}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`${primaryActive} px-2 min-h-[36px] rounded-l-none ${menuOpen ? 'bg-sig-500/10' : ''}`}
          >
            <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {menuOpen && menuPos && createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)', zIndex: 9999 }}
            className="bg-surface-base border border-border-subtle rounded-xl shadow-xl overflow-hidden min-w-[200px]"
          >
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onExecuteMedicionPat() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left"
            >
              <Zap size={14} className="text-sig-500" />
              Ejecutar protocolo de puesta a tierra
            </button>
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onLoadEvidence() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left border-t border-border-subtle"
            >
              <Upload size={14} className="text-text-secondary" />
              Cargar archivo manual
            </button>
          </div>,
          document.body
        )}
      </div>
    )
  }

  // Gestión tipo calculo_carga_fuego → wizard del Cálculo de Carga de Fuego (Dec 351/79 Anexo VII).
  if (r.ge_tipo_ejecucion === 'calculo_carga_fuego') {
    return (
      <div ref={triggerRef} className="flex items-center justify-center relative">
        <div className="inline-flex rounded-lg overflow-hidden shadow-sm">
          <button
            title="Ejecutar cálculo de carga de fuego"
            onClick={onExecuteCargaFuego}
            className={`${primaryBtn} ${primaryActive} rounded-r-none pr-2.5 border-r-0`}
          >
            <Flame size={14} />
            <span className="hidden sm:inline">Ejecutar</span>
          </button>
          <button
            title="Más opciones"
            onClick={toggleMenu}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`${primaryActive} px-2 min-h-[36px] rounded-l-none ${menuOpen ? 'bg-sig-500/10' : ''}`}
          >
            <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {menuOpen && menuPos && createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)', zIndex: 9999 }}
            className="bg-surface-base border border-border-subtle rounded-xl shadow-xl overflow-hidden min-w-[200px]"
          >
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onExecuteCargaFuego() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left"
            >
              <Flame size={14} className="text-sig-500" />
              Ejecutar cálculo de carga de fuego
            </button>
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onLoadEvidence() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left border-t border-border-subtle"
            >
              <Upload size={14} className="text-text-secondary" />
              Cargar archivo manual
            </button>
          </div>,
          document.body
        )}
      </div>
    )
  }

  // Gestión tipo medicion_carga_termica → wizard del Protocolo de Estrés Térmico (SRT 30/2023).
  if (r.ge_tipo_ejecucion === 'medicion_carga_termica') {
    return (
      <div ref={triggerRef} className="flex items-center justify-center relative">
        <div className="inline-flex rounded-lg overflow-hidden shadow-sm">
          <button
            title="Ejecutar protocolo de carga térmica"
            onClick={onExecuteMedicionCargaTermica}
            className={`${primaryBtn} ${primaryActive} rounded-r-none pr-2.5 border-r-0`}
          >
            <Thermometer size={14} />
            <span className="hidden sm:inline">Ejecutar</span>
          </button>
          <button
            title="Más opciones"
            onClick={toggleMenu}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`${primaryActive} px-2 min-h-[36px] rounded-l-none ${menuOpen ? 'bg-sig-500/10' : ''}`}
          >
            <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {menuOpen && menuPos && createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)', zIndex: 9999 }}
            className="bg-surface-base border border-border-subtle rounded-xl shadow-xl overflow-hidden min-w-[200px]"
          >
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onExecuteMedicionCargaTermica() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left"
            >
              <Thermometer size={14} className="text-sig-500" />
              Ejecutar protocolo de carga térmica
            </button>
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onLoadEvidence() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left border-t border-border-subtle"
            >
              <Upload size={14} className="text-text-secondary" />
              Cargar archivo manual
            </button>
          </div>,
          document.body
        )}
      </div>
    )
  }

  // Con formulario → botón "Ejecutar ▾" con submenu
  if (r.ge_tiene_formulario) {
    return (
      <div ref={triggerRef} className="flex items-center justify-center relative">
        <div className="inline-flex rounded-lg overflow-hidden shadow-sm">
          <button
            title="Ejecutar formulario"
            onClick={onExecuteForm}
            className={`${primaryBtn} ${primaryActive} rounded-r-none pr-2.5 border-r-0`}
          >
            <Play size={14} />
            <span className="hidden sm:inline">Ejecutar</span>
          </button>
          <button
            title="Más opciones"
            onClick={toggleMenu}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`${primaryActive} px-2 min-h-[36px] rounded-l-none ${menuOpen ? 'bg-sig-500/10' : ''}`}
          >
            <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {menuOpen && menuPos && createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)', zIndex: 9999 }}
            className="bg-surface-base border border-border-subtle rounded-xl shadow-xl overflow-hidden min-w-[200px]"
          >
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onExecuteForm() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left"
            >
              <Play size={14} className="text-sig-500" />
              Ejecutar formulario
            </button>
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onLoadEvidence() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-sunken text-left border-t border-border-subtle"
            >
              <Upload size={14} className="text-text-secondary" />
              Cargar archivo manual
            </button>
          </div>,
          document.body
        )}
      </div>
    )
  }

  // Sin formulario → botón directo "Cargar"
  return (
    <div className="flex items-center justify-center gap-1.5">
      <button
        title="Cargar evidencia"
        onClick={onLoadEvidence}
        className={`${primaryBtn} ${primaryActive}`}
      >
        <Upload size={14} />
        <span className="hidden sm:inline">Cargar</span>
      </button>
      {/* Legajo Técnico oculto hasta que haya evidencia (informativo) */}
      {legajoDisabled ? null : (
        <button
          title={r.mostrar_lt ? 'En Legajo Técnico (click para quitar)' : 'Fuera del Legajo Técnico (click para agregar)'}
          onClick={onToggleLegajo}
          aria-pressed={!!r.mostrar_lt}
          className={`${toggleBtn} ${r.mostrar_lt ? toggleOn : toggleOff}`}
        >
          <BookMarked size={14} fill={r.mostrar_lt ? 'currentColor' : 'none'} />
        </button>
      )}
    </div>
  )
}


// ─── Main component ────────────────────────────────────────────────────────────
export function GestionesAgenda({ establecimientoId, empresaId, canWrite: canWriteProp, riesgos: _riesgos, establecimientoNombre }: GestionesAgendaProps) {
  const queryClient = useQueryClient()
  const { data: canWriteData } = useCanWrite(establecimientoId)
  const canWrite = canWriteProp || (canWriteData ?? false)
  const [year, setYear] = useState<number | null>(null)

  // Task 1: default = current month
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set())

  useEffect(() => {
    const now = new Date()
    setYear(now.getFullYear())
    setSelectedMonths(new Set([now.getMonth()]))
  }, [])

  // Task 2: collapsed months for group view
  const [collapsedMonths, setCollapsedMonths] = useState<Set<number>>(new Set())

  const [searchText, setSearchText] = useState('')
  const [filterEstado, setFilterEstado] = useState<Set<string> | null>(null)
  const [filterCategoria, setFilterCategoria] = useState<Set<string> | null>(null)
  const [filterGrupo, setFilterGrupo] = useState<Set<string> | null>(null)
  const [filterResponsable, setFilterResponsable] = useState<Set<string> | null>(null)
  const [sortConfig, setSortConfig] = useState<{ col: SortCol | null; dir: 'asc' | 'desc' }>({ col: null, dir: 'asc' })
  const [viewMode, setViewMode] = useState<ViewMode>('tabla')
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(['categoria', 'gestion', 'fecha_plan', 'fecha_ejec', 'responsable', 'indice', 'acciones']))
  const [showColPicker, setShowColPicker] = useState(false)
  const [groupByMonth, setGroupByMonth] = useState(true)
  const [colPickerPos, setColPickerPos] = useState<{ top: number; left: number } | null>(null)
  const colPickerTriggerRef = useRef<HTMLDivElement>(null)
  const colPickerDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleColPickerOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        colPickerTriggerRef.current && !colPickerTriggerRef.current.contains(target) &&
        colPickerDropdownRef.current && !colPickerDropdownRef.current.contains(target)
      ) {
        setShowColPicker(false)
      }
    }
    document.addEventListener('mousedown', handleColPickerOutside)
    return () => document.removeEventListener('mousedown', handleColPickerOutside)
  }, [])
  const [editingRegistro, setEditingRegistro] = useState<FullRegistro | null>(null)
  const [executingFormulario, setExecutingFormulario] = useState<FullRegistro | null>(null)
  const [executingReporte, setExecutingReporte] = useState<FullRegistro | null>(null)
  const [executingMedicionCargaTermica, setExecutingMedicionCargaTermica] = useState<FullRegistro | null>(null)
  const [executingCargaFuego, setExecutingCargaFuego] = useState<FullRegistro | null>(null)
  const [executingMedicionPat, setExecutingMedicionPat] = useState<FullRegistro | null>(null)
  const [executingMedicionRuido, setExecutingMedicionRuido] = useState<FullRegistro | null>(null)
  const [executingMedicionIluminacion, setExecutingMedicionIluminacion] = useState<FullRegistro | null>(null)
  const [executingPresentacionAutoproteccion, setExecutingPresentacionAutoproteccion] = useState<FullRegistro | null>(null)
  const [executingCapacitacion, setExecutingCapacitacion] = useState<FullRegistro | null>(null)
  const [showPlanificarModal, setShowPlanificarModal] = useState(false)
  const [showReporteModal, setShowReporteModal] = useState(false)

  // El GestionLauncher global navega acá con ?action=plan-gestion |
  // open-reporte-fotografico. Leemos el param, abrimos el modal y lo limpiamos
  // para que no se reabra al refrescar.
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const action = searchParams.get('action')
  useEffect(() => {
    if (action !== 'plan-gestion' && action !== 'open-reporte-fotografico') return
    if (action === 'plan-gestion') setShowPlanificarModal(true)
    else setShowReporteModal(true)
    router.replace(`${pathname}?section=agenda`, { scroll: false })
  }, [action, pathname, router])


  // Task 4: resizable columns with localStorage
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COL_WIDTHS_KEY)
      if (stored) setColWidths(JSON.parse(stored))
    } catch {}
  }, [])
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COL_VISIBLE_KEY)
      if (stored) setVisibleCols(new Set(JSON.parse(stored)))
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

  const { data: gestionesEst = [], isPending: isGestionesPending } = useGestionesEstablecimiento(year !== null ? establecimientoId : undefined, year ?? 0)
  const geIds = gestionesEst?.map(g => g.id) ?? []
  const { data: rawRegistros } = useRegistrosGestion(geIds.length > 0 ? geIds : undefined, year ?? 0)
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
        ge_tipo_ejecucion: ge?.gestiones?.tipo_ejecucion ?? 'estandar',
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

  // Cuántos registros hay por (gestion_establecimiento_id, fecha_planificada).
  // Se usa para decidir si mostrar el #N (solo cuando hay duplicados).
  const groupSizes = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of registros ?? []) {
      const key = `${r.gestion_establecimiento_id}|${r.fecha_planificada}`
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [registros])

  function groupSizeFor(r: FullRegistro): number {
    return groupSizes.get(`${r.gestion_establecimiento_id}|${r.fecha_planificada}`) ?? 1
  }

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
    if (filterEstado !== null && !filterEstado.has(estado)) return false
    if (filterCategoria !== null && !filterCategoria.has(r.ge_categoria_nombre ?? '')) return false
    if (filterGrupo !== null && !filterGrupo.has(r.ge_grupo_nombre ?? '')) return false
    if (filterResponsable !== null && !filterResponsable.has(r.responsable_nombre ?? '')) return false
    if (q && !r.ge_gestion_nombre?.toLowerCase().includes(q) && !r.ge_categoria_nombre?.toLowerCase().includes(q)) return false
    return true
  })

  const sortedRegistros = (() => {
    if (!sortConfig.col) return filteredRegistros
    return [...filteredRegistros].sort((a, b) => {
      let cmp = 0
      switch (sortConfig.col) {
        case 'categoria': cmp = (a.ge_categoria_nombre ?? '').localeCompare(b.ge_categoria_nombre ?? ''); break
        case 'gestion': cmp = (a.ge_gestion_nombre ?? '').localeCompare(b.ge_gestion_nombre ?? ''); break
        case 'fecha_plan': cmp = (a.fecha_planificada ?? '').localeCompare(b.fecha_planificada ?? ''); break
        case 'fecha_ejec': cmp = (a.fecha_ejecutada ?? '').localeCompare(b.fecha_ejecutada ?? ''); break
        case 'responsable': cmp = (a.responsable_nombre ?? '').localeCompare(b.responsable_nombre ?? ''); break
        case 'indice': cmp = (a.index ?? -Infinity) - (b.index ?? -Infinity); break
      }
      return sortConfig.dir === 'asc' ? cmp : -cmp
    })
  })()

  const categoriasFiltro = Array.from(
    new Set((registros ?? []).map(r => r.ge_categoria_nombre).filter(Boolean))
  ).sort() as string[]

  const gruposFiltro = Array.from(
    new Set((registros ?? []).map(r => r.ge_grupo_nombre).filter(Boolean))
  ).sort() as string[]

  const responsablesFiltro = Array.from(
    new Set((registros ?? []).map(r => r.responsable_nombre).filter(Boolean))
  ).sort() as string[]

  const grouped = groupByMonth && selectedMonths.size > 1
    ? Array.from(selectedMonths).sort((a, b) => a - b).map(mi => ({
        monthIdx: mi,
        regs: sortedRegistros.filter(r => {
          const m = parseInt(r.fecha_planificada?.split('-')[1] ?? '0') - 1
          return m === mi
        }),
      })).filter(g => g.regs.length > 0)
    : []

  const totalCols = 7

  // Abre el editor correcto según el tipo de gestión y su estado: una gestión
  // reporte_fotografico AÚN no ejecutada (sin evidencia) abre el wizard multi-foto;
  // el resto (y las ya ejecutadas) siguen con el flujo estándar (EjecucionModal).
  function openRegistro(r: FullRegistro) {
    const yaEjecutada = !!(r.fecha_ejecutada || r.evidencia_url)
    if (r.ge_tipo_ejecucion === 'presentacion_autoproteccion') {
      // Trámite vivo: siempre abre el wizard (continuar/ver), aun ya "ejecutado".
      setExecutingPresentacionAutoproteccion(r)
    } else if (r.ge_tipo_ejecucion === 'reporte_fotografico' && !yaEjecutada && canWrite) {
      setExecutingReporte(r)
    } else if (r.ge_tipo_ejecucion === 'medicion_carga_termica' && !yaEjecutada && canWrite) {
      setExecutingMedicionCargaTermica(r)
    } else if (r.ge_tipo_ejecucion === 'calculo_carga_fuego' && !yaEjecutada && canWrite) {
      setExecutingCargaFuego(r)
    } else if (r.ge_tipo_ejecucion === 'medicion_pat' && !yaEjecutada && canWrite) {
      setExecutingMedicionPat(r)
    } else if (r.ge_tipo_ejecucion === 'medicion_ruido' && !yaEjecutada && canWrite) {
      setExecutingMedicionRuido(r)
    } else if (r.ge_tipo_ejecucion === 'medicion_iluminacion' && !yaEjecutada && canWrite) {
      setExecutingMedicionIluminacion(r)
    } else {
      setEditingRegistro(r)
    }
  }

  // ── Row renderer ────────────────────────────────────────────────────────────
  function renderRows(regs: FullRegistro[]) {
    return regs.map((r, _idx) => {
      const estado = calcularEstadoGestion(r.fecha_ejecutada ?? null, r.fecha_planificada)

      return (
        <tr key={r.id} className={`${ROW_BG_COLORS[estado]} cursor-pointer`} onClick={() => openRegistro(r)}>
          <td className={`${visibleCols.has('categoria') ? 'hidden md:table-cell' : 'hidden'} px-4 py-1.5`} style={{ maxWidth: colW('categoria'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span className="flex items-center gap-1.5">
              <CategoriaIcon nombre={r.ge_categoria_nombre} size={14} />
              <CategoriaAbbr nombre={r.ge_categoria_nombre} />
            </span>
          </td>
          <td className="px-4 py-1.5 font-medium text-text-primary" style={{ maxWidth: colW('gestion'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.ge_gestion_nombre ?? '—'}
            {groupSizeFor(r) > 1 && (
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sig-100 text-sig-700 tabular-nums">
                #{r.secuencia}
              </span>
            )}
          </td>
          <td className="px-4 py-1.5 text-text-secondary tabular-nums text-xs">{r.fecha_planificada}</td>
          <td className={`${visibleCols.has('fecha_ejec') ? 'hidden md:table-cell' : 'hidden'} px-4 py-1.5 text-text-secondary tabular-nums text-xs`}>
            {r.fecha_ejecutada ?? <span className="text-text-tertiary">—</span>}
          </td>
          <td className={`${visibleCols.has('responsable') ? 'hidden md:table-cell' : 'hidden'} px-4 py-1.5 text-text-secondary text-xs`} style={{ maxWidth: colW('responsable'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.responsable_nombre ?? <span className="text-text-tertiary">—</span>}
          </td>
          <td className={`${visibleCols.has('indice') ? '' : 'hidden'} px-4 py-1.5 text-center text-sm tabular-nums text-text-secondary`}>
            {r.index != null ? r.index : <span className="text-text-tertiary">—</span>}
          </td>
          <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
            <AgendaActionsCell
              registro={r}
              canWrite={canWrite}
              onExecuteForm={() => setExecutingFormulario(r)}
              onExecuteReporte={() => setExecutingReporte(r)}
              onExecuteMedicionCargaTermica={() => setExecutingMedicionCargaTermica(r)}
              onExecuteCargaFuego={() => setExecutingCargaFuego(r)}
              onExecuteMedicionPat={() => setExecutingMedicionPat(r)}
              onExecuteMedicionRuido={() => setExecutingMedicionRuido(r)}
              onExecuteMedicionIluminacion={() => setExecutingMedicionIluminacion(r)}
              onExecutePresentacionAutoproteccion={() => setExecutingPresentacionAutoproteccion(r)}
              onLoadEvidence={() => setEditingRegistro(r)}
              onEjecutarCapacitacion={
                r.ge_categoria_nombre === CATEGORIA_CAPACITACIONES
                  ? () => setExecutingCapacitacion(r)
                  : undefined
              }
              onToggleLegajo={async () => {
                const supabase = createClient()
                await supabase.from('gestiones_registros').update({ mostrar_lt: !r.mostrar_lt }).eq('id', r.id)
                queryClient.invalidateQueries({ queryKey: ['registros-gestion'] })
              }}
            />
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
        onClick={e => e.stopPropagation()}
      />
    )
  }

  function toggleCol(key: string) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try { localStorage.setItem(COL_VISIBLE_KEY, JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  function toggleSort(col: SortCol) {
    setSortConfig(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' }
    )
  }

  function sortIndicator(col: SortCol) {
    if (sortConfig.col !== col) return null
    return sortConfig.dir === 'asc'
      ? <ChevronUp size={11} className="inline ml-0.5 opacity-80" />
      : <ChevronDown size={11} className="inline ml-0.5 opacity-80" />
  }

  // ── Table header ────────────────────────────────────────────────────────────
  const tableHead = (
    <thead>
      <tr className="bg-gray-800 text-white text-left text-xs">
        {visibleCols.has('categoria') && (
          <th
            style={{ width: colW('categoria') }}
            className="hidden md:table-cell px-4 py-1.5 font-medium relative select-none cursor-pointer hover:bg-gray-700"
            onClick={() => toggleSort('categoria')}
          >
            <span className="flex items-center gap-1">Categoría{sortIndicator('categoria')}</span>
            {rh('categoria')}
          </th>
        )}
        <th
          style={{ width: colW('gestion') }}
          className="px-4 py-1.5 font-medium relative select-none cursor-pointer hover:bg-gray-700"
          onClick={() => toggleSort('gestion')}
        >
          <span className="flex items-center gap-1">Gestión{sortIndicator('gestion')}</span>
          {rh('gestion')}
        </th>
        <th
          style={{ width: colW('fecha_plan') }}
          className="px-4 py-1.5 font-medium relative select-none cursor-pointer hover:bg-gray-700"
          onClick={() => toggleSort('fecha_plan')}
        >
          <span className="flex items-center gap-1">Fecha Plan.{sortIndicator('fecha_plan')}</span>
          {rh('fecha_plan')}
        </th>
        {visibleCols.has('fecha_ejec') && (
          <th
            style={{ width: colW('fecha_ejec') }}
            className="hidden md:table-cell px-4 py-1.5 font-medium relative select-none cursor-pointer hover:bg-gray-700"
            onClick={() => toggleSort('fecha_ejec')}
          >
            <span className="flex items-center gap-1">Fecha Ejec.{sortIndicator('fecha_ejec')}</span>
            {rh('fecha_ejec')}
          </th>
        )}
        {visibleCols.has('responsable') && (
          <th
            style={{ width: colW('responsable') }}
            className="hidden md:table-cell px-4 py-1.5 font-medium relative select-none cursor-pointer hover:bg-gray-700"
            onClick={() => toggleSort('responsable')}
          >
            <span className="flex items-center gap-1">Responsable{sortIndicator('responsable')}</span>
            {rh('responsable')}
          </th>
        )}
        {visibleCols.has('indice') && (
          <th
            style={{ width: colW('indice') }}
            className="px-4 py-1.5 font-medium text-center relative select-none cursor-pointer hover:bg-gray-700"
            onClick={() => toggleSort('indice')}
          >
            <span className="flex items-center justify-center gap-1">Índice{sortIndicator('indice')}</span>
            {rh('indice')}
          </th>
        )}
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

  // ── Calendar view ────────────────────────────────────────────────────────────
  function renderCalendario() {
    if (!year) return null
    const months = Array.from(selectedMonths).sort((a, b) => a - b)
    if (months.length === 0) {
      return (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary text-sm mb-8">
          Seleccioná al menos un mes para ver el calendario.
        </div>
      )
    }
    const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    const today = new Date()
    return (
      <div className="space-y-4 mb-8">
        {months.map(monthIdx => {
          const firstDay = new Date(year, monthIdx, 1)
          const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
          const startOffset = (firstDay.getDay() + 6) % 7
          const monthRegs = filteredRegistros.filter(r =>
            r.fecha_planificada?.startsWith(`${year}-${String(monthIdx + 1).padStart(2, '0')}`)
          )
          const byDay = new Map<number, FullRegistro[]>()
          for (const r of monthRegs) {
            const day = parseInt(r.fecha_planificada.split('-')[2])
            if (!byDay.has(day)) byDay.set(day, [])
            byDay.get(day)!.push(r)
          }
          const cells: (number | null)[] = []
          for (let i = 0; i < startOffset; i++) cells.push(null)
          for (let d = 1; d <= daysInMonth; d++) cells.push(d)
          while (cells.length % 7 !== 0) cells.push(null)
          return (
            <div key={monthIdx} className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
              <div className="bg-gray-800 text-white px-4 py-2.5 flex items-center gap-2">
                <span className="font-semibold text-sm">{MONTHS_FULL[monthIdx]} {year}</span>
                <span className="text-xs text-gray-400">{monthRegs.length} gestiones</span>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-7 mb-1">
                  {DAY_LABELS.map(d => (
                    <div key={d} className="text-center text-[11px] font-medium text-text-tertiary py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {cells.map((day, idx) => {
                    if (!day) return <div key={idx} />
                    const regs = byDay.get(day) ?? []
                    const isToday = today.getFullYear() === year && today.getMonth() === monthIdx && today.getDate() === day
                    return (
                      <div
                        key={idx}
                        className={`min-h-[56px] p-1 rounded-lg border ${isToday ? 'border-sig-400 bg-sig-50' : 'border-transparent hover:bg-surface-elevated'}`}
                      >
                        <div className={`text-[11px] font-medium mb-0.5 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-sig-500 text-white' : 'text-text-secondary'}`}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {regs.map(r => {
                            const estado = calcularEstadoGestion(r.fecha_ejecutada ?? null, r.fecha_planificada)
                            const dot = estado === 'Realizado' ? 'bg-green-500' : estado === 'Pendiente' ? 'bg-red-500' : 'bg-gray-300'
                            return (
                              <div
                                key={r.id}
                                onClick={() => openRegistro(r)}
                                className="flex items-center gap-1 cursor-pointer hover:opacity-70"
                                title={r.ge_gestion_nombre}
                              >
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                                <span className="text-[10px] text-text-secondary leading-tight truncate">{r.ge_gestion_nombre}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Kanban view ──────────────────────────────────────────────────────────────
  function renderKanban() {
    const columns: { estado: EstadoGestion; label: string; header: string; card: string }[] = [
      { estado: 'Planificado', label: 'Planificado', header: 'bg-sky-600', card: 'bg-sky-50 border-sky-100' },
      { estado: 'Pendiente', label: 'Pendiente', header: 'bg-red-500', card: 'bg-red-50 border-red-100' },
      { estado: 'Realizado', label: 'Realizado', header: 'bg-green-600', card: 'bg-green-50 border-green-100' },
    ]
    return (
      <div className="grid grid-cols-3 gap-3 mb-8">
        {columns.map(({ estado, label, header, card }) => {
          const regs = filteredRegistros.filter(r =>
            calcularEstadoGestion(r.fecha_ejecutada ?? null, r.fecha_planificada) === estado
          )
          return (
            <div key={estado} className={`${card} rounded-xl border overflow-hidden`}>
              <div className={`${header} text-white px-3 py-2 flex items-center justify-between`}>
                <span className="font-semibold text-sm">{label}</span>
                <span className="bg-white/20 text-xs rounded-full px-2 py-0.5">{regs.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                {regs.length === 0 ? (
                  <p className="text-xs text-text-tertiary text-center py-4">Sin gestiones</p>
                ) : regs.map(r => (
                  <div
                    key={r.id}
                    onClick={() => openRegistro(r)}
                    className="bg-white rounded-lg border border-border-subtle p-2.5 cursor-pointer hover:border-sig-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <CategoriaIcon nombre={r.ge_categoria_nombre} size={12} />
                      <span className="text-[10px] text-text-tertiary">{r.ge_categoria_nombre ?? '—'}</span>
                    </div>
                    <p className="text-xs font-medium text-text-primary mb-1 line-clamp-2">{r.ge_gestion_nombre ?? '—'}</p>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-text-tertiary tabular-nums shrink-0">{r.fecha_planificada}</span>
                      {r.responsable_nombre && (
                        <span className="text-[10px] text-text-tertiary truncate">{r.responsable_nombre}</span>
                      )}
                    </div>
                    {r.fecha_ejecutada && r.fecha_ejecutada !== r.fecha_planificada && (
                      <div className="mt-1 text-[10px] text-green-600">Ejec: {r.fecha_ejecutada}</div>
                    )}
                    {r.index != null && (
                      <div className="mt-0.5 text-[10px] text-text-tertiary">Índice: {r.index}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (year === null) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-14 bg-gray-800 rounded-xl" />
        <div className="grid grid-cols-12 gap-1.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface-elevated rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>



      {/* Year navigation */}
      <div className="bg-gray-800 text-white rounded-xl px-6 py-4 mb-4 flex items-center justify-between">
        <button onClick={() => setYear(year - 1)} className="text-text-tertiary hover:text-white text-sm font-medium w-12">
          {year - 1}
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(year - 1)} className="text-text-tertiary hover:text-white text-lg leading-none">‹‹</button>
          <span className="text-base font-semibold tracking-wide">{establecimientoNombre ? `Gestiones (${establecimientoNombre})` : 'Gestiones'} {year}</span>
          <button onClick={() => setYear(year + 1)} className="text-text-tertiary hover:text-white text-lg leading-none">››</button>
        </div>
        <button onClick={() => setYear(year + 1)} className="text-text-tertiary hover:text-white text-sm font-medium w-12 text-right">
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
          <MultiSelectFilter
            label="Grupo"
            options={gruposFiltro.map(g => ({ value: g, label: g }))}
            selected={filterGrupo ?? new Set(gruposFiltro)}
            onChange={setFilterGrupo}
          />
        )}
        {categoriasFiltro.length > 0 && (
          <MultiSelectFilter
            label="Categoría"
            options={categoriasFiltro.map(c => ({ value: c, label: c }))}
            selected={filterCategoria ?? new Set(categoriasFiltro)}
            onChange={setFilterCategoria}
          />
        )}
        {responsablesFiltro.length > 0 && (
          <MultiSelectFilter
            label="Responsable"
            options={responsablesFiltro.map(r => ({ value: r, label: r }))}
            selected={filterResponsable ?? new Set(responsablesFiltro)}
            onChange={setFilterResponsable}
          />
        )}
        <MultiSelectFilter
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
          onClick={() => { setFilterEstado(null); setFilterCategoria(null); setFilterGrupo(null); setFilterResponsable(null); setSortConfig({ col: null, dir: 'asc' }) }}
          className="text-xs border border-border-subtle rounded-lg px-2 py-1.5 text-text-secondary hover:bg-surface-base shrink-0"
        >
          Rest.
        </button>

        {/* Right-side actions — pushed to the end */}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          {selectedMonths.size > 1 && (
            <button
              onClick={() => setGroupByMonth(v => !v)}
              className={`text-xs border rounded-lg px-2 py-1.5 transition-colors ${
                groupByMonth
                  ? 'border-sig-300 bg-sig-50 text-sig-700'
                  : 'border-border-subtle text-text-secondary hover:bg-surface-base'
              }`}
            >
              {groupByMonth ? 'Desagrupar' : 'Agrupar por mes'}
            </button>
          )}

          <div ref={colPickerTriggerRef} className="hidden md:block">
            <button
              onClick={() => {
                if (!showColPicker && colPickerTriggerRef.current) {
                  const rect = colPickerTriggerRef.current.getBoundingClientRect()
                  setColPickerPos({ top: rect.bottom + 4, left: rect.left })
                }
                setShowColPicker(v => !v)
              }}
              className={`text-xs border rounded-lg px-2 py-1.5 flex items-center gap-1 transition-colors ${
                showColPicker ? 'border-sig-300 bg-sig-50 text-sig-700' : 'border-border-subtle text-text-secondary hover:bg-surface-base'
              }`}
            >
              <Columns size={12} />
              Columnas
            </button>
            {showColPicker && colPickerPos && createPortal(
              <div
                ref={colPickerDropdownRef}
                style={{ position: 'fixed', top: colPickerPos.top, left: colPickerPos.left, zIndex: 9999 }}
                className="bg-surface-base border border-border-subtle rounded-xl shadow-lg p-1.5 min-w-[140px]"
              >
                {TOGGLEABLE_COLS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-elevated cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(key)}
                      onChange={() => toggleCol(key)}
                      className="rounded"
                    />
                    <span className="text-xs text-text-secondary">{label}</span>
                  </label>
                ))}
              </div>,
              document.body
            )}
          </div>

          <ViewSelector
            options={[
              { value: 'tabla' as ViewMode,      label: 'Tabla',      icon: List },
              { value: 'calendario' as ViewMode, label: 'Calendario', icon: CalendarDays },
              { value: 'kanban' as ViewMode,     label: 'Kanban',     icon: Kanban },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />

          <span className="text-xs text-text-tertiary pl-1">
            {registros !== null ? `${filteredRegistros.length} gestiones` : ''}
          </span>
        </div>
      </div>

      {/* Gestiones view */}
      {registros === null ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary text-sm">
          Cargando…
        </div>
      ) : filteredRegistros.length === 0 ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary text-sm">
          No hay gestiones para el período seleccionado.
        </div>
      ) : (
        <>
          {/* Table — always on mobile, on desktop only when viewMode === 'tabla' */}
          <div className={viewMode !== 'tabla' ? 'md:hidden' : undefined}>
            <div className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="text-sm" style={{ tableLayout: 'fixed', width: '100%', minWidth: 500 }}>
                  {tableHead}
                  {grouped.length > 0 ? (
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
          </div>

          {/* Calendar — desktop only */}
          {viewMode === 'calendario' && (
            <div className="hidden md:block">
              {renderCalendario()}
            </div>
          )}

          {/* Kanban — desktop only */}
          {viewMode === 'kanban' && (
            <div className="hidden md:block">
              {renderKanban()}
            </div>
          )}
        </>
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

      {executingReporte && (
        <ReporteFotograficoEjecutorModal
          registroId={executingReporte.id}
          gestionEstablecimientoId={executingReporte.ge_id ?? ''}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          gestionNombre={executingReporte.ge_gestion_nombre ?? 'Reporte Fotográfico'}
          rgFechaPlanificada={executingReporte.fecha_planificada}
          establecimientoNombre={establecimientoNombre}
          onClose={() => setExecutingReporte(null)}
          onSuccess={() => { setExecutingReporte(null); queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento', establecimientoId, year] }); queryClient.invalidateQueries({ queryKey: ['registros-gestion'] }) }}
        />
      )}

      {executingPresentacionAutoproteccion && (
        <PresentacionAutoproteccionEjecutorModal
          establecimientoId={establecimientoId}
          registroId={executingPresentacionAutoproteccion.id}
          gestionEstablecimientoId={executingPresentacionAutoproteccion.ge_id ?? ''}
          rgFechaPlanificada={executingPresentacionAutoproteccion.fecha_planificada}
          canWrite={canWrite}
          onClose={() => setExecutingPresentacionAutoproteccion(null)}
          onSuccess={() => { setExecutingPresentacionAutoproteccion(null); queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento', establecimientoId, year] }); queryClient.invalidateQueries({ queryKey: ['registros-gestion'] }) }}
        />
      )}

      {executingMedicionIluminacion && (
        <MedicionIluminacionEjecutorModal
          establecimientoId={establecimientoId}
          registroId={executingMedicionIluminacion.id}
          rgFechaPlanificada={executingMedicionIluminacion.fecha_planificada}
          gestionEstablecimientoId={executingMedicionIluminacion.ge_id ?? ''}
          onClose={() => setExecutingMedicionIluminacion(null)}
          onSuccess={() => { setExecutingMedicionIluminacion(null); queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento', establecimientoId, year] }); queryClient.invalidateQueries({ queryKey: ['registros-gestion'] }) }}
        />
      )}

      {executingMedicionRuido && (
        <MedicionRuidoEjecutorModal
          establecimientoId={establecimientoId}
          registroId={executingMedicionRuido.id}
          rgFechaPlanificada={executingMedicionRuido.fecha_planificada}
          gestionEstablecimientoId={executingMedicionRuido.ge_id ?? ''}
          onClose={() => setExecutingMedicionRuido(null)}
          onSuccess={() => { setExecutingMedicionRuido(null); queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento', establecimientoId, year] }); queryClient.invalidateQueries({ queryKey: ['registros-gestion'] }) }}
        />
      )}

      {executingMedicionPat && (
        <MedicionPatEjecutorModal
          establecimientoId={establecimientoId}
          registroId={executingMedicionPat.id}
          rgFechaPlanificada={executingMedicionPat.fecha_planificada}
          gestionEstablecimientoId={executingMedicionPat.gestion_establecimiento_id}
          onClose={() => setExecutingMedicionPat(null)}
          onSuccess={() => { setExecutingMedicionPat(null); queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento', establecimientoId, year] }); queryClient.invalidateQueries({ queryKey: ['registros-gestion'] }) }}
        />
      )}

      {executingCargaFuego && (
        <CalculoCargaFuegoEjecutorModal
          establecimientoId={establecimientoId}
          registroId={executingCargaFuego.id}
          rgFechaPlanificada={executingCargaFuego.fecha_planificada}
          gestionEstablecimientoId={executingCargaFuego.ge_id ?? ''}
          onClose={() => setExecutingCargaFuego(null)}
          onSuccess={() => { setExecutingCargaFuego(null); queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento', establecimientoId, year] }); queryClient.invalidateQueries({ queryKey: ['registros-gestion'] }) }}
        />
      )}

      {executingMedicionCargaTermica && (
        <MedicionCargaTermicaEjecutorModal
          establecimientoId={establecimientoId}
          registroId={executingMedicionCargaTermica.id}
          rgFechaPlanificada={executingMedicionCargaTermica.fecha_planificada}
          gestionEstablecimientoId={executingMedicionCargaTermica.ge_id ?? ''}
          onClose={() => setExecutingMedicionCargaTermica(null)}
          onSuccess={() => { setExecutingMedicionCargaTermica(null); queryClient.invalidateQueries({ queryKey: ['gestiones-establecimiento', establecimientoId, year] }); queryClient.invalidateQueries({ queryKey: ['registros-gestion'] }) }}
        />
      )}

      {executingCapacitacion && (
        <EjecutarCapacitacionModal
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          gestionEstablecimientoId={executingCapacitacion.gestion_establecimiento_id}
          registroGestionId={executingCapacitacion.id}
          rgFechaPlanificada={executingCapacitacion.fecha_planificada}
          gestionNombre={executingCapacitacion.ge_gestion_nombre}
          instructorPersonaIdDefault={executingCapacitacion.responsable_id ?? undefined}
          onClose={() => setExecutingCapacitacion(null)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['registros-gestion'] }) }}
        />
      )}

      {showPlanificarModal && (
        <Modal open title="Planificar nueva gestión" onClose={() => setShowPlanificarModal(false)} size="full">
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
