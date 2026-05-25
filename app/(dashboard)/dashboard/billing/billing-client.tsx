'use client'

import { useDatosBilling } from '@/lib/queries/mercadopago'
import { SuscripcionActual } from '@/components/billing/suscripcion-actual'
import { HistorialPagos } from '@/components/billing/historial-pagos'
import { PlanGrilla } from '@/components/billing/plan-grilla'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SubProp {
  id?: string
  estado?: string
  mp_preapproval_id?: string | null
  mp_status?: string | null
  mp_init_point?: string | null
  card_last4?: string | null
  card_brand?: string | null
  past_due_grace_until?: string | null
  current_period_end?: string | null
  current_period_start?: string | null
  plan_id?: string
  plan_id_pendiente?: string | null
  aplicar_cambio_en?: string | null
  motivo_cancelacion?: string | null
  cancelled_at?: string | null
  trial_ends_at?: string | null
  grace_period_ends_at?: string | null
  periodo?: string | null
  [key: string]: unknown
}

interface PlanProp {
  id: string
  nombre: string
  slug: string
  tipo: string
  precio_mensual_neto: number | null
}

interface ConsultoraProp {
  id: string
  seats_max: number
  tipo: string
}

interface BillingClientProps {
  sub: SubProp | null
  plan: PlanProp | null
  consultora: ConsultoraProp | null
  isMainAdmin: boolean
  formatARS: (value: number | null) => string
  formatDate: (iso: string | null) => string
}

export function BillingClient({
  sub: initialSub,
  plan: initialPlan,
  consultora: initialConsultora,
  isMainAdmin,
  formatARS,
  formatDate,
}: BillingClientProps) {
  const router = useRouter()
  const { data, isLoading } = useDatosBilling()

  // Usar data de React Query si está disponible, sino los props iniciales
  const sub = (data?.sub ?? initialSub) as SubProp | null
  const currentPlan = (data?.plan ?? initialPlan) as PlanProp | null
  const consultora = (data?.consultora ?? initialConsultora) as ConsultoraProp | null
  const planes = (data?.planes ?? []) as any[]

  const estado = (sub?.estado as string) ?? ''
  const hasActiveSub = estado === 'active' || estado === 'trialing'
  const needsUpgrade = !hasActiveSub

  if (isLoading && !sub) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Suscripción actual */}
      {sub && (
        <SuscripcionActual
          sub={sub as Record<string, unknown>}
          plan={currentPlan as Record<string, unknown> | null}
          isMainAdmin={isMainAdmin}
          consultora={consultora as Record<string, unknown> | null}
          formatARS={formatARS}
          formatDate={formatDate}
        />
      )}

      {/* Historial de pagos */}
      <HistorialPagos />

      {/* Si no tiene sub activa y es main admin, mostrar grilla de planes */}
      {needsUpgrade && isMainAdmin && planes.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Planes disponibles</h2>
            <p className="text-sm text-text-tertiary mt-1">
              Elegí un plan para tu consultora. El pago se procesa de forma automática todos los meses.
            </p>
          </div>
          <PlanGrilla
            planes={planes}
            onSelect={(planId) => {
              const form = new FormData()
              form.set('plan_id', planId)
              // La suscripción se inicia en el billing page
              router.push(`/dashboard/billing?suscribir=${planId}`)
            }}
            actionLabel="Suscribirme"
            formatARS={formatARS}
          />
        </div>
      )}

      {/* Si no es main admin */}
      {needsUpgrade && !isMainAdmin && (
        <Card>
          <p className="text-sm text-text-secondary">
            Para gestionar la suscripción, contactá al Admin Principal de tu consultora.
          </p>
        </Card>
      )}
    </div>
  )
}
