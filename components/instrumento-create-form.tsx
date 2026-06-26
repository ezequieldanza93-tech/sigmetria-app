'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { createClient } from '@/lib/supabase/client'
import {
  createInstrumento,
  updateInstrumento,
  crearModeloCatalogo,
  type InstrumentoCreado,
} from '@/lib/actions/instrumento'
import { PersonaSelector } from '@/components/persona-selector'
import { FileUploadInput } from '@/components/ui/file-upload-input'
import type { InstrumentoMedicion, ActionResult } from '@/lib/types'

// Categoría del catálogo (clase EPC) de la que sale el modelo del instrumento.
// Sus subcategorías (componentes) SON los tipos de medición.
const CAT_MEDICIONES_HYS = '318ea652-2295-4d3f-8ffb-f8f047f84fe6'

export type Subcategoria = { id: string; nombre: string }
type ProductoCat = { id: string; nombre: string; codigo: string | null }

interface InstrumentoCreateFormProps {
  /**
   * Lista de tipos de medición (subcategorías del catálogo). Si NO se pasa, el
   * form la carga solo. La página la pasa para no re-consultar.
   */
  subcategorias?: Subcategoria[]
  /** Edición de un instrumento existente (la página lo usa; el selector no). */
  instrumento?: InstrumentoMedicion | null
  /**
   * Si se provee, el tipo de medición queda FIJADO a esa subcategoría (por
   * NOMBRE) y se oculta el selector de tipo. Lo usa el selector de los modales
   * de medición, que ya conoce su tipo ("Puesta a Tierra (PAT)", "Iluminación",
   * "Ruido", "Carga Térmica").
   */
  lockedSubcategoriaNombre?: string
  /**
   * Se llama tras crear/actualizar con éxito. En alta recibe el instrumento
   * recién creado (id + modelo + numero_serie + marca) para que el selector lo
   * agregue a su lista y lo seleccione. En edición `instrumento` es null.
   */
  onCreated: (instrumento: InstrumentoCreado | null) => void
}

/**
 * Formulario COMPLETO de alta/edición de instrumento de medición. Es el mismo
 * que vive en /dashboard/instrumentos, extraído para poder reusarlo desde el
 * selector de instrumento de los modales de medición (en un Modal).
 *
 * - Elegir tipo de medición (subcategoría) — fijo si viene lockedSubcategoriaNombre.
 * - Elegir modelo del catálogo (Mediciones HyS) o CREAR un modelo nuevo.
 *   La marca se toma del modelo del catálogo.
 * - N° de serie, dueño.
 * - Certificado de calibración OPCIONAL (fechas + archivo) — solo en alta.
 */
export function InstrumentoCreateForm({
  subcategorias: subcategoriasProp,
  instrumento,
  lockedSubcategoriaNombre,
  onCreated,
}: InstrumentoCreateFormProps) {
  const action = instrumento ? updateInstrumento : createInstrumento
  const [state, formAction, pending] = useActionState(
    action,
    null as ActionResult<InstrumentoCreado> | null
  )

  // Subcategorías: las pasa la página o las carga el form (caso selector).
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>(subcategoriasProp ?? [])
  useEffect(() => { if (subcategoriasProp) setSubcategorias(subcategoriasProp) }, [subcategoriasProp])
  useEffect(() => {
    if (subcategoriasProp) return
    let activo = true
    const supabase = createClient()
    supabase
      .from('productos_componentes')
      .select('id, nombre')
      .eq('categoria_id', CAT_MEDICIONES_HYS)
      .order('nombre')
      .then(({ data }) => { if (activo) setSubcategorias((data ?? []) as Subcategoria[]) })
    return () => { activo = false }
  }, [subcategoriasProp])

  const [dueñoId, setDueñoId] = useState<string | null>(instrumento?.dueño_id ?? null)
  const [subcategoriaId, setSubcategoriaId] = useState<string>(instrumento?.subcategoria_id ?? '')
  const [productoId, setProductoId] = useState<string>(instrumento?.producto_id ?? '')
  const [productos, setProductos] = useState<ProductoCat[]>([])
  const [loadingProductos, setLoadingProductos] = useState(false)
  // Alta inline de un modelo en el catálogo (Mediciones HyS) desde acá.
  const [showNuevoModelo, setShowNuevoModelo] = useState(false)
  const [nuevoModelo, setNuevoModelo] = useState('')
  const [creandoModelo, setCreandoModelo] = useState(false)
  const [errorModelo, setErrorModelo] = useState<string | null>(null)
  // El certificado sólo se ofrece al dar de alta. Las renovaciones se cargan después
  // desde la pestaña "Calibraciones" del detalle del instrumento.
  const [showCertificado, setShowCertificado] = useState(false)

  // Si el tipo viene fijado por NOMBRE (selector), resolvemos su id en cuanto
  // tengamos las subcategorías cargadas.
  const lockedSubcat = lockedSubcategoriaNombre
    ? subcategorias.find(s => s.nombre === lockedSubcategoriaNombre)
    : null
  useEffect(() => {
    if (lockedSubcat && lockedSubcat.id !== subcategoriaId) {
      setSubcategoriaId(lockedSubcat.id)
      setProductoId('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedSubcat?.id])

  const onCreatedRef = useRef(onCreated)
  onCreatedRef.current = onCreated
  useEffect(() => { if (state?.success) onCreatedRef.current(state.data) }, [state])

  // Al elegir el tipo de medición (subcategoría), cargamos los modelos del catálogo
  // que cuelgan de ese componente.
  useEffect(() => {
    if (!subcategoriaId) { setProductos([]); return }
    let activo = true
    setLoadingProductos(true)
    const supabase = createClient()
    supabase
      .from('productos')
      .select('id, nombre, codigo')
      .eq('componente_id', subcategoriaId)
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => {
        if (!activo) return
        setProductos((data ?? []) as ProductoCat[])
        setLoadingProductos(false)
      })
    return () => { activo = false }
  }, [subcategoriaId])

  async function handleCrearModelo() {
    const nombre = nuevoModelo.trim()
    if (!nombre) return
    setCreandoModelo(true)
    setErrorModelo(null)
    const res = await crearModeloCatalogo(nombre, subcategoriaId)
    setCreandoModelo(false)
    if (!res.success) { setErrorModelo(res.error); return }
    // Refrescar la lista del componente y seleccionar el modelo recién creado.
    const supabase = createClient()
    const { data } = await supabase
      .from('productos')
      .select('id, nombre, codigo')
      .eq('componente_id', subcategoriaId)
      .eq('is_active', true)
      .order('nombre')
    setProductos((data ?? []) as ProductoCat[])
    setProductoId(res.data.id)
    setShowNuevoModelo(false)
    setNuevoModelo('')
  }

  const tipoFijo = !!lockedSubcategoriaNombre

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">{state.error}</div>
      )}
      {instrumento && <input type="hidden" name="id" value={instrumento.id} />}
      <input type="hidden" name="subcategoria_id" value={subcategoriaId} />

      {tipoFijo ? (
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Tipo de medición</label>
          <div className="w-full border border-border-subtle rounded-lg px-3 py-2 text-sm bg-surface-sunken text-text-secondary">
            {lockedSubcategoriaNombre}
          </div>
        </div>
      ) : (
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Tipo de medición *</label>
          <select
            required
            value={subcategoriaId}
            onChange={e => { setSubcategoriaId(e.target.value); setProductoId('') }}
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base"
          >
            <option value="">Seleccioná el tipo de medición…</option>
            {subcategorias.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Modelo (catálogo Mediciones HyS) *</label>
        <SearchableSelect
          name="producto_id"
          value={productoId}
          onChange={setProductoId}
          options={productos.map(p => ({ value: p.id, label: p.codigo ? `${p.nombre} · ${p.codigo}` : p.nombre }))}
          placeholder={
            !subcategoriaId ? 'Elegí primero el tipo de medición'
              : loadingProductos ? 'Cargando modelos…'
              : 'Buscar modelo en el catálogo…'
          }
          emptyText="No hay modelos en esta subcategoría del catálogo."
          disabled={!subcategoriaId || loadingProductos}
        />
        {subcategoriaId && !showNuevoModelo && (
          <button
            type="button"
            onClick={() => { setShowNuevoModelo(true); setErrorModelo(null) }}
            className="mt-1.5 text-xs text-sig-600 hover:text-sig-700 font-medium"
          >
            + Crear un modelo nuevo en el catálogo
          </button>
        )}
        {showNuevoModelo && (
          <div className="mt-2 space-y-1.5">
            {errorModelo && <p className="text-xs text-danger">{errorModelo}</p>}
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevoModelo}
                onChange={e => setNuevoModelo(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCrearModelo() } }}
                placeholder="Nombre del modelo (ej: Testo 815)…"
                className="flex-1 border border-border-default rounded-lg px-3 py-2 text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={handleCrearModelo}
                disabled={creandoModelo || !nuevoModelo.trim()}
                className="px-3 py-2 text-sm bg-sig-500 text-white rounded-lg hover:bg-sig-600 disabled:opacity-50 transition-colors"
              >
                {creandoModelo ? '…' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={() => { setShowNuevoModelo(false); setErrorModelo(null); setNuevoModelo('') }}
                className="px-3 py-2 text-sm border border-border-default rounded-lg hover:bg-surface-base transition-colors"
              >
                Cancelar
              </button>
            </div>
            <p className="text-xs text-text-tertiary">Se agrega a tu catálogo (Mediciones HyS) en la subcategoría elegida y queda seleccionado.</p>
          </div>
        )}
        {!showNuevoModelo && <p className="text-xs text-text-tertiary mt-1">La marca se toma del catálogo.</p>}
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Número de serie</label>
        <input name="numero_serie" defaultValue={instrumento?.numero_serie ?? ''} className="w-full border border-border-default rounded-lg px-3 py-2 text-sm" placeholder="Ej: SN-12345" />
      </div>
      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Dueño</label>
        <PersonaSelector name="dueño_id" value={dueñoId} onChange={setDueñoId} placeholder="Buscar persona (dueño del instrumento)…" />
      </div>

      {/* Certificado de calibración OPCIONAL — sólo al dar de alta. */}
      {!instrumento && (
        <div className="border border-border-subtle rounded-lg p-3 bg-surface-base">
          {!showCertificado ? (
            <button
              type="button"
              onClick={() => setShowCertificado(true)}
              className="text-sm text-sig-500 hover:text-sig-700 font-medium"
            >
              + Certificado de calibración (opcional)
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-secondary">Certificado de calibración (opcional)</p>
                <button
                  type="button"
                  onClick={() => setShowCertificado(false)}
                  className="text-xs text-text-tertiary hover:text-text-secondary"
                >
                  Quitar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">Fecha emisión</label>
                  <input name="cert_fecha_emision" type="date" className="w-full border border-border-default rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">Fecha vencimiento</label>
                  <input name="cert_fecha_vencimiento" type="date" className="w-full border border-border-default rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
              <FileUploadInput
                name="certificado"
                label="Archivo del certificado"
                accept="application/pdf,image/png,image/jpeg"
                maxSizeMB={5}
                helpText="PDF, PNG o JPG. Máx 5 MB. Si cargás el certificado, completá ambas fechas."
                kind="document"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}
