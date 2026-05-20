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
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import { generateMockData } from './mock-data'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { VariantSwitcher } from './variant-switcher'
import { CHART_COLORS, PROJECT_COLORS, TOOLTIP_STYLE, AXIS_STYLE, GradientDefs, GRADIENT_IDS } from './chart-config'
import { cn } from '@/lib/utils'

const DATA = generateMockData()
const { accidentes: ACC } = DATA

const CATEGORY_BADGE: Record<string, string> = {
  Leve: 'bg-[rgba(245,158,11,0.12)] text-[#F59E0B]',
  Moderado: 'bg-[rgba(249,115,22,0.12)] text-[#F97316]',
  Grave: 'bg-[rgba(239,68,68,0.12)] text-[#EF4444]',
}

function diasColor(dias: number) {
  if (dias > 30) return 'text-[#EF4444]'
  if (dias >= 15) return 'text-[#F59E0B]'
  return 'text-[#4CAF50]'
}

// ──────────────────────────────────────────────────────────────────────────────
// Variant 1 — Vista Ejecutiva
// ──────────────────────────────────────────────────────────────────────────────
function Variant1() {
  const last6 = ACC.historialMensual.slice(-6)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div
        className="rounded-2xl border border-[#4CAF50]/20 p-8 flex flex-col items-center text-center gap-2"
        style={{ background: 'linear-gradient(135deg, #0a1f0a, #0d2e0d)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-[#4CAF50]/70 font-heading">
          Días sin Accidentes
        </p>
        <div className="text-8xl font-bold text-white font-heading leading-none">
          {ACC.diasSinAccidente}
        </div>
        <p className="text-sm text-white/50">Accidentes de Trabajo</p>
      </div>

      {/* Days without per category */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard title="Días sin Accidente Leve" value={ACC.diasSinAccidenteLeve} status="success" size="md" animate={true} />
        <KpiCard title="Días sin Acc. Moderado" value={ACC.diasSinAccidenteModerado} status="warning" size="md" animate={true} />
        <KpiCard title="Días sin Acc. Grave" value={ACC.diasSinAccidenteGrave} status="success" size="md" animate={true} />
        <KpiCard title="Total Días Perdidos" value={ACC.diasPerdidos} status="neutral" size="md" animate={true} />
      </div>

      {/* 6 KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Total Accidentes" value={ACC.total} size="sm" animate={true} />
        <KpiCard title="Días Perdidos" value={ACC.diasPerdidos} size="sm" animate={true} />
        <KpiCard title="Leves" value={ACC.leves} status="warning" size="sm" animate={true} />
        <KpiCard title="Moderados" value={ACC.moderados} status="warning" size="sm" animate={true} />
        <KpiCard title="Graves" value={ACC.graves} status={ACC.graves > 0 ? 'danger' : 'success'} size="sm" animate={true} pulse={ACC.graves > 0} />
        <KpiCard title="In Itinere" value={ACC.initinere} size="sm" animate={true} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Accidentes por Establecimiento · Período"
          subtitle="Últimos 6 meses"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last6} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <GradientDefs />
              <XAxis dataKey="mes" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="VINE" fill={PROJECT_COLORS.VINE} radius={[4, 4, 0, 0]} name="VINE" />
              <Bar dataKey="SHIL" fill={PROJECT_COLORS.SHIL} radius={[4, 4, 0, 0]} name="SHIL" />
              <Bar dataKey="GUAT" fill={PROJECT_COLORS.GUAT} radius={[4, 4, 0, 0]} name="GUAT" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="% Categoría">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={ACC.porCategoria}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {ACC.porCategoria.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Variant 2 — Por Proyecto / Índices
// ──────────────────────────────────────────────────────────────────────────────
function Variant2() {
  const projects = ['VINE', 'SHIL', 'GUAT'] as const

  return (
    <div className="space-y-6">
      {/* Project index cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {projects.map((proj) => {
          const idx = ACC.indicesProyecto[proj]
          return (
            <div
              key={proj}
              className="rounded-xl border border-border-subtle bg-surface-elevated p-5 space-y-3 border-l-4"
              style={{ borderLeftColor: PROJECT_COLORS[proj] }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: PROJECT_COLORS[proj] }}
                />
                <span className="font-bold font-heading text-base text-text-primary">{proj}</span>
                <span className="text-xs text-text-tertiary ml-auto">Anual 2025</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'IP', val: idx.ip },
                  { label: 'IIG', val: idx.iig },
                  { label: 'IF', val: idx.if_ },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-surface-sunken p-2">
                    <div className="text-xl font-bold font-heading text-text-primary">{item.val}</div>
                    <div className="text-xs text-text-tertiary">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Monthly evolution charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {projects.map((proj) => (
          <ChartCard key={proj} title={`Evolución IP/IIG/IF — ${proj}`} subtitle="Por mes">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart
                data={ACC.historialMensual.map((m) => ({
                  mes: m.mes,
                  IP: parseFloat((Math.random() * 6 + 1).toFixed(2)),
                  IIG: parseFloat((Math.random() * 2 + 0.2).toFixed(2)),
                  IF: parseFloat((Math.random() * 40 + 5).toFixed(1)),
                }))}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <GradientDefs />
                <XAxis dataKey="mes" tick={{ ...AXIS_STYLE.tick, fontSize: 10 }} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
                <YAxis tick={{ ...AXIS_STYLE.tick, fontSize: 10 }} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="IP" stroke={PROJECT_COLORS[proj]} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="IIG" stroke="#8B5CF6" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="IF" stroke="#06B6D4" dot={false} strokeWidth={1.5} strokeDasharray="2 2" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        ))}
      </div>

      {/* Open accidents table */}
      <div className="rounded-xl border border-border-subtle bg-surface-elevated overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle">
          <h3 className="text-sm font-semibold font-heading text-text-primary">Accidentes Abiertos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-sunken">
                {['ID', 'Trabajador', 'Empresa', 'Categoría', 'Días Abierto', 'Fecha'].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACC.abiertos.map((row) => (
                <tr key={row.id} className="border-b border-border-subtle hover:bg-surface-sunken transition-colors">
                  <td className="px-4 py-2.5 text-xs font-mono text-text-secondary">{row.id}</td>
                  <td className="px-4 py-2.5 text-xs text-text-primary">{row.trabajador}</td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">{row.empresa}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', CATEGORY_BADGE[row.categoria] ?? 'bg-surface-sunken text-text-tertiary')}>
                      {row.categoria}
                    </span>
                  </td>
                  <td className={cn('px-4 py-2.5 text-xs font-bold', diasColor(row.diasAbierto))}>
                    {row.diasAbierto}d
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-tertiary">{row.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Variant 3 — Detalle Temporal
// ──────────────────────────────────────────────────────────────────────────────
function Variant3() {
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard title="Total Accidentes" value={ACC.total} size="md" animate={true} />
        <KpiCard title="Días Perdidos" value={ACC.diasPerdidos} status="warning" size="md" animate={true} />
        <KpiCard title="Días sin Accidente" value={ACC.diasSinAccidente} status="success" size="md" animate={true} />
      </div>

      {/* Area + stacked bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Días Perdidos Acumulados" subtitle="Últimos 12 meses">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={ACC.historialMensual} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <GradientDefs />
              <XAxis dataKey="mes" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="diasPerdidos" stroke="#EF4444" fill={`url(#${GRADIENT_IDS.red})`} strokeWidth={2} name="Días Perdidos" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Categoría por Período" subtitle="Barras apiladas">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ACC.porPeriodoCategoria} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <GradientDefs />
              <XAxis dataKey="periodo" tick={{ ...AXIS_STYLE.tick, fontSize: 10 }} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Leve" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Moderado" stackId="a" fill="#F97316" />
              <Bar dataKey="Grave" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Stakeholder chart */}
      <ChartCard title="Accidentes por Stakeholder / Categoría" subtitle="Barras agrupadas por empresa">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={ACC.stakeholders} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <GradientDefs />
            <XAxis dataKey="name" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Leve" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Moderado" fill="#F97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Grave" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
export function SectionAccidentes() {
  const [variant, setVariant] = useState<1 | 2 | 3>(1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold font-heading text-text-primary">Accidentes</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            {variant === 1 && 'Vista ejecutiva — resumen de alto nivel'}
            {variant === 2 && 'Por proyecto e índices — detalle VINE / SHIL / GUAT'}
            {variant === 3 && 'Detalle temporal — tendencias y stakeholders'}
          </p>
        </div>
        <VariantSwitcher
          current={variant}
          onChange={setVariant}
          labels={['Vista Ejecutiva', 'Por Proyecto', 'Detalle Temporal']}
        />
      </div>

      {variant === 1 && <Variant1 />}
      {variant === 2 && <Variant2 />}
      {variant === 3 && <Variant3 />}
    </div>
  )
}
