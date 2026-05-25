'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlanGrilla } from '@/components/billing/plan-grilla'
import { useDatosBilling, useCambiarPlan } from '@/lib/queries/mercadopago'
import { useToast } from '@/lib/hooks/use-toast'
import { Loader2, ArrowLeft } from 'lucide-react'

function formatARS(value: number | null) {
  if (value == null) return 'Consultar'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)
}

export default function CambiarPlanPage() {
  const router = useRouter()
  const { data, isLoading, error } = useDatosBilling()
  const cambiarPlan = useCambiarPlan()
  const { success, error: showError } = useToast()
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null)

  async function handleSelect(planId: string) {
    setLoadingPlanId(planId)
    try {
      const result = await cambiarPlan.mutateAsync(planId)
      if (result.aplicaInmediato) {
        success(`Plan cambiado. ${result.prorrataMonto > 0 ? `Se cobró una prorrata de ${formatARS(result.prorrataMonto)}.` : ''}`)
      } else {
        success(`Downgrade programado. El cambio se aplicará al final del ciclo actual.${result.fechaAplicacion ? ` (${new Date(result.fechaAplicacion).toLocaleDateString('es-AR')})` : ''}`)
      }
      router.push('/dashboard/billing')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al cambiar plan')
    } finally {
      setLoadingPlanId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-red-600">Error al cargar datos</p>
      </div>
    )
  }

  const currentPlanId = data.plan?.id as string | undefined

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/billing')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Cambiar plan</h1>
          <p className="text-sm text-text-tertiary mt-1">
            Seleccioná el nuevo plan para tu consultora.
            {data.sub?.estado === 'active' && (
              <> Los cambios de upgrade son inmediatos. Los downgrades se aplican al final del ciclo.</>
            )}
          </p>
        </div>
      </div>

      <PlanGrilla
        planes={(data.planes as any[]) ?? []}
        currentPlanId={currentPlanId}
        onSelect={handleSelect}
        actionLabel={data.sub?.estado === 'active' ? 'Cambiar a este plan' : 'Suscribirme'}
        loadingPlanId={loadingPlanId}
        formatARS={formatARS}
      />
    </div>
  )
}
