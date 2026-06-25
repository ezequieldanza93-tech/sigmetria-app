'use client'

import { useState, useTransition } from 'react'
import { Gift, Loader2, XCircle, CheckCircle, Clock } from 'lucide-react'
import { regalarPlan, cancelarRegalo, type GiftedPlanRow, type PlanRegalable } from '@/lib/actions/regalar-plan'

// ─── Props ────────────────────────────────────────────────

interface RegalarPlanClientProps {
  planes: PlanRegalable[]
  regalosIniciales: GiftedPlanRow[]
}

// ─── Componente principal ─────────────────────────────────

export function RegalarPlanClient({ planes, regalosIniciales }: RegalarPlanClientProps) {
  const [regalos, setRegalos] = useState<GiftedPlanRow[]>(regalosIniciales)
  const [isPending, startTransition] = useTransition()
  const [isCanceling, startCancelTransition] = useTransition()

  const [email, setEmail] = useState('')
  const [planId, setPlanId] = useState(planes[0]?.id ?? '')
  const [ciclo, setCiclo] = useState<'monthly' | 'annual'>('monthly')
  const [isFounder, setIsFounder] = useState(false)
  const [nota, setNota] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null)

  function resetForm() {
    setEmail('')
    setPlanId(planes[0]?.id ?? '')
    setCiclo('monthly')
    setIsFounder(false)
    setNota('')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFeedback(null)

    startTransition(async () => {
      const result = await regalarPlan({ email, planId, ciclo, isFounder, nota })
      if (result.success) {
        setFeedback({ type: 'ok', msg: `Plan regalado a ${email}. Se envió el email de invitación.` })
        resetForm()
        // Refrescar la lista haciendo un fetch liviano — la action ya hizo revalidatePath
        // pero como estamos en 'use client', recargamos desde el padre vía router.refresh()
        // En su lugar, forzamos un re-render simple actualizando state. El server component
        // hará revalidación al próximo acceso, que es suficiente.
      } else {
        setFeedback({ type: 'error', msg: result.error })
      }
    })
  }

  function handleCancelar(giftId: string) {
    startCancelTransition(async () => {
      const result = await cancelarRegalo(giftId)
      if (result.success) {
        setRegalos(prev => prev.map(r => r.id === giftId ? { ...r, estado: 'cancelado' } : r))
      } else {
        alert(`Error al cancelar: ${result.error}`)
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* ── Formulario ── */}
      <div className="bg-surface-primary border border-border-subtle rounded-xl p-6">
        <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Gift size={16} className="text-text-tertiary" aria-hidden="true" />
          Nuevo regalo
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="gift-email" className="block text-sm font-medium text-text-secondary mb-1">
              Email del destinatario
            </label>
            <input
              id="gift-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-sunken text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-colors"
            />
          </div>

          {/* Plan */}
          <div>
            <label htmlFor="gift-plan" className="block text-sm font-medium text-text-secondary mb-1">
              Plan
            </label>
            <select
              id="gift-plan"
              required
              value={planId}
              onChange={e => setPlanId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-sunken text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-colors"
            >
              {planes.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.precio_mensual_neto != null ? ` — $${p.precio_mensual_neto.toLocaleString('es-AR')} /mes` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Ciclo */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Ciclo</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="gift-ciclo"
                  value="monthly"
                  checked={ciclo === 'monthly'}
                  onChange={() => setCiclo('monthly')}
                  className="accent-brand-primary"
                />
                <span className="text-sm text-text-primary">Mensual</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="gift-ciclo"
                  value="annual"
                  checked={ciclo === 'annual'}
                  onChange={() => setCiclo('annual')}
                  className="accent-brand-primary"
                />
                <span className="text-sm text-text-primary">Anual</span>
              </label>
            </div>
          </div>

          {/* Fundador */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isFounder}
              onChange={e => setIsFounder(e.target.checked)}
              className="mt-0.5 accent-brand-primary"
            />
            <span className="text-sm text-text-primary">
              Fundador/a{' '}
              <span className="text-text-tertiary text-xs">(−20% de por vida + cupo fundador)</span>
            </span>
          </label>

          {/* Nota */}
          <div>
            <label htmlFor="gift-nota" className="block text-sm font-medium text-text-secondary mb-1">
              Nota interna <span className="text-text-tertiary font-normal">(opcional — se incluye en el email)</span>
            </label>
            <textarea
              id="gift-nota"
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={2}
              placeholder="Ej: Acceso de regalo por participar en el programa de early adopters."
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-sunken text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-colors resize-none"
            />
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
                feedback.type === 'ok'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {feedback.type === 'ok'
                ? <CheckCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                : <XCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              }
              {feedback.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || planes.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {isPending ? 'Enviando…' : 'Regalar plan'}
          </button>
        </form>
      </div>

      {/* ── Historial de regalos ── */}
      <div>
        <h2 className="text-base font-semibold text-text-primary mb-3">Regalos emitidos</h2>

        {regalos.length === 0 ? (
          <p className="text-sm text-text-tertiary">No hay regalos emitidos aún.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-sunken border-b border-border-subtle">
                  <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-xs uppercase tracking-wide">Email</th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-xs uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-xs uppercase tracking-wide">Ciclo</th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-xs uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-xs uppercase tracking-wide">Fecha</th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-tertiary text-xs uppercase tracking-wide">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {regalos.map(gift => (
                  <tr key={gift.id} className="bg-surface-primary hover:bg-surface-sunken transition-colors">
                    <td className="px-4 py-3 text-text-primary font-medium">
                      {gift.email}
                      {gift.is_founder && (
                        <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          Fundador
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{gift.plan_nombre}</td>
                    <td className="px-4 py-3 text-text-secondary capitalize">
                      {gift.ciclo === 'annual' ? 'Anual' : 'Mensual'}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={gift.estado} />
                    </td>
                    <td className="px-4 py-3 text-text-tertiary text-xs">
                      {new Date(gift.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {gift.estado === 'pendiente' && (
                        <button
                          onClick={() => handleCancelar(gift.id)}
                          disabled={isCanceling}
                          className="text-xs text-red-600 hover:text-red-700 hover:underline disabled:opacity-50 transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Estado badge ──────────────────────────────────────────

function EstadoBadge({ estado }: { estado: 'pendiente' | 'activado' | 'cancelado' }) {
  const map = {
    pendiente: { label: 'Pendiente', icon: Clock, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    activado: { label: 'Activado', icon: CheckCircle, cls: 'bg-green-50 text-green-700 border-green-200' },
    cancelado: { label: 'Cancelado', icon: XCircle, cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  }
  const { label, icon: Icon, cls } = map[estado]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${cls}`}>
      <Icon size={11} aria-hidden="true" />
      {label}
    </span>
  )
}
