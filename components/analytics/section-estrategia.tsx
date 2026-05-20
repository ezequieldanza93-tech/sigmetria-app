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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import { generateMockData } from './mock-data'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { VariantSwitcher } from './variant-switcher'
import { TOOLTIP_STYLE, AXIS_STYLE, GradientDefs } from './chart-config'

const DATA = generateMockData()
const { estrategia: EST } = DATA

// ──────────────────────────────────────────────────────────────────────────────
// Variant 1 — Vista General
// ──────────────────────────────────────────────────────────────────────────────
function Variant1() {
  const cumplePct = EST.cumple
  const legalData = [
    { name: 'Cumple', value: EST.cumple },
    { name: 'No Cumple', value: EST.noCumple },
  ]

  return (
    <div className="space-y-6">
      {/* KPI 2-column layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Comunidad */}
        <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4 space-y-3">
          <h3 className="text-sm font-semibold font-heading text-text-primary border-b border-border-subtle pb-2">
            Comunidad
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard title="Solicitudes Vecinos" value={EST.solicitudesVecinos} size="sm" animate={true} />
            <KpiCard title="Iniciativas" value={EST.iniciativasVecinos} size="sm" animate={true} />
            <KpiCard title="Actividades" value={EST.actividadesComunidad} size="sm" animate={true} />
            <KpiCard title="Feedback Neg." value={EST.feedbackNegativo} status={EST.feedbackNegativo > 5 ? 'warning' : 'neutral'} size="sm" animate={true} />
            <KpiCard title="Feedback Pos." value={EST.feedbackPositivo} status="success" size="sm" className="col-span-2" animate={true} />
          </div>
        </div>

        {/* Legal */}
        <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4 space-y-3">
          <h3 className="text-sm font-semibold font-heading text-text-primary border-b border-border-subtle pb-2">
            Legal / Inspecciones
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard title="Con Sanción" value={EST.inspeccionesConSancion} status={EST.inspeccionesConSancion > 2 ? 'danger' : 'success'} size="sm" animate={true} pulse={EST.inspeccionesConSancion > 2} />
            <KpiCard title="Sin Sanción" value={EST.inspecciones_sinSancion} status="success" size="sm" animate={true} />
            <KpiCard title="Cumple" value={`${EST.cumple}%`} status="success" size="sm" animate={false} />
            <KpiCard title="No Cumple" value={`${EST.noCumple}%`} status={EST.noCumple > 20 ? 'danger' : 'warning'} size="sm" animate={false} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Cumplimiento Legal" subtitle={`${cumplePct}% cumple — ${EST.noCumple}% no cumple`}>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={legalData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell fill="#4CAF50" />
                  <Cell fill="#EF4444" />
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-3xl font-bold font-heading text-[#4CAF50]">{cumplePct}%</div>
                <div className="text-xs text-text-tertiary">Cumple</div>
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Residuos Reciclables Recuperados" subtitle="kg/mes">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={EST.residuosMensuales} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <GradientDefs />
              <XAxis dataKey="mes" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v} kg`, 'Residuos']} />
              <Bar dataKey="kg" fill="#4CAF50" radius={[4, 4, 0, 0]} name="kg" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// RAG dot helper
// ──────────────────────────────────────────────────────────────────────────────
type RAGStatus = 'green' | 'amber' | 'red'

function RagCard({ label, value, status, description }: { label: string; value: string | number; status: RAGStatus; description?: string }) {
  const color = { green: '#4CAF50', amber: '#F59E0B', red: '#EF4444' }[status]
  const bgOpacity = { green: 'rgba(76,175,80,0.08)', amber: 'rgba(245,158,11,0.08)', red: 'rgba(239,68,68,0.08)' }[status]

  return (
    <div className="rounded-xl border bg-surface-elevated p-4 flex items-start gap-3" style={{ borderColor: color + '40', background: bgOpacity }}>
      <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-tertiary">{label}</div>
        <div className="text-2xl font-bold font-heading" style={{ color }}>{value}</div>
        {description && <div className="text-xs text-text-tertiary mt-0.5">{description}</div>}
      </div>
      <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{ background: color + '20', color }}>
        {status.toUpperCase()}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Variant 2 — Semáforo / RAG Status
// ──────────────────────────────────────────────────────────────────────────────
function Variant2() {
  const complianceScore = Math.round(
    (EST.cumple * 0.4 +
      (EST.inspeccionesConSancion === 0 ? 100 : EST.inspeccionesConSancion < 3 ? 60 : 30) * 0.3 +
      (EST.feedbackNegativo < 3 ? 100 : EST.feedbackNegativo < 6 ? 60 : 30) * 0.3) /
    1,
  )

  const ragItems: { label: string; value: string | number; status: RAGStatus; description?: string }[] = [
    {
      label: 'Accidente Grave',
      value: DATA.accidentes.graves,
      status: DATA.accidentes.graves === 0 ? 'green' : 'red',
      description: DATA.accidentes.graves === 0 ? 'Sin accidentes graves' : 'Requiere revisión urgente',
    },
    {
      label: 'Inspecciones con Sanción',
      value: EST.inspeccionesConSancion,
      status: EST.inspeccionesConSancion === 0 ? 'green' : EST.inspeccionesConSancion <= 2 ? 'amber' : 'red',
    },
    {
      label: 'Feedback Negativo',
      value: EST.feedbackNegativo,
      status: EST.feedbackNegativo < 3 ? 'green' : EST.feedbackNegativo < 6 ? 'amber' : 'red',
    },
    {
      label: 'Cumplimiento Legal',
      value: `${EST.cumple}%`,
      status: EST.cumple >= 80 ? 'green' : EST.cumple >= 60 ? 'amber' : 'red',
    },
    {
      label: 'Actividades Comunidad',
      value: EST.actividadesComunidad,
      status: EST.actividadesComunidad >= 10 ? 'green' : EST.actividadesComunidad >= 5 ? 'amber' : 'red',
    },
    {
      label: 'Solicitudes Atendidas',
      value: EST.solicitudesVecinos,
      status: 'green',
    },
  ]

  const fbHistory = DATA.accidentes.historialMensual.slice(-6).map((m) => ({
    mes: m.mes,
    Positivo: Math.round(EST.feedbackPositivo * (0.7 + Math.random() * 0.6) / 6),
    Negativo: Math.round(EST.feedbackNegativo * (0.7 + Math.random() * 0.6) / 6),
  }))

  return (
    <div className="space-y-6">
      {/* Compliance score hero */}
      <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-6 flex items-center gap-6">
        <div className="flex-1">
          <div className="text-xs text-text-tertiary uppercase tracking-widest font-heading mb-1">Compliance Score</div>
          <div
            className="text-7xl font-bold font-heading leading-none"
            style={{ color: complianceScore >= 70 ? '#4CAF50' : complianceScore >= 50 ? '#F59E0B' : '#EF4444' }}
          >
            {complianceScore}
          </div>
          <div className="text-sm text-text-tertiary mt-1">sobre 100</div>
        </div>
        <div className="h-24 w-px bg-border-subtle" />
        <div className="flex-1 text-sm text-text-secondary space-y-1">
          <div>✓ {EST.cumple}% requisitos legales</div>
          <div>{EST.inspeccionesConSancion > 0 ? '✗' : '✓'} {EST.inspeccionesConSancion} inspecciones con sanción</div>
          <div>{EST.feedbackNegativo > 5 ? '✗' : '✓'} {EST.feedbackNegativo} feedbacks negativos</div>
        </div>
      </div>

      {/* RAG grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ragItems.map((item) => (
          <RagCard key={item.label} {...item} />
        ))}
      </div>

      {/* Feedback history */}
      <ChartCard title="Histórico Feedback" subtitle="Últimos 6 meses">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={fbHistory} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <GradientDefs />
            <XAxis dataKey="mes" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Positivo" fill="#4CAF50" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Negativo" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Variant 3 — Análisis Comunidad
// ──────────────────────────────────────────────────────────────────────────────
function Variant3() {
  const comunidadData = DATA.accidentes.historialMensual.slice(-6).map((m) => ({
    mes: m.mes,
    Solicitudes: Math.round(EST.solicitudesVecinos * (0.5 + Math.random() * 0.5) / 6),
    Iniciativas: Math.round(EST.iniciativasVecinos * (0.5 + Math.random() * 0.5) / 6),
    Actividades: Math.round(EST.actividadesComunidad * (0.5 + Math.random() * 0.5) / 6),
  }))

  const feedbackData = [
    { name: 'Positivo', value: EST.feedbackPositivo },
    { name: 'Negativo', value: EST.feedbackNegativo },
  ]
  const inspeccionesData = [
    { name: 'Sin Sanción', value: EST.inspecciones_sinSancion },
    { name: 'Con Sanción', value: EST.inspeccionesConSancion },
  ]

  const pctCumple = EST.cumple
  const pctNoCumple = EST.noCumple

  return (
    <div className="space-y-6">
      {/* Stacked bar */}
      <ChartCard title="Interacciones Comunidad" subtitle="Últimos 6 meses">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={comunidadData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <GradientDefs />
            <XAxis dataKey="mes" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Solicitudes" stackId="c" fill="#3B82F6" />
            <Bar dataKey="Iniciativas" stackId="c" fill="#8B5CF6" />
            <Bar dataKey="Actividades" stackId="c" fill="#06B6D4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Donut charts side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ChartCard title="Feedback Clientes">
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={feedbackData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} dataKey="value" startAngle={90} endAngle={-270}>
                  <Cell fill="#4CAF50" />
                  <Cell fill="#EF4444" />
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-xl font-bold font-heading text-[#4CAF50]">
                  {Math.round((EST.feedbackPositivo / (EST.feedbackPositivo + EST.feedbackNegativo)) * 100)}%
                </div>
                <div className="text-xs text-text-tertiary">Positivo</div>
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Inspecciones">
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={inspeccionesData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} dataKey="value" startAngle={90} endAngle={-270}>
                  <Cell fill="#4CAF50" />
                  <Cell fill="#F59E0B" />
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-xl font-bold font-heading text-[#4CAF50]">
                  {Math.round((EST.inspecciones_sinSancion / (EST.inspecciones_sinSancion + EST.inspeccionesConSancion)) * 100)}%
                </div>
                <div className="text-xs text-text-tertiary">Sin Sanción</div>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Residuos trend line */}
      <ChartCard title="Residuos Reciclables" subtitle="Tendencia anual en kg">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={EST.residuosMensuales} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <GradientDefs />
            <XAxis dataKey="mes" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <YAxis tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v} kg`, 'Residuos']} />
            <Line type="monotone" dataKey="kg" stroke="#4CAF50" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* KPI badges */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Cumple', value: pctCumple, color: '#4CAF50', bg: 'rgba(76,175,80,0.08)' },
          { label: 'No Cumple', value: pctNoCumple, color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
        ].map((b) => (
          <div
            key={b.label}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border"
            style={{ borderColor: b.color + '40', background: b.bg }}
          >
            <span className="text-sm font-medium" style={{ color: b.color }}>{b.label}</span>
            <div className="text-2xl font-bold font-heading" style={{ color: b.color }}>{b.value}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
export function SectionEstrategia() {
  const [variant, setVariant] = useState<1 | 2 | 3>(1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold font-heading text-text-primary">Estrategia Legal y Comunidad</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            {variant === 1 && 'Vista general — comunidad y legal'}
            {variant === 2 && 'Semáforo RAG — estado por indicador'}
            {variant === 3 && 'Análisis comunidad — interacciones y tendencias'}
          </p>
        </div>
        <VariantSwitcher
          current={variant}
          onChange={setVariant}
          labels={['Vista General', 'Semáforo RAG', 'Comunidad']}
        />
      </div>

      {variant === 1 && <Variant1 />}
      {variant === 2 && <Variant2 />}
      {variant === 3 && <Variant3 />}
    </div>
  )
}
