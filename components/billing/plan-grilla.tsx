'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

interface PlanData {
  id: string
  nombre: string
  descripcion_corta: string | null
  precio_mensual_neto: number | null
  iva_porcentaje: number
  max_colaboradores: number | null
  max_empresas: number | null
  max_establecimientos: number | null
  destacado: boolean
  tipo: string
  mp_preapproval_plan_id?: string | null
  auto_billing_enabled?: boolean
}

interface PlanGrillaProps {
  planes: PlanData[]
  currentPlanId?: string
  onSelect: (planId: string) => void
  actionLabel?: string
  loadingPlanId?: string | null
  formatARS: (value: number | null) => string
  filterTipo?: string
  showPriceDiff?: boolean
  precioActual?: number
}

export function PlanGrilla({
  planes,
  currentPlanId,
  onSelect,
  actionLabel = 'Seleccionar',
  loadingPlanId,
  formatARS,
  filterTipo,
}: PlanGrillaProps) {
  const filtered = filterTipo
    ? planes.filter(p => p.tipo === filterTipo)
    : planes

  const visible = filtered.filter(p => p.precio_mensual_neto != null)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {visible.map((plan) => {
        const isCurrent = plan.id === currentPlanId
        const precioMensual = plan.precio_mensual_neto
        const precioTotal = precioMensual
          ? Math.round(precioMensual * (1 + plan.iva_porcentaje / 100))
          : null

        return (
          <Card
            key={plan.id}
            className={`relative flex flex-col ${plan.destacado ? 'ring-2 ring-brand-primary' : ''} ${isCurrent ? 'opacity-75' : ''}`}
          >
            {plan.destacado && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                Recomendado
              </span>
            )}

            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-lg font-bold text-text-primary">{plan.nombre}</h3>
                {plan.descripcion_corta && (
                  <p className="text-sm text-text-tertiary mt-0.5">{plan.descripcion_corta}</p>
                )}
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-text-primary">
                  {formatARS(precioMensual)}
                </span>
                <span className="text-sm text-text-tertiary">/mes</span>
              </div>

              {precioTotal && (
                <p className="text-xs text-text-tertiary">
                  + IVA: {formatARS(precioTotal - (precioMensual ?? 0))}
                </p>
              )}

              <ul className="space-y-2 text-sm text-text-secondary pt-2">
                {plan.max_colaboradores != null && (
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Hasta {plan.max_colaboradores} colaboradores</span>
                  </li>
                )}
                {plan.max_empresas != null && (
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Hasta {plan.max_empresas} empresas</span>
                  </li>
                )}
                {plan.max_establecimientos != null && (
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Hasta {plan.max_establecimientos} establecimientos</span>
                  </li>
                )}
              </ul>
            </div>

            <div className="pt-4 mt-auto">
              <Button
                variant={isCurrent ? 'secondary' : plan.destacado ? 'primary' : 'secondary'}
                className="w-full"
                onClick={() => onSelect(plan.id)}
                disabled={isCurrent || loadingPlanId === plan.id}
              >
                {isCurrent ? 'Plan actual' : loadingPlanId === plan.id ? '...' : actionLabel}
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
