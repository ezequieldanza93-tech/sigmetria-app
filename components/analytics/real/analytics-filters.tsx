'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import type { ResponsableOption } from '@/lib/actions/analytics'

interface AnalyticsFiltersProps {
  year: number
  month: number | null
  responsableId: string | null
  responsables: ResponsableOption[]
  onYearChange: (y: number) => void
  onMonthChange: (m: number | null) => void
  onResponsableChange: (id: string | null) => void
  establecimientos?: { id: string; nombre: string }[]
  selectedEstIds?: string[]
  onEstablecimientosChange?: (ids: string[]) => void
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const SELECT_CLASS = 'bg-surface-elevated border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer'

export function AnalyticsFilters({
  year,
  month,
  responsableId,
  responsables,
  onYearChange,
  onMonthChange,
  onResponsableChange,
  establecimientos,
  selectedEstIds,
  onEstablecimientosChange,
}: AnalyticsFiltersProps) {
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Año */}
      <select
        value={year}
        onChange={e => onYearChange(Number(e.target.value))}
        className={SELECT_CLASS}
      >
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* Mes */}
      <select
        value={month ?? ''}
        onChange={e => onMonthChange(e.target.value === '' ? null : Number(e.target.value))}
        className={SELECT_CLASS}
      >
        <option value="">Todo el año</option>
        {MONTHS.map((label, i) => (
          <option key={i + 1} value={i + 1}>{label}</option>
        ))}
      </select>

      {/* Responsable */}
      {responsables.length > 0 && (
        <select
          value={responsableId ?? ''}
          onChange={e => onResponsableChange(e.target.value === '' ? null : e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Todos los responsables</option>
          {responsables.map(r => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      )}

      {/* Establecimientos (multi) */}
      {establecimientos && establecimientos.length > 1 && onEstablecimientosChange && selectedEstIds && (
        <div className="relative">
          <details className="group">
            <summary className={cn(SELECT_CLASS, 'list-none cursor-pointer flex items-center gap-1.5')}>
              <span>
                {selectedEstIds.length === establecimientos.length
                  ? 'Todos los establecimientos'
                  : selectedEstIds.length === 0
                  ? 'Sin establecimientos'
                  : `${selectedEstIds.length} establecimientos`}
              </span>
              <svg className="w-3 h-3 text-text-tertiary group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="absolute top-full mt-1 left-0 z-50 bg-surface-elevated border border-border-default rounded-xl shadow-[var(--shadow-lg)] p-2 min-w-[220px] max-h-64 overflow-y-auto space-y-0.5">
              {/* Select all */}
              <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-sunken cursor-pointer text-xs font-semibold text-text-secondary">
                <input
                  type="checkbox"
                  checked={selectedEstIds.length === establecimientos.length}
                  onChange={e => onEstablecimientosChange(e.target.checked ? establecimientos.map(est => est.id) : [])}
                  className="rounded"
                />
                Todos
              </label>
              <div className="border-t border-border-subtle my-1" />
              {establecimientos.map(est => (
                <label key={est.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-sunken cursor-pointer text-sm text-text-primary">
                  <input
                    type="checkbox"
                    checked={selectedEstIds.includes(est.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        onEstablecimientosChange([...selectedEstIds, est.id])
                      } else {
                        onEstablecimientosChange(selectedEstIds.filter(id => id !== est.id))
                      }
                    }}
                    className="rounded"
                  />
                  <span className="truncate">{est.nombre}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
