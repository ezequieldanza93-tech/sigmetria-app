'use client'

import { useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { EmptyState } from '@/components/ui/empty-state'
import { MultiSelectFilter } from '@/components/ui/multi-select-filter'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
import { MoneyInput } from '@/components/finanzas/money-input'
import { toast } from '@/lib/hooks/use-toast'
import { formatMonto, formatFechaCorta } from '@/lib/finanzas/format'
import {
  crearComprobante,
  actualizarComprobante,
  eliminarComprobante,
  marcarCobrada,
  marcarEmitida,
} from '@/lib/actions/finanzas-comprobantes'
import { crearFormaPago } from '@/lib/actions/finanzas-formas-pago'
import type { FinFormaPago } from '@/lib/queries/finanzas-formas-pago'
import type {
  FinComprobante,
  FinComprobanteInput,
  FinEstadoComprobante,
  FinTipoComprobante,
} from '@/lib/finanzas/types'

/** Valor centinela del select para disparar el alta inline de forma de pago. */
const FORMA_PAGO_NUEVA = '__nueva__'

interface EmpresaLite {
  id: string
  razon_social: string
}

interface Props {
  comprobantesIniciales: FinComprobante[]
  empresas: EmpresaLite[]
  /** Formas de pago disponibles (genéricas + propias de la consultora). */
  formasPagoIniciales: FinFormaPago[]
  moneda: string
  locale: string
  /** Tasa de IVA por defecto (porcentaje, ej. 21) desde fin_config. */
  ivaTasa: number
}

// ─── Metadatos de estado (badges) ────────────────────────────────────────────

const ESTADOS: { value: FinEstadoComprobante; label: string }[] = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'emitida', label: 'Emitida' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'cobrada', label: 'Cobrada' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'anulada', label: 'Anulada' },
]

const ESTADO_LABEL: Record<FinEstadoComprobante, string> = {
  borrador: 'Borrador',
  emitida: 'Emitida',
  pendiente: 'Pendiente',
  cobrada: 'Cobrada',
  vencida: 'Vencida',
  anulada: 'Anulada',
}

// Clases del badge por estado (paleta consistente con gastos).
const ESTADO_BADGE: Record<FinEstadoComprobante, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  emitida: 'bg-blue-100 text-blue-800',
  pendiente: 'bg-amber-100 text-amber-800',
  cobrada: 'bg-green-100 text-green-800',
  vencida: 'bg-red-100 text-red-800',
  anulada: 'bg-slate-100 text-slate-500 line-through',
}

const TIPOS: { value: FinTipoComprobante; label: string }[] = [
  { value: 'abono', label: 'Abono (recurrente)' },
  { value: 'puntual', label: 'Trabajo puntual' },
]

function hoyISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Mes calendario YYYY-MM de una fecha ISO (YYYY-MM-DD). */
function periodoDe(fecha: string): string {
  return fecha.slice(0, 7)
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ─── Formulario de alta / edición ───────────────────────────────────────────

interface FormProps {
  comprobante: FinComprobante | null
  /** En alta: empresa preseleccionada (ej. desde el bloque de abonos pendientes). */
  empresaInicial?: string
  empresas: EmpresaLite[]
  /** Formas de pago disponibles para el select. */
  formasPago: FinFormaPago[]
  /** Avisa al padre cuando se crea una forma de pago nueva (para sumarla a la lista). */
  onFormaPagoCreada: (forma: FinFormaPago) => void
  moneda: string
  locale: string
  ivaTasa: number
  onSuccess: (comprobante: FinComprobante) => void
}

function ComprobanteForm({
  comprobante,
  empresaInicial,
  empresas,
  formasPago,
  onFormaPagoCreada,
  moneda,
  locale,
  ivaTasa,
  onSuccess,
}: FormProps) {
  const [empresaId, setEmpresaId] = useState(comprobante?.empresa_id ?? empresaInicial ?? '')
  const [concepto, setConcepto] = useState(comprobante?.concepto ?? '')
  const [tipo, setTipo] = useState<FinTipoComprobante>(comprobante?.tipo ?? 'puntual')
  const [montoNeto, setMontoNeto] = useState<number | null>(
    comprobante ? comprobante.monto_neto : null,
  )
  // IVA editable: si hay comprobante usamos su valor; si es alta, lo dejamos
  // vacío para que el server lo calcule con la tasa de config.
  const [montoIva, setMontoIva] = useState<number | null>(
    comprobante ? comprobante.monto_iva : null,
  )
  const [ivaAuto, setIvaAuto] = useState(comprobante == null)
  const [monedaInput, setMonedaInput] = useState(comprobante?.moneda ?? moneda)
  const [formaPagoId, setFormaPagoId] = useState(comprobante?.forma_pago_id ?? '')
  // Estado del alta inline de forma de pago.
  const [nuevaFormaPago, setNuevaFormaPago] = useState('')
  const [creandoFormaPago, setCreandoFormaPago] = useState(false)
  const [formaPagoPending, setFormaPagoPending] = useState(false)
  const [numero, setNumero] = useState(comprobante?.numero ?? '')
  const [fechaEmision, setFechaEmision] = useState(comprobante?.fecha_emision ?? hoyISO())
  const [fechaVencimiento, setFechaVencimiento] = useState(
    comprobante?.fecha_vencimiento ?? '',
  )
  const [estado, setEstado] = useState<FinEstadoComprobante>(
    comprobante?.estado ?? 'pendiente',
  )
  const [esRecurrente, setEsRecurrente] = useState(
    comprobante?.es_recurrente ?? false,
  )
  const [recurrenciaDia, setRecurrenciaDia] = useState(
    comprobante?.recurrencia_dia != null ? String(comprobante.recurrencia_dia) : '',
  )
  const [notas, setNotas] = useState(comprobante?.notas ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const esAbono = tipo === 'abono'

  // Cálculo en vivo de neto/iva/total para mostrarle al usuario el total final.
  const netoNum = montoNeto ?? NaN
  const netoValido = Number.isFinite(netoNum) && netoNum >= 0
  const ivaCalc = ivaAuto
    ? round2((netoValido ? netoNum : 0) * (ivaTasa / 100))
    : montoIva != null && Number.isFinite(montoIva)
      ? round2(montoIva)
      : 0
  const totalCalc = round2((netoValido ? netoNum : 0) + ivaCalc)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!empresaId) {
      setError('Tenés que elegir el cliente')
      return
    }
    if (!concepto.trim()) {
      setError('El concepto es obligatorio')
      return
    }
    if (!netoValido) {
      setError('El monto neto debe ser un número válido')
      return
    }
    if (!fechaEmision) {
      setError('La fecha de emisión es obligatoria')
      return
    }
    if (!ivaAuto && (montoIva == null || !Number.isFinite(montoIva) || montoIva < 0)) {
      setError('El IVA debe ser un número válido')
      return
    }
    if (
      esAbono &&
      recurrenciaDia !== '' &&
      (!Number.isInteger(Number(recurrenciaDia)) ||
        Number(recurrenciaDia) < 1 ||
        Number(recurrenciaDia) > 28)
    ) {
      setError('El día de recurrencia debe estar entre 1 y 28')
      return
    }

    const input: FinComprobanteInput = {
      empresa_id: empresaId,
      concepto: concepto.trim(),
      tipo,
      // IVA: si ivaAuto, omitimos el campo para que el server lo calcule.
      monto_neto: netoNum,
      ...(ivaAuto ? {} : { monto_iva: montoIva ?? 0 }),
      moneda: monedaInput || moneda,
      estado,
      numero: numero.trim() || null,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento || null,
      forma_pago_id: formaPagoId || null,
      es_recurrente: esAbono ? esRecurrente : false,
      recurrencia_dia: esAbono && recurrenciaDia !== '' ? Number(recurrenciaDia) : null,
      notas: notas.trim() || null,
    }

    setPending(true)
    const res = comprobante
      ? await actualizarComprobante(comprobante.id, input)
      : await crearComprobante(input)
    setPending(false)

    if (!res.success) {
      setError(res.error)
      return
    }
    toast.success(comprobante ? 'Comprobante actualizado' : 'Comprobante creado')
    onSuccess(res.data)
  }

  // El select dispara el alta inline al elegir "Agregar otra…".
  function handleFormaPagoChange(value: string) {
    if (value === FORMA_PAGO_NUEVA) {
      setCreandoFormaPago(true)
      setNuevaFormaPago('')
      return
    }
    setFormaPagoId(value)
  }

  async function handleCrearFormaPago() {
    const nombre = nuevaFormaPago.trim()
    if (!nombre) {
      setError('Escribí el nombre de la forma de pago')
      return
    }
    setFormaPagoPending(true)
    const res = await crearFormaPago(nombre)
    setFormaPagoPending(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    onFormaPagoCreada(res.data)
    setFormaPagoId(res.data.id)
    setCreandoFormaPago(false)
    setNuevaFormaPago('')
    toast.success('Forma de pago agregada')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <SearchableSelect
        label="Cliente"
        required
        value={empresaId}
        onChange={setEmpresaId}
        options={empresas.map((emp) => ({ value: emp.id, label: emp.razon_social }))}
        placeholder="Elegí la empresa-cliente…"
        emptyText="No hay clientes cargados."
      />

      <Input
        label="Concepto"
        required
        value={concepto}
        onChange={(e) => setConcepto(e.target.value)}
        placeholder="Ej: Abono mensual HyS, medición de ruido…"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as FinTipoComprobante)}
          options={TIPOS}
        />
        <Select
          label="Estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value as FinEstadoComprobante)}
          options={ESTADOS}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MoneyInput
          label="Monto neto"
          required
          value={montoNeto}
          onChange={setMontoNeto}
          moneda={monedaInput || moneda}
          locale={locale}
        />
        <Input
          label="Moneda"
          value={monedaInput}
          onChange={(e) => setMonedaInput(e.target.value.toUpperCase())}
          placeholder={moneda}
          maxLength={3}
        />
      </div>

      {/* IVA: por defecto se calcula con la tasa de config; el usuario puede
          editarlo manualmente (ej. comprobantes exentos = 0). */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={ivaAuto}
            onChange={(e) => setIvaAuto(e.target.checked)}
            className="h-4 w-4 rounded border-border-default text-brand-primary focus:ring-brand-primary/30"
          />
          Calcular IVA automáticamente ({ivaTasa}%)
        </label>
        {!ivaAuto && (
          <MoneyInput
            label="IVA"
            value={montoIva}
            onChange={setMontoIva}
            moneda={monedaInput || moneda}
            locale={locale}
            placeholder="Poné 0 si está exento"
          />
        )}
      </div>

      {/* Resumen del total que se va a facturar. */}
      <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-sunken px-4 py-2.5 text-sm">
        <span className="text-text-secondary">
          Neto {formatMonto(netoValido ? netoNum : 0, monedaInput || moneda)} + IVA{' '}
          {formatMonto(ivaCalc, monedaInput || moneda)}
        </span>
        <span className="font-bold tabular-nums text-text-primary">
          Total {formatMonto(totalCalc, monedaInput || moneda)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Fecha de emisión"
          required
          type="date"
          value={fechaEmision}
          onChange={(e) => setFechaEmision(e.target.value)}
        />
        <Input
          label="Vencimiento (opcional)"
          type="date"
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
        />
      </div>

      <Input
        label="Número de comprobante (opcional)"
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        placeholder="Ej: 0001-00001234"
      />

      {/* Forma de pago: select con las formas (genéricas + propias) + alta inline. */}
      {creandoFormaPago ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">
            Nueva forma de pago
          </label>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                value={nuevaFormaPago}
                onChange={(e) => setNuevaFormaPago(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleCrearFormaPago()
                  }
                }}
                placeholder="Ej: Western Union, USDT…"
                autoFocus
              />
            </div>
            <Button
              type="button"
              onClick={() => void handleCrearFormaPago()}
              disabled={formaPagoPending}
            >
              {formaPagoPending ? 'Agregando…' : 'Agregar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCreandoFormaPago(false)
                setNuevaFormaPago('')
              }}
              disabled={formaPagoPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Select
          label="Forma de pago (opcional)"
          value={formaPagoId}
          onChange={(e) => handleFormaPagoChange(e.target.value)}
          placeholder="Sin especificar"
          options={[
            ...formasPago.map((fp) => ({ value: fp.id, label: fp.nombre })),
            { value: FORMA_PAGO_NUEVA, label: '+ Agregar otra…' },
          ]}
        />
      )}

      {esAbono && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-secondary">Recurrencia</span>
            <label className="flex items-center gap-2 py-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={esRecurrente}
                onChange={(e) => setEsRecurrente(e.target.checked)}
                className="h-4 w-4 rounded border-border-default text-brand-primary focus:ring-brand-primary/30"
              />
              Es un abono recurrente
            </label>
          </div>
          {esRecurrente && (
            <Input
              label="Día de facturación (1-28)"
              type="number"
              min="1"
              max="28"
              step="1"
              value={recurrenciaDia}
              onChange={(e) => setRecurrenciaDia(e.target.value)}
              placeholder="Ej: 1"
            />
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Notas</label>
        <VoiceTextarea
          value={notas}
          onValueChange={setNotas}
          rows={2}
          className="w-full resize-none rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
          placeholder="Detalle opcional…"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : comprobante ? 'Guardar cambios' : 'Facturar'}
        </Button>
      </div>
    </form>
  )
}

// ─── Vista principal ─────────────────────────────────────────────────────────

export function FacturacionCliente({
  comprobantesIniciales,
  empresas,
  formasPagoIniciales,
  moneda,
  locale,
  ivaTasa,
}: Props) {
  const [comprobantes, setComprobantes] = useState<FinComprobante[]>(comprobantesIniciales)
  const [formasPago, setFormasPago] = useState<FinFormaPago[]>(formasPagoIniciales)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<FinComprobante | null>(null)
  /** En alta, empresa preseleccionada (desde el bloque de abonos pendientes). */
  const [empresaInicial, setEmpresaInicial] = useState('')
  const [accionId, setAccionId] = useState<string | null>(null)

  // Filtros (null = "Todos", sin filtrar).
  const [empresaSel, setEmpresaSel] = useState<Set<string> | null>(null)
  const [estadoSel, setEstadoSel] = useState<Set<string> | null>(null)
  const [periodoSel, setPeriodoSel] = useState<Set<string> | null>(null)

  const empresasNombre = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of empresas) map.set(e.id, e.razon_social)
    return map
  }, [empresas])

  // ── Opciones de filtros derivadas de los comprobantes presentes ────────────
  const empresaOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const c of comprobantes) ids.add(c.empresa_id)
    return Array.from(ids, (id) => ({
      value: id,
      label: empresasNombre.get(id) ?? 'Cliente',
    })).sort((a, b) => a.label.localeCompare(b.label))
  }, [comprobantes, empresasNombre])

  const estadoOptions = useMemo(() => {
    const present = new Set<string>()
    for (const c of comprobantes) present.add(c.estado)
    return ESTADOS.filter((e) => present.has(e.value))
  }, [comprobantes])

  const periodoOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of comprobantes) set.add(periodoDe(c.fecha_emision))
    return Array.from(set)
      .sort((a, b) => b.localeCompare(a))
      .map((p) => ({
        value: p,
        label: formatFechaCorta(`${p}-01`, locale).replace(/^\d+\s/, ''),
      }))
  }, [comprobantes, locale])

  const filtrados = useMemo(() => {
    return comprobantes.filter((c) => {
      if (empresaSel !== null && !empresaSel.has(c.empresa_id)) return false
      if (estadoSel !== null && !estadoSel.has(c.estado)) return false
      if (periodoSel !== null && !periodoSel.has(periodoDe(c.fecha_emision))) return false
      return true
    })
  }, [comprobantes, empresaSel, estadoSel, periodoSel])

  // Total al pie — agrupado por moneda (multi-país: nunca mezclar monedas).
  const totalesPorMoneda = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of filtrados) {
      map.set(c.moneda, (map.get(c.moneda) ?? 0) + (Number(c.monto_total) || 0))
    }
    return Array.from(map, ([mon, total]) => ({ moneda: mon, total }))
  }, [filtrados])

  // ── "No facturaste todavía a…" — clientes con abono recurrente que NO tienen
  //    comprobante emitido en el mes actual. Se deriva de los comprobantes.
  const clientesPendientesMes = useMemo(() => {
    const periodoActual = periodoDe(hoyISO())
    // Empresas que tienen al menos un abono recurrente histórico.
    const empresasConAbono = new Map<string, string>()
    for (const c of comprobantes) {
      if (c.tipo === 'abono') {
        empresasConAbono.set(
          c.empresa_id,
          empresasNombre.get(c.empresa_id) ?? c.empresa_id,
        )
      }
    }
    // Empresas que YA tienen un comprobante en el mes actual.
    const facturadasEsteMes = new Set<string>()
    for (const c of comprobantes) {
      if (periodoDe(c.fecha_emision) === periodoActual && c.estado !== 'anulada') {
        facturadasEsteMes.add(c.empresa_id)
      }
    }
    const pendientes: { id: string; nombre: string }[] = []
    for (const [id, nombre] of empresasConAbono) {
      if (!facturadasEsteMes.has(id)) pendientes.push({ id, nombre })
    }
    return pendientes.sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [comprobantes, empresasNombre])

  function handleSuccess(comprobante: FinComprobante) {
    setComprobantes((prev) => {
      const idx = prev.findIndex((c) => c.id === comprobante.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = comprobante
        return next
      }
      return [comprobante, ...prev].sort((a, b) =>
        b.fecha_emision.localeCompare(a.fecha_emision),
      )
    })
    setShowModal(false)
    setEditando(null)
  }

  // Suma la forma de pago recién creada a la lista (orden + nombre, espejo de la query).
  function handleFormaPagoCreada(forma: FinFormaPago) {
    setFormasPago((prev) => {
      if (prev.some((f) => f.id === forma.id)) return prev
      return [...prev, forma].sort(
        (a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre),
      )
    })
  }

  async function handleMarcarCobrada(c: FinComprobante) {
    setAccionId(c.id)
    const res = await marcarCobrada(c.id)
    setAccionId(null)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    handleSuccess(res.data)
    toast.success('Marcado como cobrado')
  }

  async function handleMarcarEmitida(c: FinComprobante) {
    setAccionId(c.id)
    const res = await marcarEmitida(c.id)
    setAccionId(null)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    handleSuccess(res.data)
    toast.success('Marcado como emitido')
  }

  async function handleEliminar(c: FinComprobante) {
    if (
      !confirm(
        `¿Eliminar el comprobante "${c.concepto}"? Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    setAccionId(c.id)
    const res = await eliminarComprobante(c.id)
    setAccionId(null)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    setComprobantes((prev) => prev.filter((x) => x.id !== c.id))
    toast.success('Comprobante eliminado')
  }

  function abrirAlta(empresaPre?: string) {
    setEditando(null)
    setEmpresaInicial(empresaPre ?? '')
    setShowModal(true)
  }

  function abrirEdicion(c: FinComprobante) {
    setEditando(c)
    setEmpresaInicial('')
    setShowModal(true)
  }

  const hayFiltros = empresaSel !== null || estadoSel !== null || periodoSel !== null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Facturación</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Registrá lo que le facturás a cada cliente y seguí el estado de cobro.
          </p>
        </div>
        <Button onClick={() => abrirAlta()}>
          <Plus size={16} />
          Facturar a un cliente
        </Button>
      </div>

      {/* "No facturaste todavía a…" — recordatorio de abonos del mes. */}
      {clientesPendientesMes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Todavía no facturaste este mes a:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {clientesPendientesMes.map((cli) => (
                  <button
                    key={cli.id}
                    type="button"
                    onClick={() => abrirAlta(cli.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100"
                  >
                    <Plus size={13} />
                    {cli.nombre}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {comprobantes.length === 0 ? (
        <EmptyState
          variant="documents"
          title="Todavía no facturaste a ningún cliente"
          description="Empezá a registrar lo que le cobrás a cada empresa-cliente —abonos mensuales o trabajos puntuales— para llevar el control de cobros y ver tu facturación del mes."
          action={{ label: 'Facturá a tu primer cliente', onClick: () => abrirAlta() }}
        />
      ) : (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
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
            {estadoOptions.length > 0 && (
              <MultiSelectFilter
                label="Estado"
                options={estadoOptions}
                selected={estadoSel ?? new Set(estadoOptions.map((o) => o.value))}
                onChange={(next) =>
                  setEstadoSel(next.size === estadoOptions.length ? null : next)
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
              {filtrados.length} de {comprobantes.length}
            </span>
          </div>

          {/* Tabla */}
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-sunken text-xs uppercase tracking-wider text-text-tertiary">
                  <tr>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Concepto</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Emisión</th>
                    <th className="px-3 py-2 text-left">Vencimiento</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-text-tertiary">
                        Sin comprobantes para los filtros activos.
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((c) => {
                      const cobrable =
                        c.estado !== 'cobrada' && c.estado !== 'anulada'
                      const emisible =
                        c.estado === 'borrador' || c.estado === 'pendiente'
                      const trabajando = accionId === c.id
                      return (
                        <tr
                          key={c.id}
                          className="border-t border-border-subtle hover:bg-surface-sunken"
                        >
                          <td className="px-3 py-2 text-text-primary">
                            <span className="block max-w-[14rem] truncate font-medium">
                              {empresasNombre.get(c.empresa_id) ?? '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-text-secondary">
                            <span className="block max-w-[16rem] truncate">
                              {c.concepto}
                            </span>
                            {c.numero && (
                              <span className="text-[11px] text-text-tertiary">
                                {c.numero}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-text-secondary">
                            <span className="inline-flex items-center gap-1 text-xs">
                              {c.tipo === 'abono' ? (
                                <>
                                  <Clock size={12} className="text-text-tertiary" />
                                  Abono
                                </>
                              ) : (
                                <>
                                  <FileText size={12} className="text-text-tertiary" />
                                  Puntual
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-text-tertiary">
                            {formatFechaCorta(c.fecha_emision, locale)}
                          </td>
                          <td className="px-3 py-2 text-xs text-text-tertiary">
                            {c.fecha_vencimiento
                              ? formatFechaCorta(c.fecha_vencimiento, locale)
                              : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ESTADO_BADGE[c.estado]}`}
                            >
                              {ESTADO_LABEL[c.estado]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums text-text-primary">
                            {formatMonto(c.monto_total, c.moneda, locale)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              {emisible && (
                                <button
                                  type="button"
                                  onClick={() => handleMarcarEmitida(c)}
                                  disabled={trabajando}
                                  aria-label="Marcar como emitida"
                                  title="Marcar como emitida"
                                  className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-base hover:text-blue-600 disabled:opacity-50"
                                >
                                  <Send size={15} />
                                </button>
                              )}
                              {cobrable && (
                                <button
                                  type="button"
                                  onClick={() => handleMarcarCobrada(c)}
                                  disabled={trabajando}
                                  aria-label="Marcar como cobrada"
                                  title="Marcar como cobrada"
                                  className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-base hover:text-green-600 disabled:opacity-50"
                                >
                                  <CheckCircle size={15} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => abrirEdicion(c)}
                                aria-label="Editar comprobante"
                                title="Editar"
                                className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-base hover:text-text-primary"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEliminar(c)}
                                disabled={trabajando}
                                aria-label="Eliminar comprobante"
                                title="Eliminar"
                                className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-base hover:text-danger disabled:opacity-50"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {filtrados.length > 0 && (
                  <tfoot className="border-t border-border-default bg-surface-sunken">
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-text-tertiary"
                      >
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
          setEmpresaInicial('')
        }}
        title={editando ? 'Editar comprobante' : 'Facturar a un cliente'}
      >
        {/* key fuerza remount del form al cambiar entre alta/edición → resetea estado. */}
        <ComprobanteForm
          key={editando?.id ?? `nuevo-${empresaInicial}`}
          comprobante={editando}
          empresaInicial={empresaInicial}
          empresas={empresas}
          formasPago={formasPago}
          onFormaPagoCreada={handleFormaPagoCreada}
          moneda={moneda}
          locale={locale}
          ivaTasa={ivaTasa}
          onSuccess={handleSuccess}
        />
      </Modal>
    </div>
  )
}
