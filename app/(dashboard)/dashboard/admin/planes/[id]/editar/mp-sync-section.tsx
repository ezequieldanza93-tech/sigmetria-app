'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import type { ActionResult } from '@/lib/types'

interface MPSyncSectionProps {
  planId: string
  mpPreapprovalPlanId: string | null
  planNombre: string
  sincronizarAction: (planId: string) => Promise<ActionResult<{ mpPlanId: string }>>
}

export function MPSyncSection({
  planId,
  mpPreapprovalPlanId,
  planNombre,
  sincronizarAction,
}: MPSyncSectionProps) {
  const [syncing, setSyncing] = useState(false)
  const [mpPlanId, setMpPlanId] = useState<string | null>(mpPreapprovalPlanId)
  const { success, error } = useToast()

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await sincronizarAction(planId)
      if (result.success) {
        setMpPlanId(result.data.mpPlanId)
        success('Plan sincronizado con Mercado Pago correctamente')
      } else {
        error(result.error)
      }
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Cobro automático Mercado Pago
            </h3>
            <p className="text-sm text-text-tertiary mt-1">
              Sincronizá este plan con Mercado Pago para permitir suscripciones automáticas.
            </p>
          </div>
        </div>

        {mpPlanId ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-green-800">Plan sincronizado</p>
                <p className="text-green-700 mt-1 font-mono text-xs break-all">
                  MP Plan ID: {mpPlanId}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-800">No sincronizado</p>
                <p className="text-amber-700 mt-1">
                  Este plan no está configurado para cobro automático.
                  Sincronizalo con MP para que los usuarios puedan suscribirse automáticamente.
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-text-tertiary">
          Al sincronizar, se crea un plan en Mercado Pago con el nombre &ldquo;{planNombre}&rdquo;
          y el precio mensual configurado. Si el plan ya existe, se actualiza.
          {mpPlanId && ' Si hay suscripciones activas, se creará uno nuevo.'}
        </p>

        <Button onClick={handleSync} disabled={syncing} variant={mpPlanId ? 'secondary' : 'primary'}>
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : mpPlanId ? 'Re-sincronizar' : 'Sincronizar con MP'}
        </Button>
      </div>
    </Card>
  )
}
