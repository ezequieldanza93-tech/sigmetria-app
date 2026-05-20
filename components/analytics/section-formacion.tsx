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
  AreaChart,
  Area,
} from 'recharts'
import { generateMockData } from './mock-data'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { VariantSwitcher } from './variant-switcher'
import { PROJECT_COLORS, TOOLTIP_STYLE, AXIS_STYLE, GradientDefs, GRADIENT_IDS } from './chart-config'

const DATA = generateMockData()
const { formacion: FORM } = DATA

// ──────────────────────────────────────────────────────────────────────────────
// Circular progress ring (SVG)
// ──────────────────────────────────────────────────────────────────────────────
function ProgressRing({
  ejecutadas,
  planificadas,
  color,
}: {
  ejecutadas: number
  planificadas: number
  color: string
}) {
  const radius = 45
  const circ = 2 * Math.PI * radius
  const pct = Math.min(ejecutadas / Math.max(planificadas, 1), 1)

  return (
    <svg width="120" height="120" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text x="50" y="46" textAnchor="middle" fill="var(--text-primary)" fontSize="16" fontWeight="bold">
        {Math.round(pct * 100)}%
      </text>
      <text x="50" y="62" textAnchor="middle" fill="var(--text-tertiary)" fontSize="9">
        {ejecutadas}/{planificadas}
      </text>
    </svg>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Variant 1 — Resumen Operativo
// ──────────────────────────────────────────────────────────────────────────────
function Variant1() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Sesiones Ejecutadas" value={FORM.sesionesEjecutadas} status="success" size="sm" animate={true} />
        <KpiCard title="Horas Ejecutadas" value={`${FORM.horasEjecutadas}h`} status="neutral" size="sm" animate={false} />
        <KpiCard title="Formaciones Planificadas" value={FORM.planificadas} size="sm" animate={true} />
        <KpiCard title="Pendientes" value={FORM.pendientes} status={FORM.pendientes > 15 ? 'warning' : 'neutral'} size="sm" animate={true} />
        <KpiCard title="Trabajadores Cubiertos" value={FORM.trabajadoresCubiertos} size="sm" animate={true} />
        <KpiCard title="Hs Promedio Mensual" value={`${FORM.horasPromedioMensual}h`} size="sm" animate={false} />
      </div>

      <ChartCard title="Horas de Formación Ejecutadas por Período" subtitle="Últimos 12 meses · agrupado por proyecto">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={FORM.historialMensual} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <GradientDefs />
            <XAxis dataKey="mes" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="VINE" fill={PROJECT_COLORS.VINE} radius={[4, 4, 0, 0]} />
            <Bar dataKey="SHIL" fill={PROJECT_COLORS.SHIL} radius={[4, 4, 0, 0]} />
            <Bar dataKey="GUAT" fill={PROJECT_COLORS.GUAT} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Improvement Opportunities" subtitle="Por proyecto y período">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={FORM.improvementOpp} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <GradientDefs />
            <XAxis dataKey="periodo" tick={{ ...AXIS_STYLE.tick, fontSize: 10 }} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="VINE" fill={PROJECT_COLORS.VINE} radius={[4, 4, 0, 0]} />
            <Bar dataKey="SHIL" fill={PROJECT_COLORS.SHIL} radius={[4, 4, 0, 0]} />
            <Bar dataKey="GUAT" fill={PROJECT_COLORS.GUAT} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Variant 2 — Progreso vs Planificado
// ──────────────────────────────────────────────────────────────────────────────
function Variant2() {
  const projects = ['VINE', 'SHIL', 'GUAT'] as const
  const projectData = {
    VINE: { ejecutadas: Math.round(FORM.sesionesEjecutadas * 0.4), planificadas: Math.round(FORM.planificadas * 0.4), horas: Math.round(FORM.horasEjecutadas * 0.4) },
    SHIL: { ejecutadas: Math.round(FORM.sesionesEjecutadas * 0.35), planificadas: Math.round(FORM.planificadas * 0.35), horas: Math.round(FORM.horasEjecutadas * 0.35) },
    GUAT: { ejecutadas: Math.round(FORM.sesionesEjecutadas * 0.25), planificadas: Math.round(FORM.planificadas * 0.25), horas: Math.round(FORM.horasEjecutadas * 0.25) },
  }

  return (
    <div className="space-y-6">
      {/* Circular rings */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {projects.map((proj) => {
          const d = projectData[proj]
          return (
            <div
              key={proj}
              className="rounded-xl border border-border-subtle bg-surface-elevated p-5 flex flex-col items-center gap-3"
            >
              <div className="flex items-center gap-2 self-start">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: PROJECT_COLORS[proj] }} />
                <span className="font-bold font-heading text-sm text-text-primary">{proj}</span>
              </div>
              <ProgressRing
                ejecutadas={d.ejecutadas}
                planificadas={d.planificadas}
                color={PROJECT_COLORS[proj]}
              />
              <div className="text-center">
                <div className="text-xs text-text-tertiary">Sesiones</div>
                <div className="text-sm font-semibold text-text-primary">
                  {d.ejecutadas} / {d.planificadas}
                </div>
                <div className="text-xs text-text-tertiary mt-1">Horas este mes</div>
                <div className="text-sm font-semibold text-[#4CAF50]">{d.horas}h</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Line chart */}
      <ChartCard title="Evolución Sesiones Ejecutadas" subtitle="Por proyecto · mensual">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={FORM.historialMensual.map((m) => ({
              mes: m.mes,
              VINE: Math.round(m.VINE / 10),
              SHIL: Math.round(m.SHIL / 10),
              GUAT: Math.round(m.GUAT / 10),
            }))}
            margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
          >
            <GradientDefs />
            <XAxis dataKey="mes" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="VINE" stroke={PROJECT_COLORS.VINE} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="SHIL" stroke={PROJECT_COLORS.SHIL} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="GUAT" stroke={PROJECT_COLORS.GUAT} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Bottom stats */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="Total Trabajadores Cubiertos" value={FORM.trabajadoresCubiertos} status="success" size="md" animate={true} />
        <KpiCard title="Promedio Mensual Horas" value={`${FORM.horasPromedioMensual}h`} size="md" animate={false} />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Variant 3 — Análisis Tendencias
// ──────────────────────────────────────────────────────────────────────────────
function Variant3() {
  const pctCumple = Math.round((FORM.sesionesEjecutadas / FORM.planificadas) * 100)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stacked bar */}
        <ChartCard title="Horas por Proyecto y Período" subtitle="Apilado mensual">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={FORM.historialMensual} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <GradientDefs />
              <XAxis dataKey="mes" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="VINE" stackId="h" fill={PROJECT_COLORS.VINE} />
              <Bar dataKey="SHIL" stackId="h" fill={PROJECT_COLORS.SHIL} />
              <Bar dataKey="GUAT" stackId="h" fill={PROJECT_COLORS.GUAT} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Area sesiones — use grad-blue for formación */}
        <ChartCard title="Tendencia de Sesiones" subtitle="Total mensual">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={FORM.historialMensual.map((m) => ({ mes: m.mes, sesiones: Math.round(m.horasEjecutadas / 8) }))}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
            >
              <GradientDefs />
              <XAxis dataKey="mes" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="sesiones" stroke="#3B82F6" fill={`url(#${GRADIENT_IDS.blue})`} strokeWidth={2} name="Sesiones" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Compact KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard title="Sesiones Ejecutadas" value={FORM.sesionesEjecutadas} status="success" size="sm" animate={true} />
        <KpiCard title="Horas Ejecutadas" value={`${FORM.horasEjecutadas}h`} size="sm" animate={false} />
        <KpiCard title="Planificadas" value={FORM.planificadas} size="sm" animate={true} />
        <KpiCard title="Pendientes" value={FORM.pendientes} status={FORM.pendientes > 15 ? 'warning' : 'neutral'} size="sm" animate={true} />
        <KpiCard title="Trabajadores" value={FORM.trabajadoresCubiertos} size="sm" animate={true} />
        <KpiCard title="Hs Prom. Mensual" value={`${FORM.horasPromedioMensual}h`} size="sm" animate={false} />
      </div>

      {/* Progress bar cumplimiento */}
      <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-text-primary font-heading">Cumplimiento del Plan</span>
          <span className="font-bold text-[#4CAF50]">{pctCumple}%</span>
        </div>
        <div className="h-3 rounded-full bg-surface-sunken overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pctCumple}%`, background: pctCumple >= 80 ? '#4CAF50' : pctCumple >= 60 ? '#F59E0B' : '#EF4444' }}
          />
        </div>
        <div className="flex justify-between text-xs text-text-tertiary">
          <span>{FORM.sesionesEjecutadas} ejecutadas</span>
          <span>{FORM.planificadas} planificadas</span>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
export function SectionFormacion() {
  const [variant, setVariant] = useState<1 | 2 | 3>(1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold font-heading text-text-primary">Formación y CM</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            {variant === 1 && 'Resumen operativo — KPIs y actividad mensual'}
            {variant === 2 && 'Progreso vs planificado — anillos por proyecto'}
            {variant === 3 && 'Análisis de tendencias — evolución temporal'}
          </p>
        </div>
        <VariantSwitcher
          current={variant}
          onChange={setVariant}
          labels={['Resumen Operativo', 'Progreso vs Plan', 'Tendencias']}
        />
      </div>

      {variant === 1 && <Variant1 />}
      {variant === 2 && <Variant2 />}
      {variant === 3 && <Variant3 />}
    </div>
  )
}
