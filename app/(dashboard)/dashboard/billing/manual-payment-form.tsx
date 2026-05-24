'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FEATURE_CATALOG } from '@/lib/plan-features'

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
  max_gestiones_registros: number | null
  max_horarios_registros: number | null
  descripcion_corta: string | null
  destacado: boolean
}

interface ManualPaymentFormProps {
  plans: Plan[]
  planFeatures: Record<string, Record<string, boolean>>
  formatARS: (value: number | null) => string
}

function withIVA(neto: number | null, iva: number): number | null {
  if (neto == null) return null
  return Math.round(neto * (1 + iva / 100))
}

function limitLabel(val: number | null, zeroLabel?: string): string {
  if (val == null) return 'Ilimitado'
  if (val === 0) return zeroLabel ?? '0'
  return String(val)
}

export function ManualPaymentForm({ plans, planFeatures, formatARS }: ManualPaymentFormProps) {
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

  const getFeatureValue = (planId: string, key: string): boolean => {
    return planFeatures[planId]?.[key] ?? false
  }

  const categories = Array.from(new Set(FEATURE_CATALOG.map(f => f.category)))

  return (
    <div className="space-y-6">
      {step === 'select' && (
        <>
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

          {/* Tabla comparativa */}
          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-elevated">
                  <th className="px-4 py-3 text-left font-medium text-text-tertiary min-w-[180px]">
                    Características
                  </th>
                  {plans.map(plan => (
                    <th
                      key={plan.id}
                      className={`px-4 py-3 text-center min-w-[160px] ${
                        plan.destacado ? 'bg-amber-50/50' : ''
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="font-semibold text-text-primary">{plan.nombre}</p>
                        {plan.descripcion_corta && (
                          <p className="text-xs text-text-tertiary font-normal">
                            {plan.descripcion_corta}
                          </p>
                        )}
                        {plan.destacado && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                            Recomendado
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {/* Precio mensual */}
                <tr className="hover:bg-surface-elevated/30 transition-colors">
                  <td className="px-4 py-3 text-text-secondary text-xs font-medium">Precio mensual</td>
                  {plans.map(plan => {
                    const total = withIVA(
                      periodo === 'mensual' ? plan.precio_mensual_neto : plan.precio_anual_neto,
                      plan.iva_porcentaje
                    )
                    const neto = periodo === 'mensual' ? plan.precio_mensual_neto : plan.precio_anual_neto
                    return (
                      <td key={plan.id} className={`px-4 py-3 text-center ${plan.destacado ? 'bg-amber-50/30' : ''}`}>
                        {total != null ? (
                          <>
                            <p className="font-bold text-text-primary">
                              {formatARS(total)}
                            </p>
                            <p className="text-[10px] text-text-tertiary">
                              Neto {formatARS(neto)} + IVA
                            </p>
                          </>
                        ) : (
                          <span className="text-text-secondary">A medida</span>
                        )}
                      </td>
                    )
                  })}
                </tr>

                {/* Límites */}
                <tr className="hover:bg-surface-elevated/30 transition-colors">
                  <td className="px-4 py-3 text-text-secondary text-xs font-medium">Colaboradores</td>
                  {plans.map(plan => (
                    <td key={plan.id} className={`px-4 py-3 text-center text-text-primary text-sm ${plan.destacado ? 'bg-amber-50/30' : ''}`}>
                      {plan.max_colaboradores === 0 ? 'Solo titular' : limitLabel(plan.max_colaboradores)}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-surface-elevated/30 transition-colors">
                  <td className="px-4 py-3 text-text-secondary text-xs font-medium">Empresas</td>
                  {plans.map(plan => (
                    <td key={plan.id} className={`px-4 py-3 text-center text-text-primary text-sm ${plan.destacado ? 'bg-amber-50/30' : ''}`}>
                      {limitLabel(plan.max_empresas)}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-surface-elevated/30 transition-colors">
                  <td className="px-4 py-3 text-text-secondary text-xs font-medium">Establecimientos</td>
                  {plans.map(plan => (
                    <td key={plan.id} className={`px-4 py-3 text-center text-text-primary text-sm ${plan.destacado ? 'bg-amber-50/30' : ''}`}>
                      {limitLabel(plan.max_establecimientos)}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-surface-elevated/30 transition-colors">
                  <td className="px-4 py-3 text-text-secondary text-xs font-medium">Registros de gestión</td>
                  {plans.map(plan => (
                    <td key={plan.id} className={`px-4 py-3 text-center text-text-primary text-sm ${plan.destacado ? 'bg-amber-50/30' : ''}`}>
                      {limitLabel(plan.max_gestiones_registros)}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-surface-elevated/30 transition-colors">
                  <td className="px-4 py-3 text-text-secondary text-xs font-medium">Registros de horario</td>
                  {plans.map(plan => (
                    <td key={plan.id} className={`px-4 py-3 text-center text-text-primary text-sm ${plan.destacado ? 'bg-amber-50/30' : ''}`}>
                      {limitLabel(plan.max_horarios_registros)}
                    </td>
                  ))}
                </tr>

                {/* Features por categoría */}
                {categories.map(category => (
                  <tr key={category} className="hover:bg-surface-elevated/30 transition-colors">
                    <td className="px-4 py-3 text-text-secondary text-xs font-medium">{category}</td>
                    {plans.map(plan => {
                      const catFeatures = FEATURE_CATALOG.filter(f => f.category === category)

                      return (
                        <td
                          key={plan.id}
                          className={`px-4 py-3 ${plan.destacado ? 'bg-amber-50/30' : ''}`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            {catFeatures.length === 0 ? (
                              <span className="text-text-tertiary">—</span>
                            ) : (
                              catFeatures.map(f => (
                                <span
                                  key={f.key}
                                  className={`inline-flex items-center gap-1 text-xs ${
                                    getFeatureValue(plan.id, f.key)
                                      ? 'text-green-600'
                                      : 'text-zinc-300'
                                  }`}
                                >
                                  {getFeatureValue(plan.id, f.key) ? '✓' : '—'}
                                  <span className={getFeatureValue(plan.id, f.key) ? 'text-text-primary' : 'text-text-tertiary'}>
                                    {f.label}
                                  </span>
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}

                {/* Acción */}
                <tr className="border-t-2 border-border-subtle bg-surface-elevated/50">
                  <td className="px-4 py-4"></td>
                  {plans.map(plan => (
                    <td key={plan.id} className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => { setSelectedPlanId(plan.id); setStep('transfer') }}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-opacity ${
                          plan.destacado
                            ? 'bg-amber-500 text-white hover:opacity-90'
                            : 'bg-brand-primary text-white hover:opacity-90'
                        }`}
                      >
                        Elegir este plan
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {selectedPlan && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-text-secondary">
                Plan seleccionado: <span className="font-semibold text-text-primary">{selectedPlan.nombre}</span>
                {' · '}
                Total: <span className="font-bold text-text-primary">{formatARS(precioTotal)}</span>
                <span className="text-text-tertiary ml-1 text-xs">(neto {formatARS(precioNeto)} + IVA)</span>
              </div>
            </div>
          )}
        </>
      )}

      {step === 'transfer' && (
        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          <div className="rounded-lg border border-border-subtle bg-surface-elevated p-4 text-sm space-y-1">
            <p className="font-medium text-text-primary">{selectedPlan?.nombre} · {periodo === 'mensual' ? 'Mensual' : 'Anual'}</p>
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
