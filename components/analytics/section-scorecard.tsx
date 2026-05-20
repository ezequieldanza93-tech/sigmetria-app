'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from 'recharts'
import { generateMockData } from './mock-data'
import { KpiCard } from './kpi-card'
import { ChartCard } from './chart-card'
import { VariantSwitcher } from './variant-switcher'
import { TOOLTIP_STYLE, AXIS_STYLE, GradientDefs } from './chart-config'
import { cn } from '@/lib/utils'

const DATA = generateMockData()
const { scorecard: SC } = DATA

// ──────────────────────────────────────────────────────────────────────────────
// Thresholds → status helpers
// ──────────────────────────────────────────────────────────────────────────────
type S = 'success' | 'warning' | 'danger' | 'neutral'

function statusAccGrave(v: number): S { return v === 0 ? 'success' : 'danger' }
function statusAccImm(v: number): S { return v < 5 ? 'success' : v <= 10 ? 'warning' : 'danger' }
function statusReq(v: number): S { return v < 5 ? 'success' : v <= 8 ? 'warning' : 'danger' }
function statusFeedback(v: number): S { return v < 2 ? 'success' : v <= 4 ? 'warning' : 'danger' }
function statusInfrac(v: number): S { return v === 0 ? 'success' : 'danger' }
function statusSinAcc(v: number): S { return v > 90 ? 'success' : v >= 30 ? 'warning' : 'danger' }

// ──────────────────────────────────────────────────────────────────────────────
// Variant 1 — Big Numbers RAG
// ──────────────────────────────────────────────────────────────────────────────
function Variant1() {
  const kpis: { title: string; value: string | number; status: S; subtitle?: string }[] = [
    { title: 'Accidente Grave', value: SC.accidenteGrave, status: statusAccGrave(SC.accidenteGrave), subtitle: SC.accidenteGrave === 0 ? 'Sin accidentes graves' : 'Requiere acción' },
    { title: 'Acción Inmediata Crítica', value: SC.accionInmediataCrit, status: statusAccImm(SC.accionInmediataCrit) },
    { title: 'Req. Empresa Crítico', value: SC.requisitoEmpresaCrit, status: statusReq(SC.requisitoEmpresaCrit) },
    { title: 'Feedback Neg. Cliente', value: SC.feedbackNegCliente, status: statusFeedback(SC.feedbackNegCliente) },
    { title: 'Infracciones', value: SC.infracciones, status: statusInfrac(SC.infracciones), subtitle: SC.infracciones === 0 ? 'Sin infracciones' : 'Con infracción' },
    { title: 'Días sin Acc. Grave', value: SC.sinAccidenteGrave, status: statusSinAcc(SC.sinAccidenteGrave) },
    { title: 'Acc. Inmediata No Crítica', value: SC.accionInmediataNotCrit, status: 'neutral' },
    { title: 'Req. Empresa No Crítico', value: SC.requisitoEmpresaNotCrit, status: 'neutral' },
    { title: 'Solicitudes Vecinos', value: SC.solicitudesVecinos, status: 'neutral', subtitle: `${SC.solicitudesVecinosResp} respondidas` },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.title}
          {...kpi}
          size="lg"
          animate={true}
          pulse={kpi.status === 'danger'}
        />
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Variant 2 — Comparación Períodos
// ──────────────────────────────────────────────────────────────────────────────
function DeltaCard({
  title,
  current,
  prev,
  status,
  isCritical,
}: {
  title: string
  current: number
  prev: number
  status: S
  isCritical?: boolean
}) {
  const delta = current - prev
  const up = delta > 0

  const sparkData = [
    { mes: 'M-2', v: Math.max(0, prev + Math.round(Math.random() * 4 - 2)) },
    { mes: 'M-1', v: prev },
    { mes: 'Actual', v: current },
  ]

  return (
    <div
      className={cn(
        'rounded-xl border bg-surface-elevated p-4 space-y-3',
        isCritical ? 'border-[#EF4444]/30 ring-1 ring-[#EF4444]/20' : 'border-border-subtle',
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wide font-heading">{title}</span>
        {isCritical && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[rgba(239,68,68,0.12)] text-[#EF4444] uppercase tracking-wider">CRÍTICO</span>
        )}
      </div>
      <div className="flex items-end gap-3">
        <div
          className={cn(
            'text-4xl font-bold font-heading',
            status === 'success' ? 'text-[#4CAF50]' :
            status === 'warning' ? 'text-[#F59E0B]' :
            status === 'danger' ? 'text-[#EF4444]' :
            'text-text-primary',
          )}
        >
          {current}
        </div>
        <div className="pb-1 flex items-center gap-1">
          <span className={cn('text-sm font-semibold', up ? 'text-[#EF4444]' : delta < 0 ? 'text-[#4CAF50]' : 'text-text-tertiary')}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
          <span className="text-xs text-text-tertiary">vs mes ant.</span>
        </div>
      </div>
      <div className="text-xs text-text-tertiary">Mes anterior: <strong className="text-text-primary">{prev}</strong></div>
      {isCritical && (
        <ResponsiveContainer width="100%" height={50}>
          <BarChart data={sparkData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <GradientDefs />
            <Bar dataKey="v" fill={status === 'danger' ? '#EF4444' : '#F59E0B'} radius={[2, 2, 0, 0]} />
            <XAxis dataKey="mes" tick={{ ...AXIS_STYLE.tick, fontSize: 9 }} axisLine={false} tickLine={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function Variant2() {
  return (
    <div className="space-y-6">
      {/* Critical section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full bg-[#EF4444]" />
          <h3 className="text-sm font-bold font-heading text-[#EF4444] uppercase tracking-wide">Indicadores Críticos</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DeltaCard
            title="Accidente Grave"
            current={SC.accidenteGrave}
            prev={SC.mesAnterior.accidenteGrave}
            status={statusAccGrave(SC.accidenteGrave)}
            isCritical
          />
          <DeltaCard
            title="Acc. Inmediata Crítica"
            current={SC.accionInmediataCrit}
            prev={SC.mesAnterior.accionInmediataCrit}
            status={statusAccImm(SC.accionInmediataCrit)}
            isCritical
          />
          <DeltaCard
            title="Infracciones"
            current={SC.infracciones}
            prev={SC.mesAnterior.infracciones}
            status={statusInfrac(SC.infracciones)}
            isCritical
          />
        </div>
      </div>

      {/* Non-critical */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full bg-[#4CAF50]" />
          <h3 className="text-sm font-bold font-heading text-text-primary uppercase tracking-wide">Otros Indicadores</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <DeltaCard title="Feedback Neg." current={SC.feedbackNegCliente} prev={Math.max(0, SC.feedbackNegCliente + Math.round(Math.random() * 2 - 1))} status={statusFeedback(SC.feedbackNegCliente)} />
          <DeltaCard title="Días sin Acc. Grave" current={SC.sinAccidenteGrave} prev={SC.sinAccidenteGrave - 30} status={statusSinAcc(SC.sinAccidenteGrave)} />
          <DeltaCard title="Req. Empresa Crítico" current={SC.requisitoEmpresaCrit} prev={SC.requisitoEmpresaCrit + 1} status={statusReq(SC.requisitoEmpresaCrit)} />
          <DeltaCard title="Acc. Inmediata No Crit." current={SC.accionInmediataNotCrit} prev={SC.accionInmediataNotCrit + 3} status="neutral" />
          <DeltaCard title="Req. Empresa No Crit." current={SC.requisitoEmpresaNotCrit} prev={SC.requisitoEmpresaNotCrit - 2} status="neutral" />
          <DeltaCard title="Solicitudes Vecinos" current={SC.solicitudesVecinos} prev={SC.solicitudesVecinos - 2} status="neutral" />
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Variant 3 — Gauge / Radial
// ──────────────────────────────────────────────────────────────────────────────
function Variant3() {
  const radialData = [
    { name: 'Acc. Grave', value: SC.accidenteGrave === 0 ? 100 : Math.max(0, 100 - SC.accidenteGrave * 50), fill: statusAccGrave(SC.accidenteGrave) === 'success' ? '#4CAF50' : '#EF4444' },
    { name: 'Acc. Inmediata Crítica', value: Math.max(0, 100 - SC.accionInmediataCrit * 5), fill: statusAccImm(SC.accionInmediataCrit) === 'success' ? '#4CAF50' : statusAccImm(SC.accionInmediataCrit) === 'warning' ? '#F59E0B' : '#EF4444' },
    { name: 'Feedback Neg.', value: Math.max(0, 100 - SC.feedbackNegCliente * 15), fill: statusFeedback(SC.feedbackNegCliente) === 'success' ? '#4CAF50' : statusFeedback(SC.feedbackNegCliente) === 'warning' ? '#F59E0B' : '#EF4444' },
    { name: 'Infracciones', value: SC.infracciones === 0 ? 100 : Math.max(0, 100 - SC.infracciones * 50), fill: statusInfrac(SC.infracciones) === 'success' ? '#4CAF50' : '#EF4444' },
  ]

  const avgScore = Math.round(radialData.reduce((s, d) => s + d.value, 0) / radialData.length)

  const compactList = [
    { label: 'Días sin Acc. Grave', value: SC.sinAccidenteGrave, status: statusSinAcc(SC.sinAccidenteGrave) },
    { label: 'Acc. Inmediata No Crit.', value: SC.accionInmediataNotCrit, status: 'neutral' as S },
    { label: 'Req. Empresa Crítico', value: SC.requisitoEmpresaCrit, status: statusReq(SC.requisitoEmpresaCrit) },
    { label: 'Req. Empresa No Crit.', value: SC.requisitoEmpresaNotCrit, status: 'neutral' as S },
    { label: 'Solicitudes Vecinos', value: SC.solicitudesVecinos, status: 'neutral' as S },
  ]

  const dotColor: Record<S, string> = { success: '#4CAF50', warning: '#F59E0B', danger: '#EF4444', neutral: '#6B7280' }

  return (
    <div className="space-y-6">
      {/* Estado General score */}
      <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-6 text-center">
        <div className="text-xs text-text-tertiary uppercase tracking-widest font-heading mb-2">Estado General</div>
        <div
          className="text-8xl font-bold font-heading leading-none"
          style={{ color: avgScore >= 70 ? '#4CAF50' : avgScore >= 50 ? '#F59E0B' : '#EF4444' }}
        >
          {avgScore}
        </div>
        <div className="text-sm text-text-tertiary mt-1">score de cumplimiento promedio</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radial bars */}
        <ChartCard title="Indicadores Críticos — Radial" subtitle="100 = óptimo">
          <ResponsiveContainer width="100%" height={260}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="20%"
              outerRadius="90%"
              data={radialData}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar
                dataKey="value"
                label={{ position: 'insideStart', fill: '#fff', fontSize: 10 }}
                background={{ fill: 'var(--bg-sunken)' }}
              />
              <Legend
                iconSize={10}
                layout="vertical"
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: 11 }}
              />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v}/100`, 'Score']} />
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Compact list */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold font-heading text-text-primary">Otros Indicadores</h3>
          {compactList.map((item) => (
            <div key={item.label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border-subtle bg-surface-elevated">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: dotColor[item.status] }} />
              <span className="flex-1 text-sm text-text-secondary">{item.label}</span>
              <span
                className="text-lg font-bold font-heading"
                style={{ color: dotColor[item.status] }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
export function SectionScorecard() {
  const [variant, setVariant] = useState<1 | 2 | 3>(1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold font-heading text-text-primary">Scorecard</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            {variant === 1 && 'Big Numbers RAG — semáforo por indicador'}
            {variant === 2 && 'Comparación períodos — actual vs mes anterior'}
            {variant === 3 && 'Gauge radial — score visual de cumplimiento'}
          </p>
        </div>
        <VariantSwitcher
          current={variant}
          onChange={setVariant}
          labels={['Big Numbers RAG', 'vs Período Ant.', 'Gauge Radial']}
        />
      </div>

      {variant === 1 && <Variant1 />}
      {variant === 2 && <Variant2 />}
      {variant === 3 && <Variant3 />}
    </div>
  )
}
