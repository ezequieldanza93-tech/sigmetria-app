'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { planificarGestionMulti, planificarGestionNueva, createGrupoGestion, createCategoriaGestion } from '@/lib/actions/gestion-establecimiento'
import { getGestionesAplicables } from '@/lib/actions/aplicabilidad'
import { Button } from '@/components/ui/button'
import type { Gestion, GrupoGestion, CategoriaGestion } from '@/lib/types'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

interface PlanificarViewProps {
  establecimientoId: string
  empresaId: string
}

export function PlanificarView({ establecimientoId }: PlanificarViewProps) {
  const supabase = createClient()

  const [todasGestiones, setTodasGestiones] = useState<Gestion[]>([])
  const [grupos, setGrupos] = useState<GrupoGestion[]>([])
  const [categorias, setCategorias] = useState<CategoriaGestion[]>([])
  const [loading, setLoading] = useState(true)

  const [filterGrupo, setFilterGrupo] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [selectedGestionId, setSelectedGestionId] = useState('')
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set())
  const [cantidad, setCantidad] = useState(1)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<number | null>(null)

  const [mode, setMode] = useState<'biblioteca' | 'nueva'>('biblioteca')

  useEffect(() => {
    getGestionesAplicables(establecimientoId).then(setTodasGestiones).catch(() => setTodasGestiones([]))
    supabase.from('grupo_gestiones').select('*').order('nombre')
      .then(({ data }) => { if (data) setGrupos(data as unknown as GrupoGestion[]) })
    supabase.from('categoria_gestiones').select('*').order('nombre')
      .then(({ data }) => { if (data) setCategorias(data as unknown as CategoriaGestion[]) })
      .finally(() => setLoading(false))
  }, [establecimientoId])

  function toggleMonth(m: number) {
    setSelectedMonths(prev => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  function toggleAll() {
    setSelectedMonths(prev => prev.size === 12 ? new Set() : new Set(Array.from({ length: 12 }, (_, i) => i)))
  }

  const year = new Date().getFullYear()

  const gruposUnicos = Array.from(
    new Set(todasGestiones.map(g => g.categoria_gestiones?.grupo_gestiones?.nombre ?? '').filter(Boolean))
  ).sort()

  const cats = Array.from(
    new Set(
      todasGestiones
        .filter(g => !filterGrupo || g.categoria_gestiones?.grupo_gestiones?.nombre === filterGrupo)
        .map(g => g.categoria_gestiones?.nombre ?? '')
        .filter(Boolean)
    )
  ).sort()

  const gestionesFiltradas = todasGestiones.filter(g => {
    if (filterGrupo && g.categoria_gestiones?.grupo_gestiones?.nombre !== filterGrupo) return false
    if (filterCat && g.categoria_gestiones?.nombre !== filterCat) return false
    return true
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(null)

    if (!selectedGestionId) { setError('Seleccioná una gestión'); return }
    if (selectedMonths.size === 0) { setError('Seleccioná al menos un mes'); return }

    setSaving(true)
    const result = await planificarGestionMulti(
      selectedGestionId,
      establecimientoId,
      Array.from(selectedMonths).sort((a, b) => a - b),
      year,
      null,
      notas || null,
      cantidad,
    )
    setSaving(false)

    if (!result.success) { setError(result.error); return }
    setSuccess(result.data!.count)
    setSelectedMonths(new Set())
    setCantidad(1)
    setNotas('')
  }

  const selectCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500'

  if (loading) {
    return <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">Cargando...</div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Planificar Gestión</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {success !== null && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-6">
            Se planificaron {success} gestión{success !== 1 ? 'es' : ''} correctamente.
          </div>
        )}

        {/* ── Tabs: Biblioteca / Nueva ── */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setMode('biblioteca')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              mode === 'biblioteca'
                ? 'border-sig-500 text-sig-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Desde la biblioteca
          </button>
          <button
            onClick={() => setMode('nueva')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              mode === 'nueva'
                ? 'border-sig-500 text-sig-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Crear nueva
          </button>
        </div>

        {mode === 'nueva' ? (
          <NuevaGestionForm
            establecimientoId={establecimientoId}
            grupos={grupos}
            categorias={categorias}
            onCreated={(gestionId) => { setSelectedGestionId(gestionId); setMode('biblioteca') }}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Filters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Grupo</label>
                <select value={filterGrupo} onChange={e => { setFilterGrupo(e.target.value); setFilterCat('') }} className={selectCls}>
                  <option value="">Filtrar por grupo</option>
                  {gruposUnicos.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Categoría</label>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className={selectCls}>
                  <option value="">Filtrar por categoría</option>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Gestion selector */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Gestión *</label>
              <select
                value={selectedGestionId}
                onChange={e => setSelectedGestionId(e.target.value)}
                required
                className={selectCls}
              >
                <option value="">Seleccionar gestión...</option>
                {gestionesFiltradas.map(g => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
              {todasGestiones.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No hay gestiones en la biblioteca. Creá una nueva.</p>
              )}
            </div>

            {/* Month multi-select */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Meses *</label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-sig-600 hover:text-sig-800 hover:underline mb-2"
              >
                {selectedMonths.size === 12 ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
              <div className="grid grid-cols-4 gap-2">
                {MONTHS.map((name, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleMonth(i)}
                    className={`text-sm border rounded-lg px-3 py-2.5 text-left transition-colors ${
                      selectedMonths.has(i)
                        ? 'bg-sig-50 border-sig-300 text-sig-700 font-medium'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {selectedMonths.size > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {selectedMonths.size} mes{selectedMonths.size !== 1 ? 'es' : ''} seleccionado{selectedMonths.size !== 1 ? 's' : ''} &mdash;
                  fecha planificada: último día de cada mes
                </p>
              )}
            </div>

            {/* Cantidad por mes */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Cantidad por mes</label>
              <input
                type="number"
                min={1}
                value={cantidad}
                onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
              />
            </div>

            {/* Notas */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Notas</label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving || !selectedGestionId || selectedMonths.size === 0}>
                {saving ? 'Guardando...' : `Planificar (${selectedMonths.size * cantidad} en total)`}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── NuevaGestionForm (inline, simplified) ──
function NuevaGestionForm({
  establecimientoId,
  grupos: gruposProp,
  categorias: categoriasProp,
  onCreated,
}: {
  establecimientoId: string
  grupos: GrupoGestion[]
  categorias: CategoriaGestion[]
  onCreated: (gestionId: string) => void
}) {
  const [localGrupos, setLocalGrupos] = useState(gruposProp)
  const [localCategorias, setLocalCategorias] = useState(categoriasProp)
  const [selectedGrupoId, setSelectedGrupoId] = useState('')
  const [selectedCatId, setSelectedCatId] = useState('')
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [creandoGrupo, setCreandoGrupo] = useState(false)
  const [creandoCat, setCreandoCat] = useState(false)

  const supabase = createClient()

  const catsFiltradas = localCategorias.filter(c => !selectedGrupoId || c.grupo_id === selectedGrupoId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!nombre.trim()) { setError('Nombre requerido'); return }
    if (!selectedCatId) { setError('Categoría requerida'); return }

    setSaving(true)
    const result = await planificarGestionNueva(
      null,
      new Map<string, FormDataEntryValue>([
        ['gestion_nombre', nombre.trim()],
        ['categoria_id', selectedCatId],
        ['establecimiento_id', establecimientoId],
        ['fecha_planificada', new Date().toISOString().split('T')[0]],
        ['notas', ''],
      ]) as unknown as FormData
    )
    setSaving(false)

    if (!result.success) { setError(result.error); return }
    // Get the created gestion id
    const { data: ges } = await supabase
      .from('gestiones')
      .select('id')
      .eq('nombre', nombre.trim())
      .single()
    if (ges) onCreated(ges.id)
  }

  async function handleCrearGrupo(n: string) {
    const r = await createGrupoGestion(n)
    if (!r.success) { setError(r.error); return }
    setLocalGrupos(prev => [...prev, r.data!])
    setSelectedGrupoId(r.data!.id)
    setCreandoGrupo(false)
    setError('')
  }

  async function handleCrearCategoria(n: string) {
    if (!selectedGrupoId) { setError('Primero seleccioná o creá un grupo'); return }
    const r = await createCategoriaGestion(n, selectedGrupoId)
    if (!r.success) { setError(r.error); return }
    setLocalCategorias(prev => [...prev, r.data!])
    setSelectedCatId(r.data!.id)
    setCreandoCat(false)
    setError('')
  }

  const selectCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500'

  if (creandoGrupo) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-gray-700">Crear nuevo grupo</p>
        <InlineCreator
          placeholder="Nombre del grupo..."
          onConfirm={handleCrearGrupo}
          onCancel={() => setCreandoGrupo(false)}
          error={error}
        />
      </div>
    )
  }

  if (creandoCat) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-gray-700">Crear nueva categoría</p>
        <p className="text-xs text-gray-500">Grupo: {localGrupos.find(g => g.id === selectedGrupoId)?.nombre}</p>
        <InlineCreator
          placeholder="Nombre de la categoría..."
          onConfirm={handleCrearCategoria}
          onCancel={() => setCreandoCat(false)}
          error={error}
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Grupo</label>
        <div className="flex gap-2">
          <select value={selectedGrupoId} onChange={e => { setSelectedGrupoId(e.target.value); setSelectedCatId('') }} className={selectCls}>
            <option value="">Seleccionar grupo...</option>
            {localGrupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          <button type="button" onClick={() => setCreandoGrupo(true)} className="text-xs text-sig-600 hover:text-sig-800 hover:underline shrink-0 self-center">
            + Nuevo
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Categoría *</label>
        <div className="flex gap-2">
          <select
            value={selectedCatId}
            onChange={e => setSelectedCatId(e.target.value)}
            required
            className={selectCls}
            disabled={!selectedGrupoId}
          >
            <option value="">Seleccionar categoría...</option>
            {catsFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setCreandoCat(true)}
            disabled={!selectedGrupoId}
            className="text-xs text-sig-600 hover:text-sig-800 hover:underline shrink-0 self-center disabled:text-gray-300 disabled:no-underline"
          >
            + Nueva
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Nombre de la gestión *</label>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="ej. Recargar extintores"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving || !nombre.trim() || !selectedCatId}>
          {saving ? 'Guardando...' : 'Crear gestión'}
        </Button>
      </div>
    </form>
  )
}

function InlineCreator({
  placeholder,
  onConfirm,
  onCancel,
  error,
}: {
  placeholder: string
  onConfirm: (nombre: string) => Promise<void>
  onCancel: () => void
  error: string
}) {
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)

  async function handle() {
    if (!nombre.trim()) return
    setSaving(true)
    await onConfirm(nombre.trim())
    setSaving(false)
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-2">
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handle() } }}
          placeholder={placeholder}
          autoFocus
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
        <button
          type="button"
          onClick={handle}
          disabled={saving || !nombre.trim()}
          className="text-xs bg-sig-500 text-white rounded-lg px-3 py-1.5 hover:bg-sig-700 disabled:opacity-50"
        >
          {saving ? '...' : 'Crear'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          X
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
