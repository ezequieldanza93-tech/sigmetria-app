'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'

interface AddOnSeatFormProps {
  precioUnitarioNeto: number
  ivaPorcentaje: number
  seatsMax: number
  seatsUsed: number
}

function withIVA(neto: number, iva: number) {
  return Math.round(neto * (1 + iva / 100))
}

function formatARS(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)
}

export function AddOnSeatForm({ precioUnitarioNeto, ivaPorcentaje, seatsMax, seatsUsed }: AddOnSeatFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [cantidad, setCantidad] = useState(1)
  const [step, setStep] = useState<'info' | 'transfer'>('info')
  const [numeroOperacion, setNumeroOperacion] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const totalNeto = precioUnitarioNeto * cantidad
  const totalConIVA = withIVA(totalNeto, ivaPorcentaje)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!numeroOperacion.trim()) {
      setError('El número de operación es obligatorio')
      return
    }
    startTransition(async () => {
      setError(null)
      try {
        const res = await fetch('/api/billing/add-on-seat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cantidad, numero_operacion: numeroOperacion, notas: notas || undefined }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Error al registrar')
          return
        }
        setSuccess(true)
        router.refresh()
      } catch {
        console.error('[addOnSeatForm] Error de red')
        setError('Error de red')
      }
    })
  }

  function handleClose() {
    setOpen(false)
    setStep('info')
    setNumeroOperacion('')
    setNotas('')
    setError(null)
    setSuccess(false)
    setCantidad(1)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-primary text-brand-primary text-sm font-medium hover:bg-brand-muted transition-colors"
      >
        <UserPlus size={16} strokeWidth={1.75} />
        Agregar seat
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="bg-surface-base border border-border-subtle rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-text-primary mb-1">
              Agregar seats adicionales
            </h2>
            <p className="text-xs text-text-tertiary mb-5">
              Actualmente usás {seatsUsed} de {seatsMax} seats. Cada seat extra cuesta {formatARS(withIVA(precioUnitarioNeto, ivaPorcentaje))} / mes (IVA incl.)
            </p>

            {success ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center space-y-2">
                <p className="font-semibold text-green-700">¡Solicitud registrada!</p>
                <p className="text-sm text-green-600">Confirmamos dentro de las 24 hs hábiles y habilitamos los seats.</p>
                <button onClick={handleClose} className="mt-2 text-sm text-green-700 underline">Cerrar</button>
              </div>
            ) : step === 'info' ? (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    ¿Cuántos seats necesitás?
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                      className="w-9 h-9 rounded-lg border border-border-subtle text-text-secondary hover:bg-surface-elevated transition-colors text-lg font-medium"
                    >
                      −
                    </button>
                    <span className="text-2xl font-bold text-text-primary w-8 text-center">{cantidad}</span>
                    <button
                      type="button"
                      onClick={() => setCantidad(Math.min(10, cantidad + 1))}
                      className="w-9 h-9 rounded-lg border border-border-subtle text-text-secondary hover:bg-surface-elevated transition-colors text-lg font-medium"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-border-subtle bg-surface-elevated p-4 space-y-1 text-sm">
                  <div className="flex justify-between text-text-secondary">
                    <span>{cantidad} seat{cantidad > 1 ? 's' : ''} × {formatARS(precioUnitarioNeto)} neto</span>
                    <span>{formatARS(totalNeto)}</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>IVA 21%</span>
                    <span>{formatARS(totalConIVA - totalNeto)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-text-primary border-t border-border-subtle pt-1 mt-1">
                    <span>Total a transferir</span>
                    <span>{formatARS(totalConIVA)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-3 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('transfer')}
                    className="flex-1 px-3 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Continuar →
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm">
                  <span className="text-text-secondary">{cantidad} seat{cantidad > 1 ? 's' : ''} · Total: </span>
                  <strong className="text-text-primary">{formatARS(totalConIVA)}</strong>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    N° de operación / comprobante *
                  </label>
                  <input
                    type="text"
                    value={numeroOperacion}
                    onChange={(e) => setNumeroOperacion(e.target.value)}
                    placeholder="Ej: 1234567890"
                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Notas (opcional)
                  </label>
                  <input
                    type="text"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Ej: Transferencia desde Mercado Pago"
                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('info')}
                    className="px-3 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    ← Volver
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 px-3 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isPending ? 'Registrando…' : 'Registrar pago'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
