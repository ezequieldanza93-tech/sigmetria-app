'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Check } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { catalogoArbolKey } from '@/lib/queries/producto-catalogo'
import {
  createClase,
  createCategoria,
  createComponente,
} from '@/lib/actions/producto-catalogo'
import type { ProductoClase, ProductoComponente, CategoriaProducto } from '@/lib/types'

// ─── Árbol del catálogo ──────────────────────────────────────────────────────
// Helpers puros para filtrar clase → categoría → componente en cascada.
// Se comparten entre los filtros de la página y el form de alta de producto.

export interface CatalogoArbol {
  clases: ProductoClase[]
  categorias: CategoriaProducto[]
  componentes: ProductoComponente[]
}

/** Categorías que cuelgan de una clase. '' (vacío) → todas las categorías. */
export function categoriasDeClase(
  categorias: CategoriaProducto[],
  claseId: string,
): CategoriaProducto[] {
  if (!claseId) return categorias
  return categorias.filter(c => c.clase_id === claseId)
}

/** Componentes que cuelgan de una categoría. '' (vacío) → ninguno (no aplica). */
export function componentesDeCategoria(
  componentes: ProductoComponente[],
  categoriaId: string,
): ProductoComponente[] {
  if (!categoriaId) return []
  return componentes.filter(co => co.categoria_id === categoriaId)
}

// ─── Mini-creador inline ──────────────────────────────────────────────────────
// Input compacto + confirmar/cancelar para crear un nivel del árbol sin salir del form.

function InlineCreator({
  label,
  disabled,
  disabledHint,
  onCreate,
}: {
  label: string
  disabled?: boolean
  disabledHint?: string
  onCreate: (nombre: string) => Promise<string | null>
}) {
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    const n = nombre.trim()
    if (!n) return
    setPending(true)
    setError(null)
    const err = await onCreate(n)
    setPending(false)
    if (err) {
      setError(err)
      return
    }
    setNombre('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        title={disabled ? disabledHint : undefined}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-sig-600 hover:text-sig-700 disabled:text-text-tertiary disabled:cursor-not-allowed"
      >
        <Plus size={13} aria-hidden="true" />
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); confirm() }
            if (e.key === 'Escape') { setOpen(false); setError(null) }
          }}
          placeholder="Nombre…"
          className="flex-1 border border-border-default rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
        />
        <button
          type="button"
          disabled={pending || !nombre.trim()}
          onClick={confirm}
          aria-label="Confirmar"
          className="p-1.5 rounded-lg bg-sig-500 text-white disabled:opacity-50"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          aria-label="Cancelar"
          className="p-1.5 rounded-lg border border-border-default text-text-tertiary hover:text-text-primary"
        >
          <X size={14} />
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

/**
 * Cascada clase → categoría → componente para el FORM de alta de producto.
 * Cada select participa del submit nativo (categoria_id, componente_id) vía
 * SearchableSelect con `name`. La clase NO se envía al server: la deriva la categoría.
 *
 * Reglas:
 * - Al cambiar la clase se resetea categoría y componente.
 * - Al cambiar la categoría se resetea componente.
 * - El select de componente solo aparece si la categoría elegida tiene componentes.
 *
 * Creación inline: cada nivel ofrece "+ nueva …". Para staff developer crea genéricas
 * (consultora_id NULL); para consultora crea propias. Tras crear, refresca el árbol y
 * autoselecciona el nuevo ítem.
 */
export function CatalogoCascadeForm({
  arbol,
  claseId,
  categoriaId,
  componenteId,
  onClaseChange,
  onCategoriaChange,
  onComponenteChange,
  esGenerico = false,
}: {
  arbol: CatalogoArbol
  claseId: string
  categoriaId: string
  componenteId: string
  onClaseChange: (v: string) => void
  onCategoriaChange: (v: string) => void
  onComponenteChange: (v: string) => void
  /** Si true, la creación inline crea ítems genéricos (solo staff developer). */
  esGenerico?: boolean
}) {
  const qc = useQueryClient()

  // Modo edición: si viene categoriaId pero no claseId (ej. producto existente),
  // derivamos la clase del árbol para habilitar el select de categoría.
  useEffect(() => {
    if (!claseId && categoriaId) {
      const cat = arbol.categorias.find(c => c.id === categoriaId)
      if (cat?.clase_id) onClaseChange(cat.clase_id)
    }
  }, [categoriaId, claseId]) // eslint-disable-line react-hooks/exhaustive-deps

  const categorias = categoriasDeClase(arbol.categorias, claseId)
  const componentes = componentesDeCategoria(arbol.componentes, categoriaId)

  // Refresca el árbol del catálogo tras crear un nivel nuevo.
  function refetchArbol() {
    return qc.invalidateQueries({ queryKey: catalogoArbolKey })
  }

  return (
    <div className="space-y-3">
      <div>
        <SearchableSelect
          label="Clase"
          required
          value={claseId}
          onChange={onClaseChange}
          placeholder="Elegí una clase…"
          options={arbol.clases.map(cl => ({ value: cl.id, label: cl.nombre }))}
          emptyText="No hay clases."
        />
        <div className="mt-1">
          <InlineCreator
            label="Nueva clase"
            onCreate={async (n) => {
              const res = await createClase(n, esGenerico)
              if (!res.success) return res.error
              await refetchArbol()
              onClaseChange(res.data.id)
              return null
            }}
          />
        </div>
      </div>

      <div>
        <SearchableSelect
          label="Categoría"
          required
          name="categoria_id"
          value={categoriaId}
          onChange={onCategoriaChange}
          disabled={!claseId}
          placeholder={claseId ? 'Elegí una categoría…' : 'Elegí una clase primero'}
          options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
          emptyText="Esta clase no tiene categorías."
        />
        <div className="mt-1">
          <InlineCreator
            label="Nueva categoría"
            disabled={!claseId}
            disabledHint="Elegí una clase primero"
            onCreate={async (n) => {
              const res = await createCategoria(n, claseId, esGenerico)
              if (!res.success) return res.error
              await refetchArbol()
              onCategoriaChange(res.data.id)
              return null
            }}
          />
        </div>
      </div>

      {/* El componente es opcional: el select aparece si la categoría tiene componentes;
          el creador inline está disponible siempre que haya una categoría elegida. */}
      <div>
        {componentes.length > 0 && (
          <SearchableSelect
            label="Componente (opcional)"
            name="componente_id"
            value={componenteId}
            onChange={onComponenteChange}
            placeholder="Sin componente específico"
            options={componentes.map(co => ({ value: co.id, label: co.nombre }))}
            emptyText="Esta categoría no tiene componentes."
          />
        )}
        {/* Si no hay componente seleccionable visible, transportamos componente_id (vacío) al form. */}
        {componentes.length === 0 && (
          <input type="hidden" name="componente_id" value="" />
        )}
        <div className="mt-1">
          <InlineCreator
            label="Nuevo componente"
            disabled={!categoriaId}
            disabledHint="Elegí una categoría primero"
            onCreate={async (n) => {
              const res = await createComponente(n, categoriaId, esGenerico)
              if (!res.success) return res.error
              await refetchArbol()
              onComponenteChange(res.data.id)
              return null
            }}
          />
        </div>
      </div>
    </div>
  )
}
