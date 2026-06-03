'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Play, Search, List, CalendarDays, Columns, ArrowUpDown, Layers, Plus, X, ChevronRight, ChevronDown } from 'lucide-react'
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
type SortDir = 'asc' | 'desc'
interface SortRule { col: string; dir: SortDir }

interface Props {
  rows: GestionAggregateRow[]
  showEmpresaFilter?: boolean
  showEstablecimientoFilter?: boolean
  /** Título del bloque. Si se omite, se usa "Gestiones {año}". */
  title?: string
}

const ESTADOS: EstadoGestion[] = ['Realizado', 'Pendiente', 'Planificado']

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const MAX_SORTS = 3
const MAX_GROUPS = 3

// Definición de columnas ordenables / agrupables.
// `kind` controla el orden (texto vs fecha vs estado) y el label de dirección.
interface ColDef {
  key: string
  label: string
  kind: 'text' | 'date' | 'estado'
  value: (r: GestionAggregateRow) => string | null
  /** Solo disponible cuando showEmpresaFilter (nivel global). */
  empresaOnly?: boolean
}

const COLS: ColDef[] = [
  { key: 'empresa', label: 'Empresa', kind: 'text', value: r => r.empresa_razon_social, empresaOnly: true },
  { key: 'establecimiento', label: 'Establecimiento', kind: 'text', value: r => r.establecimiento_nombre },
  { key: 'grupo', label: 'Grupo', kind: 'text', value: r => r.grupo },
  { key: 'categoria', label: 'Categoría', kind: 'text', value: r => r.categoria },
  { key: 'gestion', label: 'Gestión', kind: 'text', value: r => r.gestion_nombre },
  { key: 'fecha_plan', label: 'Fecha Plan.', kind: 'date', value: r => r.fecha_planificada },
  { key: 'fecha_ejec', label: 'Fecha Ejec.', kind: 'date', value: r => r.fecha_ejecutada },
  { key: 'responsable', label: 'Responsable', kind: 'text', value: r => r.responsable_nombre },
  { key: 'estado', label: 'Estado', kind: 'estado', value: r => getEstado(r) },
]

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

// Orden de estado para sort (Planificado → Pendiente → Realizado).
const ESTADO_ORDER: Record<string, number> = { Planificado: 0, Pendiente: 1, Realizado: 2 }

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

function colByKey(key: string): ColDef | undefined {
  return COLS.find(c => c.key === key)
}

// Compara dos filas según una columna. nulls al final.
function compareByCol(a: GestionAggregateRow, b: GestionAggregateRow, col: ColDef): number {
  const va = col.value(a)
  const vb = col.value(b)
  if (va == null && vb == null) return 0
  if (va == null) return 1
  if (vb == null) return -1
  if (col.kind === 'date') {
    return new Date(va).getTime() - new Date(vb).getTime()
  }
  if (col.kind === 'estado') {
    return (ESTADO_ORDER[va] ?? 99) - (ESTADO_ORDER[vb] ?? 99)
  }
  return va.localeCompare(vb, 'es', { sensitivity: 'base' })
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
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())
  const [anio, setAnio] = useState<number>(() => new Date().getFullYear())

  // Sort y Group — vacíos por defecto (sin orden ni agrupación).
  const [sorts, setSorts] = useState<SortRule[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [sortOpen, setSortOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Columnas disponibles según el nivel.
  const availableCols = useMemo(
    () => COLS.filter(c => showEmpresaFilter || !c.empresaOnly),
    [showEmpresaFilter],
  )

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

  // Ordenamiento multi-columna con precedencia (sorts[0] manda, luego [1], luego [2]).
  const sorted = useMemo(() => {
    if (sorts.length === 0) return filtered
    const rules = sorts.map(s => ({ col: colByKey(s.col), dir: s.dir })).filter(r => r.col) as { col: ColDef; dir: SortDir }[]
    if (rules.length === 0) return filtered
    return [...filtered].sort((a, b) => {
      for (const { col, dir } of rules) {
        const cmp = compareByCol(a, b, col)
        if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }, [filtered, sorts])

  // Agrupación jerárquica (hasta 3 niveles). Devuelve árbol de grupos o null.
  const grouped = useMemo(() => {
    if (groups.length === 0) return null
    const groupCols = groups.map(colByKey).filter(Boolean) as ColDef[]
    if (groupCols.length === 0) return null

    function build(items: GestionAggregateRow[], depth: number, keyPrefix: string): GroupNode[] {
      if (depth >= groupCols.length) return []
      const col = groupCols[depth]
      const buckets = new Map<string, GestionAggregateRow[]>()
      for (const r of items) {
        const label = col.value(r) ?? '— Sin valor —'
        const arr = buckets.get(label) ?? []
        arr.push(r)
        buckets.set(label, arr)
      }
      const ordered = Array.from(buckets.keys()).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
      return ordered.map(label => {
        const items2 = buckets.get(label)!
        const path = `${keyPrefix}/${col.key}:${label}`
        return {
          path,
          label,
          colLabel: col.label,
          count: items2.length,
          rows: depth === groupCols.length - 1 ? items2 : [],
          children: depth < groupCols.length - 1 ? build(items2, depth + 1, path) : [],
        }
      })
    }
    return build(sorted, 0, '')
  }, [sorted, groups])

  // Contador por mes — aplica todos los filtros EXCEPTO el de mes.
  const monthCounts = useMemo(() => {
    const counts = Array.from({ length: 12 }, () => 0)
    const q = search.trim().toLowerCase()
    for (const r of rows) {
      if (r.fecha_planificada && new Date(r.fecha_planificada).getFullYear() !== anio) continue
      if (empresaSel.size > 0 && !empresaSel.has(r.empresa_id)) continue
      if (estSel.size > 0 && !estSel.has(r.establecimiento_id)) continue
      if (estadoSel.size > 0 && !estadoSel.has(getEstado(r))) continue
      if (grupoSel.size > 0 && !(r.grupo && grupoSel.has(r.grupo))) continue
      if (categoriaSel.size > 0 && !(r.categoria && categoriaSel.has(r.categoria))) continue
      if (responsableSel.size > 0 && !(r.responsable_nombre && responsableSel.has(r.responsable_nombre))) continue
      if (q) {
        const haystack = `${r.gestion_nombre ?? ''} ${r.categoria ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) continue
      }
      const month = parseInt(r.fecha_planificada?.split('-')[1] ?? '0') - 1
      if (month >= 0 && month < 12) counts[month]++
    }
    return counts
  }, [rows, anio, empresaSel, estSel, estadoSel, grupoSel, categoriaSel, responsableSel, search])

  const heading = title ?? 'Gestiones'

  function toggleGroupCollapse(path: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function collapseAll() {
    if (!grouped) return
    const paths = new Set<string>()
    const walk = (nodes: GroupNode[]) => {
      for (const n of nodes) { paths.add(n.path); walk(n.children) }
    }
    walk(grouped)
    setCollapsedGroups(paths)
  }

  function expandAll() {
    setCollapsedGroups(new Set())
  }

  return (
    <div className="px-6 py-6 space-y-4">
      {/* Fila: título de año centrado en la fila, selector de vista a la derecha */}
      <div className="relative flex items-center min-h-[40px]">
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 select-none">
          <span className="text-xs text-text-tertiary tabular-nums">{anio - 1}</span>
          <button type="button" onClick={() => setAnio(a => a - 1)} aria-label={`Ver gestiones de ${anio - 1}`} className="text-text-tertiary hover:text-sig-500 transition-colors px-1">«</button>
          <h2 className="text-lg font-semibold text-text-primary tabular-nums whitespace-nowrap">{heading} {anio}</h2>
          <button type="button" onClick={() => setAnio(a => a + 1)} aria-label={`Ver gestiones de ${anio + 1}`} className="text-text-tertiary hover:text-sig-500 transition-colors px-1">»</button>
          <span className="text-xs text-text-tertiary tabular-nums">{anio + 1}</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
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
                  viewMode === mode ? 'bg-brand-muted text-brand-primary' : 'text-text-tertiary hover:text-text-primary hover:bg-surface-elevated'
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <span className="text-xs text-text-tertiary whitespace-nowrap">{filtered.length} de {rows.length}</span>
        </div>
      </div>

      {/* Ordenar / Agrupar — solo en vista tabla (donde tienen sentido visual) */}
      {viewMode === 'tabla' && (
        <div className="flex items-center gap-2">
          <SortPanel
            cols={availableCols}
            sorts={sorts}
            onChange={setSorts}
            open={sortOpen}
            onOpenChange={setSortOpen}
          />
          <GroupPanel
            cols={availableCols}
            groups={groups}
            onChange={setGroups}
            open={groupOpen}
            onOpenChange={setGroupOpen}
            onCollapseAll={collapseAll}
            onExpandAll={expandAll}
            hasGroups={!!grouped}
          />
        </div>
      )}

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
          <MultiFilterWithAll label="Establecimiento" options={establecimientoOptions} selected={estSel} onChange={setEstSel} />
        )}
        <MultiFilterWithAll label="Grupo" options={grupoOptions} selected={grupoSel} onChange={setGrupoSel} />
        <MultiFilterWithAll label="Categoría" options={categoriaOptions} selected={categoriaSel} onChange={setCategoriaSel} />
        <MultiFilterWithAll label="Responsable" options={responsableOptions} selected={responsableSel} onChange={setResponsableSel} />
        <MultiFilterWithAll label="Estado" options={ESTADOS.map(e => ({ value: e, label: e }))} selected={estadoSel} onChange={setEstadoSel} />
      </div>

      {/* Tiles de meses */}
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
        {MONTHS.map((m, i) => {
          const key = String(i)
          const isSelected = selectedMonths.has(key)
          return (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMonths(prev => {
                const next = new Set(prev)
                if (next.has(key)) next.delete(key)
                else next.add(key)
                return next
              })}
              className={`rounded-lg py-2 text-center transition-colors ${
                isSelected ? 'bg-sig-500 text-white' : 'bg-surface-elevated text-text-secondary hover:bg-surface-sunken'
              }`}
            >
              <div className="text-xs font-medium">{m}</div>
              <div className="text-xs opacity-80 tabular-nums">{monthCounts[i]}</div>
            </button>
          )
        })}
      </div>

      {/* Quick-select de meses */}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setSelectedMonths(new Set([String(new Date().getMonth())]))} className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${selectedMonths.size === 1 && selectedMonths.has(String(new Date().getMonth())) ? 'bg-success-bg border-green-300 text-success' : 'border-border-subtle text-text-secondary hover:bg-surface-base'}`}>Mes actual</button>
        <button type="button" onClick={() => setSelectedMonths(new Set(Array.from({ length: 12 }, (_, i) => String(i))))} className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${selectedMonths.size === 12 ? 'bg-success-bg border-green-300 text-success' : 'border-border-subtle text-text-secondary hover:bg-surface-base'}`}>Todos los meses</button>
        <button type="button" onClick={() => setSelectedMonths(new Set())} className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${selectedMonths.size === 0 ? 'bg-success-bg border-green-300 text-success' : 'border-border-subtle text-text-secondary hover:bg-surface-base'}`}>Ninguno</button>
        <button type="button" onClick={() => setSelectedMonths(prev => new Set(Array.from({ length: 12 }, (_, i) => String(i)).filter(m => !prev.has(m))))} className="text-xs border border-border-subtle rounded-lg px-3 py-1.5 text-text-secondary hover:bg-surface-base">Invertir selección</button>
      </div>

      {viewMode === 'tabla' && (
        <TablaView
          sorted={sorted}
          grouped={grouped}
          showEmpresaFilter={showEmpresaFilter}
          collapsedGroups={collapsedGroups}
          onToggleCollapse={toggleGroupCollapse}
        />
      )}
      {viewMode === 'calendario' && (
        <CalendarioView filtered={sorted} anio={anio} selectedMonths={selectedMonths} />
      )}
      {viewMode === 'kanban' && (
        <KanbanView filtered={sorted} showEmpresaFilter={showEmpresaFilter} />
      )}
    </div>
  )
}

// ─── Tipos de grupo ─────────────────────────────────────────────────────────
interface GroupNode {
  path: string
  label: string
  colLabel: string
  count: number
  rows: GestionAggregateRow[]
  children: GroupNode[]
}

// ─── Panel de Ordenar (estilo Airtable) ─────────────────────────────────────
function SortPanel({
  cols, sorts, onChange, open, onOpenChange,
}: {
  cols: ColDef[]; sorts: SortRule[]; onChange: (s: SortRule[]) => void; open: boolean; onOpenChange: (v: boolean) => void
}) {
  const usedKeys = new Set(sorts.map(s => s.col))
  const firstAvailable = cols.find(c => !usedKeys.has(c.key))

  function dirLabel(col: ColDef | undefined, dir: SortDir): string {
    if (col?.kind === 'date') return dir === 'asc' ? 'Más antigua → reciente' : 'Más reciente → antigua'
    return dir === 'asc' ? 'A → Z' : 'Z → A'
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
          sorts.length > 0 ? 'border-brand-primary/40 bg-brand-muted text-brand-primary' : 'border-border-default bg-surface-base text-text-secondary hover:bg-surface-elevated'
        }`}
      >
        <ArrowUpDown size={14} />
        Ordenar
        {sorts.length > 0 && <span className="text-[10px]">({sorts.length})</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-80 bg-surface-elevated border border-border-default rounded-xl shadow-xl p-3 space-y-2">
            {sorts.length === 0 && (
              <p className="text-xs text-text-tertiary px-1 py-2">Sin orden aplicado. Agregá una columna para ordenar.</p>
            )}
            {sorts.map((s, i) => {
              const col = cols.find(c => c.key === s.col)
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-text-tertiary w-10 shrink-0">{i === 0 ? 'Ordenar' : 'luego'}</span>
                  <select
                    value={s.col}
                    onChange={e => onChange(sorts.map((x, j) => j === i ? { ...x, col: e.target.value } : x))}
                    className="flex-1 text-xs border border-border-default rounded-md px-2 py-1 bg-surface-base text-text-primary"
                  >
                    {cols.filter(c => c.key === s.col || !usedKeys.has(c.key)).map(c => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                  <select
                    value={s.dir}
                    onChange={e => onChange(sorts.map((x, j) => j === i ? { ...x, dir: e.target.value as SortDir } : x))}
                    className="text-xs border border-border-default rounded-md px-2 py-1 bg-surface-base text-text-primary"
                  >
                    <option value="asc">{dirLabel(col, 'asc')}</option>
                    <option value="desc">{dirLabel(col, 'desc')}</option>
                  </select>
                  <button type="button" onClick={() => onChange(sorts.filter((_, j) => j !== i))} className="text-text-tertiary hover:text-danger p-1" aria-label="Quitar orden">
                    <X size={13} />
                  </button>
                </div>
              )
            })}
            {sorts.length < MAX_SORTS && firstAvailable && (
              <button
                type="button"
                onClick={() => onChange([...sorts, { col: firstAvailable.key, dir: 'asc' }])}
                className="flex items-center gap-1.5 text-xs text-brand-primary hover:underline px-1 pt-1"
              >
                <Plus size={13} /> Agregar otro orden
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Panel de Agrupar (estilo Airtable) ─────────────────────────────────────
function GroupPanel({
  cols, groups, onChange, open, onOpenChange, onCollapseAll, onExpandAll, hasGroups,
}: {
  cols: ColDef[]; groups: string[]; onChange: (g: string[]) => void; open: boolean; onOpenChange: (v: boolean) => void
  onCollapseAll: () => void; onExpandAll: () => void; hasGroups: boolean
}) {
  const usedKeys = new Set(groups)
  const firstAvailable = cols.find(c => !usedKeys.has(c.key))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
          groups.length > 0 ? 'border-brand-primary/40 bg-brand-muted text-brand-primary' : 'border-border-default bg-surface-base text-text-secondary hover:bg-surface-elevated'
        }`}
      >
        <Layers size={14} />
        Agrupar
        {groups.length > 0 && <span className="text-[10px]">({groups.length})</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-80 bg-surface-elevated border border-border-default rounded-xl shadow-xl p-3 space-y-2">
            {hasGroups && (
              <div className="flex items-center gap-2 pb-1">
                <button type="button" onClick={onCollapseAll} className="text-[11px] text-text-secondary hover:text-text-primary border border-border-subtle rounded px-2 py-0.5">Colapsar todo</button>
                <button type="button" onClick={onExpandAll} className="text-[11px] text-text-secondary hover:text-text-primary border border-border-subtle rounded px-2 py-0.5">Expandir todo</button>
              </div>
            )}
            {groups.length === 0 && (
              <p className="text-xs text-text-tertiary px-1 py-2">Sin agrupación. Agregá una columna para agrupar.</p>
            )}
            {groups.map((g, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[10px] text-text-tertiary w-12 shrink-0">{i === 0 ? 'Agrupar' : 'subgrupo'}</span>
                <select
                  value={g}
                  onChange={e => onChange(groups.map((x, j) => j === i ? e.target.value : x))}
                  className="flex-1 text-xs border border-border-default rounded-md px-2 py-1 bg-surface-base text-text-primary"
                >
                  {cols.filter(c => c.key === g || !usedKeys.has(c.key)).map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <button type="button" onClick={() => onChange(groups.filter((_, j) => j !== i))} className="text-text-tertiary hover:text-danger p-1" aria-label="Quitar grupo">
                  <X size={13} />
                </button>
              </div>
            ))}
            {groups.length < MAX_GROUPS && firstAvailable && (
              <button
                type="button"
                onClick={() => onChange([...groups, firstAvailable.key])}
                className="flex items-center gap-1.5 text-xs text-brand-primary hover:underline px-1 pt-1"
              >
                <Plus size={13} /> Agregar subgrupo
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tabla ────────────────────────────────────────────────────────────────
const TABLE_COL_COUNT_BASE = 7 // establecimiento, categoria, gestion, fechaP, fechaE, resp, acciones

function TablaView({
  sorted, grouped, showEmpresaFilter, collapsedGroups, onToggleCollapse,
}: {
  sorted: GestionAggregateRow[]
  grouped: GroupNode[] | null
  showEmpresaFilter: boolean
  collapsedGroups: Set<string>
  onToggleCollapse: (path: string) => void
}) {
  const colCount = TABLE_COL_COUNT_BASE + (showEmpresaFilter ? 1 : 0)

  function renderDataRows(rowsToRender: GestionAggregateRow[]) {
    return rowsToRender.map(r => {
      const estado = getEstado(r)
      return (
        <tr key={r.registro_id} className={`border-t border-border-subtle transition-colors ${ROW_BG_COLORS[estado]}`}>
          {showEmpresaFilter && <td className="px-3 py-2 text-text-secondary truncate max-w-[14rem]">{r.empresa_razon_social}</td>}
          <td className="px-3 py-2 text-text-primary font-medium truncate max-w-[14rem]">{r.establecimiento_nombre}</td>
          <td className="px-3 py-2 text-text-tertiary text-xs">{r.categoria ?? '—'}</td>
          <td className="px-3 py-2 text-text-primary truncate max-w-[18rem]">{r.gestion_nombre ?? '—'}</td>
          <td className="px-3 py-2 text-text-tertiary text-xs">{fmt(r.fecha_planificada)}</td>
          <td className="px-3 py-2 text-text-tertiary text-xs">{fmt(r.fecha_ejecutada)}</td>
          <td className="px-3 py-2 text-text-tertiary text-xs">{r.responsable_nombre ?? '—'}</td>
          <td className="px-3 py-2">
            <Link href={agendaHref(r)} className="inline-flex items-center gap-1.5 text-xs font-medium text-sig-500 hover:text-sig-700 transition-colors" title="Ir a la agenda del establecimiento para ejecutar esta gestión">
              <Play size={14} /> Ejecutar
            </Link>
          </td>
        </tr>
      )
    })
  }

  // Render recursivo de grupos.
  function renderGroups(nodes: GroupNode[], depth: number): React.ReactNode {
    return nodes.map(node => {
      const isCollapsed = collapsedGroups.has(node.path)
      return (
        <Fragment key={node.path}>
          <tr className="bg-surface-sunken border-t border-border-default">
            <td colSpan={colCount} className="px-2 py-1.5">
              <button
                type="button"
                onClick={() => onToggleCollapse(node.path)}
                className="flex items-center gap-1.5 text-xs font-semibold text-text-primary hover:text-brand-primary transition-colors"
                style={{ paddingLeft: depth * 16 }}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className="text-[10px] uppercase tracking-wider text-text-tertiary">{node.colLabel}:</span>
                <span>{node.label}</span>
                <span className="text-[10px] text-text-tertiary font-normal">({node.count})</span>
              </button>
            </td>
          </tr>
          {!isCollapsed && (
            node.children.length > 0 ? renderGroups(node.children, depth + 1) : renderDataRows(node.rows)
          )}
        </Fragment>
      )
    })
  }

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
            {sorted.length === 0 ? (
              <tr><td colSpan={colCount} className="px-3 py-8 text-center text-text-tertiary">Sin gestiones para los filtros activos.</td></tr>
            ) : grouped ? (
              renderGroups(grouped, 0)
            ) : (
              renderDataRows(sorted)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Calendario ─────────────────────────────────────────────────────────────
function CalendarioView({
  filtered, anio, selectedMonths,
}: {
  filtered: GestionAggregateRow[]; anio: number; selectedMonths: Set<string>
}) {
  const month = useMemo(() => {
    if (selectedMonths.size > 0) return Math.min(...Array.from(selectedMonths, Number))
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

  const firstDay = new Date(anio, month, 1).getDay()
  const offset = (firstDay + 6) % 7
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
          <div key={d} className="bg-surface-sunken px-2 py-1.5 text-[10px] uppercase tracking-wider text-text-tertiary text-center">{d}</div>
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
                        <Link key={r.registro_id} href={agendaHref(r)} className="flex items-center gap-1 text-[10px] text-text-secondary hover:text-text-primary truncate" title={`${r.gestion_nombre ?? ''} · ${r.establecimiento_nombre}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ESTADO_DOT[estado]}`} />
                          <span className="truncate">{r.gestion_nombre ?? '—'}</span>
                        </Link>
                      )
                    })}
                    {items.length > 4 && <span className="text-[10px] text-text-tertiary">+{items.length - 4} más</span>}
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
function KanbanView({ filtered, showEmpresaFilter }: { filtered: GestionAggregateRow[]; showEmpresaFilter: boolean }) {
  const columns = useMemo(() => {
    const map: Record<EstadoGestion, GestionAggregateRow[]> = { Realizado: [], Pendiente: [], Planificado: [] }
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
                <Link key={r.registro_id} href={agendaHref(r)} className="block bg-surface-base border border-border-subtle rounded-lg p-2 hover:border-brand-primary/40 transition-colors">
                  <p className="text-xs font-medium text-text-primary truncate">{r.gestion_nombre ?? '—'}</p>
                  <p className="text-[10px] text-text-tertiary truncate mt-0.5">{showEmpresaFilter ? `${r.empresa_razon_social} · ` : ''}{r.establecimiento_nombre}</p>
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
