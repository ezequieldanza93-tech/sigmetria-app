'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeEstadoSub } from './badge-estado-sub'
import { ModalCancelar } from './modal-cancelar'
import { useActualizarMetodoPago } from '@/lib/queries/mercadopago'
import { useToast } from '@/lib/hooks/use-toast'
import { CreditCard, ArrowRight, XCircle, AlertTriangle } from 'lucide-react'

interface SuscripcionActualProps {
  sub: Record<string, unknown>
  plan: Record<string, unknown> | null
  isMainAdmin: boolean
  consultora: Record<string, unknown> | null
  formatARS: (value: number | null) => string
  formatDate: (iso: string | null) => string
}

export function SuscripcionActual({
  sub,
  plan,
  isMainAdmin,
  consultora,
  formatARS,
  formatDate,
}: SuscripcionActualProps) {
  const [showCancelModal, setShowCancelModal] = useState(false)
  const { error: showError } = useToast()
  const actualizarMetodo = useActualizarMetodoPago()

  const estado = (sub.estado as string) ?? ''
  const isActive = estado === 'active' || estado === 'trialing'
  const isPastDue = estado === 'past_due'
  const cardInfo = sub.card_last4
    ? `${sub.card_brand ?? 'Tarjeta'} ****${sub.card_last4}`
    : null

  const graceUntil = sub.past_due_grace_until as string | null
  const currentPeriodEnd = sub.current_period_end as string | null
  const planNombre = (plan?.nombre as string) ?? 'Plan no encontrado'
  const planPrecio = plan?.precio_mensual_neto as number | null
  const consultoraTipo = (consultora?.tipo as string) ?? 'profesional'

  async function handleActualizarMetodo() {
    try {
      const result = await actualizarMetodo.mutateAsync()
      if (result.update_url) {
        window.open(result.update_url, '_blank')
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al obtener link')
    }
  }

  return (
    <>
      <Card>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-text-primary">Suscripción actual</p>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-text-primary">{planNombre}</h2>
              <BadgeEstadoSub estado={estado} />
            </div>
            {planPrecio && (
              <p className="text-sm text-text-tertiary">
                {formatARS(planPrecio)} / mes
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          {currentPeriodEnd && (
            <div>
              <p className="text-text-tertiary">Próximo cobro</p>
              <p className="font-medium text-text-primary">{formatDate(currentPeriodEnd)}</p>
            </div>
          )}
          {cardInfo && (
            <div>
              <p className="text-text-tertiary">Método de pago</p>
              <p className="font-medium text-text-primary">{cardInfo}</p>
            </div>
          )}
        </div>

        {isMainAdmin && isActive && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border-subtle">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleActualizarMetodo}
              disabled={actualizarMetodo.isPending}
            >
              <CreditCard className="w-4 h-4" />
              Actualizar tarjeta
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.location.href = '/dashboard/billing/cambiar-plan'}
            >
              <ArrowRight className="w-4 h-4" />
              Cambiar plan
            </Button>
            {consultoraTipo === 'profesional' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.location.href = '/dashboard/billing/convertir-consultora'}
              >
                Convertirme en consultora
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowCancelModal(true)}
            >
              <XCircle className="w-4 h-4" />
              Cancelar suscripción
            </Button>
          </div>
        )}

        {isPastDue && isMainAdmin && (
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Tu último pago falló.
                {graceUntil && <> Actualizá tu método antes del {formatDate(graceUntil)}.</>}
              </span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="mt-2"
              onClick={handleActualizarMetodo}
              disabled={actualizarMetodo.isPending}
            >
              Actualizar método de pago
            </Button>
          </div>
        )}
      </Card>

      <ModalCancelar
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        currentPeriodEnd={currentPeriodEnd}
      />
    </>
  )
}
