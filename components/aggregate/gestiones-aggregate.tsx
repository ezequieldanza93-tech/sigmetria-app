'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Play, Search, List, CalendarDays, Columns } from 'lucide-react'
import { MultiFilterWithAll } from '@/components/ui/multi-filter-with-all'
import { calcularEstadoGestion } from '@/lib/types'
import type { EstadoGestion } from '@/lib/types'

export interface GestionAggregateRow {
  registro_id: string
  empresa_id: string
  empresa_razon_social: string
  establecimiento_id: string
  establecimiento_nombre: string
  categoria: string | null
  grupo: string | null
  gestion_nombre: string | null
  fecha_planificada: string
  fecha_ejecutada: string | null
  fecha_vencimiento: string | null
  responsable_nombre: string | null
}

type ViewMode = 'tabla' | 'calendario' | 'kanban'

interface Props {
  rows: GestionAggregateRow[]
  showEmpresaFilter?: boolean
  showEstablecimientoFilter?: boolean
  /** Título del bloque. Si se omite, se usa "Gestiones {año}". */
  title?: string
}

const ESTADOS: EstadoGestion[] = ['Realizado', 'Pendiente', 'Planificado']

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Mismo criterio que la tabla a nivel establecimiento: el estado pinta la fila.
const ROW_BG_COLORS: Record<EstadoGestion, string> = {
  Realizado: 'bg-green-200 hover:bg-green-300',
  Pendiente: 'bg-red-200 hover:bg-red-300',
  Planificado: 'bg-white hover:bg-gray-50',
}

const ESTADO_DOT: Record<EstadoGestion, string> = {
  Realizado: 'bg-green-500',
  Pendiente: 'bg-red-500',
  Planificado: 'bg-gray-400',
}

function getEstado(row: GestionAggregateRow): EstadoGestion {
  return calcularEstadoGestion(row.fecha_ejecutada, row.fecha_planificada)
}

function fmt(date: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function agendaHref(r: GestionAggregateRow): string {
  return `/dashboard/empresas/${r.empresa_id}/establecimientos/${r.establecimiento_id}?section=agenda`
}

export function GestionesAggregate({
  rows,
  showEmpresaFilter = false,
  showEstablecimientoFilter = true,
  title,
}: Props) {
  const [empresaSel, setEmpresaSel] = useState<Set<string>>(new Set())
  const [estSel, setEstSel] = useState<Set<string>>(new Set())
  const [estadoSel, setEstadoSel] = useState<Set<string>>(new Set())
  const [grupoSel, setGrupoSel] = useState<Set<string>>(new Set())
  const [categoriaSel, setCategoriaSel] = useState<Set<string>>(new Set())
  const [responsableSel, setResponsableSel] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('tabla')
  // Meses como Set<string> de índices "0".."11" (consistente con MultiFilterWithAll).
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())
  const [anio, setAnio] = useState<number>(() => new Date().getFullYear())

  // Default: solo el mes actual (igual que la tabla a nivel establecimiento).
  useEffect(() => {
    setSelectedMonths(new Set([String(new Date().getMonth())]))
  }, [])

  const empresaOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) map.set(r.empresa_id, r.empresa_razon_social)
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rows])

  const establecimientoOptions = useMemo(() => {
    const map = new Map<string, string>()
    const allowed = empresaSel.size === 0 ? null : empresaSel
    for (const r of rows) {
      if (allowed && !allowed.has(r.empresa_id)) continue
      map.set(r.establecimiento_id, r.establecimiento_nombre)
    }
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rows, empresaSel])

  const grupoOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.grupo) set.add(r.grupo)
    return Array.from(set).sort().map(v => ({ value: v, label: v }))
  }, [rows])

  const categoriaOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.categoria) set.add(r.categoria)
    return Array.from(set).sort().map(v => ({ value: v, label: v }))
  }, [rows])

  const responsableOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.responsable_nombre) set.add(r.responsable_nombre)
    return Array.from(set).sort().map(v => ({ value: v, label: v }))
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (r.fecha_planificada && new Date(r.fecha_planificada).getFullYear() !== anio) return false
      // Mes 0-indexed parseado del string para evitar problemas de timezone.
      const month = parseInt(r.fecha_planificada?.split('-')[1] ?? '0') - 1
      if (selectedMonths.size > 0 && !selectedMonths.has(String(month))) return false
      if (empresaSel.size > 0 && !empresaSel.has(r.empresa_id)) return false
      if (estSel.size > 0 && !estSel.has(r.establecimiento_id)) return false
      if (estadoSel.size > 0 && !estadoSel.has(getEstado(r))) return false
      if (grupoSel.size > 0 && !(r.grupo && grupoSel.has(r.grupo))) return false
      if (categoriaSel.size > 0 && !(r.categoria && categoriaSel.has(r.categoria))) return false
      if (responsableSel.size > 0 && !(r.responsable_nombre && responsableSel.has(r.responsable_nombre))) return false
      if (q) {
        const haystack = `${r.gestion_nombre ?? ''} ${r.categoria ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [rows, anio, selectedMonths, empresaSel, estSel, estadoSel, grupoSel, categoriaSel, responsableSel, search])

  const heading = title ?? 'Gestiones'

  return (
    <div className="px-6 py-6 space-y-4">
      {/* Año + título */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 mr-4 select-none">
          <span className="text-xs text-text-tertiary tabular-nums">{anio - 1}</span>
          <button
            type="button"
            onClick={() => setAnio(a => a - 1)}
            aria-label={`Ver gestiones de ${anio - 1}`}
            className="text-text-tertiary hover:text-sig-500 transition-colors px-1"
          >
            «
          </button>
          <h2 className="text-lg font-semibold text-text-primary tabular-nums">{heading} {anio}</h2>
          <button
            type="button"
            onClick={() => setAnio(a => a + 1)}
            aria-label={`Ver gestiones de ${anio + 1}`}
            className="text-text-tertiary hover:text-sig-500 transition-colors px-1"
          >
            »
          </button>
          <span className="text-xs text-text-tertiary tabular-nums">{anio + 1}</span>
        </div>

        {/* Selector de vista */}
        <div className="flex items-center gap-0.5 border border-border-default rounded-lg p-0.5 bg-surface-base">
          {([
            { mode: 'tabla' as const, icon: List, label: 'Tabla' },
            { mode: 'calendario' as const, icon: CalendarDays, label: 'Calendario' },
            { mode: 'kanban' as const, icon: Columns, label: 'Kanban' },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              title={label}
              aria-label={label}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === mode
                  ? 'bg-brand-muted text-brand-primary'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <span className="text-xs text-text-tertiary ml-auto">{filtered.length} de {rows.length}</span>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar gestión…"
            className="pl-8 pr-3 py-1.5 text-xs border border-border-default rounded-lg bg-surface-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 w-44"
          />
        </div>
        {showEmpresaFilter && (
          <MultiFilterWithAll label="Empresa" options={empresaOptions} selected={empresaSel} onChange={setEmpresaSel} />
        )}
        {showEstablecimientoFilter && (
          <MultiFilterWithAll
            label="Establecimiento"
            options={establecimientoOptions}
            selected={estSel}
            onChange={setEstSel}
          />
        )}
        <MultiFilterWithAll label="Grupo" options={grupoOptions} selected={grupoSel} onChange={setGrupoSel} />
        <MultiFilterWithAll label="Categoría" options={categoriaOptions} selected={categoriaSel} onChange={setCategoriaSel} />
        <MultiFilterWithAll label="Responsable" options={responsableOptions} selected={responsableSel} onChange={setResponsableSel} />
        <MultiFilterWithAll
          label="Mes"
          options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
          selected={selectedMonths}
          onChange={setSelectedMonths}
        />
        <MultiFilterWithAll
          label="Estado"
          options={ESTADOS.map(e => ({ value: e, label: e }))}
          selected={estadoSel}
          onChange={setEstadoSel}
        />
      </div>

      {viewMode === 'tabla' && (
        <TablaView filtered={filtered} showEmpresaFilter={showEmpresaFilter} />
      )}
      {viewMode === 'calendario' && (
        <CalendarioView filtered={filtered} anio={anio} selectedMonths={selectedMonths} />
      )}
      {viewMode === 'kanban' && (
        <KanbanView filtered={filtered} showEmpresaFilter={showEmpresaFilter} />
      )}
    </div>
  )
}

// ─── Tabla ────────────────────────────────────────────────────────────────
function TablaView({ filtered, showEmpresaFilter }: { filtered: GestionAggregateRow[]; showEmpresaFilter: boolean }) {
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-xs uppercase tracking-wider text-text-tertiary">
            <tr>
              {showEmpresaFilter && <th className="px-3 py-2 text-left">Empresa</th>}
              <th className="px-3 py-2 text-left">Establecimiento</th>
              <th className="px-3 py-2 text-left">Categoría</th>
              <th className="px-3 py-2 text-left">Gestión</th>
              <th className="px-3 py-2 text-left">Fecha Plan.</th>
              <th className="px-3 py-2 text-left">Fecha Ejec.</th>
              <th className="px-3 py-2 text-left">Responsable</th>
              <th className="px-3 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={showEmpresaFilter ? 8 : 7} className="px-3 py-8 text-center text-text-tertiary">
                  Sin gestiones para los filtros activos.
                </td>
              </tr>
            ) : (
              filtered.map(r => {
                const estado = getEstado(r)
                return (
                  <tr key={r.registro_id} className={`border-t border-border-subtle transition-colors ${ROW_BG_COLORS[estado]}`}>
                    {showEmpresaFilter && (
                      <td className="px-3 py-2 text-text-secondary truncate max-w-[14rem]">{r.empresa_razon_social}</td>
                    )}
                    <td className="px-3 py-2 text-text-primary font-medium truncate max-w-[14rem]">{r.establecimiento_nombre}</td>
                    <td className="px-3 py-2 text-text-tertiary text-xs">{r.categoria ?? '—'}</td>
                    <td className="px-3 py-2 text-text-primary truncate max-w-[18rem]">{r.gestion_nombre ?? '—'}</td>
                    <td className="px-3 py-2 text-text-tertiary text-xs">{fmt(r.fecha_planificada)}</td>
                    <td className="px-3 py-2 text-text-tertiary text-xs">{fmt(r.fecha_ejecutada)}</td>
                    <td className="px-3 py-2 text-text-tertiary text-xs">{r.responsable_nombre ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={agendaHref(r)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-sig-500 hover:text-sig-700 transition-colors"
                        title="Ir a la agenda del establecimiento para ejecutar esta gestión"
                      >
                        <Play size={14} />
                        Ejecutar
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Calendario ─────────────────────────────────────────────────────────────
// Grilla mensual. Si hay un solo mes seleccionado lo muestra; si hay varios,
// muestra el primero seleccionado (o el mes actual). Cada día lista las
// gestiones planificadas, con punto de color por estado.
function CalendarioView({
  filtered,
  anio,
  selectedMonths,
}: {
  filtered: GestionAggregateRow[]
  anio: number
  selectedMonths: Set<string>
}) {
  const month = useMemo(() => {
    if (selectedMonths.size > 0) {
      return Math.min(...Array.from(selectedMonths, Number))
    }
    return new Date().getMonth()
  }, [selectedMonths])

  const byDay = useMemo(() => {
    const map = new Map<number, GestionAggregateRow[]>()
    for (const r of filtered) {
      if (!r.fecha_planificada) continue
      const [y, m, d] = r.fecha_planificada.split('-').map(Number)
      if (y !== anio || m - 1 !== month) continue
      const arr = map.get(d) ?? []
      arr.push(r)
      map.set(d, arr)
    }
    return map
  }, [filtered, anio, month])

  const firstDay = new Date(anio, month, 1).getDay() // 0=Dom
  const offset = (firstDay + 6) % 7 // lunes-first
  const daysInMonth = new Date(anio, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-4">
      <p className="text-sm font-medium text-text-primary mb-3">{MONTHS[month]} {anio}</p>
      <div className="grid grid-cols-7 gap-px bg-border-subtle rounded-lg overflow-hidden">
        {WEEKDAYS.map(d => (
          <div key={d} className="bg-surface-sunken px-2 py-1.5 text-[10px] uppercase tracking-wider text-text-tertiary text-center">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const items = day ? (byDay.get(day) ?? []) : []
          return (
            <div key={i} className="bg-surface-base min-h-[84px] p-1.5 align-top">
              {day && (
                <>
                  <span className="text-[11px] text-text-tertiary">{day}</span>
                  <div className="mt-0.5 space-y-0.5">
                    {items.slice(0, 4).map(r => {
                      const estado = getEstado(r)
                      return (
                        <Link
                          key={r.registro_id}
                          href={agendaHref(r)}
                          className="flex items-center gap-1 text-[10px] text-text-secondary hover:text-text-primary truncate"
                          title={`${r.gestion_nombre ?? ''} · ${r.establecimiento_nombre}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ESTADO_DOT[estado]}`} />
                          <span className="truncate">{r.gestion_nombre ?? '—'}</span>
                        </Link>
                      )
                    })}
                    {items.length > 4 && (
                      <span className="text-[10px] text-text-tertiary">+{items.length - 4} más</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Kanban ───────────────────────────────────────────────────────────────
// Una columna por estado. Cada tarjeta enlaza a la agenda del establecimiento.
function KanbanView({ filtered, showEmpresaFilter }: { filtered: GestionAggregateRow[]; showEmpresaFilter: boolean }) {
  const columns = useMemo(() => {
    const map: Record<EstadoGestion, GestionAggregateRow[]> = {
      Realizado: [],
      Pendiente: [],
      Planificado: [],
    }
    for (const r of filtered) map[getEstado(r)].push(r)
    return map
  }, [filtered])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {ESTADOS.map(estado => (
        <div key={estado} className="bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-surface-sunken">
            <span className={`w-2 h-2 rounded-full ${ESTADO_DOT[estado]}`} />
            <span className="text-xs font-semibold text-text-primary">{estado}</span>
            <span className="text-[10px] text-text-tertiary ml-auto">{columns[estado].length}</span>
          </div>
          <div className="p-2 space-y-2 flex-1 min-h-[60px]">
            {columns[estado].length === 0 ? (
              <p className="text-[11px] text-text-tertiary text-center py-4">Sin gestiones.</p>
            ) : (
              columns[estado].map(r => (
                <Link
                  key={r.registro_id}
                  href={agendaHref(r)}
                  className="block bg-surface-base border border-border-subtle rounded-lg p-2 hover:border-brand-primary/40 transition-colors"
                >
                  <p className="text-xs font-medium text-text-primary truncate">{r.gestion_nombre ?? '—'}</p>
                  <p className="text-[10px] text-text-tertiary truncate mt-0.5">
                    {showEmpresaFilter ? `${r.empresa_razon_social} · ` : ''}{r.establecimiento_nombre}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-text-tertiary">{r.categoria ?? '—'}</span>
                    <span className="text-[10px] text-text-tertiary tabular-nums">{fmt(r.fecha_planificada)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
