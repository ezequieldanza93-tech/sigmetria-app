'use client'

import { useMemo, useState } from 'react'
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

interface Props {
  rows: GestionAggregateRow[]
  showEmpresaFilter?: boolean
  showEstablecimientoFilter?: boolean
}

const ESTADOS: EstadoGestion[] = ['Realizado', 'Pendiente', 'Planificado']

const ESTADO_BADGE: Record<EstadoGestion, string> = {
  Realizado: 'bg-green-100 text-green-800',
  Pendiente: 'bg-red-100 text-red-800',
  Planificado: 'bg-sky-100 text-sky-800',
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

export function GestionesAggregate({
  rows,
  showEmpresaFilter = false,
  showEstablecimientoFilter = true,
}: Props) {
  const [empresaSel, setEmpresaSel] = useState<Set<string>>(new Set())
  const [estSel, setEstSel] = useState<Set<string>>(new Set())
  const [estadoSel, setEstadoSel] = useState<Set<string>>(new Set())
  const [anio, setAnio] = useState<number>(() => new Date().getFullYear())

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

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (r.fecha_planificada && new Date(r.fecha_planificada).getFullYear() !== anio) return false
      if (empresaSel.size > 0 && !empresaSel.has(r.empresa_id)) return false
      if (estSel.size > 0 && !estSel.has(r.establecimiento_id)) return false
      if (estadoSel.size > 0 && !estadoSel.has(getEstado(r))) return false
      return true
    })
  }, [rows, anio, empresaSel, estSel, estadoSel])

  return (
    <div className="px-6 py-6 space-y-4">
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
          <h2 className="text-lg font-semibold text-text-primary tabular-nums">Gestiones {anio}</h2>
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
        <MultiFilterWithAll
          label="Estado"
          options={ESTADOS.map(e => ({ value: e, label: e }))}
          selected={estadoSel}
          onChange={setEstadoSel}
        />
        <span className="text-xs text-text-tertiary ml-auto">{filtered.length} de {rows.length}</span>
      </div>

      <div className="bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-xs uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="px-3 py-2 text-left">Establecimiento</th>
                <th className="px-3 py-2 text-left">Estado</th>
                {showEmpresaFilter && <th className="px-3 py-2 text-left">Empresa</th>}
                <th className="px-3 py-2 text-left">Categoría</th>
                <th className="px-3 py-2 text-left">Gestión</th>
                <th className="px-3 py-2 text-left">Fecha Plan.</th>
                <th className="px-3 py-2 text-left">Fecha Ejec.</th>
                <th className="px-3 py-2 text-left">Responsable</th>
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
                    <tr key={r.registro_id} className="border-t border-border-subtle hover:bg-surface-sunken">
                      <td className="px-3 py-2 text-text-primary font-medium truncate max-w-[14rem]">{r.establecimiento_nombre}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ESTADO_BADGE[estado]}`}>
                          {estado}
                        </span>
                      </td>
                      {showEmpresaFilter && (
                        <td className="px-3 py-2 text-text-secondary truncate max-w-[14rem]">{r.empresa_razon_social}</td>
                      )}
                      <td className="px-3 py-2 text-text-tertiary text-xs">{r.categoria ?? '—'}</td>
                      <td className="px-3 py-2 text-text-primary truncate max-w-[18rem]">{r.gestion_nombre ?? '—'}</td>
                      <td className="px-3 py-2 text-text-tertiary text-xs">{fmt(r.fecha_planificada)}</td>
                      <td className="px-3 py-2 text-text-tertiary text-xs">{fmt(r.fecha_ejecutada)}</td>
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
