'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { MultiFilterWithAll } from '@/components/ui/multi-filter-with-all'

export interface IncidenteAggregateRow {
  id: string
  empresa_id: string
  empresa_razon_social: string
  establecimiento_id: string | null
  establecimiento_nombre: string | null
  titulo: string
  tipo_incidente: string
  severidad: string
  estado: string
  fecha_incidente: string
}

interface Props {
  rows: IncidenteAggregateRow[]
  showEmpresaFilter?: boolean
  showEstablecimientoFilter?: boolean
}

const ESTADOS = ['recibida', 'en_analisis', 'accion_planificada', 'implementada', 'cerrada'] as const
const ESTADO_LABEL: Record<string, string> = {
  recibida: 'Recibida',
  en_analisis: 'En análisis',
  accion_planificada: 'Acción planificada',
  implementada: 'Implementada',
  cerrada: 'Cerrada',
}
const ESTADO_BADGE: Record<string, string> = {
  recibida: 'bg-sky-100 text-sky-800',
  en_analisis: 'bg-amber-100 text-amber-800',
  accion_planificada: 'bg-indigo-100 text-indigo-800',
  implementada: 'bg-blue-100 text-blue-800',
  cerrada: 'bg-green-100 text-green-800',
}
const SEVERIDAD_BADGE: Record<string, string> = {
  baja: 'bg-slate-100 text-slate-700',
  media: 'bg-yellow-100 text-yellow-800',
  alta: 'bg-orange-100 text-orange-800',
  critica: 'bg-red-100 text-red-800',
}

function fmt(date: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function IncidentesAggregate({
  rows,
  showEmpresaFilter = false,
  showEstablecimientoFilter = true,
}: Props) {
  const [empresaSel, setEmpresaSel] = useState<Set<string>>(new Set())
  const [estSel, setEstSel] = useState<Set<string>>(new Set())
  const [estadoSel, setEstadoSel] = useState<Set<string>>(new Set())

  const empresaOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) map.set(r.empresa_id, r.empresa_razon_social)
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rows])

  const establecimientoOptions = useMemo(() => {
    const map = new Map<string, string>()
    const allowed = empresaSel.size === 0 ? null : empresaSel
    for (const r of rows) {
      if (!r.establecimiento_id) continue
      if (allowed && !allowed.has(r.empresa_id)) continue
      map.set(r.establecimiento_id, r.establecimiento_nombre ?? '—')
    }
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rows, empresaSel])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (empresaSel.size > 0 && !empresaSel.has(r.empresa_id)) return false
      if (estSel.size > 0 && (!r.establecimiento_id || !estSel.has(r.establecimiento_id))) return false
      if (estadoSel.size > 0 && !estadoSel.has(r.estado)) return false
      return true
    })
  }, [rows, empresaSel, estSel, estadoSel])

  const columnCount = 5 + (showEmpresaFilter ? 1 : 0)

  return (
    <div className="px-6 py-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-text-primary mr-4">Incidentes</h2>
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
          options={ESTADOS.map(e => ({ value: e, label: ESTADO_LABEL[e] }))}
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
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Establecimiento</th>
                {showEmpresaFilter && <th className="px-3 py-2 text-left">Empresa</th>}
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Título</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-3 py-8 text-center text-text-tertiary">
                    Sin incidentes para los filtros activos.
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id} className="border-t border-border-subtle hover:bg-surface-sunken">
                    <td className="px-3 py-2 text-text-tertiary text-xs whitespace-nowrap">{fmt(r.fecha_incidente)}</td>
                    <td className="px-3 py-2 text-text-secondary truncate max-w-[14rem]">{r.establecimiento_nombre ?? '—'}</td>
                    {showEmpresaFilter && (
                      <td className="px-3 py-2 text-text-secondary truncate max-w-[14rem]">{r.empresa_razon_social}</td>
                    )}
                    <td className="px-3 py-2 text-text-tertiary text-xs">
                      {r.tipo_incidente}
                      <span className={`ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${SEVERIDAD_BADGE[r.severidad] ?? 'bg-slate-100 text-slate-700'}`}>
                        {r.severidad}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ESTADO_BADGE[r.estado] ?? 'bg-slate-100 text-slate-700'}`}>
                        {ESTADO_LABEL[r.estado] ?? r.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-primary truncate max-w-[20rem]">
                      <Link href={`/dashboard/incidentes/${r.id}`} className="hover:underline">
                        {r.titulo}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
