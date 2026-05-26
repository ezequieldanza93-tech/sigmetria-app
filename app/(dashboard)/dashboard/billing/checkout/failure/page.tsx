'use client'

import { useRouter } from 'next/navigation'
import { XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function CheckoutFailurePage() {
  const router = useRouter()

  return (
    <div className="p-8 max-w-lg mx-auto">
      <Card className="text-center space-y-6 py-12">
        <XCircle className="w-12 h-12 text-danger mx-auto" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">No se pudo procesar el pago</h1>
          <p className="text-sm text-text-tertiary mt-2">
            Hubo un problema al procesar tu pago. Podés intentar de nuevo con otro método de pago.
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => router.push('/dashboard/billing')}>
            Volver a facturación
          </Button>
          <Button onClick={() => router.push('/dashboard/billing')}>
            Intentar de nuevo
          </Button>
        </div>
      </Card>
    </div>
  )
}
