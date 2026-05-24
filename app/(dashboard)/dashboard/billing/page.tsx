import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ManualPaymentForm } from './manual-payment-form'
import { AddOnSeatForm } from './add-on-seat-form'

type SubscriptionEstado =
  | 'trialing' | 'trial_view_only' | 'active'
  | 'past_due' | 'grace_period' | 'canceled' | 'expired'

const ESTADO_LABELS: Record<SubscriptionEstado, string> = {
  trialing: 'En período de prueba',
  trial_view_only: 'Trial vencido (solo lectura)',
  active: 'Activa',
  past_due: 'Vencida',
  grace_period: 'Período de gracia',
  canceled: 'Cancelada',
  expired: 'Expirada',
}

const ESTADO_COLORS: Record<SubscriptionEstado, string> = {
  trialing: 'text-blue-600 bg-blue-50 border-blue-200',
  trial_view_only: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  active: 'text-green-700 bg-green-50 border-green-200',
  past_due: 'text-orange-700 bg-orange-50 border-orange-200',
  grace_period: 'text-orange-700 bg-orange-50 border-orange-200',
  canceled: 'text-red-700 bg-red-50 border-red-200',
  expired: 'text-zinc-600 bg-zinc-50 border-zinc-200',
}

function formatARS(value: number | null) {
  if (value == null) return 'Consultar'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) redirect('/dashboard')

  const isMainAdmin = membership.role === 'full_access_main'

  const admin = createAdminClient()

  const [{ data: sub }, { data: plans }, { data: planFeatures }, { data: membersCount }, { data: consultora }] = await Promise.all([
    admin
      .from('subscriptions')
      .select(`
        id, estado, periodo, trial_ends_at, current_period_end, grace_period_ends_at,
        plans ( id, nombre, slug, precio_mensual_neto, precio_anual_neto, iva_porcentaje, max_colaboradores, precio_extra_seat_neto )
      `)
      .eq('consultora_id', membership.consultora_id)
      .single(),
    admin
      .from('plans')
      .select('id, nombre, slug, tipo, precio_mensual_neto, precio_anual_neto, iva_porcentaje, max_colaboradores, max_empresas, max_establecimientos, max_gestiones_registros, max_horarios_registros, descripcion_corta, destacado, sort_order, precio_extra_seat_neto')
      .eq('is_active', true)
      .eq('is_visible', true)
      .order('sort_order', { ascending: true }),
    admin
      .from('plan_features')
      .select('plan_id, feature_key, habilitado'),
    admin
      .from('consultoras_members')
      .select('id', { count: 'exact', head: true })
      .eq('consultora_id', membership.consultora_id)
      .eq('is_active', true),
    admin
      .from('consultoras')
      .select('seats_max')
      .eq('id', membership.consultora_id)
      .single(),
  ])

  const featuresByPlan: Record<string, Record<string, boolean>> = {}
  if (planFeatures) {
    for (const pf of planFeatures) {
      if (!featuresByPlan[pf.plan_id]) featuresByPlan[pf.plan_id] = {}
      featuresByPlan[pf.plan_id][pf.feature_key] = pf.habilitado
    }
  }

  const estado = sub?.estado as SubscriptionEstado | undefined
  const currentPlan = sub?.plans as unknown as {
    id: string; nombre: string; slug: string
    precio_mensual_neto: number | null; precio_anual_neto: number | null; iva_porcentaje: number
    max_colaboradores: number | null; precio_extra_seat_neto: number | null
  } | null

  const seatsMax = consultora?.seats_max ?? 0
  const seatsUsed = (membersCount as unknown as number) ?? 0

  const needsUpgrade = estado && ['trialing', 'trial_view_only', 'past_due', 'grace_period', 'canceled', 'expired'].includes(estado)
  const canAddSeats = isMainAdmin
    && estado === 'active'
    && currentPlan?.precio_extra_seat_neto != null

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Suscripción y Facturación</h1>
        <p className="text-sm text-text-tertiary mt-1">Gestioná el plan de tu consultora</p>
      </div>

      {/* Estado actual */}
      {sub && estado && (
        <div className={`rounded-xl border p-5 ${ESTADO_COLORS[estado]}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Estado actual</p>
              <p className="text-lg font-bold mt-0.5">{ESTADO_LABELS[estado]}</p>
              {currentPlan && (
                <p className="text-sm mt-1 opacity-80">Plan: {currentPlan.nombre}</p>
              )}
            </div>
            <div className="text-right text-sm opacity-80 space-y-0.5">
              {sub.trial_ends_at && estado === 'trialing' && (
                <p>Trial vence: <strong>{formatDate(sub.trial_ends_at)}</strong></p>
              )}
              {sub.current_period_end && estado === 'active' && (
                <p>Próximo vencimiento: <strong>{formatDate(sub.current_period_end)}</strong></p>
              )}
              {sub.grace_period_ends_at && ['grace_period', 'trial_view_only'].includes(estado) && (
                <p>Vista hasta: <strong>{formatDate(sub.grace_period_ends_at)}</strong></p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seats actuales */}
      {sub && estado === 'active' && (
        <div className="rounded-xl border border-border-subtle p-5 bg-surface-elevated">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">Colaboradores (seats)</p>
              <p className="text-2xl font-bold text-text-primary mt-1">
                {seatsUsed}
                <span className="text-base font-normal text-text-tertiary"> / {seatsMax} activos</span>
              </p>
              {currentPlan?.precio_extra_seat_neto != null && (
                <p className="text-xs text-text-tertiary mt-1">
                  Seat adicional: {formatARS(Math.round(currentPlan.precio_extra_seat_neto * 1.21))} / mes (IVA incl.)
                </p>
              )}
            </div>
            {canAddSeats && currentPlan && currentPlan.precio_extra_seat_neto != null && (
              <AddOnSeatForm
                precioUnitarioNeto={currentPlan.precio_extra_seat_neto}
                ivaPorcentaje={currentPlan.iva_porcentaje}
                seatsMax={seatsMax}
                seatsUsed={seatsUsed}
              />
            )}
          </div>
          {seatsUsed >= seatsMax && !canAddSeats && (
            <p className="text-xs text-orange-600 mt-3">
              Alcanzaste el límite de seats de tu plan. Contactanos para ampliarlo.
            </p>
          )}
        </div>
      )}

      {/* Planes disponibles + formulario */}
      {isMainAdmin && needsUpgrade && plans && plans.length > 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Elegí tu plan</h2>
            <p className="text-sm text-text-tertiary mt-1">
              Precios en pesos argentinos. IVA 21% incluido en el total.
            </p>
          </div>

          <ManualPaymentForm
            plans={plans.map(p => ({
              id: p.id,
              nombre: p.nombre,
              slug: p.slug,
              tipo: p.tipo,
              precio_mensual_neto: p.precio_mensual_neto,
              precio_anual_neto: p.precio_anual_neto,
              iva_porcentaje: p.iva_porcentaje,
              max_colaboradores: p.max_colaboradores,
              max_empresas: p.max_empresas,
              max_establecimientos: p.max_establecimientos,
              max_gestiones_registros: p.max_gestiones_registros,
              max_horarios_registros: p.max_horarios_registros,
              descripcion_corta: p.descripcion_corta,
              destacado: p.destacado,
            }))}
            planFeatures={featuresByPlan}
            formatARS={formatARS}
          />
        </div>
      )}

      {/* Si no es main admin, solo informacional */}
      {!isMainAdmin && needsUpgrade && (
        <div className="rounded-xl border border-border-subtle p-5 bg-surface-elevated">
          <p className="text-sm text-text-secondary">
            Para gestionar la suscripción, contactá al Admin Principal de tu consultora.
          </p>
        </div>
      )}

      {/* Activa: info de cómo pagar el próximo período */}
      {estado === 'active' && isMainAdmin && (
        <div className="rounded-xl border border-border-subtle p-5 bg-surface-elevated space-y-3">
          <h2 className="text-base font-semibold text-text-primary">Renovar suscripción</h2>
          <p className="text-sm text-text-secondary">
            Para renovar o cambiar de plan antes del vencimiento, usá el formulario de pago por transferencia y contactanos.
          </p>
          {plans && plans.length > 0 && (
            <ManualPaymentForm
              plans={plans.map(p => ({
                id: p.id,
                nombre: p.nombre,
                slug: p.slug,
                tipo: p.tipo,
                precio_mensual_neto: p.precio_mensual_neto,
                precio_anual_neto: p.precio_anual_neto,
                iva_porcentaje: p.iva_porcentaje,
                max_colaboradores: p.max_colaboradores,
                max_empresas: p.max_empresas,
                max_establecimientos: p.max_establecimientos,
                max_gestiones_registros: p.max_gestiones_registros,
                max_horarios_registros: p.max_horarios_registros,
                descripcion_corta: p.descripcion_corta,
                destacado: p.destacado,
              }))}
              planFeatures={featuresByPlan}
              formatARS={formatARS}
            />
          )}
        </div>
      )}

      {/* Info bancaria */}
      <div className="rounded-xl border border-border-subtle p-5 bg-surface-elevated space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Datos para transferencia</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-text-tertiary">Razón social</dt>
          <dd className="text-text-primary font-medium">Sigmetría HyS</dd>
          <dt className="text-text-tertiary">CBU / CVU</dt>
          <dd className="text-text-primary font-mono">— (completar con CBU real)</dd>
          <dt className="text-text-tertiary">Alias</dt>
          <dd className="text-text-primary font-mono">— (completar con alias real)</dd>
          <dt className="text-text-tertiary">Banco</dt>
          <dd className="text-text-primary">—</dd>
        </dl>
        <p className="text-xs text-text-tertiary pt-1">
          Una vez realizada la transferencia, ingresá el número de operación en el formulario.
          Confirmamos manualmente dentro de las 24 hs hábiles.
        </p>
      </div>
    </div>
  )
}
