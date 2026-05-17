'use client'

import { useState, useEffect, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { createProducto, deleteProducto } from '@/lib/actions/producto'
import type { Producto, CategoriaProducto, Organizacion, ActionResult, UnidadMedida } from '@/lib/types'

const UNIDADES: UnidadMedida[] = ['g', 'kg', 'ml', 'l', 'unidad', 'par', 'caja', 'rollo', 'metro']

function ProductoForm({
  categorias,
  marcas,
  onSuccess,
}: {
  categorias: CategoriaProducto[]
  marcas: Organizacion[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(
    createProducto,
    null as ActionResult<null> | null
  )
  useEffect(() => { if (state?.success) onSuccess() }, [state])

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{state.error}</div>
      )}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Nombre *</label>
        <input name="nombre" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Ej: Casco de seguridad" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Categoría *</label>
          <select name="categoria_id" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Seleccioná…</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Marca</label>
          <select name="marca_id" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Sin marca</option>
            {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Tamaño</label>
          <input name="tamano" type="number" step="0.01" min="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Ej: 500" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Unidad</label>
          <select name="unidad" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">—</option>
            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Descripción</label>
        <textarea name="descripcion" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Opcional…" />
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
  const [activeCategoria, setActiveCategoria] = useState<string>('todos')
  const [showModal, setShowModal] = useState(false)

  function load() {
    const supabase = createClient()
    supabase
      .from('productos')
      .select('*, categoria_productos(nombre), organizaciones_externas(nombre)')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setProductos((data as unknown as Producto[]) ?? []))
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.from('categoria_productos').select('*').order('nombre')
      .then(({ data }) => setCategorias(data ?? []))
    supabase.from('organizaciones_externas').select('id, nombre, tipo_id, tipo_organizaciones(nombre)')
      .eq('is_active', true).order('nombre')
      .then(({ data }) => {
        const marcasOnly = ((data ?? []) as unknown as Organizacion[]).filter(o => o.tipo_organizaciones?.nombre === 'Marca')
        setMarcas(marcasOnly)
      })
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
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500 mt-1">Catálogo de EPP y otros productos de seguridad</p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ Nuevo Producto</Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        <button
          onClick={() => setActiveCategoria('todos')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeCategoria === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          Todos {productos !== null && `(${productos.length})`}
        </button>
        {categorias.map(c => {
          const count = productos?.filter(p => p.categoria_id === c.id).length ?? 0
          return (
            <button
              key={c.id}
              onClick={() => setActiveCategoria(c.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeCategoria === c.id ? 'bg-sig-500 text-white border-sig-500' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {c.nombre} ({count})
            </button>
          )
        })}
      </div>

      {filtered === null ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No hay productos registrados{activeCategoria !== 'todos' ? ' en esta categoría' : ''}.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Nombre</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Categoría</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Marca</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Tamaño</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{p.nombre}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sig-50 text-sig-700">
                      {p.categoria_productos?.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{p.organizaciones_externas?.nombre ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {p.tamano ? `${p.tamano} ${p.unidad ?? ''}`.trim() : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Eliminar
                    </button>
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
          onSuccess={() => { setShowModal(false); load() }}
        />
      </Modal>
    </div>
  )
}
