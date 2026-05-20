import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ForceSubscriptionForm } from './force-subscription-form'
import { RunCronButton } from './run-cron-button'
import { ConfirmPaymentButton } from './confirm-payment-button'

type SubscriptionEstado =
  | 'trialing' | 'trial_view_only' | 'active'
  | 'past_due' | 'grace_period' | 'canceled' | 'expired'

const ESTADO_LABELS: Record<SubscriptionEstado, string> = {
  trialing: 'Trial',
  trial_view_only: 'Trial (solo lectura)',
  active: 'Activa',
  past_due: 'Vencida',
  grace_period: 'Período de gracia',
  canceled: 'Cancelada',
  expired: 'Expirada',
}

const ESTADO_COLORS: Record<SubscriptionEstado, string> = {
  trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  trial_view_only: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  past_due: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  grace_period: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  canceled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export default async function AdminPage() {
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
  const [{ data: subscriptions }, { data: pendingPayments }] = await Promise.all([
    admin
    .from('subscriptions')
    .select(`
      id,
      estado,
      periodo,
      trial_ends_at,
      current_period_end,
      grace_period_ends_at,
      created_at,
      consultoras (
        id,
        nombre,
        cuit,
        trial_used_at
      ),
      plans (
        nombre,
        slug
      )
    `)
    .order('created_at', { ascending: false }),
    admin
      .from('payments')
      .select(`
        id, monto_neto, monto_total, estado, created_at,
        manual_payments ( numero_operacion, notas, confirmado_at ),
        subscriptions ( consultora_id, consultoras ( nombre ) )
      `)
      .eq('estado', 'pending')
      .eq('provider', 'transferencia')
      .order('created_at', { ascending: true }),
  ])

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Panel Super Admin</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {subscriptions?.length ?? 0} suscripciones en el sistema
          </p>
        </div>
        <RunCronButton />
      </div>

      {/* Pagos pendientes de confirmación */}
      {pendingPayments && pendingPayments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <span className="inline-flex w-2 h-2 rounded-full bg-orange-400" />
            Transferencias pendientes de confirmación ({pendingPayments.length})
          </h2>
          <div className="overflow-x-auto rounded-xl border border-orange-200 bg-orange-50/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orange-200">
                  <th className="px-4 py-3 text-left font-medium text-orange-700">Consultora</th>
                  <th className="px-4 py-3 text-left font-medium text-orange-700">Monto</th>
                  <th className="px-4 py-3 text-left font-medium text-orange-700">N° operación</th>
                  <th className="px-4 py-3 text-left font-medium text-orange-700">Notas</th>
                  <th className="px-4 py-3 text-left font-medium text-orange-700">Recibido</th>
                  <th className="px-4 py-3 text-right font-medium text-orange-700">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100">
                {pendingPayments.map((pmt) => {
                  const subData = pmt.subscriptions as unknown as { consultoras: { nombre: string } | null } | null
                  const manualData = (Array.isArray(pmt.manual_payments)
                    ? pmt.manual_payments[0]
                    : pmt.manual_payments) as { numero_operacion: string; notas: string | null } | null

                  return (
                    <tr key={pmt.id} className="hover:bg-orange-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {subData?.consultoras?.nombre ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-text-primary font-mono text-xs">
                        {pmt.monto_total
                          ? `$${Number(pmt.monto_total).toLocaleString('es-AR')}`
                          : `$${Number(pmt.monto_neto).toLocaleString('es-AR')} + IVA`}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                        {manualData?.numero_operacion ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-tertiary max-w-xs truncate">
                        {manualData?.notas ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {formatDate(pmt.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ConfirmPaymentButton paymentId={pmt.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-elevated">
              <th className="px-4 py-3 text-left font-medium text-text-tertiary">Consultora</th>
              <th className="px-4 py-3 text-left font-medium text-text-tertiary">CUIT</th>
              <th className="px-4 py-3 text-left font-medium text-text-tertiary">Plan</th>
              <th className="px-4 py-3 text-left font-medium text-text-tertiary">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-text-tertiary">Trial vence</th>
              <th className="px-4 py-3 text-left font-medium text-text-tertiary">Período vence</th>
              <th className="px-4 py-3 text-left font-medium text-text-tertiary">Alta</th>
              <th className="px-4 py-3 text-right font-medium text-text-tertiary">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {subscriptions?.map((sub) => {
              const consultora = sub.consultoras as unknown as { id: string; nombre: string; cuit: string | null; trial_used_at: string | null } | null
              const plan = sub.plans as unknown as { nombre: string; slug: string } | null
              const estado = sub.estado as SubscriptionEstado

              return (
                <tr key={sub.id} className="hover:bg-surface-elevated/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {consultora?.nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary font-mono text-xs">
                    {consultora?.cuit ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {plan?.nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[estado] ?? ''}`}>
                      {ESTADO_LABELS[estado] ?? estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {formatDate(sub.trial_ends_at)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {formatDate(sub.current_period_end)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {formatDate(sub.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {consultora?.id && (
                      <ForceSubscriptionForm
                        consultoraId={consultora.id}
                        estadoActual={estado}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
