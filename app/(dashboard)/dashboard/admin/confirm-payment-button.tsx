'use client'

import { useState, useTransition } from 'react'
import { CheckCircle } from 'lucide-react'

interface ConfirmPaymentButtonProps {
  paymentId: string
}

export function ConfirmPaymentButton({ paymentId }: ConfirmPaymentButtonProps) {
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      setError(null)
      try {
        const res = await fetch('/api/admin/confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_id: paymentId }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Error')
          return
        }
        setConfirmed(true)
        window.location.reload()
      } catch {
        setError('Error de red')
      }
    })
  }

  if (confirmed) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <CheckCircle size={12} />
        Confirmado
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleConfirm}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
      >
        <CheckCircle size={12} />
        {isPending ? 'Confirmando…' : 'Confirmar pago'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
