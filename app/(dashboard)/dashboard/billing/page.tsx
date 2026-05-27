import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMercadoPagoConfigured } from '@/lib/mercadopago/client'
import { ManualPaymentForm } from './manual-payment-form'
import { AddOnSeatForm } from './add-on-seat-form'
import { BillingClient } from './billing-client'
import { ROLE_LABELS } from '@/lib/types'
import type { UserRole } from '@/lib/types'

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
  trialing: 'text-info bg-info-bg border-blue-200',
  trial_view_only: 'text-warning bg-warning-bg border-yellow-200',
  active: 'text-success bg-success-bg border-green-200',
  past_due: 'text-orange-700 bg-orange-50 border-orange-200',
  grace_period: 'text-orange-700 bg-orange-50 border-orange-200',
  canceled: 'text-danger bg-danger-bg border-red-200',
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

  const [subResult, plansResult, planFeaturesResult, membersCountResult, consultoraResult, membersResult] = await Promise.all([
    admin
      .from('subscriptions')
      .select(`
        id, estado, periodo, trial_ends_at, current_period_start, current_period_end, grace_period_ends_at,
        mp_preapproval_id, mp_status, mp_init_point, card_last4, card_brand,
        past_due_grace_until, plan_id_pendiente, aplicar_cambio_en, motivo_cancelacion, cancelled_at,
        plans ( id, nombre, slug, precio_mensual_neto, precio_anual_neto, iva_porcentaje, max_colaboradores, precio_extra_seat_neto, tipo )
      `)
      .eq('consultora_id', membership.consultora_id)
      .single(),
    admin
      .from('plans')
      .select('id, nombre, slug, tipo, precio_mensual_neto, precio_anual_neto, iva_porcentaje, max_colaboradores, max_empresas, max_establecimientos, max_gestiones_registros, max_horarios_registros, descripcion_corta, destacado, sort_order, precio_extra_seat_neto, mp_preapproval_plan_id, auto_billing_enabled')
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
      .select('seats_max, tipo')
      .eq('id', membership.consultora_id)
      .single(),
    admin
      .from('consultoras_members')
      .select('id, role, user_id, profiles(full_name)')
      .eq('consultora_id', membership.consultora_id)
      .eq('is_active', true)
      .order('role'),
  ])

  const sub = subResult.data
  const plans = plansResult.data ?? []
  const planFeatures = planFeaturesResult.data ?? []
  const membersCount = membersCountResult.count ?? 0
  const consultora = consultoraResult.data
  const allMembers = (membersResult.data ?? []) as unknown as Array<{
    id: string; role: string; user_id: string; profiles: { full_name?: string } | null
  }>

  // Group members by role
  const roleGroups: Record<string, { label: string; members: { full_name: string }[] }> = {}
  const ROLE_ORDER = ['full_access_main', 'full_access_branch', 'colaborador', 'full_viewer', 'colaborador_viewer']
  for (const m of allMembers) {
    const role = m.role
    if (!roleGroups[role]) {
      const isDev = (m.profiles as any)?.system_role === 'developer'
      roleGroups[role] = {
        label: isDev ? 'Developer' : (ROLE_LABELS[m.role as UserRole] ?? m.role),
        members: [],
      }
    }
    const name = m.profiles?.full_name ?? 'Sin nombre'
    roleGroups[role].members.push({ full_name: name })
  }

  // Define plan seat limits per role
  const planLimits: Record<string, number | null> = {
    full_access_main: 1,
    full_access_branch: null,
    colaborador: currentPlan?.max_colaboradores ?? 3,
    full_viewer: 6,
    colaborador_viewer: null,
  }

  const featuresByPlan: Record<string, Record<string, boolean>> = {}
  for (const pf of planFeatures) {
    if (!featuresByPlan[pf.plan_id]) featuresByPlan[pf.plan_id] = {}
    featuresByPlan[pf.plan_id][pf.feature_key] = pf.habilitado
  }

  const estado = sub?.estado as SubscriptionEstado | undefined
  const currentPlan = sub?.plans as unknown as {
    id: string; nombre: string; slug: string; tipo: string
    precio_mensual_neto: number | null; precio_anual_neto: number | null; iva_porcentaje: number
    max_colaboradores: number | null; precio_extra_seat_neto: number | null
  } | null

  const seatsMax = consultora?.seats_max ?? 0
  const seatsUsed = membersCount as unknown as number

  const needsUpgrade = estado && ['trialing', 'trial_view_only', 'past_due', 'grace_period', 'canceled', 'expired'].includes(estado)
  const canAddSeats = isMainAdmin
    && estado === 'active'
    && currentPlan?.precio_extra_seat_neto != null

  const mpEnabled = isMercadoPagoConfigured()
  const hasMPSub = sub?.mp_preapproval_id != null
  const isActive = estado === 'active' || estado === 'trialing'
  const isPastDue = estado === 'past_due'

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Suscripción y Facturación</h1>
        <p className="text-sm text-text-tertiary mt-1">Gestioná el plan de tu consultora</p>
      </div>

      {/* ── Si tiene MP activo, mostrar customer portal ── */}
      {mpEnabled && (isActive || isPastDue || hasMPSub) ? (
        <BillingClient
          sub={sub ? {
            ...sub,
            estado: sub.estado,
            mp_preapproval_id: sub.mp_preapproval_id,
            mp_status: sub.mp_status,
            mp_init_point: sub.mp_init_point,
            card_last4: sub.card_last4,
            card_brand: sub.card_brand,
            past_due_grace_until: sub.past_due_grace_until
              ? sub.past_due_grace_until instanceof Date
                ? sub.past_due_grace_until.toISOString()
                : sub.past_due_grace_until
              : null,
            current_period_end: sub.current_period_end
              ? sub.current_period_end instanceof Date
                ? sub.current_period_end.toISOString()
                : sub.current_period_end
              : null,
            current_period_start: sub.current_period_start
              ? sub.current_period_start instanceof Date
                ? sub.current_period_start.toISOString()
                : sub.current_period_start
              : null,
          } : null}
          plan={currentPlan ? {
            id: currentPlan.id,
            nombre: currentPlan.nombre,
            slug: currentPlan.slug,
            tipo: currentPlan.tipo,
            precio_mensual_neto: currentPlan.precio_mensual_neto,
          } : null}
          consultora={consultora ? {
            id: membership.consultora_id,
            seats_max: consultora.seats_max,
            tipo: consultora.tipo,
          } : null}
          isMainAdmin={isMainAdmin}
          formatARS={formatARS}
          formatDate={formatDate}
        />
      ) : (
        <>
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

          {/* Planes disponibles + formulario (pago manual) */}
          {isMainAdmin && needsUpgrade && plans.length > 0 && (
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
              {plans.length > 0 && (
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

          {/* Usuarios por rol */}
          {currentPlan && (
            <div className="rounded-xl border border-border-subtle p-5 bg-surface-elevated space-y-4">
              <h2 className="text-base font-semibold text-text-primary">Usuarios del plan</h2>
              <p className="text-xs text-text-tertiary">
                Plan <strong>{currentPlan.nombre}</strong>
              </p>
              <div className="space-y-3">
                {ROLE_ORDER.map(role => {
                  const group = roleGroups[role]
                  if (!group) return null
                  const limit = planLimits[role]
                  const count = group.members.length
                  return (
                    <div key={role} className="flex items-start gap-3 pb-3 border-b border-border-subtle last:border-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-text-primary">{group.label}</span>
                          <span className="text-sm text-text-secondary">
                            {count}
                            {limit != null ? <span className="text-text-tertiary"> / {limit}</span> : null}
                          </span>
                        </div>
                        {count > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {group.members.map((m, i) => (
                              <span key={i} className="text-xs text-text-tertiary bg-surface-base px-2 py-0.5 rounded-full">
                                {m.full_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
