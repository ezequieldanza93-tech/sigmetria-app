'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { createProducto, deleteProducto } from '@/lib/actions/producto'
import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'
import type { Producto, CategoriaProducto, Organizacion, ActionResult, Unidad } from '@/lib/types'

function ProductoForm({
  categorias,
  marcas,
  unidades,
  onSuccess,
}: {
  categorias: CategoriaProducto[]
  marcas: Organizacion[]
  unidades: Unidad[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(
    createProducto,
    null as ActionResult<null> | null
  )
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">{state.error}</div>
      )}
      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Nombre *</label>
        <input name="nombre" required className="w-full border border-border-default rounded-lg px-3 py-2 text-sm" placeholder="Ej: Casco de seguridad" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Categoría *</label>
          <select name="categoria_id" required className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base">
            <option value="">Seleccioná…</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Marca</label>
          <select name="marca_id" className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base">
            <option value="">Sin marca</option>
            {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Tamaño</label>
          <input name="tamano" type="number" step="0.01" min="0" className="w-full border border-border-default rounded-lg px-3 py-2 text-sm" placeholder="Ej: 500" />
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Unidad</label>
          <select name="unidad_id" className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base">
            <option value="">—</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.simbolo})</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Descripción</label>
        <textarea name="descripcion" rows={2} className="w-full border border-border-default rounded-lg px-3 py-2 text-sm resize-none" placeholder="Opcional…" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [categorias, setCategorias] = useState<CategoriaProducto[]>([])
  const [marcas, setMarcas] = useState<Organizacion[]>([])
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [activeCategoria, setActiveCategoria] = useState<string>('todos')
  const [showModal, setShowModal] = useState(false)
  // Los productos genéricos (consultora_id IS NULL) son base de Sigmetría:
  // solo el staff los borra; el resto los ve como solo-lectura.
  const isStaff = useEffectiveRoleContext()?.isSuperAdmin ?? false

  function load() {
    const supabase = createClient()
    supabase
      .from('productos')
      .select('*, productos_categorias(nombre), organizaciones_externas(nombre), unidades(nombre, simbolo)')
      .eq('is_active', true)
      .range(0, 99)
      .order('nombre')
      .then(({ data }) => setProductos((data as unknown as Producto[]) ?? []))
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.from('productos_categorias').select('*').order('nombre')
      .then(({ data }) => setCategorias(data ?? []))
    supabase.from('organizaciones_externas').select('id, nombre, tipo_id, organizaciones_tipos(nombre)')
      .range(0, 99)
      .eq('is_active', true).order('nombre')
      .then(({ data }) => {
        const marcasOnly = ((data ?? []) as unknown as Organizacion[]).filter(o => o.organizaciones_tipos?.nombre === 'Marca')
        setMarcas(marcasOnly)
      })
    supabase.from('unidades').select('id, nombre, simbolo, categoria')
      .eq('is_active', true).order('categoria').order('nombre')
      .then(({ data }) => setUnidades((data ?? []) as unknown as Unidad[]))
  }, [])

  const filtered = productos === null
    ? null
    : activeCategoria === 'todos'
      ? productos
      : productos.filter(p => p.categoria_id === activeCategoria)

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este producto?')) return
    await deleteProducto(id)
    setProductos(prev => prev?.filter(p => p.id !== id) ?? null)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Productos</h1>
          <p className="text-sm text-text-secondary mt-1">Catálogo de EPP y otros productos de seguridad</p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ Nuevo Producto</Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        <button
          onClick={() => setActiveCategoria('todos')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeCategoria === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
        >
          Todos {productos !== null && `(${productos.length})`}
        </button>
        {categorias.map(c => {
          const count = productos?.filter(p => p.categoria_id === c.id).length ?? 0
          return (
            <button
              key={c.id}
              onClick={() => setActiveCategoria(c.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeCategoria === c.id ? 'bg-sig-500 text-white border-sig-500' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
            >
              {c.nombre} ({count})
            </button>
          )
        })}
      </div>

      {filtered === null ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">
          No hay productos registrados{activeCategoria !== 'todos' ? ' en esta categoría' : ''}.
        </div>
      ) : (
        <div className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle bg-surface-base">
              <tr className="text-left">
                <th className="px-5 py-3 text-text-secondary font-medium">Nombre</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Categoría</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Marca</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Tamaño</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-surface-base">
                  <td className="px-5 py-3.5 font-medium text-text-primary">
                    <div className="flex items-center gap-2">
                      {p.nombre}
                      {p.consultora_id === null && (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--info-bg)] text-[var(--info)]"
                          title="Provisto por Sigmetría — compartido con todas las consultoras"
                        >
                          Base
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sig-50 text-sig-700">
                      {p.productos_categorias?.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">{p.organizaciones_externas?.nombre ?? '—'}</td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {p.tamano ? `${p.tamano} ${p.unidades?.simbolo ?? ''}`.trim() : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {(p.consultora_id !== null || isStaff) && (
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-xs text-red-400 hover:text-danger"
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo Producto">
        <ProductoForm
          categorias={categorias}
          marcas={marcas}
          unidades={unidades}
          onSuccess={() => { setShowModal(false); load() }}
        />
      </Modal>
    </div>
  )
}
