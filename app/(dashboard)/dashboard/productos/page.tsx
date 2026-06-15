'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import Image from 'next/image'
import { Search, Filter, Layers, Shield, ShieldCheck, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { FotoInput } from '@/components/ui/foto-input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { createClient } from '@/lib/supabase/client'
import { createProducto, deleteProducto } from '@/lib/actions/producto'
import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'
import { useCatalogoArbol } from '@/lib/queries/producto-catalogo'
import { OrigenFilter, pasaOrigen, type OrigenFiltro } from '@/components/ui/origen-filter'
import { ProductoCard } from '@/components/productos/producto-card'
import { ProductoDetalle } from '@/components/productos/producto-detalle'
import {
  CatalogoCascadeForm,
  categoriasDeClase,
  componentesDeCategoria,
  type CatalogoArbol,
} from '@/components/productos/catalogo-cascade'
import type { Producto, Organizacion, ActionResult, Unidad, ProductoClase } from '@/lib/types'

// Ícono por clase (por nombre genérico). Fallback Package para clases propias.
function iconoClase(nombre: string) {
  const n = nombre.toLowerCase()
  if (n.startsWith('epp')) return Shield
  if (n.startsWith('epc')) return ShieldCheck
  if (n.startsWith('equip')) return Package
  return Layers
}

// ─── Formulario de creación ────────────────────────────────────────────────────

function ProductoForm({
  arbol,
  marcas,
  unidades,
  onSuccess,
  isStaffDeveloper,
}: {
  arbol: CatalogoArbol
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
  // Cascada clase → categoría → componente (controlada, para resets en cadena).
  const [claseId, setClaseId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [componenteId, setComponenteId] = useState('')
  const [marcaId, setMarcaId] = useState('')
  const [unidadId, setUnidadId] = useState('')
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

  // Resets en cadena: clase nueva → limpia categoría y componente; categoría nueva → limpia componente.
  function handleClase(v: string) {
    setClaseId(v)
    setCategoriaId('')
    setComponenteId('')
  }
  function handleCategoria(v: string) {
    setCategoriaId(v)
    setComponenteId('')
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

      {/* Clasificación en cascada: clase → categoría → componente.
          esGenerico (solo staff developer) hace que la creación inline cree ítems base. */}
      <CatalogoCascadeForm
        arbol={arbol}
        claseId={claseId}
        categoriaId={categoriaId}
        componenteId={componenteId}
        onClaseChange={handleClase}
        onCategoriaChange={handleCategoria}
        onComponenteChange={setComponenteId}
        esGenerico={esGenerico}
      />

      <div className="grid grid-cols-2 gap-3">
        <SearchableSelect
          label="Marca"
          name="marca_id"
          value={marcaId}
          onChange={setMarcaId}
          placeholder="Sin marca"
          options={marcas.map(m => ({ value: m.id, label: m.nombre }))}
          emptyText="Sin marcas."
        />
        <SearchableSelect
          label="Unidad"
          name="unidad_id"
          value={unidadId}
          onChange={setUnidadId}
          placeholder="—"
          options={unidades.map(u => ({ value: u.id, label: `${u.nombre} (${u.simbolo})` }))}
          emptyText="Sin unidades."
        />
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Tamaño</label>
        <input name="tamano" type="number" step="0.01" min="0" className="w-full border border-border-default rounded-lg px-3 py-2 text-sm" placeholder="Ej: 500" />
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
  const [marcas, setMarcas] = useState<Organizacion[]>([])
  const [unidades, setUnidades] = useState<Unidad[]>([])
  // Cascada de filtros tipo MercadoLibre: clase → categoría → componente.
  const [activeClase, setActiveClase] = useState<string>('todos')
  const [activeCategoria, setActiveCategoria] = useState<string>('todos')
  const [activeComponente, setActiveComponente] = useState<string>('todos')
  // Facetas secundarias (estilo ML, en panel lateral).
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

  // Árbol del catálogo (clase → categoría → componente), híbrido base + propios.
  const arbolQuery = useCatalogoArbol()
  const arbol: CatalogoArbol = {
    clases: arbolQuery.data?.clases ?? [],
    categorias: arbolQuery.data?.categorias ?? [],
    componentes: arbolQuery.data?.componentes ?? [],
  }

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

  // Clases para tabs: separamos Equipamiento (librería aparte) de las protecciones (EPP/EPC).
  const equipamientoClases = arbol.clases.filter(cl => cl.nombre.toLowerCase().startsWith('equip'))
  const proteccionClases = arbol.clases.filter(cl => !cl.nombre.toLowerCase().startsWith('equip'))

  // Cascada de filtros: categorías de la clase activa; componentes de la categoría activa.
  const categoriasVisibles = activeClase === 'todos'
    ? arbol.categorias
    : categoriasDeClase(arbol.categorias, activeClase)
  const componentesVisibles = activeCategoria === 'todos'
    ? []
    : componentesDeCategoria(arbol.componentes, activeCategoria)

  // Set de categorías que pertenecen a la clase activa (para filtrar productos por clase).
  const categoriaIdsDeClase = new Set(categoriasVisibles.map(c => c.id))

  // Proveedores presentes en el catálogo (derivados de los productos cargados).
  const proveedoresMap = new Map<string, string>()
  productos?.forEach(p => { if (p.proveedor_id && p.proveedor?.nombre) proveedoresMap.set(p.proveedor_id, p.proveedor.nombre) })
  const proveedores = [...proveedoresMap.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  // Filtrado client-side (cientos de productos, perfecto para filtros sin round-trips).
  const termino = busqueda.trim().toLowerCase()
  const filtered = productos === null
    ? null
    : productos.filter(p =>
        // Clase: el producto pasa si su categoría pertenece a la clase activa.
        (activeClase === 'todos' || categoriaIdsDeClase.has(p.categoria_id)) &&
        (activeCategoria === 'todos' || p.categoria_id === activeCategoria) &&
        (activeComponente === 'todos' || p.componente_id === activeComponente) &&
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

  // Cambiar de clase resetea categoría y componente (cascada).
  function selectClase(claseId: string) {
    setActiveClase(claseId)
    setActiveCategoria('todos')
    setActiveComponente('todos')
  }
  function selectCategoria(categoriaId: string) {
    setActiveCategoria(categoriaId)
    setActiveComponente('todos')
  }

  // Agrupación visual: se aplica DESPUÉS del filtrado. Cada "tarjeta" representa
  // un grupo nombre+marca. El conteo en el encabezado refleja tarjetas (grupos), no filas.
  const agrupados: ProductoAgrupado[] | null = filtered === null ? null : agruparProductos(filtered)

  const totalCount = productos?.length ?? 0
  const filteredCount = filtered?.length ?? 0
  const agrupadosCount = agrupados?.length ?? 0

  // Renderiza un tab de clase con su ícono.
  function ClaseTab({ clase }: { clase: ProductoClase }) {
    const Icon = iconoClase(clase.nombre)
    const active = activeClase === clase.id
    return (
      <button
        onClick={() => selectClase(clase.id)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${active ? 'bg-sig-500 text-white border-sig-500 shadow-sm' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
      >
        <Icon size={15} aria-hidden="true" />
        {clase.nombre}
      </button>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Productos</h1>
          <p className="text-sm text-text-secondary mt-1">
            Catálogo de protecciones y equipamiento
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

      {/* ── Nivel 1: CLASE (tabs destacados, Equipamiento separado) ── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => selectClase('todos')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${activeClase === 'todos' ? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
        >
          <Layers size={15} aria-hidden="true" />
          Todo el catálogo
        </button>

        {proteccionClases.length > 0 && (
          <>
            <span className="text-text-tertiary/40 select-none px-1">|</span>
            {proteccionClases.map(cl => <ClaseTab key={cl.id} clase={cl} />)}
          </>
        )}

        {/* Equipamiento como librería aparte de las protecciones. */}
        {equipamientoClases.length > 0 && (
          <>
            <span className="text-text-tertiary/40 select-none px-1">|</span>
            <span className="text-xs text-text-tertiary uppercase tracking-wide self-center">Librería aparte:</span>
            {equipamientoClases.map(cl => <ClaseTab key={cl.id} clase={cl} />)}
          </>
        )}
      </div>

      {/* ── Nivel 2: CATEGORÍA (filtrada por la clase elegida) ── */}
      <div className="flex gap-1 mb-2 flex-wrap">
        <button
          onClick={() => selectCategoria('todos')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeCategoria === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
        >
          {activeClase === 'todos' ? 'Todas las categorías' : 'Todas'}
        </button>
        {categoriasVisibles.map(c => (
          <button
            key={c.id}
            onClick={() => selectCategoria(c.id)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeCategoria === c.id ? 'bg-sig-500 text-white border-sig-500' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {/* ── Nivel 3: COMPONENTE (solo si la categoría elegida tiene componentes) ── */}
      {componentesVisibles.length > 0 && (
        <div className="flex gap-1 mb-4 flex-wrap pl-3 border-l-2 border-sig-200">
          <button
            onClick={() => setActiveComponente('todos')}
            className={`px-2.5 py-0.5 text-xs rounded-full border transition-colors ${activeComponente === 'todos' ? 'bg-sig-600 text-white border-sig-600' : 'border-border-subtle text-text-tertiary hover:bg-surface-base'}`}
          >
            Todos los componentes
          </button>
          {componentesVisibles.map(co => (
            <button
              key={co.id}
              onClick={() => setActiveComponente(co.id)}
              className={`px-2.5 py-0.5 text-xs rounded-full border transition-colors ${activeComponente === co.id ? 'bg-sig-600 text-white border-sig-600' : 'border-border-subtle text-text-tertiary hover:bg-surface-base'}`}
            >
              {co.nombre}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Panel lateral de facetas secundarias (estilo ML) ── */}
        <aside className="lg:w-56 shrink-0 space-y-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
            <input
              type="search"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre…"
              className="w-full pl-9 pr-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wide">
              <Filter size={13} aria-hidden="true" />
              Filtros
            </div>

            {/* Origen */}
            <div>
              <p className="text-xs text-text-tertiary mb-1.5">Origen</p>
              <OrigenFilter value={origen} onChange={setOrigen} className="flex-wrap" />
            </div>

            {/* Proveedor */}
            {proveedores.length > 0 && (
              <div>
                <p className="text-xs text-text-tertiary mb-1.5">Proveedor</p>
                <SearchableSelect
                  value={activeProveedor === 'todos' ? '' : activeProveedor}
                  onChange={v => setActiveProveedor(v || 'todos')}
                  placeholder="Todos"
                  options={proveedores.map(pv => ({ value: pv.id, label: pv.nombre }))}
                  emptyText="Sin proveedores."
                />
              </div>
            )}

            {/* Marca */}
            {marcas.length > 0 && (
              <div>
                <p className="text-xs text-text-tertiary mb-1.5">Marca</p>
                <SearchableSelect
                  value={activeMarca === 'todas' ? '' : activeMarca}
                  onChange={v => setActiveMarca(v || 'todas')}
                  placeholder="Todas"
                  options={marcas.map(m => ({ value: m.id, label: m.nombre }))}
                  emptyText="Sin marcas."
                />
              </div>
            )}
          </div>
        </aside>

        {/* ── Grilla de productos ── */}
        <div className="flex-1 min-w-0">
          {agrupados === null ? (
            <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">
              Cargando…
            </div>
          ) : agrupados.length === 0 ? (
            <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">
              No hay productos que coincidan con los filtros.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
        </div>
      </div>

      {/* Modal crear */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo Producto">
        <ProductoForm
          arbol={arbol}
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
