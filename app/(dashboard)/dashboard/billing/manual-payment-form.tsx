'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Plan {
  id: string
  nombre: string
  slug: string
  tipo: string
  precio_mensual_neto: number | null
  precio_anual_neto: number | null
  iva_porcentaje: number
  max_colaboradores: number | null
  max_empresas: number | null
  max_establecimientos: number | null
}

interface ManualPaymentFormProps {
  plans: Plan[]
  formatARS: (value: number | null) => string
}

function withIVA(neto: number | null, iva: number): number | null {
  if (neto == null) return null
  return Math.round(neto * (1 + iva / 100))
}

export function ManualPaymentForm({ plans, formatARS }: ManualPaymentFormProps) {
  const router = useRouter()
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id ?? '')
  const [periodo, setPeriodo] = useState<'mensual' | 'anual'>('mensual')
  const [step, setStep] = useState<'select' | 'transfer'>('select')
  const [numeroOperacion, setNumeroOperacion] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const selectedPlan = plans.find(p => p.id === selectedPlanId)

  const precioNeto = selectedPlan
    ? (periodo === 'mensual' ? selectedPlan.precio_mensual_neto : selectedPlan.precio_anual_neto)
    : null
  const precioTotal = selectedPlan ? withIVA(precioNeto, selectedPlan.iva_porcentaje) : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!numeroOperacion.trim()) {
      setError('El número de operación es obligatorio')
      return
    }
    startTransition(async () => {
      setError(null)
      try {
        const res = await fetch('/api/billing/manual-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: selectedPlanId,
            periodo,
            numero_operacion: numeroOperacion,
            notas: notas || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Error al registrar el pago')
          return
        }
        setSuccess(true)
        router.refresh()
      } catch {
        setError('Error de red')
      }
    })
  }

  if (success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center space-y-2">
        <p className="text-base font-semibold text-green-700">¡Pago registrado correctamente!</p>
        <p className="text-sm text-green-600">
          Revisaremos tu transferencia y activaremos tu cuenta dentro de las 24 hs hábiles.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {step === 'select' && (
        <>
          {/* Selector de plan */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map(plan => {
              const neto = periodo === 'mensual' ? plan.precio_mensual_neto : plan.precio_anual_neto
              const total = withIVA(neto, plan.iva_porcentaje)
              const isSelected = plan.id === selectedPlanId

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    isSelected
                      ? 'border-brand-primary bg-brand-muted ring-1 ring-brand-primary'
                      : 'border-border-subtle bg-surface-elevated hover:border-brand-primary/50'
                  }`}
                >
                  <p className="font-semibold text-text-primary text-sm">{plan.nombre}</p>
                  <p className="text-xl font-bold text-text-primary mt-2">{formatARS(total)}</p>
                  <p className="text-xs text-text-tertiary">
                    Neto {formatARS(neto)} + IVA 21%
                    {periodo === 'anual' && ' · Ahorrás 20%'}
                  </p>
                  <div className="mt-3 space-y-0.5 text-xs text-text-secondary">
                    {plan.max_empresas != null && <p>Hasta {plan.max_empresas} empresas</p>}
                    {plan.max_establecimientos != null && <p>Hasta {plan.max_establecimientos} establecimientos</p>}
                    {plan.max_colaboradores != null && plan.max_colaboradores > 0 && (
                      <p>Hasta {plan.max_colaboradores} colaboradores</p>
                    )}
                    {plan.max_colaboradores === 0 && <p>Solo vos (sin colaboradores)</p>}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Toggle mensual/anual */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Período:</span>
            <div className="flex rounded-lg border border-border-subtle overflow-hidden">
              <button
                type="button"
                onClick={() => setPeriodo('mensual')}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  periodo === 'mensual'
                    ? 'bg-brand-primary text-white'
                    : 'text-text-secondary hover:bg-surface-elevated'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setPeriodo('anual')}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  periodo === 'anual'
                    ? 'bg-brand-primary text-white'
                    : 'text-text-secondary hover:bg-surface-elevated'
                }`}
              >
                Anual (-20%)
              </button>
            </div>
          </div>

          {selectedPlan && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-text-secondary">
                Total a transferir:{' '}
                <span className="text-text-primary font-bold text-base">{formatARS(precioTotal)}</span>
                <span className="text-text-tertiary ml-1 text-xs">(neto {formatARS(precioNeto)} + IVA)</span>
              </div>
              <button
                type="button"
                onClick={() => setStep('transfer')}
                className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Continuar →
              </button>
            </div>
          )}
        </>
      )}

      {step === 'transfer' && (
        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          <div className="rounded-lg border border-border-subtle bg-surface-elevated p-4 text-sm space-y-1">
            <p className="font-medium text-text-primary">{selectedPlan?.nombre} · {periodo}</p>
            <p className="text-text-secondary">Total: <strong>{formatARS(precioTotal)}</strong> (neto {formatARS(precioNeto)} + IVA 21%)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Número de operación / comprobante *
            </label>
            <input
              type="text"
              value={numeroOperacion}
              onChange={(e) => setNumeroOperacion(e.target.value)}
              placeholder="Ej: 1234567890"
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
              required
            />
            <p className="text-xs text-text-tertiary mt-1">
              El número que aparece en el comprobante de tu banco o billetera virtual.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Notas adicionales (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Transferencia desde Mercado Pago, enviada el lunes 20"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('select')}
              className="px-4 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              ← Volver
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? 'Registrando…' : 'Registrar pago'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
