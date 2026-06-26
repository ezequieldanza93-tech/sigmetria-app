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
import {
  CreditCard,
  Package,
  Activity,
  BarChart3,
  Plus,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  ArrowRight,
  Users,
  Star,
} from 'lucide-react'
import { KpiCard } from '@/components/analytics/kpi-card'
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_STYLE } from '@/components/analytics/chart-config'
import { formatMonto } from '@/lib/finanzas/format'
import type { FinCockpitResumen, FinRentabilidadCliente } from '@/lib/finanzas/types'

interface CockpitFinanzasProps {
  resumen: FinCockpitResumen
  /** Cliente con mejor margen del período (con actividad económica). */
  topCliente: FinRentabilidadCliente | null
  /** Cliente con peor margen del período. Null si hay 0 o 1 cliente con actividad. */
  peorCliente: FinRentabilidadCliente | null
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
 * Muestra de un vistazo cómo le va a la consultora este mes: facturación,
 * cobranzas (por cobrar / vencido), gastos, ganancia neta REAL y cuántos
 * clientes están en rojo. Suma un panel de "Atención" con CTAs según el estado
 * (no facturaste / te deben / vencimientos), el gráfico de gastos por categoría
 * y un mini-resumen de rentabilidad (mejor / peor cliente) que enlaza al detalle
 * en /dashboard/finanzas/rentabilidad.
 *
 * Todos los montos se formatean locale-aware con la moneda/locale que viene en
 * el resumen (derivados de fin_config). NUNCA hardcodear '$'.
 */
export function CockpitFinanzas({ resumen, topCliente, peorCliente }: CockpitFinanzasProps) {
  const {
    moneda,
    locale,
    gastosMes,
    gastosPorCategoria,
    inversionTotal,
    amortizacionMensual,
    ingresosMes,
    porCobrar,
    vencidoTotal,
    gananciaNeta,
    clientesEnRojo,
  } = resumen

  const fmt = (v: number) => formatMonto(v, moneda, locale)

  const sinDatos =
    gastosMes === 0 &&
    inversionTotal === 0 &&
    ingresosMes === 0 &&
    porCobrar === 0 &&
    vencidoTotal === 0

  const chartData = gastosPorCategoria.map((c, i) => ({
    nombre: c.nombre,
    total: c.total,
    color: c.color ?? CHART_COLORS[i % CHART_COLORS.length],
  }))

  // Bloques de atención: solo aparecen si hay algo que mirar.
  const noFacturoConGastos = ingresosMes === 0 && porCobrar === 0 && gastosMes > 0
  const teDeben = porCobrar > 0
  const hayVencido = vencidoTotal > 0
  const hayMiniRentabilidad = topCliente !== null

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

      {/* ── KPIs principales del mes ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard
          title="Facturado del mes"
          value={fmt(ingresosMes)}
          subtitle="Ingresos cobrados en el período"
          status={ingresosMes > 0 ? 'success' : 'neutral'}
          icon={<TrendingUp size={16} aria-hidden="true" />}
          animate={false}
        />
        <KpiCard
          title="Por cobrar"
          value={fmt(porCobrar)}
          subtitle={
            hayVencido
              ? `Incluye ${fmt(vencidoTotal)} vencido`
              : 'Comprobantes emitidos sin cobrar'
          }
          status={hayVencido ? 'danger' : porCobrar > 0 ? 'warning' : 'neutral'}
          icon={<Clock size={16} aria-hidden="true" />}
          animate={false}
        />
        <KpiCard
          title="Gastos del mes"
          value={fmt(gastosMes)}
          subtitle="Total registrado en el período"
          status={gastosMes > 0 ? 'danger' : 'neutral'}
          icon={<CreditCard size={16} aria-hidden="true" />}
          animate={false}
        />
        <KpiCard
          title="Ganancia neta"
          value={fmt(gananciaNeta)}
          subtitle="Facturado − gastos − amortización"
          status={gananciaNeta > 0 ? 'success' : gananciaNeta < 0 ? 'danger' : 'neutral'}
          icon={
            gananciaNeta < 0
              ? <TrendingDown size={16} aria-hidden="true" />
              : <BarChart3 size={16} aria-hidden="true" />
          }
          animate={false}
        />
      </div>

      {/* ── KPIs secundarios (patrimonio + alerta de rojos) ──── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          title="Inversión total"
          value={fmt(inversionTotal)}
          subtitle="Equipos e inversiones acumuladas"
          status="neutral"
          icon={<Package size={16} aria-hidden="true" />}
          size="sm"
          animate={false}
        />
        <KpiCard
          title="Amortización mensual"
          value={fmt(amortizacionMensual)}
          subtitle="Desgaste de inversiones por mes"
          status="neutral"
          icon={<Activity size={16} aria-hidden="true" />}
          size="sm"
          animate={false}
        />
        <KpiCard
          title="Clientes en rojo"
          value={clientesEnRojo}
          subtitle={
            clientesEnRojo > 0
              ? 'Te cuestan más de lo que facturan'
              : 'Ningún cliente con margen negativo'
          }
          status={clientesEnRojo > 0 ? 'danger' : 'success'}
          icon={<Users size={16} aria-hidden="true" />}
          size="sm"
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
              Empezá registrando un gasto o una factura para ver cómo se mueve la plata de tu consultora.
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

      {/* ── Atención: cosas que requieren acción ─────────────── */}
      {!sinDatos && (noFacturoConGastos || teDeben || hayVencido) && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hayVencido && (
            <AtencionCard
              tono="danger"
              icon={<AlertTriangle size={18} aria-hidden="true" />}
              titulo="Tenés cobros vencidos"
              detalle={`${fmt(vencidoTotal)} pasaron de fecha. Reclamalos antes de que se enfríen.`}
              href="/dashboard/finanzas/comprobantes?estado=vencida"
              cta="Ver vencidos"
            />
          )}
          {teDeben && (
            <AtencionCard
              tono="warning"
              icon={<Clock size={18} aria-hidden="true" />}
              titulo="Te deben plata"
              detalle={`${fmt(porCobrar)} emitidos esperando cobro. Seguí la cobranza de cerca.`}
              href="/dashboard/finanzas/comprobantes"
              cta="Ver por cobrar"
            />
          )}
          {noFacturoConGastos && (
            <AtencionCard
              tono="warning"
              icon={<TrendingDown size={18} aria-hidden="true" />}
              titulo="Cargaste gastos pero no facturaste"
              detalle="Este mes gastaste pero todavía no registraste ingresos. ¿Te quedó alguna factura sin cargar?"
              href="/dashboard/finanzas/comprobantes"
              cta="Cargar facturación"
            />
          )}
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
                tickFormatter={(v: number) => fmt(v)}
                width={88}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                cursor={{ fill: 'var(--border-subtle)', opacity: 0.4 }}
                formatter={(value: number) => [fmt(value), 'Total']}
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

      {/* ── Mini-resumen de rentabilidad por cliente ─────────── */}
      <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary">Rentabilidad por cliente</h2>
          <Link
            href="/dashboard/finanzas/rentabilidad"
            className="inline-flex items-center gap-1 text-xs font-semibold text-sig-600 hover:text-sig-700"
          >
            Ver detalle
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {!hayMiniRentabilidad ? (
          <p className="text-sm text-text-tertiary">
            Cuando registres facturación o gastos por cliente, vas a ver acá quién te conviene y quién te cuesta.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ClienteRentabilidad
              tipo="mejor"
              cliente={topCliente}
              moneda={moneda}
              locale={locale}
            />
            {peorCliente && peorCliente.empresaId !== topCliente?.empresaId ? (
              <ClienteRentabilidad
                tipo="peor"
                cliente={peorCliente}
                moneda={moneda}
                locale={locale}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border-subtle bg-surface-base p-4 flex items-center text-xs text-text-tertiary">
                Necesitás al menos dos clientes con actividad para comparar.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Tarjeta de acción del panel de "Atención". */
function AtencionCard({
  tono,
  icon,
  titulo,
  detalle,
  href,
  cta,
}: {
  tono: 'danger' | 'warning'
  icon: React.ReactNode
  titulo: string
  detalle: string
  href: string
  cta: string
}) {
  const estilos =
    tono === 'danger'
      ? { border: 'border-l-[#EF4444]', bg: 'bg-[rgba(239,68,68,0.06)]', icon: 'text-[#EF4444]' }
      : { border: 'border-l-[#F59E0B]', bg: 'bg-[rgba(245,158,11,0.06)]', icon: 'text-[#F59E0B]' }

  return (
    <div
      className={`rounded-xl border border-border-subtle border-l-4 ${estilos.border} ${estilos.bg} p-4 flex flex-col gap-2`}
    >
      <div className="flex items-start gap-2">
        <span className={`shrink-0 ${estilos.icon}`}>{icon}</span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-text-primary leading-tight">{titulo}</h3>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">{detalle}</p>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs font-semibold text-sig-600 hover:text-sig-700 self-start"
      >
        {cta}
        <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </div>
  )
}

/** Tarjeta de mejor/peor cliente del mini-resumen de rentabilidad. */
function ClienteRentabilidad({
  tipo,
  cliente,
  moneda,
  locale,
}: {
  tipo: 'mejor' | 'peor'
  cliente: FinRentabilidadCliente
  moneda: string
  locale: string
}) {
  const esMejor = tipo === 'mejor'
  const margenNegativo = cliente.margen < 0
  const margenColor = margenNegativo
    ? 'text-[#EF4444]'
    : cliente.margen > 0
      ? 'text-[#4CAF50]'
      : 'text-text-primary'

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-base p-4 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className={esMejor ? 'text-sig-500' : 'text-[#EF4444]'}>
          {esMejor ? <Star size={15} aria-hidden="true" /> : <TrendingDown size={15} aria-hidden="true" />}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary font-heading">
          {esMejor ? 'Mejor cliente' : 'Cliente a revisar'}
        </span>
      </div>
      <p className="text-sm font-semibold text-text-primary leading-tight truncate" title={cliente.razonSocial}>
        {cliente.razonSocial}
      </p>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-text-tertiary">Margen del mes</span>
        <span className={`text-base font-bold font-heading tabular-nums ${margenColor}`}>
          {formatMonto(cliente.margen, moneda, locale)}
        </span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
        {VEREDICTO_LABEL[cliente.veredicto]}
      </span>
    </div>
  )
}

const VEREDICTO_LABEL: Record<FinRentabilidadCliente['veredicto'], string> = {
  estrella: 'Estrella',
  rentable: 'Rentable',
  justo: 'Margen justo',
  rojo: 'En rojo',
}
