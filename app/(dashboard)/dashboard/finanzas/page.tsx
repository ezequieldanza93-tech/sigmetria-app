import { redirect } from 'next/navigation'
import { getFinanzasAccess } from '@/lib/finanzas/access'
import { getCockpitResumen } from '@/lib/queries/finanzas'
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
 */
export default async function FinanzasPage() {
  const acc = await getFinanzasAccess()
  if (!acc.consultoraId) redirect('/login')
  if (!acc.hasAccess) redirect('/dashboard')

  const resumen = await getCockpitResumen(acc.consultoraId)

  return <CockpitFinanzas resumen={resumen} />
}
