'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { obtenerEstadoSuscripcion } from '@/lib/actions/mercadopago'

export default function CheckoutSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preapprovalId = searchParams.get('preapproval_id')
  const [status, setStatus] = useState<'polling' | 'active' | 'timeout'>('polling')
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (!preapprovalId) {
      setStatus('timeout')
      return
    }

    const poll = setInterval(async () => {
      attemptsRef.current += 1

      try {
        const res = await obtenerEstadoSuscripcion()
        if (res.success && res.data.estado === 'active') {
          setStatus('active')
          clearInterval(poll)
        }
      } catch {
        // Ignorar errores de polling
      }

      if (attemptsRef.current >= 15) {
        // 30 segundos (15 × 2s)
        clearInterval(poll)
        setStatus('timeout')
      }
    }, 2000)

    return () => clearInterval(poll)
  }, [preapprovalId])

  return (
    <div className="p-8 max-w-lg mx-auto">
      <Card className="text-center space-y-6 py-12">
        {status === 'polling' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-brand-primary mx-auto" />
            <div>
              <h1 className="text-xl font-bold text-text-primary">¡Listo!</h1>
              <p className="text-sm text-text-tertiary mt-2">
                Estamos activando tu suscripción...
              </p>
            </div>
          </>
        )}

        {status === 'active' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
            <div>
              <h1 className="text-xl font-bold text-text-primary">¡Suscripción activada!</h1>
              <p className="text-sm text-text-tertiary mt-2">
                Tu suscripción ya está activa. Ya podés usar todas las funcionalidades.
              </p>
            </div>
            <Button onClick={() => router.push('/dashboard/billing')}>
              Ir a mi suscripción
            </Button>
          </>
        )}

        {status === 'timeout' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-brand-primary mx-auto" />
            <div>
              <h1 className="text-xl font-bold text-text-primary">Tomamos tu pago</h1>
              <p className="text-sm text-text-tertiary mt-2">
                Recibimos tu solicitud. La activación puede tardar unos minutos.
                Recibirás confirmación en breve.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => router.push('/dashboard/billing')}>
                Ver estado actual
              </Button>
              <Button onClick={() => setStatus('polling')}>
                Reintentar
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
