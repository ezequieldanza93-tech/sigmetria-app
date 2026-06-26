import { redirect } from 'next/navigation'
import { getFinanzasAccess } from '@/lib/finanzas/access'
import { getCockpitResumen, rentabilidadPorCliente } from '@/lib/queries/finanzas'
import { CockpitFinanzas } from '@/components/finanzas/cockpit-finanzas'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Finanzas — Sigmetría HyS',
}

/**
 * Cockpit financiero de la consultora (home del módulo Finanzas).
 *
 * Acceso: solo roles full_access (o developer/superadmin) con el plan que
 * habilita la feature 'finanzas'. El gate completo (rol + plan) lo resuelve
 * getFinanzasAccess; si falta el rol o el plan, se redirige a /dashboard.
 *
 * Trae en paralelo el resumen del mes y la rentabilidad por cliente (esta
 * última solo para el mini-resumen top/peor cliente del cockpit; la vista
 * completa vive en /dashboard/finanzas/rentabilidad).
 */
export default async function FinanzasPage() {
  const acc = await getFinanzasAccess()
  if (!acc.consultoraId) redirect('/login')
  if (!acc.hasAccess) redirect('/dashboard')

  const [resumen, rentabilidad] = await Promise.all([
    getCockpitResumen(acc.consultoraId),
    rentabilidadPorCliente(acc.consultoraId),
  ])

  // rentabilidadPorCliente viene ordenada por mayor margen primero: el primero
  // con facturación es el mejor; el último, el peor. Solo se muestran clientes
  // que tuvieron actividad económica en el período (facturado o gastos).
  const conActividad = rentabilidad.filter(
    (r) => r.facturado > 0 || r.gastosImputados > 0,
  )
  const topCliente = conActividad[0] ?? null
  const peorCliente =
    conActividad.length > 1 ? conActividad[conActividad.length - 1] : null

  return (
    <CockpitFinanzas
      resumen={resumen}
      topCliente={topCliente}
      peorCliente={peorCliente}
    />
  )
}
