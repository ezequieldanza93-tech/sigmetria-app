'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface BannerPastDueProps {
  graceUntil: string | null
  onActualizarMetodo?: () => void
}

export function BannerPastDue({ graceUntil, onActualizarMetodo }: BannerPastDueProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const graceDate = graceUntil
    ? new Date(graceUntil).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : null

  return (
    <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-orange-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Tu último pago no se pudo procesar.
            {graceDate && (
              <> Accedés con funciones limitadas hasta el <strong>{graceDate}</strong>.</>
            )}
            {' '}Actualizá tu método de pago para evitar la cancelación.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onActualizarMetodo && (
            <Button variant="destructive" size="sm" onClick={onActualizarMetodo}>
              Actualizar método de pago
            </Button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="text-orange-400 hover:text-orange-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
