'use client'

import { useTransition, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { togglePlanVisibility, togglePlanDestacado, deletePlan, reorderPlans } from '@/lib/actions/admin/plan'
import type { PlanWithSubscribers } from '@/lib/types'

function formatARS(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)
}

interface PlanListClientProps {
  plans: PlanWithSubscribers[]
}

export function PlanListClient({ plans }: PlanListClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [items, setItems] = useState(plans)

  const moveUp = useCallback((index: number) => {
    if (index === 0) return
    const newItems = [...items]
    ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
    setItems(newItems)
    startTransition(async () => {
      await reorderPlans(newItems.map(p => p.id))
      router.refresh()
    })
  }, [items, router])

  const moveDown = useCallback((index: number) => {
    if (index === items.length - 1) return
    const newItems = [...items]
    ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
    setItems(newItems)
    startTransition(async () => {
      await reorderPlans(newItems.map(p => p.id))
      router.refresh()
    })
  }, [items, router])

  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-surface-elevated">
            <th className="px-3 py-3 w-16"></th>
            <th className="px-4 py-3 text-left font-medium text-text-tertiary">Nombre</th>
            <th className="px-4 py-3 text-left font-medium text-text-tertiary">Slug</th>
            <th className="px-4 py-3 text-right font-medium text-text-tertiary">Precio mes</th>
            <th className="px-4 py-3 text-right font-medium text-text-tertiary">Precio año</th>
            <th className="px-4 py-3 text-center font-medium text-text-tertiary">Suscriptores activos</th>
            <th className="px-4 py-3 text-center font-medium text-text-tertiary">Visible</th>
            <th className="px-4 py-3 text-center font-medium text-text-tertiary">Destacado</th>
            <th className="px-4 py-3 text-right font-medium text-text-tertiary">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {items.map((plan, i) => (
            <tr
              key={plan.id}
              className={`hover:bg-surface-elevated/50 transition-colors ${!plan.is_visible ? 'opacity-60' : ''}`}
            >
              <td className="px-3 py-3">
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveUp(i)}
                    disabled={i === 0 || isPending}
                    className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors"
                    title="Mover arriba"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(i)}
                    disabled={i === items.length - 1 || isPending}
                    className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors"
                    title="Mover abajo"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/admin/planes/${plan.id}`}
                  className="font-medium text-text-primary hover:text-brand-primary transition-colors"
                >
                  {plan.nombre}
                </Link>
                {plan.descripcion_corta && (
                  <p className="text-xs text-text-tertiary mt-0.5">{plan.descripcion_corta}</p>
                )}
              </td>
              <td className="px-4 py-3 text-text-secondary font-mono text-xs">{plan.slug}</td>
              <td className="px-4 py-3 text-text-primary font-mono text-xs text-right">{formatARS(plan.precio_mensual_neto)}</td>
              <td className="px-4 py-3 text-text-primary font-mono text-xs text-right">{formatARS(plan.precio_anual_neto)}</td>
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-surface-elevated text-xs font-medium text-text-primary">
                  {plan.subscriber_count}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <VisibilityToggle planId={plan.id} isVisible={plan.is_visible} />
              </td>
              <td className="px-4 py-3 text-center">
                <DestacadoToggle planId={plan.id} destacado={plan.destacado} />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/dashboard/admin/planes/${plan.id}/editar`}
                    className="px-2.5 py-1 rounded-md border border-border-subtle text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Editar
                  </Link>
                  <DeleteButton planId={plan.id} subscriberCount={plan.subscriber_count} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VisibilityToggle({ planId, isVisible }: { planId: string; isVisible: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await togglePlanVisibility(planId, !isVisible)
          router.refresh()
        })
      }}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1 ${
        isVisible ? 'bg-green-500' : 'bg-zinc-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          isVisible ? 'translate-x-4.5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function DestacadoToggle({ planId, destacado }: { planId: string; destacado: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await togglePlanDestacado(planId, !destacado)
          router.refresh()
        })
      }}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1 ${
        destacado ? 'bg-amber-500' : 'bg-zinc-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          destacado ? 'translate-x-4.5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function DeleteButton({ planId, subscriberCount }: { planId: string; subscriberCount: number | undefined }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-red-500">¿Eliminar?</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await deletePlan(planId)
              router.refresh()
            })
          }}
          className="px-2 py-1 rounded-md bg-red-500 text-white text-xs hover:bg-red-600 transition-colors"
        >
          {isPending ? '…' : 'Sí'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="px-2 py-1 rounded-md border border-border-subtle text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="px-2.5 py-1 rounded-md border border-border-subtle text-xs text-red-500 hover:bg-red-50 transition-colors"
    >
      {(subscriberCount ?? 0) > 0 ? 'Desactivar' : 'Eliminar'}
    </button>
  )
}
