'use client'

import { useEffect, useRef, useState } from 'react'
import { MultiSelectFilter } from '@/components/ui/multi-select-filter'
import { useCatalogoArbol } from '@/lib/queries/producto-catalogo'
import { getProductoCategorias, setProductoCategorias } from '@/lib/actions/producto-clasificacion'

/**
 * Editor multi-select de las categorías de un producto (clasificación N:N).
 * Lee/escribe producto_categoria_map. Permite 1 o varias categorías por producto.
 *
 * AUTO-GUARDADO: cada cambio se persiste solo (debounce 600ms). NO hay botón
 * "Guardar" — antes el cambio se veía en los chips pero no tocaba la base hasta
 * apretar "Guardar", y un refresh lo borraba. Ahora es imposible perder trabajo.
 *
 * La RLS protege: base → solo staff developer; propios → members de la consultora.
 */
export function ProductoCategoriasEditor({
  productoId,
  canEdit = true,
}: {
  productoId: string
  /** Si false, se muestra solo lectura (sin editar). Default true. */
  canEdit?: boolean
}) {
  const { data: arbol } = useCatalogoArbol()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [inicial, setInicial] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Evita que el auto-guardado dispare durante la carga inicial del producto.
  const cargando = useRef(true)

  useEffect(() => {
    let cancel = false
    cargando.current = true
    setSaved(false)
    setError(null)
    getProductoCategorias(productoId).then(res => {
      if (cancel || !res.success) return
      const s = new Set(res.data)
      setSel(s)
      setInicial(s)
      cargando.current = false
    })
    return () => { cancel = true }
  }, [productoId])

  // Auto-guardado: persiste apenas el usuario cambia la selección (debounce 600ms).
  useEffect(() => {
    if (cargando.current) return
    const dirty = sel.size !== inicial.size || [...sel].some(v => !inicial.has(v))
    if (!dirty) return
    const t = setTimeout(async () => {
      setSaving(true)
      setError(null)
      const res = await setProductoCategorias(productoId, [...sel])
      setSaving(false)
      if (res.success) {
        setInicial(new Set(sel))
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setError(res.error)
      }
    }, 600)
    return () => clearTimeout(t)
  }, [sel, inicial, productoId])

  // Solo categorías de la taxonomía nueva (con clase). Label "Clase › Categoría".
  const claseNombre = new Map((arbol?.clases ?? []).map(c => [c.id, c.nombre]))
  const opciones = (arbol?.categorias ?? [])
    .filter(c => c.clase_id)
    .map(c => ({ value: c.id, label: `${claseNombre.get(c.clase_id!) ?? '—'} › ${c.nombre}` }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const labelDe = (id: string) => opciones.find(o => o.value === id)?.label ?? '—'

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <p className="text-xs font-medium text-text-secondary">Categorías ({sel.size})</p>
        {canEdit && (
          <MultiSelectFilter
            label="Editar"
            options={opciones}
            selected={sel}
            onChange={setSel}
            emptyLabel="Sin categorías en el catálogo"
          />
        )}
        {canEdit && saving && <span className="text-xs text-text-tertiary">Guardando…</span>}
        {canEdit && !saving && saved && <span className="text-xs text-green-600">Guardado ✓</span>}
      </div>

      {error && <p className="text-xs text-danger mb-1.5">{error}</p>}

      <div className="flex gap-1.5 flex-wrap">
        {sel.size === 0 ? (
          <span className="text-xs italic text-text-tertiary">Sin clasificar</span>
        ) : (
          [...sel].map(id => (
            <span key={id} className="px-2.5 py-1 rounded-md border border-border-default text-xs text-text-primary bg-surface-base">
              {labelDe(id)}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
