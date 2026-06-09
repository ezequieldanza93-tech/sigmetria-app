'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FolderOpen,
  Gavel,
  Landmark,
  Library,
  Loader2,
  Plus,
  Scale,
  ScrollText,
  Search,
  Tag,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { MultiSelectFilter, type MultiSelectOption } from '@/components/ui/multi-select-filter'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useToast } from '@/lib/hooks/use-toast'
import {
  getNormativaCategorias,
  getNormativaNormas,
  getTiposEstablecimiento,
  deleteNormativa,
  type NormativaCategoriaConConteo,
  type NormativaNormaConConteo,
  type TipoEstablecimientoOption,
} from '@/lib/actions/normativa-legal'
import { NORMATIVA_AMBITOS, NORMATIVA_ESTADOS, NORMATIVA_TIPOS } from './normativa-constants'
import { NormativaNormaCard } from './normativa-norma-card'
import { NormativaFormModal } from './normativa-form-modal'

const AMBITO_ICON = {
  Nacional: Landmark,
  Provincial: Scale,
  Municipal: Gavel,
  Internacional: Library,
  Interno: ScrollText,
} as const

// Opciones de filtros (value === label en los enums de texto).
const TIPO_OPTIONS: MultiSelectOption[] = NORMATIVA_TIPOS.map((t) => ({ value: t, label: t }))
const AMBITO_OPTIONS: MultiSelectOption[] = NORMATIVA_AMBITOS.map((a) => ({ value: a, label: a }))
const ESTADO_OPTIONS: MultiSelectOption[] = NORMATIVA_ESTADOS.map((e) => ({ value: e, label: e }))

export function NormativaCatalogo() {
  const { success, error } = useToast()

  const [categorias, setCategorias] = useState<NormativaCategoriaConConteo[]>([])
  const [loadingCats, setLoadingCats] = useState(true)

  const [tiposEst, setTiposEst] = useState<TipoEstablecimientoOption[]>([])

  const [categoriaSel, setCategoriaSel] = useState<string | null>(null)
  // Por defecto: TODAS las opciones seleccionadas (= sin filtrar).
  const [tipoSel, setTipoSel] = useState<Set<string>>(() => new Set(NORMATIVA_TIPOS))
  const [ambitoSel, setAmbitoSel] = useState<Set<string>>(() => new Set(NORMATIVA_AMBITOS))
  const [estadoSel, setEstadoSel] = useState<Set<string>>(() => new Set(NORMATIVA_ESTADOS))
  const [tipoEstSel, setTipoEstSel] = useState<Set<string>>(() => new Set())
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput.trim(), 300)

  // Opciones del filtro de tipo de establecimiento (desde la tabla).
  const tipoEstOptions = useMemo<MultiSelectOption[]>(
    () => tiposEst.map((t) => ({ value: t.id, label: t.nombre })),
    [tiposEst],
  )

  const [normas, setNormas] = useState<NormativaNormaConConteo[]>([])
  const [loadingNormas, setLoadingNormas] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<NormativaNormaConConteo | null>(null)

  // --- Carga de categorías ---
  const cargarCategorias = useCallback(async () => {
    setLoadingCats(true)
    const res = await getNormativaCategorias()
    if (res.success) setCategorias(res.data)
    else error(res.error)
    setLoadingCats(false)
  }, [error])

  useEffect(() => {
    cargarCategorias()
  }, [cargarCategorias])

  // --- Carga de tipos de establecimiento (una sola vez) ---
  useEffect(() => {
    let cancelado = false
    getTiposEstablecimiento().then((res) => {
      if (cancelado) return
      if (res.success) {
        setTiposEst(res.data)
        // Por defecto: TODOS seleccionados (= sin filtrar).
        setTipoEstSel(new Set(res.data.map((t) => t.id)))
      } else {
        error(res.error)
      }
    })
    return () => {
      cancelado = true
    }
  }, [error])

  // --- Carga de normas (reacciona a filtros) ---
  const cargarNormas = useCallback(async () => {
    setLoadingNormas(true)
    const res = await getNormativaNormas({
      categoria_id: categoriaSel,
      tipos: [...tipoSel],
      ambitos: [...ambitoSel],
      estados: [...estadoSel],
      tiposEstablecimiento: [...tipoEstSel],
      search,
    })
    if (res.success) setNormas(res.data)
    else error(res.error)
    setLoadingNormas(false)
  }, [categoriaSel, tipoSel, ambitoSel, estadoSel, tipoEstSel, search, error])

  useEffect(() => {
    cargarNormas()
  }, [cargarNormas])

  const refrescar = useCallback(() => {
    cargarNormas()
    cargarCategorias()
  }, [cargarNormas, cargarCategorias])

  // Un filtro multi-select está activo si NO están todas las opciones tildadas.
  const tipoActivo = tipoSel.size > 0 && tipoSel.size < NORMATIVA_TIPOS.length
  const ambitoActivo = ambitoSel.size > 0 && ambitoSel.size < NORMATIVA_AMBITOS.length
  const estadoActivo = estadoSel.size > 0 && estadoSel.size < NORMATIVA_ESTADOS.length
  const tipoEstActivo = tiposEst.length > 0 && tipoEstSel.size > 0 && tipoEstSel.size < tiposEst.length

  const hayFiltros = Boolean(
    tipoActivo || ambitoActivo || estadoActivo || tipoEstActivo || search || categoriaSel,
  )

  const limpiarFiltros = useCallback(() => {
    setTipoSel(new Set(NORMATIVA_TIPOS))
    setAmbitoSel(new Set(NORMATIVA_AMBITOS))
    setEstadoSel(new Set(NORMATIVA_ESTADOS))
    setTipoEstSel(new Set(tiposEst.map((t) => t.id)))
    setSearchInput('')
    setCategoriaSel(null)
  }, [tiposEst])

  const categoriaActiva = useMemo(
    () => categorias.find((c) => c.id === categoriaSel) ?? null,
    [categorias, categoriaSel],
  )

  const totalNormasBase = useMemo(
    () => categorias.reduce((acc, c) => acc + c.normas_count, 0),
    [categorias],
  )

  const categoriasPropias = useMemo(
    () => categorias.filter((c) => c.consultora_id !== null),
    [categorias],
  )

  async function handleDelete(norma: NormativaNormaConConteo) {
    if (!confirm(`¿Eliminar "${norma.titulo}"? Esta acción no se puede deshacer.`)) return
    const res = await deleteNormativa(norma.id)
    if (res.success) {
      success('Normativa eliminada')
      refrescar()
    } else {
      error(res.error)
    }
  }

  function abrirCrear() {
    setEditTarget(null)
    setModalOpen(true)
  }

  function abrirEditar(norma: NormativaNormaConConteo) {
    setEditTarget(norma)
    setModalOpen(true)
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-6 w-6 text-brand-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-text-primary">Normativa Legal</h1>
          </div>
          <p className="text-sm text-text-secondary">
            Catálogo de requisitos legales aplicables a Higiene y Seguridad.
            {!loadingCats && (
              <> {totalNormasBase} normas en {categorias.length} categorías.</>
            )}
          </p>
        </div>
        <Button onClick={abrirCrear} className="shrink-0">
          <Plus className="h-4 w-4" />
          Agregar normativa
        </Button>
      </div>

      {/* Buscador */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" aria-hidden="true" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por número, título u organismo…"
          className="w-full border border-border-default rounded-lg pl-10 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary bg-surface-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:border-transparent"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <MultiSelectFilter
          label="Tipo"
          options={TIPO_OPTIONS}
          selected={tipoSel}
          onChange={setTipoSel}
        />
        <MultiSelectFilter
          label="Ámbito"
          options={AMBITO_OPTIONS}
          selected={ambitoSel}
          onChange={setAmbitoSel}
        />
        <MultiSelectFilter
          label="Estado"
          options={ESTADO_OPTIONS}
          selected={estadoSel}
          onChange={setEstadoSel}
        />
        <MultiSelectFilter
          label="Tipo de Establecimiento"
          options={tipoEstOptions}
          selected={tipoEstSel}
          onChange={setTipoEstSel}
          emptyLabel="Cargando…"
        />
        {hayFiltros && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar de categorías */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2 flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            Categorías
          </p>
          {loadingCats ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 rounded-lg bg-surface-elevated animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-1">
              <CategoriaChip
                label="Todas las categorías"
                count={totalNormasBase}
                active={categoriaSel === null}
                onClick={() => setCategoriaSel(null)}
                Icon={Library}
              />
              {categorias.map((c) => {
                const Icon = AMBITO_ICON[c.ambito] ?? Tag
                return (
                  <CategoriaChip
                    key={c.id}
                    label={c.nombre}
                    sub={c.consultora_id !== null ? 'Propia' : undefined}
                    count={c.normas_count}
                    active={categoriaSel === c.id}
                    onClick={() => setCategoriaSel(c.id)}
                    Icon={Icon}
                  />
                )
              })}
            </div>
          )}
        </aside>

        {/* Lista de normas */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-text-secondary">
              {categoriaActiva ? categoriaActiva.nombre : 'Todas las normas'}
              {!loadingNormas && (
                <span className="text-text-tertiary"> · {normas.length} {normas.length === 1 ? 'norma' : 'normas'}</span>
              )}
            </p>
          </div>

          {loadingNormas ? (
            <div className="flex items-center gap-2 text-sm text-text-tertiary py-12 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Cargando normas…
            </div>
          ) : normas.length === 0 ? (
            <EmptyState
              variant={hayFiltros ? 'search' : 'documents'}
              title={hayFiltros ? 'Sin resultados' : 'No hay normas'}
              description={
                hayFiltros
                  ? 'Probá ajustar la búsqueda o limpiar los filtros.'
                  : 'Todavía no hay normativa cargada en esta categoría.'
              }
              action={hayFiltros ? { label: 'Limpiar filtros', onClick: limpiarFiltros } : undefined}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {normas.map((n) => (
                <NormativaNormaCard
                  key={n.id}
                  norma={n}
                  esPropia={n.consultora_id !== null}
                  onEdit={abrirEditar}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <NormativaFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        norma={editTarget}
        categorias={categoriasPropias}
        onSaved={refrescar}
      />
    </div>
  )
}

// ============================================================
// Sub-componentes
// ============================================================

function CategoriaChip({
  label,
  sub,
  count,
  active,
  onClick,
  Icon,
}: {
  label: string
  sub?: string
  count: number
  active: boolean
  onClick: () => void
  Icon: typeof Tag
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors shrink-0 lg:w-full',
        active
          ? 'bg-brand-primary/10 text-brand-primary font-medium'
          : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-primary' : 'text-text-tertiary')} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        {label}
        {sub && <span className="ml-1 text-[10px] text-text-tertiary">· {sub}</span>}
      </span>
      <span
        className={cn(
          'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
          active ? 'bg-brand-primary/20 text-brand-primary' : 'bg-surface-elevated text-text-tertiary',
        )}
      >
        {count}
      </span>
    </button>
  )
}
