'use client'

import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { CreditCard, Package, Activity, BarChart3, Plus, Sparkles } from 'lucide-react'
import { KpiCard } from '@/components/analytics/kpi-card'
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_STYLE } from '@/components/analytics/chart-config'
import { formatMonto } from '@/lib/finanzas/format'
import type { FinCockpitResumen } from '@/lib/finanzas/types'

interface CockpitFinanzasProps {
  resumen: FinCockpitResumen
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Convierte 'YYYY-MM' a un título humano: "agosto 2026". */
function periodoHumano(periodo: string): string {
  const [y, m] = periodo.split('-')
  const idx = Number(m) - 1
  const mes = MESES[idx] ?? m
  return `${mes} ${y}`
}

/**
 * Cockpit financiero (home del módulo Finanzas de la consultora).
 *
 * Versión base de esta fase: KPIs del mes (gastos, inversión, amortización) +
 * un placeholder de ganancia neta, un gráfico de gastos por categoría y un
 * bloque de "Atención" con CTA cuando todavía no se cargó nada. Facturación y
 * rentabilidad llegan en fases siguientes (placeholders "Próximamente").
 *
 * Todos los montos se formatean locale-aware con la moneda/locale que viene en
 * el resumen (derivados de fin_config). NUNCA hardcodear '$'.
 */
export function CockpitFinanzas({ resumen }: CockpitFinanzasProps) {
  const { moneda, locale, gastosMes, gastosPorCategoria, inversionTotal, amortizacionMensual } = resumen
  const sinDatos = gastosMes === 0 && inversionTotal === 0

  const chartData = gastosPorCategoria.map((c, i) => ({
    nombre: c.nombre,
    total: c.total,
    color: c.color ?? CHART_COLORS[i % CHART_COLORS.length],
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* ── Encabezado ───────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <CreditCard size={22} className="text-sig-500" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-text-primary">Finanzas</h1>
        </div>
        <p className="text-sm text-text-secondary mt-1">
          Cómo le va a tu consultora este mes — {periodoHumano(resumen.periodo)}
        </p>
      </div>

      {/* ── KPIs del mes ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Gastos del mes"
          value={formatMonto(gastosMes, moneda, locale)}
          subtitle="Total registrado en el período"
          status={gastosMes > 0 ? 'danger' : 'neutral'}
          icon={<CreditCard size={16} aria-hidden="true" />}
          animate={false}
        />
        <KpiCard
          title="Inversión total"
          value={formatMonto(inversionTotal, moneda, locale)}
          subtitle="Equipos e inversiones acumuladas"
          status="neutral"
          icon={<Package size={16} aria-hidden="true" />}
          animate={false}
        />
        <KpiCard
          title="Amortización mensual"
          value={formatMonto(amortizacionMensual, moneda, locale)}
          subtitle="Desgaste de inversiones por mes"
          status="neutral"
          icon={<Activity size={16} aria-hidden="true" />}
          animate={false}
        />
        <KpiCard
          title="Ganancia neta"
          value="Pronto"
          subtitle="Llega con Facturación"
          status="neutral"
          icon={<BarChart3 size={16} aria-hidden="true" />}
          animate={false}
        />
      </div>

      {/* ── Bloque de atención: sin datos todavía ────────────── */}
      {sinDatos && (
        <div className="mb-6 rounded-xl border border-border-subtle bg-surface-elevated p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sig-50 text-sig-600">
            <Sparkles size={22} aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-text-primary">Todavía no cargaste nada</h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Empezá registrando un gasto para ver cómo se mueve la plata de tu consultora.
            </p>
          </div>
          <Link
            href="/dashboard/finanzas/gastos"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sig-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sig-600 shrink-0"
          >
            <Plus size={16} aria-hidden="true" />
            Cargá tu primer gasto
          </Link>
        </div>
      )}

      {/* ── Gráfico de gastos por categoría ──────────────────── */}
      <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary">Gastos por categoría</h2>
          <span className="text-[11px] text-text-tertiary uppercase tracking-widest font-heading">
            {periodoHumano(resumen.periodo)}
          </span>
        </div>

        {chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-text-tertiary">No hay gastos en este mes para mostrar.</p>
            <Link
              href="/dashboard/finanzas/gastos"
              className="text-sm font-medium text-sig-600 hover:text-sig-700"
            >
              Cargar un gasto
            </Link>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="nombre" {...AXIS_STYLE} interval={0} />
              <YAxis
                {...AXIS_STYLE}
                tickFormatter={(v: number) => formatMonto(v, moneda, locale)}
                width={88}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                cursor={{ fill: 'var(--border-subtle)', opacity: 0.4 }}
                formatter={(value: number) => [formatMonto(value, moneda, locale), 'Total']}
              />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={64}>
                {chartData.map((entry) => (
                  <Cell key={entry.nombre} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Próximamente: facturación y rentabilidad ─────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ProximamenteCard
          titulo="Facturación"
          descripcion="Cargá tus facturas e ingresos por cliente para ver tu facturación real."
        />
        <ProximamenteCard
          titulo="Rentabilidad"
          descripcion="Cruzá ingresos y gastos por empresa para saber qué cliente te conviene."
        />
      </div>
    </div>
  )
}

function ProximamenteCard({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border-subtle bg-surface-base p-5">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-sm font-semibold text-text-secondary">{titulo}</h3>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-sig-600 bg-sig-50 rounded-full px-2 py-0.5">
          Próximamente
        </span>
      </div>
      <p className="text-xs text-text-tertiary leading-relaxed">{descripcion}</p>
    </div>
  )
}
