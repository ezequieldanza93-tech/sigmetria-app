'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { generateMockData } from './mock-data'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { VariantSwitcher } from './variant-switcher'
import { PROJECT_COLORS, TOOLTIP_STYLE, AXIS_STYLE, GradientDefs } from './chart-config'
import { cn } from '@/lib/utils'

const DATA = generateMockData()
const { siteControl: SC } = DATA

// ──────────────────────────────────────────────────────────────────────────────
// Variant 1 — Tendencia Semanal
// ──────────────────────────────────────────────────────────────────────────────
function Variant1() {
  return (
    <div className="space-y-6">
      {/* 3 line charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { key: 'reports', label: 'Reports', color: '#4CAF50' },
          { key: 'impOpp', label: 'Improvement Opp.', color: '#3B82F6' },
          { key: 'immAction', label: 'Immediate Action', color: '#F59E0B' },
        ].map(({ key, label, color }) => (
          <ChartCard key={key} title={label} subtitle="Semanal — últimas 12 semanas">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={SC.historialSemanal} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <GradientDefs />
                <XAxis dataKey="semana" tick={{ ...AXIS_STYLE.tick, fontSize: 9 }} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
                <YAxis tick={{ ...AXIS_STYLE.tick, fontSize: 10 }} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line type="monotone" dataKey={key} stroke={color} dot={false} strokeWidth={2.5} activeDot={{ r: 4, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        ))}
      </div>

      {/* Immediate action by project */}
      <ChartCard title="Immediate Action por Proyecto" subtitle="Últimas 4 semanas · agrupado por proyecto">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={SC.pivotImmAction}
            margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
          >
            <GradientDefs />
            <XAxis dataKey="semana" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="VINE" fill={PROJECT_COLORS.VINE} radius={[4, 4, 0, 0]} />
            <Bar dataKey="SHIL" fill={PROJECT_COLORS.SHIL} radius={[4, 4, 0, 0]} />
            <Bar dataKey="GUAT" fill={PROJECT_COLORS.GUAT} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Checklists */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SC.checklists.map((c) => (
          <ChartCard key={c.tipo} title={c.tipo} subtitle="Ejecutados vs Pendientes">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={[{ name: c.tipo, Ejecutados: c.ejecutados, Pendientes: c.pendientes }]}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <GradientDefs />
                <XAxis dataKey="name" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
                <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Ejecutados" fill="#4CAF50" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pendientes" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Pivot table helper
// ──────────────────────────────────────────────────────────────────────────────
function PivotTable({
  title,
  data,
}: {
  title: string
  data: { semana: string; VINE: number; SHIL: number; GUAT: number }[]
}) {
  const maxVal = Math.max(...data.flatMap((r) => [r.VINE, r.SHIL, r.GUAT]))

  function cellBg(v: number) {
    const ratio = v / Math.max(maxVal, 1)
    const r = Math.round(220 - ratio * 180)
    const g = Math.round(220 - ratio * 160)
    const b = Math.round(220 - ratio * 180)
    return `rgb(${r},${g},${b})`
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle">
        <h3 className="text-sm font-semibold font-heading text-text-primary">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-sunken">
              <th className="text-left px-4 py-2 text-xs font-semibold text-text-tertiary">Semana</th>
              {['VINE', 'SHIL', 'GUAT'].map((p) => (
                <th key={p} className="text-center px-4 py-2 text-xs font-semibold text-text-tertiary">
                  <span className="flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: PROJECT_COLORS[p] }} />
                    {p}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.semana} className="border-b border-border-subtle">
                <td className="px-4 py-2.5 text-xs font-mono text-text-secondary">{row.semana}</td>
                {(['VINE', 'SHIL', 'GUAT'] as const).map((p) => (
                  <td
                    key={p}
                    className="px-4 py-2.5 text-center text-xs font-bold"
                    style={{ background: cellBg(row[p]) }}
                  >
                    {row[p]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Trend indicator helper
// ──────────────────────────────────────────────────────────────────────────────
function TrendArrow({ current, prev, label }: { current: number; prev: number; label: string }) {
  const diff = current - prev
  const up = diff > 0
  const color = up ? 'text-[#EF4444]' : diff < 0 ? 'text-[#4CAF50]' : 'text-text-tertiary'

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-tertiary truncate">{label}</div>
        <div className="text-sm font-bold text-text-primary">{current}</div>
      </div>
      <div className={cn('text-lg font-bold', color)}>
        {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'}
      </div>
      <div className={cn('text-xs font-semibold', color)}>
        {diff > 0 ? '+' : ''}{diff}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Variant 2 — Pivot / Últimas Semanas
// ──────────────────────────────────────────────────────────────────────────────
function Variant2() {
  const last = SC.historialSemanal[SC.historialSemanal.length - 1]
  const prev = SC.historialSemanal[SC.historialSemanal.length - 2]
  const totalReports = last.reports
  const totalActions = last.immAction

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="Reports esta semana" value={totalReports} size="md" animate={true} />
        <KpiCard title="Acciones abiertas" value={totalActions} status={totalActions > 8 ? 'warning' : 'success'} size="md" animate={true} />
      </div>

      {/* Trend indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TrendArrow current={last.reports} prev={prev.reports} label="Reports" />
        <TrendArrow current={last.impOpp} prev={prev.impOpp} label="Impr. Opp." />
        <TrendArrow current={last.immAction} prev={prev.immAction} label="Imm. Action" />
      </div>

      <PivotTable title="Improvement Opp. — Últimas 4 Semanas" data={SC.pivotImpOpp} />
      <PivotTable title="Immediate Actions — Últimas 4 Semanas" data={SC.pivotImmAction} />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Variant 3 — Estado de Checklists
// ──────────────────────────────────────────────────────────────────────────────
function Variant3() {
  const heatWeeks = SC.historialSemanal.slice(-4)
  const maxHeat = Math.max(...heatWeeks.flatMap((w) => [w.reports, w.immAction, w.impOpp]))

  function heatBg(v: number) {
    const ratio = v / Math.max(maxHeat, 1)
    const g = Math.round(200 - ratio * 150)
    const r = Math.round(76 + ratio * (220 - 76))
    return `rgba(${r},${g},80,${0.15 + ratio * 0.6})`
  }

  return (
    <div className="space-y-6">
      {/* Progress bars */}
      <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4 space-y-4">
        <h3 className="text-sm font-semibold font-heading text-text-primary">Estado de Checklists</h3>
        {SC.checklists.map((c) => {
          const pct = Math.round((c.ejecutados / (c.ejecutados + c.pendientes)) * 100)
          return (
            <div key={c.tipo} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-text-primary font-medium">{c.tipo}</span>
                <span className="font-bold" style={{ color: pct >= 80 ? '#4CAF50' : pct >= 60 ? '#F59E0B' : '#EF4444' }}>
                  {pct}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-sunken overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 80 ? '#4CAF50' : pct >= 60 ? '#F59E0B' : '#EF4444',
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-text-tertiary">
                <span>{c.ejecutados} ejecutados</span>
                <span>{c.pendientes} pendientes</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Line chart */}
        <ChartCard title="Immediate Actions Trend" subtitle="Últimas 12 semanas">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={SC.historialSemanal} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <GradientDefs />
              <XAxis dataKey="semana" tick={{ ...AXIS_STYLE.tick, fontSize: 9 }} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <YAxis tick={{ ...AXIS_STYLE.tick, fontSize: 10 }} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="immAction" stroke="#F59E0B" dot={false} strokeWidth={2.5} activeDot={{ r: 4, strokeWidth: 0 }} name="Imm. Action" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Heat map grid */}
        <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4">
          <h3 className="text-sm font-semibold font-heading text-text-primary mb-3">
            Heat Map · 4 Semanas × Reports
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1 pr-3 text-text-tertiary font-medium">Semana</th>
                  {(['VINE', 'SHIL', 'GUAT'] as const).map((p) => (
                    <th key={p} className="text-center py-1 px-3 text-text-tertiary font-medium">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatWeeks.map((w) => {
                  const vals: Record<string, number> = {
                    VINE: SC.pivotImpOpp.find((r) => r.semana === w.semana)?.VINE ?? w.reports,
                    SHIL: SC.pivotImpOpp.find((r) => r.semana === w.semana)?.SHIL ?? w.immAction,
                    GUAT: SC.pivotImpOpp.find((r) => r.semana === w.semana)?.GUAT ?? w.impOpp,
                  }
                  return (
                    <tr key={w.semana}>
                      <td className="py-1.5 pr-3 font-mono text-text-secondary">{w.semana}</td>
                      {(['VINE', 'SHIL', 'GUAT'] as const).map((p) => (
                        <td
                          key={p}
                          className="py-1.5 px-3 text-center font-bold rounded"
                          style={{ background: heatBg(vals[p]) }}
                        >
                          {vals[p]}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
export function SectionSiteControl() {
  const [variant, setVariant] = useState<1 | 2 | 3>(1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold font-heading text-text-primary">Site Control</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            {variant === 1 && 'Tendencia semanal — líneas de tiempo y checklists'}
            {variant === 2 && 'Pivot — últimas semanas con comparación de período'}
            {variant === 3 && 'Estado de checklists — progreso y heat map'}
          </p>
        </div>
        <VariantSwitcher
          current={variant}
          onChange={setVariant}
          labels={['Tendencia Semanal', 'Pivot Semanal', 'Estado Checklists']}
        />
      </div>

      {variant === 1 && <Variant1 />}
      {variant === 2 && <Variant2 />}
      {variant === 3 && <Variant3 />}
    </div>
  )
}
