'use client'

import { useMemo, useState } from 'react'
import { MultiSelectFilter } from '@/components/ui/multi-select-filter'

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
}

interface Props {
  rows: SeguimientoAggregateRow[]
  showEmpresaFilter?: boolean
  showEstablecimientoFilter?: boolean
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

function fmt(date: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function SeguimientoAggregate({
  rows,
  showEmpresaFilter = false,
  showEstablecimientoFilter = true,
}: Props) {
  const [empresaSel, setEmpresaSel] = useState<Set<string>>(new Set())
  const [estSel, setEstSel] = useState<Set<string>>(new Set())
  const [estadoSel, setEstadoSel] = useState<Set<string>>(new Set(['Planificado', 'Vencido']))

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
      if (empresaSel.size > 0 && !empresaSel.has(r.empresa_id)) return false
      if (estSel.size > 0 && !estSel.has(r.establecimiento_id)) return false
      if (estadoSel.size > 0 && !estadoSel.has(getEstado(r))) return false
      return true
    })
  }, [rows, empresaSel, estSel, estadoSel])

  return (
    <div className="px-6 py-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-text-primary mr-4">Seguimiento de observaciones</h2>
        {showEmpresaFilter && (
          <MultiSelectFilter label="Empresa" options={empresaOptions} selected={empresaSel} onChange={setEmpresaSel} />
        )}
        {showEstablecimientoFilter && (
          <MultiSelectFilter
            label="Establecimiento"
            options={establecimientoOptions}
            selected={estSel}
            onChange={setEstSel}
          />
        )}
        <MultiSelectFilter
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
