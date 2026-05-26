'use client'

import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function CheckoutPendingPage() {
  const router = useRouter()

  return (
    <div className="p-8 max-w-lg mx-auto">
      <Card className="text-center space-y-6 py-12">
        <Clock className="w-12 h-12 text-warning mx-auto" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Pago pendiente</h1>
          <p className="text-sm text-text-tertiary mt-2">
            Tu pago está siendo procesado. Te notificaremos cuando se confirme.
            Esto puede tomar unos minutos.
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push('/dashboard/billing')}>
          Ver estado actual
        </Button>
      </Card>
    </div>
  )
}
