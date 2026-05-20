'use client'

import { useState, useTransition } from 'react'

type SubscriptionEstado =
  | 'trialing' | 'trial_view_only' | 'active'
  | 'past_due' | 'grace_period' | 'canceled' | 'expired'

const ESTADOS: { value: SubscriptionEstado; label: string }[] = [
  { value: 'trialing', label: 'Trial' },
  { value: 'trial_view_only', label: 'Trial (solo lectura)' },
  { value: 'active', label: 'Activa' },
  { value: 'past_due', label: 'Vencida' },
  { value: 'grace_period', label: 'Período de gracia' },
  { value: 'canceled', label: 'Cancelada' },
  { value: 'expired', label: 'Expirada' },
]

interface ForceSubscriptionFormProps {
  consultoraId: string
  estadoActual: SubscriptionEstado
}

export function ForceSubscriptionForm({ consultoraId, estadoActual }: ForceSubscriptionFormProps) {
  const [open, setOpen] = useState(false)
  const [estado, setEstado] = useState<SubscriptionEstado>(estadoActual)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (estado === estadoActual) {
      setOpen(false)
      return
    }

    startTransition(async () => {
      setError(null)
      try {
        const res = await fetch('/api/admin/force-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consultora_id: consultoraId, estado, motivo: motivo || undefined }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Error desconocido')
          return
        }
        setOpen(false)
        // Forzar recarga para reflejar el nuevo estado
        window.location.reload()
      } catch {
        setError('Error de red')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2.5 py-1 rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary hover:border-brand-primary hover:bg-brand-muted transition-colors"
      >
        Forzar estado
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-surface-base border border-border-subtle rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-text-primary mb-4">
              Forzar estado de suscripción
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Nuevo estado
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as SubscriptionEstado)}
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {ESTADOS.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Motivo (opcional)
                </label>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: demo para cliente potencial"
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 px-3 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 px-3 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isPending ? 'Guardando…' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
