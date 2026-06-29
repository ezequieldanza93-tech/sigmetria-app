import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { calcularPrecioFinal, type PrecioCalculado } from '@/lib/billing/descuento'
import { OnboardingWizard } from './onboarding-wizard'

export interface DeepLink {
  planId: string
  planSlug: string
  planNombre: string
  ciclo: 'monthly' | 'annual'
  esFounderIntentado: boolean
  hayFounder: boolean
  precioCalculado: PrecioCalculado | null
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; ciclo?: string; fundador?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Si ya pertenece a una consultora, no necesita onboarding.
  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (membership) redirect('/dashboard/empresas')

  // Planes para el selector (catálogo) — service client para no depender de RLS.
  const service = createServiceClient()
  const { data: planes } = await service
    .from('plans')
    .select('id, nombre, slug, tipo, precio_mensual_neto, max_colaboradores, max_empresas, max_establecimientos, descripcion_corta')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true, nullsFirst: true })

  // Resolver deep-link desde searchParams
  let deepLink: DeepLink | null = null

  const params = await searchParams
  if (params.plan) {
    const planEncontrado = (planes ?? []).find(
      p => p.slug === params.plan && p.slug !== 'trial' && p.slug !== 'empresa',
    )

    if (planEncontrado) {
      // Validar ciclo
      const ciclo: 'monthly' | 'annual' =
        params.ciclo === 'annual' || params.ciclo === 'monthly'
          ? params.ciclo
          : 'monthly'

      // Validar intento Fundador (solo aplica a ciclo anual)
      const esFounderIntentado = params.fundador === '1' && ciclo === 'annual'

      // Verificar cupos disponibles si corresponde
      let hayFounder = false
      if (esFounderIntentado) {
        const { data: cuposRow } = await service
          .from('plans')
          .select(`
            founder_slots_total,
            founder_seed_taken,
            subscriptions!inner(id, is_founder)
          `)
          .eq('id', planEncontrado.id)
          .maybeSingle()

        if (cuposRow) {
          const tomados = Array.isArray(cuposRow.subscriptions)
            ? cuposRow.subscriptions.filter((s: { is_founder: boolean }) => s.is_founder).length
            : 0
          const disponibles =
            (cuposRow.founder_slots_total ?? 0) -
            (cuposRow.founder_seed_taken ?? 0) -
            tomados
          hayFounder = disponibles > 0
        }
      }

      // Calcular precio — Fundador solo si hay cupos efectivos
      const precioMensual =
        planEncontrado.precio_mensual_neto != null
          ? Number(planEncontrado.precio_mensual_neto)
          : null

      let precioCalculado: PrecioCalculado | null = null
      try {
        const resultado = calcularPrecioFinal(precioMensual, ciclo, esFounderIntentado && hayFounder)
        precioCalculado = resultado
      } catch {
        // monthly + founder lanza — dejamos null
      }

      deepLink = {
        planId: planEncontrado.id,
        planSlug: planEncontrado.slug,
        planNombre: planEncontrado.nombre,
        ciclo,
        esFounderIntentado,
        hayFounder,
        precioCalculado,
      }
    }
  }

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? null
  return (
    <OnboardingWizard
      userEmail={user.email ?? ''}
      fullName={fullName}
      planes={planes ?? []}
      deepLink={deepLink}
    />
  )
}
