'use client'

import { useState, useCallback } from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import type { Plan, PlanFeature, ActionResult } from '@/lib/types'
import { FEATURE_CATALOG, getFeaturesByCategory } from '@/lib/plan-features'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface PlanFormProps {
  mode: 'create' | 'edit'
  plan?: Plan
  planFeatures?: PlanFeature[]
  action: (prev: ActionResult<null> | null, formData: FormData) => Promise<ActionResult<null>>
}

function formatInputValue(value: number | null | undefined): string {
  if (value == null) return ''
  return String(value)
}

export function PlanForm({ mode, plan, planFeatures, action }: PlanFormProps) {
  const router = useRouter()
  const [nombre, setNombre] = useState(plan?.nombre ?? '')
  const [slug, setSlug] = useState(plan?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(!!plan?.slug)

  const [customFeatures, setCustomFeatures] = useState<string[]>(() => {
    if (!planFeatures) return []
    const catalogKeys = new Set(FEATURE_CATALOG.map(f => f.key))
    return planFeatures.map(f => f.feature_key).filter(k => !catalogKeys.has(k))
  })
  const [newFeatureKey, setNewFeatureKey] = useState('')

  const handleNombreChange = useCallback((value: string) => {
    setNombre(value)
    if (!slugEdited) {
      setSlug(slugify(value))
    }
  }, [slugEdited])

  const featuresByCategory = getFeaturesByCategory()
  const featuresMap = new Map(planFeatures?.map(f => [f.feature_key, f.habilitado]) ?? [])

  const [, formAction, isPending] = useActionState(action, null)

  function addCustomFeature() {
    const key = slugify(newFeatureKey)
    if (!key || customFeatures.includes(key)) return
    setCustomFeatures(prev => [...prev, key])
    setNewFeatureKey('')
  }

  return (
    <form action={formAction} className="space-y-8 max-w-2xl">
      <input type="hidden" name="is_active" value={plan?.is_active !== false ? 'on' : ''} />

      {/* Información básica */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-text-primary">Información básica</h2>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Nombre *</label>
          <input
            type="text"
            name="nombre"
            value={nombre}
            onChange={e => handleNombreChange(e.target.value)}
            required
            placeholder="Ej: Profesional Plus"
            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Slug
            <span className="text-text-tertiary ml-1 font-normal">(URL única, auto-generada)</span>
          </label>
          <input
            type="text"
            name="slug"
            value={slug}
            onChange={e => { setSlug(e.target.value); setSlugEdited(true) }}
            placeholder="profesional-plus"
            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Descripción corta</label>
          <input
            type="text"
            name="descripcion_corta"
            defaultValue={plan?.descripcion_corta ?? ''}
            placeholder="Ej: Para profesionales independientes"
            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Tipo</label>
          <input
            type="text"
            name="tipo"
            defaultValue={plan?.tipo ?? ''}
            placeholder="Ej: profesional"
            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="destacado"
              defaultChecked={plan?.destacado ?? false}
              className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary"
            />
            <span className="text-sm text-text-primary">Plan recomendado</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="is_visible"
              defaultChecked={plan?.is_visible ?? true}
              className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary"
            />
            <span className="text-sm text-text-primary">Visible en billing</span>
          </label>
        </div>
      </section>

      {/* Precios */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-text-primary">Precios (ARS, sin IVA)</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Precio mensual
              <span className="text-text-tertiary ml-1 font-normal">(vacío = a medida)</span>
            </label>
            <input
              type="number"
              name="precio_mensual_neto"
              defaultValue={formatInputValue(plan?.precio_mensual_neto)}
              step="0.01"
              min="0"
              placeholder="16900"
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Precio anual</label>
            <input
              type="number"
              name="precio_anual_neto"
              defaultValue={formatInputValue(plan?.precio_anual_neto)}
              step="0.01"
              min="0"
              placeholder="202800"
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">IVA %</label>
            <input
              type="number"
              name="iva_porcentaje"
              defaultValue={formatInputValue(plan?.iva_porcentaje) || '21.00'}
              step="0.01"
              min="0"
              max="100"
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Precio seat adicional
              <span className="text-text-tertiary ml-1 font-normal">(vacío = no disponible)</span>
            </label>
            <input
              type="number"
              name="precio_extra_seat_neto"
              defaultValue={formatInputValue(plan?.precio_extra_seat_neto) || '15000'}
              step="0.01"
              min="0"
              placeholder="15000"
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
            />
          </div>
        </div>
      </section>

      {/* Límites */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-text-primary">
          Límites
          <span className="text-text-tertiary ml-1 font-normal text-sm">(vacío = ilimitado)</span>
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Max colaboradores
              <span className="text-text-tertiary ml-1 font-normal">(0 = solo titular)</span>
            </label>
            <input
              type="number"
              name="max_colaboradores"
              defaultValue={formatInputValue(plan?.max_colaboradores)}
              min="0"
              placeholder="Ilimitado"
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Max empresas</label>
            <input
              type="number"
              name="max_empresas"
              defaultValue={formatInputValue(plan?.max_empresas)}
              min="0"
              placeholder="Ilimitado"
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Max establecimientos</label>
            <input
              type="number"
              name="max_establecimientos"
              defaultValue={formatInputValue(plan?.max_establecimientos)}
              min="0"
              placeholder="Ilimitado"
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Max registros de gestión</label>
            <input
              type="number"
              name="max_gestiones_registros"
              defaultValue={formatInputValue(plan?.max_gestiones_registros)}
              min="0"
              placeholder="Ilimitado"
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Max registros de horario</label>
            <input
              type="number"
              name="max_horarios_registros"
              defaultValue={formatInputValue(plan?.max_horarios_registros)}
              min="0"
              placeholder="Ilimitado"
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary"
            />
          </div>
        </div>
      </section>

      {/* Feature Flags */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-text-primary">Feature Flags</h2>

        {Array.from(featuresByCategory.entries()).map(([category, features]) => (
          <div key={category}>
            <h3 className="text-sm font-medium text-text-secondary mb-2">{category}</h3>
            <div className="grid grid-cols-2 gap-2">
              {features.map(f => (
                <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name={`feature_${f.key}`}
                    defaultChecked={featuresMap.get(f.key) ?? false}
                    className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary"
                  />
                  <span className="text-sm text-text-primary">{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Custom features */}
        {customFeatures.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">Features personalizadas</h3>
            <div className="grid grid-cols-2 gap-2">
              {customFeatures.map(key => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name={`feature_${key}`}
                    defaultChecked={featuresMap.get(key) ?? false}
                    className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary"
                  />
                  <span className="text-sm text-text-primary">{key}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Agregar feature key</label>
            <input
              type="text"
              value={newFeatureKey}
              onChange={e => setNewFeatureKey(e.target.value)}
              placeholder="ej: modulo_auditoria"
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-text-tertiary font-mono"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomFeature() } }}
            />
          </div>
          <button
            type="button"
            onClick={addCustomFeature}
            disabled={!newFeatureKey.trim()}
            className="px-3 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            + Agregar
          </button>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border-subtle">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending
            ? 'Guardando…'
            : mode === 'create'
              ? 'Crear plan'
              : 'Guardar cambios'
          }
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
