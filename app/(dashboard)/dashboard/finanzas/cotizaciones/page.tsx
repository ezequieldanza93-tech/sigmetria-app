import { redirect } from 'next/navigation'
import { getFinanzasAccess, getFinConfig } from '@/lib/finanzas/access'
import { listarCotizaciones } from '@/lib/queries/cotizaciones'
import { listarFormasPago } from '@/lib/queries/finanzas-formas-pago'
import { createClient } from '@/lib/supabase/server'
import { CotizacionesCliente } from '@/components/finanzas/cotizaciones-cliente'

export const dynamic = 'force-dynamic'

export default async function CotizacionesPage() {
  // Gate server-side espejo de la RLS de fin_*: solo full_access (o developer)
  // y con el plan 'finanzas' habilitado. Defensa en profundidad.
  const acc = await getFinanzasAccess()
  if (!acc.consultoraId) redirect('/login')
  if (!acc.hasAccess) redirect('/dashboard')

  const supabase = await createClient()
  const [cotizaciones, config, formasPago, empresasResult, leadsResult] = await Promise.all([
    listarCotizaciones(acc.consultoraId),
    getFinConfig(acc.consultoraId),
    listarFormasPago(acc.consultoraId),
    supabase
      .from('empresas')
      .select('id, razon_social')
      .eq('consultora_id', acc.consultoraId)
      .eq('is_active', true)
      .order('razon_social'),
    supabase
      .from('leads')
      .select('id, nombre, servicios_interes')
      .eq('consultora_id', acc.consultoraId)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const empresas = (empresasResult.data ?? []).map((e) => ({
    id: e.id as string,
    razon_social: (e.razon_social as string | null) ?? 'Sin nombre',
  }))

  const leads = (leadsResult.data ?? []).map((l) => ({
    id: l.id as string,
    nombre: (l.nombre as string | null) ?? 'Lead sin nombre',
    serviciosInteres: (l.servicios_interes as string[] | null) ?? null,
  }))

  return (
    <CotizacionesCliente
      cotizacionesIniciales={cotizaciones}
      empresas={empresas}
      leads={leads}
      formasPagoIniciales={formasPago}
      moneda={config.moneda}
      locale={config.locale}
    />
  )
}
