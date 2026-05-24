'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deletePlan } from '@/lib/actions/admin/plan'

interface PlanDetailClientProps {
  planId: string
  subscriberCount: number
}

export function PlanDetailClient({ planId, subscriberCount }: PlanDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-500">
          {subscriberCount > 0
            ? 'Se desactivará (tiene suscriptores)'
            : '¿Eliminar permanentemente?'
          }
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await deletePlan(planId)
              router.push('/dashboard/admin/planes')
            })
          }}
          className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {isPending ? '…' : 'Confirmar'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-500 hover:bg-red-50 transition-colors"
    >
      {subscriberCount > 0 ? 'Desactivar plan' : 'Eliminar plan'}
    </button>
  )
}
