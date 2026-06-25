import type { createClient } from '@/lib/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Recursos cuyo cupo controla el plan de la consultora.
 * Coinciden con el parámetro `p_resource` de la función SQL `check_plan_limit`.
 */
export type PlanLimitResource = 'empresas' | 'establecimientos' | 'gestiones_registros' | 'horarios'

/**
 * Forma del JSONB que devuelve la función SQL `public.check_plan_limit`.
 * `current`/`max` solo vienen cuando hay un límite numérico evaluado.
 */
export interface PlanLimitCheck {
  allowed: boolean
  reason?: string
  current?: number
  max?: number
  resource?: string
}

const RESOURCE_LABELS: Record<PlanLimitResource, { articulo: string; singular: string; plural: string }> = {
  empresas: { articulo: 'la', singular: 'empresa', plural: 'empresas' },
  establecimientos: { articulo: 'el', singular: 'establecimiento', plural: 'establecimientos' },
  gestiones_registros: { articulo: 'la', singular: 'gestión', plural: 'gestiones' },
  horarios: { articulo: 'el', singular: 'horario', plural: 'horarios' },
}

/**
 * Pre-chequeo de cupo del plan ANTES de insertar. Reutiliza la función SQL
 * `check_plan_limit` (la misma lógica que el trigger BEFORE INSERT, que sigue
 * siendo la red de seguridad dura). Esto solo existe para poder devolver un
 * mensaje prolijo y accionable en vez de la excepción cruda del trigger.
 *
 * `null` en el límite del plan = ilimitado → la función SQL devuelve allowed=true.
 */
export async function checkPlanLimit(
  supabase: ServerClient,
  consultoraId: string,
  resource: PlanLimitResource,
): Promise<PlanLimitCheck> {
  const { data, error } = await supabase.rpc('check_plan_limit', {
    p_consultora_id: consultoraId,
    p_resource: resource,
  })

  // Si el pre-chequeo falla por cualquier motivo, NO bloqueamos el alta:
  // dejamos pasar y que el trigger de base decida (red de seguridad).
  if (error || data == null || typeof data !== 'object') {
    return { allowed: true }
  }

  return data as PlanLimitCheck
}

/**
 * Mensaje amable y accionable para mostrar al usuario cuando el pre-chequeo
 * rechaza la creación. Español rioplatense.
 */
export function planLimitMessage(check: PlanLimitCheck, resource: PlanLimitResource): string {
  const labels = RESOURCE_LABELS[resource]

  switch (check.reason) {
    case 'limit_reached': {
      const max = check.max
      const cupo = typeof max === 'number'
        ? ` (${max} ${max === 1 ? labels.singular : labels.plural})`
        : ''
      return `Llegaste al límite de ${labels.plural} de tu plan${cupo}. Subí de plan para agregar más, desde Suscripción → Cambiar plan (/dashboard/billing/cambiar-plan).`
    }
    case 'no_subscription':
      return 'No encontramos una suscripción activa para tu consultora. Activá un plan desde Suscripción → Cambiar plan (/dashboard/billing/cambiar-plan).'
    case 'trial_view_only':
      return 'Tu prueba gratis venció y la cuenta quedó en solo lectura. Activá un plan para volver a crear, desde Suscripción → Cambiar plan (/dashboard/billing/cambiar-plan).'
    case 'expired':
    case 'canceled':
      return 'Tu suscripción no está activa, así que la cuenta está en solo lectura. Reactivá un plan desde Suscripción → Cambiar plan (/dashboard/billing/cambiar-plan).'
    default:
      return `No pudimos crear ${labels.articulo} ${labels.singular} por un límite de tu plan. Revisá tu suscripción desde Suscripción → Cambiar plan (/dashboard/billing/cambiar-plan).`
  }
}
