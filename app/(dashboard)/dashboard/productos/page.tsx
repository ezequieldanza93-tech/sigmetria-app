'use client'

import { useState, useEffect, useActionState, useRef, useMemo } from 'react'
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
import { ProductoDetalle } from '@/components/productos/producto-detalle'
import type { Producto, CategoriaProducto, Organizacion, ActionResult, Unidad } from '@/lib/types'

// ─── Formulario de creación ────────────────────────────────────────────────────

function ProductoForm({
  categorias,
  marcas,
  unidades,
  onSuccess,
  isStaffDeveloper,
}: {
  categorias: CategoriaProducto[]
  marcas: Organizacion[]
  unidades: Unidad[]
  onSuccess: () => void
  isStaffDeveloper: boolean
}) {
  const [state, formAction, pending] = useActionState(
    createProducto,
    null as ActionResult<null> | null
  )
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  // Para staff developer: controla si el producto será genérico (base Sigmetría) o propio.
  // Para consultoras normales esta variable no se usa — siempre propio.
  const [esGenerico, setEsGenerico] = useState(false)
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

      {/* Toggle genérico/propio — solo visible para staff developer */}
      {isStaffDeveloper && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-amber-900">Tipo de producto</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {esGenerico
                ? 'Genérico — visible para todas las consultoras (base Sigmetría)'
                : 'Propio — visible solo para tu consultora'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={esGenerico}
            onClick={() => setEsGenerico(v => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${esGenerico ? 'bg-amber-500' : 'bg-gray-300'}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${esGenerico ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
          {/* Campo oculto que transporta la decisión al server action */}
          <input type="hidden" name="es_generico" value={esGenerico ? 'true' : 'false'} />
        </div>
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

// ─── Agrupación visual ────────────────────────────────────────────────────────
// Agrupa por clave `nombre + marca_id`. Representante: el primero que tenga foto_url;
// si ninguno la tiene, el primero del grupo. NO modifica ni borra datos de la base.

interface ProductoAgrupado {
  representante: Producto
  count: number
}

function agruparProductos(lista: Producto[]): ProductoAgrupado[] {
  const mapa = new Map<string, Producto[]>()
  for (const p of lista) {
    const clave = `${p.nombre.trim().toLowerCase()}||${p.marca_id ?? ''}`
    const grupo = mapa.get(clave)
    if (grupo) {
      grupo.push(p)
    } else {
      mapa.set(clave, [p])
    }
  }
  const resultado: ProductoAgrupado[] = []
  for (const grupo of mapa.values()) {
    const conFoto = grupo.find(p => !!p.foto_url)
    resultado.push({ representante: conFoto ?? grupo[0], count: grupo.length })
  }
  return resultado
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
  const [activeProveedor, setActiveProveedor] = useState<string>('todos')
  const [detalle, setDetalle] = useState<Producto | null>(null)
  const [showModal, setShowModal] = useState(false)
  const roleCtx = useEffectiveRoleContext()
  // isSuperAdmin: puede borrar genéricos desde la lista (existía antes).
  const isStaff = roleCtx?.isSuperAdmin ?? false
  // isStaffDeveloper: puede crear productos GENÉRICOS (base Sigmetría). Matchea is_developer() en RLS.
  const isStaffDeveloper = roleCtx?.systemRole === 'developer'

  function load() {
    const supabase = createClient()
    supabase
      .from('productos')
      .select('*, productos_categorias(nombre), marca:organizaciones_externas!productos_marca_id_fkey(nombre), proveedor:organizaciones_externas!productos_proveedor_id_fkey(nombre), unidades(nombre, simbolo), producto_variantes(count)')
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

  // Proveedores presentes en el catálogo (derivados de los productos cargados).
  const proveedores = useMemo(() => {
    const map = new Map<string, string>()
    productos?.forEach(p => { if (p.proveedor_id && p.proveedor?.nombre) map.set(p.proveedor_id, p.proveedor.nombre) })
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [productos])

  // Filtrado client-side (cientos de productos, perfecto para filtros sin round-trips)
  const termino = busqueda.trim().toLowerCase()
  const filtered = productos === null
    ? null
    : productos.filter(p =>
        (activeCategoria === 'todos' || p.categoria_id === activeCategoria) &&
        (activeMarca === 'todas' || p.marca_id === activeMarca) &&
        (activeProveedor === 'todos' || p.proveedor_id === activeProveedor) &&
        pasaOrigen(p.consultora_id, origen) &&
        (!termino || p.nombre.toLowerCase().includes(termino))
      )

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este producto?')) return
    await deleteProducto(id)
    setProductos(prev => prev?.filter(p => p.id !== id) ?? null)
  }

  // Agrupación visual: se aplica DESPUÉS del filtrado. Cada "tarjeta" representa
  // un grupo nombre+marca. El conteo en el encabezado refleja tarjetas (grupos), no filas.
  const agrupados: ProductoAgrupado[] | null = filtered === null ? null : agruparProductos(filtered)

  const totalCount = productos?.length ?? 0
  const filteredCount = filtered?.length ?? 0
  const agrupadosCount = agrupados?.length ?? 0

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
                ({filteredCount < totalCount
                  ? `${agrupadosCount} de ${totalCount}`
                  : agrupadosCount})
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

      {/* Filtro: proveedor + marca + origen en la misma línea */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        {proveedores.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary shrink-0">Proveedor:</span>
            <select
              value={activeProveedor}
              onChange={e => setActiveProveedor(e.target.value)}
              className="border border-border-default rounded-lg px-2 py-1 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
              <option value="todos">Todos</option>
              {proveedores.map(pv => (
                <option key={pv.id} value={pv.id}>{pv.nombre}</option>
              ))}
            </select>
          </div>
        )}
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
      {agrupados === null ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">
          Cargando…
        </div>
      ) : agrupados.length === 0 ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">
          No hay productos que coincidan con los filtros.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {agrupados.map(({ representante, count }) => (
            <ProductoCard
              key={representante.id}
              producto={representante}
              canDelete={representante.consultora_id !== null || isStaff}
              onDelete={handleDelete}
              onOpen={setDetalle}
              count={count}
              // Nota: en grupos con duplicados, handleDelete borra solo el representante (limitación conocida del modo agrupación visual).
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
          isStaffDeveloper={isStaffDeveloper}
        />
      </Modal>

      {/* Modal detalle: galería + variantes (talle/color) + fichas técnicas */}
      <ProductoDetalle producto={detalle} open={detalle !== null} onClose={() => setDetalle(null)} />
    </div>
  )
}
