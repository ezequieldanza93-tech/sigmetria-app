'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { createClient } from '@/lib/supabase/client'
import { createInstrumento, updateInstrumento, deleteInstrumento, crearModeloCatalogo } from '@/lib/actions/instrumento'
import { InstrumentoModal } from '@/components/instrumento-modal'
import { PersonaSelector } from '@/components/persona-selector'
import { FileUploadInput } from '@/components/ui/file-upload-input'
import type { InstrumentoMedicion, ActionResult } from '@/lib/types'

// Categoría del catálogo (clase EPC) de la que sale el modelo del instrumento.
// Sus subcategorías (componentes) SON los tipos de medición.
const CAT_MEDICIONES_HYS = '318ea652-2295-4d3f-8ffb-f8f047f84fe6'

type Subcategoria = { id: string; nombre: string }
type ProductoCat = { id: string; nombre: string; codigo: string | null }

function InstrumentoForm({
  subcategorias,
  instrumento,
  onSuccess,
}: {
  subcategorias: Subcategoria[]
  instrumento?: InstrumentoMedicion | null
  onSuccess: () => void
}) {
  const action = instrumento ? updateInstrumento : createInstrumento
  const [state, formAction, pending] = useActionState(
    action,
    null as ActionResult<null> | null
  )
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

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

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

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">{state.error}</div>
      )}
      {instrumento && <input type="hidden" name="id" value={instrumento.id} />}
      <input type="hidden" name="subcategoria_id" value={subcategoriaId} />

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

export default function InstrumentosPage() {
  const [instrumentos, setInstrumentos] = useState<InstrumentoMedicion[] | null>(null)
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([])
  const [activeSubcat, setActiveSubcat] = useState<string>('todos')
  const [showModal, setShowModal] = useState(false)
  const [selectedInstrumento, setSelectedInstrumento] = useState<InstrumentoMedicion | null>(null)

  function load() {
    const supabase = createClient()
    supabase
      .from('mediciones_instrumentos')
      .select('*, productos_componentes(nombre), organizaciones_externas(nombre), personas_directorio(nombre, apellido)')
      .eq('is_active', true)
      .range(0, 99)
      .order('modelo')
      .then(({ data }) => setInstrumentos((data as unknown as InstrumentoMedicion[]) ?? []))
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase
      .from('productos_componentes')
      .select('id, nombre')
      .eq('categoria_id', CAT_MEDICIONES_HYS)
      .order('nombre')
      .then(({ data }) => setSubcategorias((data ?? []) as Subcategoria[]))
  }, [])

  const filtered = instrumentos === null
    ? null
    : activeSubcat === 'todos'
      ? instrumentos
      : instrumentos.filter(i => i.subcategoria_id === activeSubcat)

  async function handleDelete(id: string) {
    if (!confirm('¿Dar de baja este instrumento?')) return
    await deleteInstrumento(id)
    setInstrumentos(prev => prev?.filter(i => i.id !== id) ?? null)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Instrumentos de Medición</h1>
          <p className="text-sm text-text-secondary mt-1">Equipos de medición habilitados para uso en campo</p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ Nuevo Instrumento</Button>
      </div>

      {/* Filtro por tipo de medición (subcategoría del catálogo) */}
      <div className="flex gap-1 mb-5 flex-wrap">
        <button
          onClick={() => setActiveSubcat('todos')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeSubcat === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
        >
          Todos {instrumentos !== null && `(${instrumentos.length})`}
        </button>
        {subcategorias.map(s => {
          const count = instrumentos?.filter(i => i.subcategoria_id === s.id).length ?? 0
          return (
            <button
              key={s.id}
              onClick={() => setActiveSubcat(s.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeSubcat === s.id ? 'bg-sig-500 text-white border-sig-500' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
            >
              {s.nombre} ({count})
            </button>
          )
        })}
      </div>

      {filtered === null ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">
          No hay instrumentos registrados{activeSubcat !== 'todos' ? ' de este tipo' : ''}.
        </div>
      ) : (
        <div className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle bg-surface-base">
              <tr className="text-left">
                <th className="px-5 py-3 text-text-secondary font-medium">Modelo</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Tipo de medición</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Marca</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Nro. de serie</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Dueño</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(i => (
                <tr key={i.id} className="hover:bg-surface-base cursor-pointer" onClick={() => setSelectedInstrumento(i)}>
                  <td className="px-5 py-3.5 font-medium text-text-primary">{i.modelo ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sig-50 text-sig-700">
                      {i.productos_componentes?.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">{i.organizaciones_externas?.nombre ?? '—'}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{i.numero_serie ?? '—'}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{i.personas_directorio ? `${i.personas_directorio.apellido}, ${i.personas_directorio.nombre}` : '—'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(i.id) }}
                      className="text-xs text-red-400 hover:text-danger"
                    >
                      Dar de baja
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedInstrumento && (
        <InstrumentoModal
          instrumento={selectedInstrumento}
          open={!!selectedInstrumento}
          onClose={() => setSelectedInstrumento(null)}
          canWrite={true}
        />
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo Instrumento">
        <InstrumentoForm
          subcategorias={subcategorias}
          onSuccess={() => { setShowModal(false); load() }}
        />
      </Modal>
    </div>
  )
}
