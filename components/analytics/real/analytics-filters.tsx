'use client'

import React from 'react'
import { MultiSelectFilter } from '@/components/ui/multi-select-filter'
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
        <MultiSelectFilter
          label="Establecimientos"
          options={establecimientos.map(est => ({ value: est.id, label: est.nombre }))}
          selected={new Set(selectedEstIds)}
          onChange={next => onEstablecimientosChange(Array.from(next))}
        />
      )}
    </div>
  )
}
