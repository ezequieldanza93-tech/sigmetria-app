import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFeatureLabel } from '@/lib/plan-features'
import { PlanDetailClient } from './plan-detail-client'

function formatARS(value: number | null) {
  if (value == null) return 'A medida'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function PlanDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) redirect('/dashboard')

  const admin = createAdminClient()

  const [planResult, featuresResult, subsResult] = await Promise.all([
    admin.from('plans').select('*').eq('id', id).single(),
    admin.from('plan_features').select('*').eq('plan_id', id),
    admin
      .from('subscriptions')
      .select(`
        id, estado, periodo, created_at, current_period_end,
        consultoras ( id, nombre, cuit )
      `)
      .eq('plan_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!planResult.data) notFound()

  const plan = planResult.data
  const planFeatures = featuresResult.data ?? []
  const subscriptions = subsResult.data ?? []

  const activeSubCount = subscriptions.filter(s => s.estado === 'active').length
  const totalSubCount = subscriptions.length

  const averagePrice = plan.precio_mensual_neto ?? plan.precio_anual_neto ?? 0

  const featuresByEnabled = planFeatures.reduce((acc, f) => {
    if (f.habilitado) acc.enabled.push(f)
    else acc.disabled.push(f)
    return acc
  }, { enabled: [] as typeof planFeatures, disabled: [] as typeof planFeatures })

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-2 text-sm text-text-tertiary mb-1">
        <Link href="/dashboard/admin" className="hover:text-text-primary transition-colors">Admin</Link>
        <span>/</span>
        <Link href="/dashboard/admin/planes" className="hover:text-text-primary transition-colors">Planes</Link>
        <span>/</span>
        <span className="text-text-primary">{plan.nombre}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {plan.nombre}
            {plan.destacado && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                Recomendado
              </span>
            )}
            {!plan.is_visible && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
                Oculto
              </span>
            )}
          </h1>
          <p className="text-sm text-text-tertiary mt-1">Slug: <code className="font-mono">{plan.slug}</code></p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/admin/planes/${plan.id}/editar`}
            className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Editar plan
          </Link>
          <PlanDetailClient planId={plan.id} subscriberCount={totalSubCount} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-border-subtle p-4 bg-surface-elevated">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Suscriptores activos</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{activeSubCount}</p>
        </div>
        <div className="rounded-xl border border-border-subtle p-4 bg-surface-elevated">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Total suscripciones</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{totalSubCount}</p>
        </div>
        <div className="rounded-xl border border-border-subtle p-4 bg-surface-elevated">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Precio mensual</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{formatARS(plan.precio_mensual_neto)}</p>
        </div>
        <div className="rounded-xl border border-border-subtle p-4 bg-surface-elevated">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Revenue mensual estimado</p>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {activeSubCount > 0 ? formatARS(averagePrice * activeSubCount) : '—'}
          </p>
        </div>
      </div>

      {/* Info del plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Precios y Límites */}
        <div className="rounded-xl border border-border-subtle p-5 space-y-4">
          <h2 className="text-base font-semibold text-text-primary">Precios y Límites</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-text-tertiary">Precio mensual (neto)</dt>
            <dd className="text-text-primary font-mono">{formatARS(plan.precio_mensual_neto)}</dd>
            <dt className="text-text-tertiary">Precio anual (neto)</dt>
            <dd className="text-text-primary font-mono">{formatARS(plan.precio_anual_neto)}</dd>
            <dt className="text-text-tertiary">IVA</dt>
            <dd className="text-text-primary">{plan.iva_porcentaje}%</dd>
            <dt className="text-text-tertiary">Seat adicional (neto)</dt>
            <dd className="text-text-primary font-mono">{formatARS(plan.precio_extra_seat_neto)}</dd>
            <dt className="text-text-tertiary">Max colaboradores</dt>
            <dd className="text-text-primary">{plan.max_colaboradores != null ? plan.max_colaboradores === 0 ? 'Solo titular' : plan.max_colaboradores : 'Ilimitado'}</dd>
            <dt className="text-text-tertiary">Max empresas</dt>
            <dd className="text-text-primary">{plan.max_empresas != null ? plan.max_empresas : 'Ilimitado'}</dd>
            <dt className="text-text-tertiary">Max establecimientos</dt>
            <dd className="text-text-primary">{plan.max_establecimientos != null ? plan.max_establecimientos : 'Ilimitado'}</dd>
            <dt className="text-text-tertiary">Max registros gestión</dt>
            <dd className="text-text-primary">{plan.max_gestiones_registros != null ? plan.max_gestiones_registros : 'Ilimitado'}</dd>
            <dt className="text-text-tertiary">Max registros horario</dt>
            <dd className="text-text-primary">{plan.max_horarios_registros != null ? plan.max_horarios_registros : 'Ilimitado'}</dd>
            <dt className="text-text-tertiary">Tipo</dt>
            <dd className="text-text-primary">{plan.tipo}</dd>
            <dt className="text-text-tertiary">Activo</dt>
            <dd className="text-text-primary">{plan.is_active ? 'Sí' : 'No'}</dd>
          </dl>
        </div>

        {/* Features */}
        <div className="rounded-xl border border-border-subtle p-5 space-y-4">
          <h2 className="text-base font-semibold text-text-primary">Features</h2>
          {featuresByEnabled.enabled.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-green-600 uppercase tracking-wider mb-2">Habilitadas</h3>
              <div className="flex flex-wrap gap-2">
                {featuresByEnabled.enabled.map(f => (
                  <span key={f.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                    {getFeatureLabel(f.feature_key)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {featuresByEnabled.disabled.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Deshabilitadas</h3>
              <div className="flex flex-wrap gap-2">
                {featuresByEnabled.disabled.map(f => (
                  <span key={f.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-50 text-zinc-500 text-xs">
                    {getFeatureLabel(f.feature_key)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {planFeatures.length === 0 && (
            <p className="text-sm text-text-tertiary">Sin features configuradas</p>
          )}
        </div>
      </div>

      {/* Suscriptores */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-text-primary">
          Suscriptores ({totalSubCount})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-elevated">
                <th className="px-4 py-3 text-left font-medium text-text-tertiary">Consultora</th>
                <th className="px-4 py-3 text-left font-medium text-text-tertiary">CUIT</th>
                <th className="px-4 py-3 text-left font-medium text-text-tertiary">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-text-tertiary">Período</th>
                <th className="px-4 py-3 text-left font-medium text-text-tertiary">Vence</th>
                <th className="px-4 py-3 text-left font-medium text-text-tertiary">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {subscriptions.map(sub => {
                const consultora = sub.consultoras as unknown as { nombre: string; cuit: string | null } | null
                return (
                  <tr key={sub.id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {consultora?.nombre ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary font-mono text-xs">
                      {consultora?.cuit ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        sub.estado === 'active' ? 'bg-green-100 text-green-700' :
                        sub.estado === 'trialing' ? 'bg-blue-100 text-blue-700' :
                        'bg-zinc-100 text-zinc-600'
                      }`}>
                        {sub.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{sub.periodo}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{formatDate(sub.current_period_end)}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{formatDate(sub.created_at)}</td>
                  </tr>
                )
              })}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-tertiary">
                    Sin suscriptores
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
