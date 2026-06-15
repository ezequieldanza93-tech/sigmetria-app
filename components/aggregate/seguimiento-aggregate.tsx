'use client'

import { useMemo, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { MultiSelectFilter } from '@/components/ui/multi-select-filter'
import type { EstablecimientoStatus } from '@/lib/types'

// Pesado (html2canvas + jsPDF): solo se carga al abrir el reporte.
const ReporteObservacionesEmpresaButton = dynamic(
  () => import('@/components/reporte-observaciones-campo-modal').then(m => m.ReporteObservacionesEmpresaButton),
  { ssr: false },
)

export interface SeguimientoAggregateRow {
  id: string
  empresa_id: string
  empresa_razon_social: string
  establecimiento_id: string
  establecimiento_nombre: string
  gestion_nombre: string | null
  descripcion: string
  fecha_planificada: string
  fecha_cierre: string | null
  responsable_nombre: string | null
  /** Estado de la EMPRESA dueña del establecimiento de esta fila. */
  empresa_is_active: boolean
  /** Estado del ESTABLECIMIENTO de esta fila (enum establishment_status). */
  establecimiento_status: EstablecimientoStatus
}

// ─── Toggle de estado de ENTIDAD (empresa/establecimiento) ───────────────────
// Distinto y adicional al filtro de estado de la OBSERVACIÓN (Cerrado/Vencido/
// Planificado). Réplica de la semántica ya en prod en consultora-ficha-global.
type EntidadEstado = 'activas' | 'inactivas' | 'todas'

// Cada fila es (observación × 1 establecimiento × 1 empresa): predicado escalar.
//   - 'activas' (default): empresa activa Y establecimiento 'active'.
//   - 'inactivas': NO cancelled Y (empresa inactiva O establecimiento ≠ 'active').
//   - 'todas': todo, salvo 'cancelled' (estado terminal ≈ removido).
function matchEntidadEstado(
  empresaActiva: boolean,
  status: EstablecimientoStatus,
  sel: EntidadEstado,
): boolean {
  if (status === 'cancelled') return false
  const esActiva = empresaActiva && status === 'active'
  if (sel === 'activas') return esActiva
  if (sel === 'inactivas') return !esActiva
  return true
}

const ENTIDAD_SELECT_CLS =
  'bg-surface-base border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-sig-500/40 focus:border-sig-500 transition-shadow'

interface Props {
  rows: SeguimientoAggregateRow[]
  showEmpresaFilter?: boolean
  showEstablecimientoFilter?: boolean
  /** Si se pasa, muestra el botón "Emitir reporte de observaciones" (consolidado de empresa). */
  empresaId?: string
}

type Estado = 'Cerrado' | 'Vencido' | 'Planificado'
const ESTADOS: Estado[] = ['Planificado', 'Vencido', 'Cerrado']

const ESTADO_BADGE: Record<Estado, string> = {
  Cerrado: 'bg-gray-100 text-gray-700',
  Vencido: 'bg-red-100 text-red-800',
  Planificado: 'bg-sky-100 text-sky-800',
}

function getEstado(row: SeguimientoAggregateRow): Estado {
  if (row.fecha_cierre) return 'Cerrado'
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const plan = new Date(row.fecha_planificada); plan.setHours(0, 0, 0, 0)
  return plan < hoy ? 'Vencido' : 'Planificado'
}

function fmt(date: string | null | undefined): ReactNode {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  const dm = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  const dmy = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  return (
    <>
      <span className="md:hidden">{dm}</span>
      <span className="hidden md:inline">{dmy}</span>
    </>
  )
}

export function SeguimientoAggregate({
  rows,
  showEmpresaFilter = false,
  showEstablecimientoFilter = true,
  empresaId,
}: Props) {
  // null = "Todos" (sin filtrar). Estado arranca con default explícito
  // (Planificado + Vencido) para ocultar los cerrados de entrada.
  const [empresaSel, setEmpresaSel] = useState<Set<string> | null>(null)
  const [estSel, setEstSel] = useState<Set<string> | null>(null)
  const [estadoSel, setEstadoSel] = useState<Set<string> | null>(new Set(['Planificado', 'Vencido']))
  // Toggle de estado de ENTIDAD — default 'activas' (solo lo vigente).
  const [entidadSel, setEntidadSel] = useState<EntidadEstado>('activas')

  const empresaOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) map.set(r.empresa_id, r.empresa_razon_social)
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rows])

  const establecimientoOptions = useMemo(() => {
    const map = new Map<string, string>()
    const allowed = empresaSel && empresaSel.size > 0 ? empresaSel : null
    for (const r of rows) {
      if (allowed && !allowed.has(r.empresa_id)) continue
      map.set(r.establecimiento_id, r.establecimiento_nombre)
    }
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rows, empresaSel])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (!matchEntidadEstado(r.empresa_is_active, r.establecimiento_status, entidadSel)) return false
      if (empresaSel !== null && !empresaSel.has(r.empresa_id)) return false
      if (estSel !== null && !estSel.has(r.establecimiento_id)) return false
      if (estadoSel !== null && !estadoSel.has(getEstado(r))) return false
      return true
    })
  }, [rows, entidadSel, empresaSel, estSel, estadoSel])

  return (
    <div className="px-6 py-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-text-primary mr-4">Seguimiento de observaciones</h2>
        {empresaId && <ReporteObservacionesEmpresaButton empresaId={empresaId} />}
        {showEmpresaFilter && (
          <MultiSelectFilter label="Empresa" options={empresaOptions} selected={empresaSel ?? new Set(empresaOptions.map(o => o.value))} onChange={setEmpresaSel} />
        )}
        {showEstablecimientoFilter && (
          <MultiSelectFilter
            label="Establecimiento"
            options={establecimientoOptions}
            selected={estSel ?? new Set(establecimientoOptions.map(o => o.value))}
            onChange={setEstSel}
          />
        )}
        <MultiSelectFilter
          label="Estado"
          options={ESTADOS.map(e => ({ value: e, label: e }))}
          selected={estadoSel ?? new Set(ESTADOS)}
          onChange={setEstadoSel}
        />
        <div className="ml-auto flex items-center gap-2">
          <select
            value={entidadSel}
            onChange={e => setEntidadSel(e.target.value as EntidadEstado)}
            aria-label="Filtrar por estado de empresa/establecimiento"
            className={ENTIDAD_SELECT_CLS}
          >
            <option value="activas">Activas</option>
            <option value="inactivas">Inactivas</option>
            <option value="todas">Todas</option>
          </select>
          <span className="text-xs text-text-tertiary whitespace-nowrap">{filtered.length} de {rows.length}</span>
        </div>
      </div>

      <div className="bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-xs uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="px-3 py-2 text-left">Estado</th>
                {showEmpresaFilter && <th className="px-3 py-2 text-left">Empresa</th>}
                <th className="px-3 py-2 text-left">Establecimiento</th>
                <th className="px-3 py-2 text-left">Gestión</th>
                <th className="px-3 py-2 text-left">Descripción</th>
                <th className="px-3 py-2 text-left">Fecha Plan.</th>
                <th className="px-3 py-2 text-left">Cierre</th>
                <th className="px-3 py-2 text-left">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={showEmpresaFilter ? 8 : 7} className="px-3 py-8 text-center text-text-tertiary">
                    Sin observaciones para los filtros activos.
                  </td>
                </tr>
              ) : (
                filtered.map(r => {
                  const estado = getEstado(r)
                  return (
                    <tr key={r.id} className="border-t border-border-subtle hover:bg-surface-sunken">
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ESTADO_BADGE[estado]}`}>
                          {estado}
                        </span>
                      </td>
                      {showEmpresaFilter && (
                        <td className="px-3 py-2 text-text-secondary truncate max-w-[14rem]">{r.empresa_razon_social}</td>
                      )}
                      <td className="px-3 py-2 text-text-secondary truncate max-w-[14rem]">{r.establecimiento_nombre}</td>
                      <td className="px-3 py-2 text-text-tertiary text-xs truncate max-w-[12rem]">{r.gestion_nombre ?? '—'}</td>
                      <td className="px-3 py-2 text-text-primary truncate max-w-[24rem]">{r.descripcion}</td>
                      <td className="px-3 py-2 text-text-tertiary text-xs">{fmt(r.fecha_planificada)}</td>
                      <td className="px-3 py-2 text-text-tertiary text-xs">{fmt(r.fecha_cierre)}</td>
                      <td className="px-3 py-2 text-text-tertiary text-xs">{r.responsable_nombre ?? '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
