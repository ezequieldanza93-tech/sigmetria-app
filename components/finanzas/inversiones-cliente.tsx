'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Wrench,
  Pencil,
  Trash2,
  Package,
  Gauge,
  Activity,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { KpiCard } from '@/components/analytics/kpi-card'
import { MoneyInput } from '@/components/finanzas/money-input'
import { formatMonto, formatFechaCorta, formatNumero } from '@/lib/finanzas/format'
import {
  crearInversion,
  actualizarInversion,
  eliminarInversion,
  crearInversionDesdeInstrumento,
} from '@/lib/actions/finanzas-inversiones'
import type { FinInversion } from '@/lib/finanzas/types'

/** Instrumento disponible para vincular a una inversión (shape mínimo de la page). */
export interface InstrumentoOpcion {
  id: string
  modelo: string | null
  numero_serie: string | null
  marca: string | null
  tipo: string | null
}

interface InversionesClienteProps {
  inversiones: FinInversion[]
  /** Recupero precalculado en server: instrumento_id de la inversión → mediciones hechas. */
  recuperoPorInversion: Record<string, number>
  instrumentos: InstrumentoOpcion[]
  moneda: string
  locale: string
  vidaUtilDefault: number
}

/** Amortización mensual lineal: (monto − residual) / vida útil. 0 si vida ≤ 0. */
function amortizacionMensual(inv: Pick<FinInversion, 'monto' | 'valor_residual' | 'vida_util_meses'>): number {
  const base = (Number(inv.monto) || 0) - (Number(inv.valor_residual) || 0)
  const vida = Number(inv.vida_util_meses) || 0
  return vida > 0 ? base / vida : 0
}

/** Meses transcurridos desde la adquisición (para estimar amortización acumulada). */
function mesesTranscurridos(fechaAdq: string): number {
  const desde = new Date(fechaAdq)
  if (Number.isNaN(desde.getTime())) return 0
  const ahora = new Date()
  const meses =
    (ahora.getFullYear() - desde.getFullYear()) * 12 +
    (ahora.getMonth() - desde.getMonth())
  return Math.max(0, meses)
}

function etiquetaInstrumento(i: InstrumentoOpcion): string {
  const partes = [i.marca, i.modelo].filter(Boolean).join(' ').trim() || 'Instrumento'
  const serie = i.numero_serie ? ` · N° ${i.numero_serie}` : ''
  const tipo = i.tipo ? ` (${i.tipo})` : ''
  return `${partes}${tipo}${serie}`
}

const HOY = new Date().toISOString().slice(0, 10)

export function InversionesCliente({
  inversiones,
  recuperoPorInversion,
  instrumentos,
  moneda,
  locale,
  vidaUtilDefault,
}: InversionesClienteProps) {
  const router = useRouter()
  const [modal, setModal] = useState<'manual' | 'instrumento' | null>(null)
  const [editando, setEditando] = useState<FinInversion | null>(null)
  const [borrandoId, setBorrandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── KPIs ──────────────────────────────────────────────────────
  const totalInvertido = inversiones.reduce((acc, inv) => acc + (Number(inv.monto) || 0), 0)
  const amortMensualTotal = inversiones.reduce((acc, inv) => acc + amortizacionMensual(inv), 0)
  const cantidadEquipos = inversiones.length

  async function handleEliminar(id: string) {
    if (!confirm('¿Eliminar esta inversión? Esta acción no se puede deshacer.')) return
    setBorrandoId(id)
    setError(null)
    const res = await eliminarInversion(id)
    setBorrandoId(null)
    if (!res.success) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  function cerrarModales() {
    setModal(null)
    setEditando(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Inversiones</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Equipos y bienes de capital de tu consultora. Mirá cuánto valen, cómo se amortizan y
            cuánto recuperás con cada medición.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { setError(null); setModal('instrumento') }}>
            <Wrench size={16} strokeWidth={2} />
            Desde un instrumento
          </Button>
          <Button onClick={() => { setError(null); setModal('manual') }}>
            <Plus size={16} strokeWidth={2.25} />
            Registrar inversión
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Total invertido"
          value={formatMonto(totalInvertido, moneda, locale)}
          subtitle="Valor de adquisición acumulado"
          icon={<Package size={18} strokeWidth={1.75} />}
        />
        <KpiCard
          title="Amortización mensual"
          value={formatMonto(amortMensualTotal, moneda, locale)}
          subtitle="Lo que se deprecia cada mes"
          status="warning"
          icon={<Activity size={18} strokeWidth={1.75} />}
        />
        <KpiCard
          title="Equipos registrados"
          value={cantidadEquipos}
          subtitle={cantidadEquipos === 1 ? '1 inversión cargada' : `${cantidadEquipos} inversiones cargadas`}
          icon={<Gauge size={18} strokeWidth={1.75} />}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--danger)] bg-[rgba(239,68,68,0.06)] px-4 py-3 text-sm text-[var(--danger)]">
          <AlertCircle size={16} strokeWidth={2} />
          {error}
        </div>
      )}

      {/* Tabla / Empty state */}
      {inversiones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-default bg-surface-elevated p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-tertiary">
            <Package size={24} strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-semibold text-text-primary">Todavía no cargaste ninguna inversión</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary">
            Registrá tus equipos de medición, vehículos o cualquier bien de capital. Te calculamos
            la amortización mensual y, si vinculás un instrumento, cuánto vas recuperando.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => { setError(null); setModal('manual') }}>
              <Plus size={16} strokeWidth={2.25} />
              Registrar mi primera inversión
            </Button>
            {instrumentos.length > 0 && (
              <Button variant="secondary" onClick={() => { setError(null); setModal('instrumento') }}>
                <Wrench size={16} strokeWidth={2} />
                Desde un instrumento
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-base">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border-subtle">
              <tr className="text-left">
                <th className="px-5 py-3 font-medium text-text-secondary">Descripción</th>
                <th className="px-5 py-3 font-medium text-text-secondary">Adquisición</th>
                <th className="px-5 py-3 text-right font-medium text-text-secondary">Monto</th>
                <th className="px-5 py-3 text-right font-medium text-text-secondary">Vida útil</th>
                <th className="px-5 py-3 text-right font-medium text-text-secondary">Amort. / mes</th>
                <th className="px-5 py-3 font-medium text-text-secondary">Recupero</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {inversiones.map((inv) => {
                const amort = amortizacionMensual(inv)
                const vinculado = inv.instrumento_id != null
                const mediciones = vinculado ? recuperoPorInversion[inv.id] ?? 0 : 0
                const meses = mesesTranscurridos(inv.fecha_adquisicion)
                const amortAcumulada = Math.min(amort * meses, Number(inv.monto) || 0)
                const pctAmortizado = inv.monto > 0 ? Math.min(100, (amortAcumulada / inv.monto) * 100) : 0
                return (
                  <tr key={inv.id} className="transition-colors hover:bg-surface-elevated">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 font-medium text-text-primary">
                        {vinculado && (
                          <span
                            className="inline-flex shrink-0 text-sig-600"
                            title="Vinculado a un instrumento de medición"
                          >
                            <Wrench size={14} strokeWidth={2} />
                          </span>
                        )}
                        <span>{inv.descripcion}</span>
                      </div>
                      {inv.notas && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-text-tertiary">{inv.notas}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {formatFechaCorta(inv.fecha_adquisicion, locale)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums text-text-primary">
                      {formatMonto(inv.monto, inv.moneda || moneda, locale)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-text-secondary">
                      {formatNumero(inv.vida_util_meses, locale)} meses
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-text-secondary">
                      {formatMonto(amort, inv.moneda || moneda, locale)}
                    </td>
                    <td className="px-5 py-3.5">
                      {vinculado ? (
                        <div className="min-w-[120px]">
                          <div className="flex items-center justify-between gap-2 text-xs text-text-secondary">
                            <span className="tabular-nums">
                              {formatNumero(mediciones, locale)}{' '}
                              {mediciones === 1 ? 'medición' : 'mediciones'}
                            </span>
                          </div>
                          <BarraRecupero mediciones={mediciones} />
                        </div>
                      ) : (
                        <div className="min-w-[120px]">
                          <div className="text-xs text-text-tertiary">
                            {pctAmortizado >= 100 ? 'Amortizado' : `${Math.round(pctAmortizado)}% amortizado`}
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                            <div
                              className="h-full rounded-full bg-[#F59E0B] transition-[width]"
                              style={{ width: `${pctAmortizado}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => { setError(null); setEditando(inv) }}
                          aria-label="Editar inversión"
                          className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-subtle hover:text-text-primary"
                        >
                          <Pencil size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminar(inv.id)}
                          disabled={borrandoId === inv.id}
                          aria-label="Eliminar inversión"
                          className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-[rgba(239,68,68,0.08)] hover:text-[var(--danger)] disabled:opacity-50"
                        >
                          {borrandoId === inv.id ? (
                            <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                          ) : (
                            <Trash2 size={15} strokeWidth={1.75} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: alta manual */}
      <Modal open={modal === 'manual'} onClose={cerrarModales} title="Registrar inversión">
        <InversionForm
          modo="crear"
          moneda={moneda}
          vidaUtilDefault={vidaUtilDefault}
          onCancel={cerrarModales}
          onDone={() => { cerrarModales(); router.refresh() }}
        />
      </Modal>

      {/* Modal: edición */}
      <Modal open={editando != null} onClose={cerrarModales} title="Editar inversión">
        {editando && (
          <InversionForm
            modo="editar"
            inversion={editando}
            moneda={moneda}
            vidaUtilDefault={vidaUtilDefault}
            onCancel={cerrarModales}
            onDone={() => { cerrarModales(); router.refresh() }}
          />
        )}
      </Modal>

      {/* Modal: desde instrumento */}
      <Modal open={modal === 'instrumento'} onClose={cerrarModales} title="Inversión desde un instrumento">
        <DesdeInstrumentoForm
          instrumentos={instrumentos}
          moneda={moneda}
          locale={locale}
          vidaUtilDefault={vidaUtilDefault}
          onCancel={cerrarModales}
          onDone={() => { cerrarModales(); router.refresh() }}
        />
      </Modal>
    </div>
  )
}

// ── Barra de recupero (mediciones realizadas con el equipo) ─────────
// Escala simple sobre 50 mediciones como referencia visual de "amortizado por uso".
const RECUPERO_REF = 50

function BarraRecupero({ mediciones }: { mediciones: number }) {
  const pct = Math.min(100, (mediciones / RECUPERO_REF) * 100)
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
      <div
        className="h-full rounded-full bg-[#4CAF50] transition-[width]"
        style={{ width: `${mediciones === 0 ? 4 : pct}%`, opacity: mediciones === 0 ? 0.4 : 1 }}
      />
    </div>
  )
}

// ── Formulario de alta/edición manual ───────────────────────────────

interface InversionFormProps {
  modo: 'crear' | 'editar'
  inversion?: FinInversion
  moneda: string
  vidaUtilDefault: number
  onCancel: () => void
  onDone: () => void
}

function InversionForm({ modo, inversion, moneda, vidaUtilDefault, onCancel, onDone }: InversionFormProps) {
  const [descripcion, setDescripcion] = useState(inversion?.descripcion ?? '')
  const [fecha, setFecha] = useState(inversion?.fecha_adquisicion?.slice(0, 10) ?? HOY)
  const [monto, setMonto] = useState<number | null>(inversion ? Number(inversion.monto) : null)
  const [vidaUtil, setVidaUtil] = useState(
    inversion ? String(inversion.vida_util_meses) : String(vidaUtilDefault),
  )
  const [valorResidual, setValorResidual] = useState<number | null>(
    inversion ? Number(inversion.valor_residual) : 0,
  )
  const [notas, setNotas] = useState(inversion?.notas ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const montoNum = monto ?? NaN
    if (!descripcion.trim()) return setError('Poné una descripción para la inversión')
    if (!fecha) return setError('Indicá la fecha de adquisición')
    if (!Number.isFinite(montoNum) || montoNum < 0) return setError('El monto tiene que ser un número válido')

    setGuardando(true)
    const input = {
      descripcion: descripcion.trim(),
      fecha_adquisicion: fecha,
      monto: montoNum,
      vida_util_meses: Number(vidaUtil) || vidaUtilDefault,
      valor_residual: valorResidual ?? 0,
      notas: notas.trim() || null,
    }
    const res =
      modo === 'crear'
        ? await crearInversion(input)
        : await actualizarInversion(inversion!.id, input)
    setGuardando(false)

    if (!res.success) {
      setError(res.error)
      return
    }
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Campo label="Descripción" requerido>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: Sonómetro clase 1, vehículo, notebook…"
          className={INPUT_CLASS}
          autoFocus
        />
      </Campo>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Fecha de adquisición" requerido>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={INPUT_CLASS}
          />
        </Campo>
        <Campo label={`Monto (${moneda})`} requerido>
          <MoneyInput
            value={monto}
            onChange={setMonto}
            moneda={moneda}
          />
        </Campo>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Vida útil (meses)" ayuda="Sobre cuántos meses se amortiza">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step="1"
            value={vidaUtil}
            onChange={(e) => setVidaUtil(e.target.value)}
            className={INPUT_CLASS}
          />
        </Campo>
        <Campo label={`Valor residual (${moneda})`} ayuda="Lo que valdría al final de su vida útil">
          <MoneyInput
            value={valorResidual}
            onChange={setValorResidual}
            moneda={moneda}
          />
        </Campo>
      </div>

      <Campo label="Notas">
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Opcional"
          className={INPUT_CLASS}
        />
      </Campo>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-[rgba(239,68,68,0.06)] px-3 py-2 text-sm text-[var(--danger)]">
          <AlertCircle size={15} strokeWidth={2} />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando}>
          {guardando && <Loader2 size={15} strokeWidth={2} className="animate-spin" />}
          {modo === 'crear' ? 'Registrar inversión' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}

// ── Formulario: inversión desde un instrumento ──────────────────────

interface DesdeInstrumentoFormProps {
  instrumentos: InstrumentoOpcion[]
  moneda: string
  locale: string
  vidaUtilDefault: number
  onCancel: () => void
  onDone: () => void
}

function DesdeInstrumentoForm({
  instrumentos,
  moneda,
  vidaUtilDefault,
  onCancel,
  onDone,
}: DesdeInstrumentoFormProps) {
  const [instrumentoId, setInstrumentoId] = useState('')
  const [monto, setMonto] = useState<number | null>(null)
  const [fecha, setFecha] = useState(HOY)
  const [vidaUtil, setVidaUtil] = useState(String(vidaUtilDefault))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (instrumentos.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-border-default bg-surface-elevated p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle text-text-tertiary">
            <Wrench size={20} strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-text-primary">No hay instrumentos cargados todavía</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-text-secondary">
            Dá de alta tus equipos en Instrumentos de Medición y después volvé acá para registrarlos
            como inversión y seguir su recupero por uso.
          </p>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cerrar
          </Button>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const montoNum = monto ?? NaN
    if (!instrumentoId) return setError('Elegí el instrumento que querés registrar')
    if (!fecha) return setError('Indicá la fecha de adquisición')
    if (!Number.isFinite(montoNum) || montoNum < 0) return setError('El monto tiene que ser un número válido')

    setGuardando(true)
    const res = await crearInversionDesdeInstrumento(
      instrumentoId,
      montoNum,
      fecha,
      Number(vidaUtil) || vidaUtilDefault,
    )
    setGuardando(false)

    if (!res.success) {
      setError(res.error)
      return
    }
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-text-secondary">
        Vinculá un instrumento de medición ya cargado. Tomamos su marca y modelo como descripción y
        empezamos a contar las mediciones que hacés con él para mostrarte el recupero.
      </p>

      <Campo label="Instrumento" requerido>
        <select
          value={instrumentoId}
          onChange={(e) => setInstrumentoId(e.target.value)}
          className={INPUT_CLASS}
          autoFocus
        >
          <option value="">Elegí un instrumento…</option>
          {instrumentos.map((i) => (
            <option key={i.id} value={i.id}>
              {etiquetaInstrumento(i)}
            </option>
          ))}
        </select>
      </Campo>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Fecha de adquisición" requerido>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={INPUT_CLASS}
          />
        </Campo>
        <Campo label={`Monto (${moneda})`} requerido>
          <MoneyInput
            value={monto}
            onChange={setMonto}
            moneda={moneda}
          />
        </Campo>
      </div>

      <Campo label="Vida útil (meses)" ayuda="Sobre cuántos meses se amortiza">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step="1"
          value={vidaUtil}
          onChange={(e) => setVidaUtil(e.target.value)}
          className={INPUT_CLASS}
        />
      </Campo>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-[rgba(239,68,68,0.06)] px-3 py-2 text-sm text-[var(--danger)]">
          <AlertCircle size={15} strokeWidth={2} />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando}>
          {guardando && <Loader2 size={15} strokeWidth={2} className="animate-spin" />}
          Registrar inversión
        </Button>
      </div>
    </form>
  )
}

// ── Átomos de formulario ────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary'

function Campo({
  label,
  requerido,
  ayuda,
  children,
}: {
  label: string
  requerido?: boolean
  ayuda?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-text-primary">
        {label}
        {requerido && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      </span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-text-tertiary">{ayuda}</span>}
    </label>
  )
}
