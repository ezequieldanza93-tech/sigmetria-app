'use client'

import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { MultiSelectFilter } from '@/components/ui/multi-select-filter'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
import { toast } from '@/lib/hooks/use-toast'
import { formatMonto, formatFechaCorta, formatNumero } from '@/lib/finanzas/format'
import { crearGasto, actualizarGasto, eliminarGasto } from '@/lib/actions/finanzas-gastos'
import type {
  FinGasto,
  FinGastoInput,
  FinCategoria,
  FinPeriodicidad,
} from '@/lib/finanzas/types'

interface EmpresaLite {
  id: string
  razon_social: string
}

interface Props {
  gastosIniciales: FinGasto[]
  categorias: FinCategoria[]
  empresas: EmpresaLite[]
  moneda: string
  locale: string
}

const PERIODICIDADES: { value: FinPeriodicidad; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
]

// Heurística para mostrar el campo de km: categorías de movilidad/transporte.
function esCategoriaMovilidad(nombre: string | undefined): boolean {
  if (!nombre) return false
  const n = nombre.toLowerCase()
  return (
    n.includes('movilidad') ||
    n.includes('transporte') ||
    n.includes('combustible') ||
    n.includes('viático') ||
    n.includes('viatico') ||
    n.includes('km')
  )
}

function hoyISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Mes calendario YYYY-MM de una fecha ISO (YYYY-MM-DD).
function periodoDe(fecha: string): string {
  return fecha.slice(0, 7)
}

// ─── Formulario de alta / edición ───────────────────────────────────────────

interface FormProps {
  gasto: FinGasto | null
  categorias: FinCategoria[]
  empresas: EmpresaLite[]
  moneda: string
  onSuccess: (gasto: FinGasto) => void
}

function GastoForm({ gasto, categorias, empresas, moneda, onSuccess }: FormProps) {
  const [concepto, setConcepto] = useState(gasto?.concepto ?? '')
  const [monto, setMonto] = useState(gasto ? String(gasto.monto) : '')
  const [monedaInput, setMonedaInput] = useState(gasto?.moneda ?? moneda)
  const [categoriaId, setCategoriaId] = useState(gasto?.categoria_id ?? '')
  const [fecha, setFecha] = useState(gasto?.fecha ?? hoyISO())
  const [empresaId, setEmpresaId] = useState(gasto?.empresa_id ?? '')
  const [esRecurrente, setEsRecurrente] = useState(gasto?.es_recurrente ?? false)
  const [periodicidad, setPeriodicidad] = useState(gasto?.periodicidad ?? 'mensual')
  const [estado, setEstado] = useState(gasto?.estado ?? 'pagado')
  const [km, setKm] = useState(gasto?.km_recorridos != null ? String(gasto.km_recorridos) : '')
  const [notas, setNotas] = useState(gasto?.notas ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categoriaSel = categorias.find((c) => c.id === categoriaId)
  const mostrarKm = esCategoriaMovilidad(categoriaSel?.nombre)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const montoNum = Number(monto)
    if (!concepto.trim()) {
      setError('El concepto es obligatorio')
      return
    }
    if (!Number.isFinite(montoNum) || montoNum < 0) {
      setError('El monto debe ser un número válido')
      return
    }
    if (!fecha) {
      setError('La fecha es obligatoria')
      return
    }

    const input: FinGastoInput = {
      concepto: concepto.trim(),
      fecha,
      monto: montoNum,
      moneda: monedaInput || moneda,
      categoria_id: categoriaId || null,
      empresa_id: empresaId || null,
      es_recurrente: esRecurrente,
      periodicidad: esRecurrente ? periodicidad : null,
      km_recorridos: mostrarKm && km !== '' ? Number(km) : null,
      estado: estado as FinGasto['estado'],
      notas: notas.trim() || null,
    }

    setPending(true)
    const res = gasto
      ? await actualizarGasto(gasto.id, input)
      : await crearGasto(input)
    setPending(false)

    if (!res.success) {
      setError(res.error)
      return
    }
    toast.success(gasto ? 'Gasto actualizado' : 'Gasto cargado')
    onSuccess(res.data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Input
        label="Concepto"
        required
        value={concepto}
        onChange={(e) => setConcepto(e.target.value)}
        placeholder="Ej: Nafta del mes, alquiler de oficina…"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Monto"
          required
          type="number"
          step="0.01"
          min="0"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0,00"
        />
        <Input
          label="Moneda"
          value={monedaInput}
          onChange={(e) => setMonedaInput(e.target.value.toUpperCase())}
          placeholder={moneda}
          maxLength={3}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Categoría"
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          placeholder="Sin categoría"
          options={categorias.map((c) => ({ value: c.id, label: c.nombre }))}
        />
        <Input
          label="Fecha"
          required
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>

      <Select
        label="Cliente (opcional)"
        value={empresaId}
        onChange={(e) => setEmpresaId(e.target.value)}
        placeholder="Gasto general de la consultora"
        options={empresas.map((emp) => ({ value: emp.id, label: emp.razon_social }))}
      />

      {mostrarKm && (
        <Input
          label="Kilómetros recorridos"
          type="number"
          step="0.1"
          min="0"
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder="Ej: 120"
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value as FinGasto['estado'])}
          options={[
            { value: 'pagado', label: 'Pagado' },
            { value: 'pendiente', label: 'Pendiente' },
          ]}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-secondary">Recurrencia</span>
          <label className="flex items-center gap-2 py-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={esRecurrente}
              onChange={(e) => setEsRecurrente(e.target.checked)}
              className="h-4 w-4 rounded border-border-default text-brand-primary focus:ring-brand-primary/30"
            />
            Es un gasto recurrente (fijo)
          </label>
        </div>
      </div>

      {esRecurrente && (
        <Select
          label="Periodicidad"
          value={periodicidad}
          onChange={(e) => setPeriodicidad(e.target.value)}
          options={PERIODICIDADES}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Notas</label>
        <VoiceTextarea
          value={notas}
          onValueChange={setNotas}
          rows={2}
          className="w-full resize-none rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
          placeholder="Detalle opcional del gasto…"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : gasto ? 'Guardar cambios' : 'Cargar gasto'}
        </Button>
      </div>
    </form>
  )
}

// ─── Vista principal ─────────────────────────────────────────────────────────

export function GastosCliente({
  gastosIniciales,
  categorias,
  empresas,
  moneda,
  locale,
}: Props) {
  const [gastos, setGastos] = useState<FinGasto[]>(gastosIniciales)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<FinGasto | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  // Filtros (null = "Todos", sin filtrar).
  const [categoriaSel, setCategoriaSel] = useState<Set<string> | null>(null)
  const [empresaSel, setEmpresaSel] = useState<Set<string> | null>(null)
  const [periodoSel, setPeriodoSel] = useState<Set<string> | null>(null)

  const categoriasNombre = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categorias) map.set(c.id, c.nombre)
    return map
  }, [categorias])

  const empresasNombre = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of empresas) map.set(e.id, e.razon_social)
    return map
  }, [empresas])

  // Opciones de los filtros derivadas de los gastos presentes (más algunas fijas).
  const categoriaOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const g of gastos) if (g.categoria_id) ids.add(g.categoria_id)
    const opts = Array.from(ids, (id) => ({
      value: id,
      label: categoriasNombre.get(id) ?? 'Categoría',
    }))
    // Marcador para gastos sin categoría.
    if (gastos.some((g) => !g.categoria_id)) {
      opts.push({ value: '__sin__', label: 'Sin categoría' })
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label))
  }, [gastos, categoriasNombre])

  const empresaOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const g of gastos) if (g.empresa_id) ids.add(g.empresa_id)
    const opts = Array.from(ids, (id) => ({
      value: id,
      label: empresasNombre.get(id) ?? 'Cliente',
    }))
    if (gastos.some((g) => !g.empresa_id)) {
      opts.push({ value: '__sin__', label: 'Gasto general' })
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label))
  }, [gastos, empresasNombre])

  const periodoOptions = useMemo(() => {
    const set = new Set<string>()
    for (const g of gastos) set.add(periodoDe(g.fecha))
    return Array.from(set)
      .sort((a, b) => b.localeCompare(a))
      .map((p) => ({ value: p, label: formatFechaCorta(`${p}-01`, locale).replace(/^\d+\s/, '') }))
  }, [gastos, locale])

  const filtrados = useMemo(() => {
    return gastos.filter((g) => {
      if (categoriaSel !== null) {
        const key = g.categoria_id ?? '__sin__'
        if (!categoriaSel.has(key)) return false
      }
      if (empresaSel !== null) {
        const key = g.empresa_id ?? '__sin__'
        if (!empresaSel.has(key)) return false
      }
      if (periodoSel !== null && !periodoSel.has(periodoDe(g.fecha))) return false
      return true
    })
  }, [gastos, categoriaSel, empresaSel, periodoSel])

  // Total al pie — agrupado por moneda (multi-país: nunca mezclar monedas distintas).
  const totalesPorMoneda = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of filtrados) {
      map.set(g.moneda, (map.get(g.moneda) ?? 0) + (Number(g.monto) || 0))
    }
    return Array.from(map, ([mon, total]) => ({ moneda: mon, total }))
  }, [filtrados])

  function handleSuccess(gasto: FinGasto) {
    setGastos((prev) => {
      const idx = prev.findIndex((g) => g.id === gasto.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = gasto
        return next
      }
      // Alta: insertar y reordenar por fecha desc (igual que la query).
      return [gasto, ...prev].sort((a, b) => b.fecha.localeCompare(a.fecha))
    })
    setShowModal(false)
    setEditando(null)
  }

  async function handleEliminar(gasto: FinGasto) {
    if (!confirm(`¿Eliminar el gasto "${gasto.concepto}"? Esta acción no se puede deshacer.`)) {
      return
    }
    setEliminandoId(gasto.id)
    const res = await eliminarGasto(gasto.id)
    setEliminandoId(null)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    setGastos((prev) => prev.filter((g) => g.id !== gasto.id))
    toast.success('Gasto eliminado')
  }

  function abrirAlta() {
    setEditando(null)
    setShowModal(true)
  }

  function abrirEdicion(gasto: FinGasto) {
    setEditando(gasto)
    setShowModal(true)
  }

  const hayFiltros = categoriaSel !== null || empresaSel !== null || periodoSel !== null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Gastos</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Registrá los gastos de tu consultora para entender adónde se va la plata.
          </p>
        </div>
        <Button onClick={abrirAlta}>
          <Plus size={16} />
          Cargar gasto
        </Button>
      </div>

      {gastos.length === 0 ? (
        <EmptyState
          variant="generic"
          title="Todavía no cargaste ningún gasto"
          description="Empezá a registrar los gastos de tu consultora —nafta, alquiler, herramientas, lo que sea— para ver en qué se va la plata mes a mes."
          action={{ label: 'Cargá tu primer gasto', onClick: abrirAlta }}
        />
      ) : (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            {categoriaOptions.length > 0 && (
              <MultiSelectFilter
                label="Categoría"
                options={categoriaOptions}
                selected={categoriaSel ?? new Set(categoriaOptions.map((o) => o.value))}
                onChange={(next) =>
                  setCategoriaSel(next.size === categoriaOptions.length ? null : next)
                }
              />
            )}
            {empresaOptions.length > 0 && (
              <MultiSelectFilter
                label="Cliente"
                options={empresaOptions}
                selected={empresaSel ?? new Set(empresaOptions.map((o) => o.value))}
                onChange={(next) =>
                  setEmpresaSel(next.size === empresaOptions.length ? null : next)
                }
              />
            )}
            {periodoOptions.length > 0 && (
              <MultiSelectFilter
                label="Período"
                options={periodoOptions}
                selected={periodoSel ?? new Set(periodoOptions.map((o) => o.value))}
                onChange={(next) =>
                  setPeriodoSel(next.size === periodoOptions.length ? null : next)
                }
              />
            )}
            <span className="ml-auto text-xs text-text-tertiary">
              {filtrados.length} de {gastos.length}
            </span>
          </div>

          {/* Tabla */}
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-sunken text-xs uppercase tracking-wider text-text-tertiary">
                  <tr>
                    <th className="px-3 py-2 text-left">Concepto</th>
                    <th className="px-3 py-2 text-left">Categoría</th>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-text-tertiary">
                        Sin gastos para los filtros activos.
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((g) => (
                      <tr
                        key={g.id}
                        className="border-t border-border-subtle hover:bg-surface-sunken"
                      >
                        <td className="px-3 py-2 text-text-primary">
                          <span className="block max-w-[18rem] truncate font-medium">
                            {g.concepto}
                          </span>
                          {g.km_recorridos != null && (
                            <span className="text-[11px] text-text-tertiary">
                              {formatNumero(g.km_recorridos, locale)} km
                            </span>
                          )}
                          {g.es_recurrente && (
                            <span className="ml-1 text-[11px] text-text-tertiary">
                              · recurrente {g.periodicidad ?? ''}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-text-secondary">
                          {g.categoria_id ? categoriasNombre.get(g.categoria_id) ?? '—' : '—'}
                        </td>
                        <td className="px-3 py-2 text-text-secondary">
                          {g.empresa_id ? empresasNombre.get(g.empresa_id) ?? '—' : 'General'}
                        </td>
                        <td className="px-3 py-2 text-text-tertiary text-xs">
                          {formatFechaCorta(g.fecha, locale)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              g.estado === 'pagado'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {g.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums text-text-primary">
                          {formatMonto(g.monto, g.moneda, locale)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => abrirEdicion(g)}
                              aria-label="Editar gasto"
                              title="Editar"
                              className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-base hover:text-text-primary"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEliminar(g)}
                              disabled={eliminandoId === g.id}
                              aria-label="Eliminar gasto"
                              title="Eliminar"
                              className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-base hover:text-danger disabled:opacity-50"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filtrados.length > 0 && (
                  <tfoot className="border-t border-border-default bg-surface-sunken">
                    <tr>
                      <td colSpan={5} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                        Total {hayFiltros ? '(filtrado)' : ''}
                      </td>
                      <td colSpan={2} className="px-3 py-2.5 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          {totalesPorMoneda.map((t) => (
                            <span
                              key={t.moneda}
                              className="font-bold tabular-nums text-text-primary"
                            >
                              {formatMonto(t.total, t.moneda, locale)}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal alta / edición */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setEditando(null)
        }}
        title={editando ? 'Editar gasto' : 'Cargar gasto'}
      >
        {/* key fuerza remount del form al cambiar entre alta/edición → resetea estado. */}
        <GastoForm
          key={editando?.id ?? 'nuevo'}
          gasto={editando}
          categorias={categorias}
          empresas={empresas}
          moneda={moneda}
          onSuccess={handleSuccess}
        />
      </Modal>
    </div>
  )
}
