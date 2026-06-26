import { redirect } from 'next/navigation'
import { getFinanzasAccess, getFinConfig } from '@/lib/finanzas/access'
import { rentabilidadPorCliente, getCockpitResumen } from '@/lib/queries/finanzas'
import { RentabilidadCliente } from '@/components/finanzas/rentabilidad-cliente'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Rentabilidad por cliente — Sigmetría HyS',
}

/** Valida que el query param tenga forma YYYY-MM; si no, devuelve undefined (= mes actual). */
function normalizarPeriodo(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value && /^\d{4}-\d{2}$/.test(value)) return value
  return undefined
}

/**
 * Rentabilidad por cliente: el ranking que le dice al consultor cuánto le deja
 * (o le cuesta) cada empresa-cliente en el mes, cruzando facturación contra el
 * costo real de atenderlo (gastos + movilidad + tiempo).
 *
 * Acceso: mismo gate que el resto del módulo Finanzas (rol full_access/developer
 * + plan con la feature 'finanzas'). El período se controla por ?periodo=YYYY-MM
 * (default: mes actual).
 */
export default async function RentabilidadPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string | string[] }>
}) {
  const acc = await getFinanzasAccess()
  if (!acc.consultoraId) redirect('/login')
  if (!acc.hasAccess) redirect('/dashboard')

  const { periodo: periodoRaw } = await searchParams
  const periodo = normalizarPeriodo(periodoRaw)

  const [config, filas, resumen] = await Promise.all([
    getFinConfig(acc.consultoraId),
    rentabilidadPorCliente(acc.consultoraId, periodo),
    getCockpitResumen(acc.consultoraId, periodo),
  ])

  return (
    <RentabilidadCliente
      filas={filas}
      resumen={resumen}
      periodo={resumen.periodo}
      moneda={config.moneda}
      locale={config.locale}
    />
  )
}
