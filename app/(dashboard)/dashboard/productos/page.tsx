'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import Image from 'next/image'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { FotoInput } from '@/components/ui/foto-input'
import { createClient } from '@/lib/supabase/client'
import { createProducto, deleteProducto } from '@/lib/actions/producto'
import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'
import { OrigenFilter, pasaOrigen, type OrigenFiltro } from '@/components/ui/origen-filter'
import { ProductoCard } from '@/components/productos/producto-card'
import type { Producto, CategoriaProducto, Organizacion, ActionResult, Unidad } from '@/lib/types'

// ─── Formulario de creación ────────────────────────────────────────────────────

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
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

  useEffect(() => {
    if (state?.success) {
      onSuccessRef.current()
    }
  }, [state])

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setFotoPreview(url)
    // Copiar el archivo al input oculto dentro del form para que llegue en FormData
    const dt = new DataTransfer()
    dt.items.add(file)
    if (fotoInputRef.current) fotoInputRef.current.files = dt.files
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
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

      {/* Foto */}
      <div>
        <label className="text-sm font-medium text-text-secondary block mb-2">Foto del producto</label>
        {fotoPreview && (
          <div className="mb-2 w-24 h-24 rounded-lg overflow-hidden border border-border-subtle relative">
            <Image
              src={fotoPreview}
              alt="Preview"
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
        )}
        <FotoInput onChange={handleFotoChange} accept="image/*" size="sm" />
        {/* Input oculto dentro del form para transportar el File al server action */}
        <input ref={fotoInputRef} type="file" name="foto" accept="image/*" className="hidden" />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [categorias, setCategorias] = useState<CategoriaProducto[]>([])
  const [marcas, setMarcas] = useState<Organizacion[]>([])
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [activeCategoria, setActiveCategoria] = useState<string>('todos')
  const [activeMarca, setActiveMarca] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState<string>('')
  const [origen, setOrigen] = useState<OrigenFiltro>('todos')
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
      .range(0, 999)
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

  // Filtrado client-side (~261 productos, perfecto para filtros sin round-trips)
  const termino = busqueda.trim().toLowerCase()
  const filtered = productos === null
    ? null
    : productos.filter(p =>
        (activeCategoria === 'todos' || p.categoria_id === activeCategoria) &&
        (activeMarca === 'todas' || p.marca_id === activeMarca) &&
        pasaOrigen(p.consultora_id, origen) &&
        (!termino || p.nombre.toLowerCase().includes(termino))
      )

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este producto?')) return
    await deleteProducto(id)
    setProductos(prev => prev?.filter(p => p.id !== id) ?? null)
  }

  const totalCount = productos?.length ?? 0
  const filteredCount = filtered?.length ?? 0

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Productos</h1>
          <p className="text-sm text-text-secondary mt-1">
            Catálogo de EPP y otros productos de seguridad
            {productos !== null && (
              <span className="ml-2 text-text-tertiary">
                ({filteredCount === totalCount ? totalCount : `${filteredCount} de ${totalCount}`})
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ Nuevo Producto</Button>
      </div>

      {/* Barra de búsqueda */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
        <input
          type="search"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="w-full pl-9 pr-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
        />
      </div>

      {/* Filtros: categoría */}
      <div className="flex gap-1 mb-3 flex-wrap">
        <button
          onClick={() => setActiveCategoria('todos')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeCategoria === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
        >
          Todas las categorías
        </button>
        {categorias.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveCategoria(c.id)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeCategoria === c.id ? 'bg-sig-500 text-white border-sig-500' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {/* Filtro: marca + origen en la misma línea */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        {marcas.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary shrink-0">Marca:</span>
            <select
              value={activeMarca}
              onChange={e => setActiveMarca(e.target.value)}
              className="border border-border-default rounded-lg px-2 py-1 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
              <option value="todas">Todas</option>
              {marcas.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">Origen:</span>
          <OrigenFilter value={origen} onChange={setOrigen} />
        </div>
      </div>

      {/* Contenido */}
      {filtered === null ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">
          Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">
          No hay productos que coincidan con los filtros.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductoCard
              key={p.id}
              producto={p}
              canDelete={p.consultora_id !== null || isStaff}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal crear */}
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
