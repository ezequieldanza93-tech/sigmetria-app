'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlanGrilla } from '@/components/billing/plan-grilla'
import { useDatosBilling, useConvertirAConsultora } from '@/lib/queries/mercadopago'
import { useToast } from '@/lib/hooks/use-toast'
import { Loader2, ArrowLeft, Building2, CheckCircle2 } from 'lucide-react'

function formatARS(value: number | null) {
  if (value == null) return 'Consultar'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)
}

export default function ConvertirConsultoraPage() {
  const router = useRouter()
  const { data, isLoading } = useDatosBilling()
  const convertir = useConvertirAConsultora()
  const { success, error: showError } = useToast()
  const [step, setStep] = useState<'select' | 'confirm'>('select')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const consultoraTipo = (data?.consultora?.tipo as string) ?? 'profesional'

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    )
  }

  if (consultoraTipo === 'consultora') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Card className="text-center py-12">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h1 className="text-xl font-bold text-text-primary mt-4">Ya sos una consultora</h1>
          <p className="text-sm text-text-tertiary mt-2">
            Tu cuenta ya está configurada como consultora. Podés invitar miembros a tu equipo.
          </p>
          <Button className="mt-4" onClick={() => router.push('/dashboard/billing')}>
            Ir a facturación
          </Button>
        </Card>
      </div>
    )
  }

  async function handleSelect(planId: string) {
    setSelectedPlanId(planId)
    setStep('confirm')
  }

  async function handleConfirm() {
    if (!selectedPlanId) return
    setLoading(true)
    try {
      await convertir.mutateAsync(selectedPlanId)
      success('¡Convertido a consultora! Ya podés gestionar tu equipo.')
      router.push('/dashboard/billing')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al convertir')
    } finally {
      setLoading(false)
    }
  }

  const selectedPlan = data?.planes?.find((p: any) => p.id === selectedPlanId) as any

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        {step === 'confirm' && (
          <Button variant="ghost" size="sm" onClick={() => setStep('select')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Convertirme en consultora</h1>
          <p className="text-sm text-text-tertiary mt-1">
            Como consultora podés invitar miembros a tu equipo y gestionar empresas en conjunto.
          </p>
        </div>
      </div>

      {step === 'select' && (
        <div className="space-y-4">
          <Card className="bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">¿Qué significa convertirte en consultora?</p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Tu cuenta actual pasa a ser la principal (Admin Principal)</li>
                  <li>Podrás invitar colaboradores a tu consultora</li>
                  <li>No perdés ningún dato existente</li>
                </ul>
              </div>
            </div>
          </Card>

          <PlanGrilla
            planes={(data?.planes as any[]) ?? []}
            onSelect={handleSelect}
            actionLabel="Seleccionar este plan"
            formatARS={formatARS}
          />
        </div>
      )}

      {step === 'confirm' && selectedPlan && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-subtle">
              <Building2 className="w-8 h-8 text-brand-primary" />
              <div>
                <h2 className="text-lg font-bold text-text-primary">{selectedPlan.nombre}</h2>
                <p className="text-sm text-text-tertiary">
                  {formatARS(selectedPlan.precio_mensual_neto)} / mes
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              <p className="font-medium">Confirmación</p>
              <p className="mt-1">
                Vas a convertirte en consultora con el plan <strong>{selectedPlan.nombre}</strong>.
                Tu cuenta actual pasa a ser Admin Principal y podrás invitar más miembros.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setStep('select')}>
                Volver
              </Button>
              <Button onClick={handleConfirm} disabled={loading}>
                {loading ? 'Procesando...' : 'Confirmar y convertir'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
