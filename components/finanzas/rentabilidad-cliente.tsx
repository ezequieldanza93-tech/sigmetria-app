'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users,
  Megaphone,
  TrendingUp,
  MapPin,
  Gauge,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { KpiCard } from '@/components/analytics/kpi-card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatMonto, formatNumero } from '@/lib/finanzas/format'
import type {
  FinRentabilidadCliente,
  FinVeredictoCliente,
  FinCockpitResumen,
} from '@/lib/finanzas/types'

interface Props {
  filas: FinRentabilidadCliente[]
  resumen: FinCockpitResumen
  /** Período evaluado, formato YYYY-MM. */
  periodo: string
  moneda: string
  locale: string
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

/** Genera las últimas N opciones de período (mes calendario) terminando en `hasta`. */
function ultimosPeriodos(hasta: string, cantidad: number): string[] {
  const [yStr, mStr] = hasta.split('-')
  const out: string[] = []
  let y = Number(yStr)
  let m = Number(mStr) // 1-12
  for (let i = 0; i < cantidad; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  return out
}

// ── Veredicto: copy + estilos del chip ──────────────────────────────────────

const VEREDICTO_META: Record<
  FinVeredictoCliente,
  { emoji: string; label: string; chip: string }
> = {
  estrella: {
    emoji: '🟢',
    label: 'Estrella',
    chip: 'bg-[rgba(76,175,80,0.12)] text-[#2E7D32] border-[rgba(76,175,80,0.3)]',
  },
  rentable: {
    emoji: '🟢',
    label: 'Rentable',
    chip: 'bg-[rgba(76,175,80,0.10)] text-[#388E3C] border-[rgba(76,175,80,0.25)]',
  },
  justo: {
    emoji: '🟡',
    label: 'Justo',
    chip: 'bg-[rgba(245,158,11,0.12)] text-[#B45309] border-[rgba(245,158,11,0.3)]',
  },
  rojo: {
    emoji: '🔴',
    label: 'Te cuesta plata',
    chip: 'bg-[rgba(239,68,68,0.12)] text-[#C62828] border-[rgba(239,68,68,0.3)]',
  },
}

function VeredictoChip({ veredicto }: { veredicto: FinVeredictoCliente }) {
  const m = VEREDICTO_META[veredicto]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${m.chip}`}
    >
      <span aria-hidden="true">{m.emoji}</span>
      {m.label}
    </span>
  )
}

// ── Detalle expandido del cálculo de una fila ───────────────────────────────

function DetalleCalculo({
  fila,
  moneda,
  locale,
}: {
  fila: FinRentabilidadCliente
  moneda: string
  locale: string
}) {
  const costoAtencion = fila.gastosImputados + fila.costoMovilidad + fila.costoTiempo
  const filasDetalle: { label: string; valor: string; signo: '+' | '−'; hint?: string }[] = [
    {
      label: 'Facturado',
      valor: formatMonto(fila.facturado, moneda, locale),
      signo: '+',
      hint: 'Comprobantes emitidos o cobrados en el período',
    },
    {
      label: 'Gastos imputados',
      valor: formatMonto(fila.gastosImputados, moneda, locale),
      signo: '−',
      hint: 'Gastos cargados a este cliente en el período',
    },
    {
      label: 'Movilidad',
      valor: formatMonto(fila.costoMovilidad, moneda, locale),
      signo: '−',
      hint: `${formatNumero(fila.km, locale, fila.km % 1 === 0 ? 0 : 1)} km recorridos`,
    },
    {
      label: 'Tiempo del consultor',
      valor: formatMonto(fila.costoTiempo, moneda, locale),
      signo: '−',
      hint: `${formatNumero(fila.recorridas, locale)} recorrida${fila.recorridas === 1 ? '' : 's'} × 3 h`,
    },
  ]

  return (
    <div className="bg-surface-sunken px-4 py-4 sm:px-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Desglose del cálculo */}
        <div className="space-y-1.5">
          {filasDetalle.map((d) => (
            <div
              key={d.label}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="text-text-secondary">
                <span
                  className={`mr-1.5 font-mono font-bold ${
                    d.signo === '+' ? 'text-[#388E3C]' : 'text-[#C62828]'
                  }`}
                >
                  {d.signo}
                </span>
                {d.label}
                {d.hint && (
                  <span className="ml-1.5 text-[11px] text-text-tertiary">({d.hint})</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-text-primary">{d.valor}</span>
            </div>
          ))}
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border-default pt-2 text-sm font-bold">
            <span className="text-text-primary">
              = Margen{' '}
              <span className="font-normal text-text-tertiary">
                (te queda después de atenderlo)
              </span>
            </span>
            <span
              className={`shrink-0 tabular-nums ${
                fila.margen < 0 ? 'text-[#C62828]' : 'text-[#2E7D32]'
              }`}
            >
              {formatMonto(fila.margen, moneda, locale)}
            </span>
          </div>
        </div>

        {/* Lectura humana */}
        <div className="flex flex-col justify-center rounded-lg border border-border-subtle bg-surface-elevated p-4">
          <p className="text-sm leading-relaxed text-text-secondary">
            Atender a <span className="font-semibold text-text-primary">{fila.razonSocial}</span>{' '}
            te costó{' '}
            <span className="font-semibold text-text-primary">
              {formatMonto(costoAtencion, moneda, locale)}
            </span>{' '}
            este mes (gastos + movilidad + tu tiempo).{' '}
            {fila.margen < 0 ? (
              <>
                Como facturaste{' '}
                <span className="font-semibold">{formatMonto(fila.facturado, moneda, locale)}</span>,
                estás <span className="font-semibold text-[#C62828]">perdiendo plata</span> con
                este cliente.
              </>
            ) : fila.facturado === 0 ? (
              <>
                Todavía no hay facturación cargada para sacar conclusiones.
              </>
            ) : (
              <>
                Frente a los{' '}
                <span className="font-semibold">{formatMonto(fila.facturado, moneda, locale)}</span>{' '}
                que facturaste, te queda un margen de{' '}
                <span className="font-semibold text-[#2E7D32]">
                  {formatMonto(fila.margen, moneda, locale)}
                </span>
                .
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Vista principal ──────────────────────────────────────────────────────────

export function RentabilidadCliente({ filas, resumen, periodo, moneda, locale }: Props) {
  const router = useRouter()
  const [expandido, setExpandido] = useState<string | null>(null)

  // Solo evaluamos clientes con algo de movimiento (facturación, gastos o recorridas).
  // Los demás (cargados pero sin actividad este mes) no aportan ruido al ranking.
  const conMovimiento = filas.filter(
    (f) => f.facturado !== 0 || f.gastosImputados !== 0 || f.recorridas !== 0,
  )

  const periodoOptions = ultimosPeriodos(resumen.periodo, 12)
  // Aseguramos que el período actualmente visto esté presente aunque sea viejo.
  if (!periodoOptions.includes(periodo)) periodoOptions.unshift(periodo)

  function cambiarPeriodo(nuevo: string) {
    router.push(`/dashboard/finanzas/rentabilidad?periodo=${nuevo}`)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* ── Encabezado ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={22} className="text-sig-500" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-text-primary">Rentabilidad por cliente</h1>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Esto es lo que te deja cada cliente este mes — {periodoHumano(periodo)}.
          </p>
        </div>

        {/* Selector de período */}
        <label className="flex items-center gap-2 text-sm">
          <span className="text-text-tertiary">Período</span>
          <select
            value={periodo}
            onChange={(e) => cambiarPeriodo(e.target.value)}
            className="rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-sm text-text-primary focus:border-sig-500 focus:outline-none focus:ring-2 focus:ring-sig-500/20"
          >
            {periodoOptions.map((p) => (
              <option key={p} value={p}>
                {periodoHumano(p)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Bloque Marketing / CAC ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Inversión en marketing"
          value={formatMonto(resumen.marketingMes, moneda, locale)}
          subtitle="Lo que pusiste en captar clientes este mes"
          status={resumen.marketingMes > 0 ? 'warning' : 'neutral'}
          icon={<Megaphone size={16} aria-hidden="true" />}
          animate={false}
        />
        <KpiCard
          title="Costo por cliente nuevo (CAC)"
          value={formatMonto(resumen.cacAprox, moneda, locale)}
          subtitle="Cuánto te salió cada cliente que entró"
          status="neutral"
          icon={<Users size={16} aria-hidden="true" />}
          animate={false}
        />
        <KpiCard
          title="Clientes que te cuestan plata"
          value={formatNumero(resumen.clientesEnRojo, locale)}
          subtitle="Margen negativo este mes"
          status={resumen.clientesEnRojo > 0 ? 'danger' : 'success'}
          icon={<TrendingUp size={16} aria-hidden="true" />}
          animate={false}
        />
      </div>

      {/* ── Ranking ─────────────────────────────────────────── */}
      {conMovimiento.length === 0 ? (
        <EmptyState
          variant="generic"
          title="Todavía no hay nada para calcular"
          description="Para saber qué te deja cada cliente necesitás cargar facturación y gastos imputados a la empresa. Con eso cruzamos los ingresos contra el costo real de atender a cada uno y armamos el ranking."
          action={{ label: 'Cargar un gasto', href: '/dashboard/finanzas/gastos' }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-xs uppercase tracking-wider text-text-tertiary">
                <tr>
                  <th className="px-3 py-2.5 text-left">Cliente</th>
                  <th className="px-3 py-2.5 text-right">Facturado</th>
                  <th className="hidden px-3 py-2.5 text-right sm:table-cell">Recorridas</th>
                  <th className="hidden px-3 py-2.5 text-right md:table-cell">Km</th>
                  <th className="hidden px-3 py-2.5 text-right md:table-cell">Costo de atención</th>
                  <th className="px-3 py-2.5 text-right">Margen</th>
                  <th className="px-3 py-2.5 text-left">Veredicto</th>
                  <th className="px-3 py-2.5 text-right" aria-label="Detalle" />
                </tr>
              </thead>
              <tbody>
                {conMovimiento.map((fila) => {
                  const abierto = expandido === fila.empresaId
                  const costoAtencion =
                    fila.gastosImputados + fila.costoMovilidad + fila.costoTiempo
                  return (
                    <FilaCliente
                      key={fila.empresaId}
                      fila={fila}
                      abierto={abierto}
                      costoAtencion={costoAtencion}
                      moneda={moneda}
                      locale={locale}
                      onToggle={() =>
                        setExpandido((prev) => (prev === fila.empresaId ? null : fila.empresaId))
                      }
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Nota metodológica ───────────────────────────────── */}
      {conMovimiento.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-dashed border-border-subtle bg-surface-base px-4 py-3 text-xs leading-relaxed text-text-tertiary">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-sig-500" aria-hidden="true" />
          <p>
            El <span className="font-medium text-text-secondary">margen</span> cruza lo que
            facturaste contra el costo real de atender: gastos imputados, movilidad (km × costo por
            km) y tu tiempo (3 h por recorrida × costo por hora). Configurá tus costos por km y por
            hora en{' '}
            <Link
              href="/dashboard/finanzas/configuracion"
              className="font-medium text-sig-600 hover:text-sig-700"
            >
              Configuración
            </Link>{' '}
            para que el cálculo sea más fino.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Fila de cliente (con expansión) ─────────────────────────────────────────

function FilaCliente({
  fila,
  abierto,
  costoAtencion,
  moneda,
  locale,
  onToggle,
}: {
  fila: FinRentabilidadCliente
  abierto: boolean
  costoAtencion: number
  moneda: string
  locale: string
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-t border-border-subtle transition-colors hover:bg-surface-sunken"
        onClick={onToggle}
        aria-expanded={abierto}
      >
        <td className="px-3 py-2.5">
          <span className="block max-w-[16rem] truncate font-medium text-text-primary">
            {fila.razonSocial}
          </span>
          {/* En mobile, recorridas/km viven acá como sub-línea. */}
          <span className="text-[11px] text-text-tertiary sm:hidden">
            {formatNumero(fila.recorridas, locale)} recorridas ·{' '}
            {formatNumero(fila.km, locale, fila.km % 1 === 0 ? 0 : 1)} km
          </span>
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-text-primary">
          {formatMonto(fila.facturado, moneda, locale)}
        </td>
        <td className="hidden px-3 py-2.5 text-right tabular-nums text-text-secondary sm:table-cell">
          <span className="inline-flex items-center justify-end gap-1">
            <Gauge size={13} className="text-text-tertiary" aria-hidden="true" />
            {formatNumero(fila.recorridas, locale)}
          </span>
        </td>
        <td className="hidden px-3 py-2.5 text-right tabular-nums text-text-secondary md:table-cell">
          <span className="inline-flex items-center justify-end gap-1">
            <MapPin size={13} className="text-text-tertiary" aria-hidden="true" />
            {formatNumero(fila.km, locale, fila.km % 1 === 0 ? 0 : 1)}
          </span>
        </td>
        <td className="hidden px-3 py-2.5 text-right tabular-nums text-text-secondary md:table-cell">
          {formatMonto(costoAtencion, moneda, locale)}
        </td>
        <td
          className={`px-3 py-2.5 text-right font-bold tabular-nums ${
            fila.margen < 0 ? 'text-[#C62828]' : 'text-[#2E7D32]'
          }`}
        >
          {formatMonto(fila.margen, moneda, locale)}
        </td>
        <td className="px-3 py-2.5">
          <VeredictoChip veredicto={fila.veredicto} />
        </td>
        <td className="px-3 py-2.5 text-right">
          <span className="inline-flex text-text-tertiary" aria-hidden="true">
            {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </td>
      </tr>
      {abierto && (
        <tr className="border-t border-border-subtle">
          <td colSpan={8} className="p-0">
            <DetalleCalculo fila={fila} moneda={moneda} locale={locale} />
          </td>
        </tr>
      )}
    </>
  )
}
