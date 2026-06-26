'use client'

import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
import { MoneyInput } from '@/components/finanzas/money-input'
import { toast } from '@/lib/hooks/use-toast'
import { formatMonto, formatFechaCorta } from '@/lib/finanzas/format'
import {
  crearCotizacion,
  actualizarCotizacion,
  eliminarCotizacion,
  cambiarEstadoCotizacion,
  generarPresupuestoPdf,
  type CotizacionInput,
} from '@/lib/actions/finanzas-cotizaciones'
import { crearFormaPago } from '@/lib/actions/finanzas-formas-pago'
import type {
  Cotizacion,
  CotizacionTipo,
  CotizacionEstado,
  CotizacionItem,
} from '@/lib/queries/cotizaciones'
import type { FinFormaPago } from '@/lib/queries/finanzas-formas-pago'

interface EmpresaLite {
  id: string
  razon_social: string
}

interface LeadLite {
  id: string
  nombre: string
  /** Servicios que el lead marcó de interés — sugieren el concepto. */
  serviciosInteres: string[] | null
}

interface Props {
  cotizacionesIniciales: Cotizacion[]
  empresas: EmpresaLite[]
  leads: LeadLite[]
  formasPagoIniciales: FinFormaPago[]
  moneda: string
  locale: string
}

// Destinatario del presupuesto.
type Destinatario = 'empresa' | 'lead' | 'manual'

// Metadatos de estado para el embudo comercial.
const ESTADO_META: Record<
  CotizacionEstado,
  { label: string; clase: string }
> = {
  borrador: { label: 'Borrador', clase: 'bg-slate-100 text-slate-700' },
  enviada: { label: 'Enviada', clase: 'bg-blue-100 text-blue-800' },
  aceptada: { label: 'Aceptada', clase: 'bg-green-100 text-green-800' },
  rechazada: { label: 'Rechazada', clase: 'bg-red-100 text-red-800' },
  vencida: { label: 'Vencida', clase: 'bg-amber-100 text-amber-800' },
}

const ESTADO_OPCIONES: CotizacionEstado[] = [
  'borrador',
  'enviada',
  'aceptada',
  'rechazada',
  'vencida',
]

// ─── Formulario de alta / edición ───────────────────────────────────────────

interface FormProps {
  cotizacion: Cotizacion | null
  empresas: EmpresaLite[]
  leads: LeadLite[]
  formasPago: FinFormaPago[]
  /** Registra en la lista (a nivel vista) una forma de pago recién creada. */
  onFormaPagoCreada: (fp: FinFormaPago) => void
  moneda: string
  locale: string
  onSuccess: (cotizacion: Cotizacion, esNueva: boolean) => void
}

// Deriva el destinatario inicial a partir de una cotización existente.
function destinatarioDe(cot: Cotizacion | null): Destinatario {
  if (!cot) return 'empresa'
  if (cot.empresa_id) return 'empresa'
  if (cot.lead_id) return 'lead'
  return 'manual'
}

function CotizacionForm({
  cotizacion,
  empresas,
  leads,
  formasPago,
  onFormaPagoCreada,
  moneda,
  locale,
  onSuccess,
}: FormProps) {
  const [destinatario, setDestinatario] = useState<Destinatario>(destinatarioDe(cotizacion))
  const [empresaId, setEmpresaId] = useState(cotizacion?.empresa_id ?? '')
  const [leadId, setLeadId] = useState(cotizacion?.lead_id ?? '')
  const [prospectoNombre, setProspectoNombre] = useState(cotizacion?.prospecto_nombre ?? '')
  const [prospectoEmail, setProspectoEmail] = useState(cotizacion?.prospecto_email ?? '')
  const [prospectoTelefono, setProspectoTelefono] = useState(cotizacion?.prospecto_telefono ?? '')

  const [tipo, setTipo] = useState<CotizacionTipo>(cotizacion?.tipo ?? 'completo')
  const [concepto, setConcepto] = useState(cotizacion?.concepto ?? '')
  const [montoUnico, setMontoUnico] = useState<number | null>(
    cotizacion && cotizacion.tipo === 'completo' ? cotizacion.monto_total : null,
  )
  const [items, setItems] = useState<CotizacionItem[]>(
    cotizacion && cotizacion.tipo === 'especifico' && cotizacion.items.length > 0
      ? cotizacion.items
      : [{ descripcion: '', monto: 0 }],
  )
  const [monedaInput, setMonedaInput] = useState(cotizacion?.moneda ?? moneda)
  const [formaPagoId, setFormaPagoId] = useState(cotizacion?.forma_pago_id ?? '')
  // Inline "Agregar otra" forma de pago.
  const [agregandoFormaPago, setAgregandoFormaPago] = useState(false)
  const [nuevaFormaPago, setNuevaFormaPago] = useState('')
  const [creandoFormaPago, setCreandoFormaPago] = useState(false)
  const [validezDias, setValidezDias] = useState(
    cotizacion?.validez_dias != null ? String(cotizacion.validez_dias) : '',
  )
  const [notas, setNotas] = useState(cotizacion?.notas ?? '')

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Total derivado para tipo 'especifico'.
  const totalItems = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.monto) || 0), 0),
    [items],
  )

  // Al elegir un lead, si trae servicios de interés y el concepto está vacío,
  // lo sugerimos. Los datos completos del cliente los resuelve el server al
  // generar el PDF (desde empresa_id / lead_id) — acá no hace falta consultar.
  function sugerirConceptoDesdeLead(id: string) {
    if (!id || concepto.trim()) return
    const lead = leads.find((l) => l.id === id)
    if (lead?.serviciosInteres && lead.serviciosInteres.length > 0) {
      setConcepto(lead.serviciosInteres.join(', '))
    }
  }

  function addItem() {
    setItems((prev) => [...prev, { descripcion: '', monto: 0 }])
  }

  function updateItem(idx: number, patch: Partial<CotizacionItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function removeItem(idx: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  async function handleCrearFormaPago() {
    const nombre = nuevaFormaPago.trim()
    if (!nombre) return
    setCreandoFormaPago(true)
    const res = await crearFormaPago(nombre)
    setCreandoFormaPago(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    onFormaPagoCreada(res.data)
    setFormaPagoId(res.data.id)
    setNuevaFormaPago('')
    setAgregandoFormaPago(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!concepto.trim()) {
      setError('El concepto es obligatorio')
      return
    }

    // Validación del destinatario.
    if (destinatario === 'empresa' && !empresaId) {
      setError('Elegí una empresa-cliente')
      return
    }
    if (destinatario === 'lead' && !leadId) {
      setError('Elegí un prospecto')
      return
    }
    if (destinatario === 'manual' && !prospectoNombre.trim()) {
      setError('Ingresá el nombre del destinatario')
      return
    }

    // Validación del monto según tipo.
    let montoTotal: number | undefined
    let itemsLimpios: CotizacionItem[] | undefined
    if (tipo === 'completo') {
      const m = montoUnico ?? NaN
      if (!Number.isFinite(m) || m < 0) {
        setError('El monto debe ser un número válido')
        return
      }
      montoTotal = m
    } else {
      itemsLimpios = items
        .map((it) => ({ descripcion: it.descripcion.trim(), monto: Number(it.monto) || 0 }))
        .filter((it) => it.descripcion.length > 0)
      if (itemsLimpios.length === 0) {
        setError('Agregá al menos un ítem con descripción')
        return
      }
      // El total lo recalcula el server desde los ítems; no lo forzamos acá.
    }

    const input: CotizacionInput = {
      tipo,
      concepto: concepto.trim(),
      items: itemsLimpios,
      montoTotal,
      moneda: monedaInput || moneda,
      formaPagoId: formaPagoId || null,
      validezDias: validezDias !== '' ? Number(validezDias) : null,
      notas: notas.trim() || null,
      empresaId: destinatario === 'empresa' ? empresaId : null,
      leadId: destinatario === 'lead' ? leadId : null,
      prospectoNombre: destinatario === 'manual' ? prospectoNombre.trim() : null,
      prospectoEmail: destinatario === 'manual' ? prospectoEmail.trim() || null : null,
      prospectoTelefono: destinatario === 'manual' ? prospectoTelefono.trim() || null : null,
    }

    setPending(true)
    const res = cotizacion
      ? await actualizarCotizacion(cotizacion.id, input)
      : await crearCotizacion(input)
    setPending(false)

    if (!res.success) {
      setError(res.error)
      return
    }

    // Reconstruimos el objeto Cotizacion para actualizar la lista en cliente.
    const ahora = new Date().toISOString()
    const total = tipo === 'completo' ? montoTotal ?? 0 : totalItemsLimpios(itemsLimpios)
    const reconstruida: Cotizacion = {
      id: res.data.id,
      consultora_id: cotizacion?.consultora_id ?? '',
      empresa_id: input.empresaId ?? null,
      lead_id: input.leadId ?? null,
      prospecto_nombre: input.prospectoNombre ?? null,
      prospecto_email: input.prospectoEmail ?? null,
      prospecto_telefono: input.prospectoTelefono ?? null,
      tipo,
      concepto: input.concepto,
      items: tipo === 'especifico' ? itemsLimpios ?? [] : [],
      monto_total: total,
      moneda: monedaInput || moneda,
      forma_pago_id: input.formaPagoId ?? null,
      estado: cotizacion?.estado ?? 'borrador',
      fecha_emision: cotizacion?.fecha_emision ?? ahora.slice(0, 10),
      validez_dias: input.validezDias ?? null,
      fecha_decision: cotizacion?.fecha_decision ?? null,
      convertida_empresa_id: cotizacion?.convertida_empresa_id ?? null,
      notas: input.notas ?? null,
      created_by: cotizacion?.created_by ?? null,
      created_at: cotizacion?.created_at ?? ahora,
      updated_at: ahora,
    }

    toast.success(cotizacion ? 'Presupuesto actualizado' : 'Presupuesto creado')
    onSuccess(reconstruida, !cotizacion)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Destinatario */}
      <Select
        label="Destinatario"
        value={destinatario}
        onChange={(e) => {
          const next = e.target.value as Destinatario
          setDestinatario(next)
          // Limpiamos las referencias que no aplican al cambiar de tipo.
          if (next !== 'empresa') setEmpresaId('')
          if (next !== 'lead') setLeadId('')
        }}
        options={[
          { value: 'empresa', label: 'Cliente existente (empresa)' },
          { value: 'lead', label: 'Prospecto del CRM (lead)' },
          { value: 'manual', label: 'Destinatario manual' },
        ]}
      />

      {destinatario === 'empresa' && (
        <Select
          label="Empresa-cliente"
          required
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          placeholder="Elegí una empresa…"
          options={empresas.map((emp) => ({ value: emp.id, label: emp.razon_social }))}
        />
      )}

      {destinatario === 'lead' && (
        <Select
          label="Prospecto"
          required
          value={leadId}
          onChange={(e) => {
            setLeadId(e.target.value)
            sugerirConceptoDesdeLead(e.target.value)
          }}
          placeholder="Elegí un prospecto…"
          options={leads.map((l) => ({ value: l.id, label: l.nombre }))}
        />
      )}

      {destinatario === 'manual' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Nombre / razón social"
            required
            value={prospectoNombre}
            onChange={(e) => setProspectoNombre(e.target.value)}
            placeholder="Ej: Distribuidora del Sur S.A."
          />
          <Input
            label="Email"
            type="email"
            value={prospectoEmail}
            onChange={(e) => setProspectoEmail(e.target.value)}
            placeholder="contacto@cliente.com"
          />
          <Input
            label="Teléfono"
            value={prospectoTelefono}
            onChange={(e) => setProspectoTelefono(e.target.value)}
            placeholder="Ej: 11 5555-5555"
          />
        </div>
      )}

      {/* Concepto */}
      <Input
        label="Concepto"
        required
        value={concepto}
        onChange={(e) => setConcepto(e.target.value)}
        placeholder="Ej: Servicio integral de Higiene y Seguridad"
      />

      {/* Tipo de presupuesto */}
      <Select
        label="Tipo de presupuesto"
        value={tipo}
        onChange={(e) => setTipo(e.target.value as CotizacionTipo)}
        options={[
          { value: 'completo', label: 'Servicio completo (monto único)' },
          { value: 'especifico', label: 'Servicio específico (detalle de ítems)' },
        ]}
      />

      {tipo === 'completo' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MoneyInput
            label="Monto"
            required
            value={montoUnico}
            onChange={setMontoUnico}
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
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary">Ítems del presupuesto</span>
            <Input
              label="Moneda"
              value={monedaInput}
              onChange={(e) => setMonedaInput(e.target.value.toUpperCase())}
              placeholder={moneda}
              maxLength={3}
              className="w-24"
            />
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    value={it.descripcion}
                    onChange={(e) => updateItem(idx, { descripcion: e.target.value })}
                    placeholder="Descripción del ítem"
                  />
                </div>
                <div className="w-36">
                  <MoneyInput
                    value={it.monto === 0 ? null : it.monto}
                    onChange={(v) => updateItem(idx, { monto: v ?? 0 })}
                    moneda={monedaInput || moneda}
                    locale={locale}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  disabled={items.length <= 1}
                  aria-label="Quitar ítem"
                  title="Quitar ítem"
                  className="mt-1 rounded-lg p-2 text-text-tertiary transition-colors hover:bg-surface-base hover:text-danger disabled:opacity-40"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button type="button" variant="secondary" size="sm" onClick={addItem}>
              <Plus size={14} />
              Agregar ítem
            </Button>
            <span className="text-sm font-semibold tabular-nums text-text-primary">
              Total: {formatMonto(totalItems, monedaInput || moneda)}
            </span>
          </div>
        </div>
      )}

      {/* Forma de pago */}
      <div className="space-y-2">
        <Select
          label="Forma de pago"
          value={formaPagoId}
          onChange={(e) => setFormaPagoId(e.target.value)}
          placeholder="Sin especificar"
          options={formasPago.map((fp) => ({ value: fp.id, label: fp.nombre }))}
        />
        {agregandoFormaPago ? (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                value={nuevaFormaPago}
                onChange={(e) => setNuevaFormaPago(e.target.value)}
                placeholder="Nombre de la forma de pago"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleCrearFormaPago()
                  }
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleCrearFormaPago()}
              disabled={creandoFormaPago || !nuevaFormaPago.trim()}
            >
              {creandoFormaPago ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setAgregandoFormaPago(false)
                setNuevaFormaPago('')
              }}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAgregandoFormaPago(true)}
          >
            <Plus size={14} />
            Agregar otra
          </Button>
        )}
      </div>

      {/* Validez */}
      <Input
        label="Validez (días)"
        type="number"
        min="0"
        value={validezDias}
        onChange={(e) => setValidezDias(e.target.value)}
        placeholder="Ej: 30"
      />

      {/* Notas */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Notas</label>
        <VoiceTextarea
          value={notas}
          onValueChange={setNotas}
          rows={2}
          className="w-full resize-none rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
          placeholder="Condiciones, aclaraciones, forma de pago…"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : cotizacion ? 'Guardar cambios' : 'Crear presupuesto'}
        </Button>
      </div>
    </form>
  )
}

function totalItemsLimpios(items?: CotizacionItem[]): number {
  if (!items) return 0
  return items.reduce((acc, it) => acc + (Number(it.monto) || 0), 0)
}

// ─── Vista principal ─────────────────────────────────────────────────────────

export function CotizacionesCliente({
  cotizacionesIniciales,
  empresas,
  leads,
  formasPagoIniciales,
  moneda,
  locale,
}: Props) {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>(cotizacionesIniciales)
  const [formasPago, setFormasPago] = useState<FinFormaPago[]>(formasPagoIniciales)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Cotizacion | null>(null)
  const [accionId, setAccionId] = useState<string | null>(null)

  // Suma una forma de pago recién creada al catálogo en memoria (sin recargar).
  function handleFormaPagoCreada(fp: FinFormaPago) {
    setFormasPago((prev) => (prev.some((x) => x.id === fp.id) ? prev : [...prev, fp]))
  }

  const empresasNombre = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of empresas) map.set(e.id, e.razon_social)
    return map
  }, [empresas])

  const leadsNombre = useMemo(() => {
    const map = new Map<string, string>()
    for (const l of leads) map.set(l.id, l.nombre)
    return map
  }, [leads])

  // Nombre del destinatario para mostrar en la tabla.
  function destinatarioLabel(cot: Cotizacion): string {
    if (cot.empresa_id) return empresasNombre.get(cot.empresa_id) ?? 'Cliente'
    if (cot.lead_id) return leadsNombre.get(cot.lead_id) ?? 'Prospecto'
    return cot.prospecto_nombre ?? '—'
  }

  function handleSuccess(cot: Cotizacion, esNueva: boolean) {
    setCotizaciones((prev) => {
      if (!esNueva) {
        return prev.map((c) => (c.id === cot.id ? cot : c))
      }
      return [cot, ...prev]
    })
    setShowModal(false)
    setEditando(null)
  }

  async function handleEliminar(cot: Cotizacion) {
    if (
      !confirm(
        `¿Eliminar el presupuesto "${cot.concepto}"? Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    setAccionId(cot.id)
    const res = await eliminarCotizacion(cot.id)
    setAccionId(null)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    setCotizaciones((prev) => prev.filter((c) => c.id !== cot.id))
    toast.success('Presupuesto eliminado')
  }

  async function handleCambiarEstado(cot: Cotizacion, estado: CotizacionEstado) {
    if (estado === cot.estado) return
    setAccionId(cot.id)
    const res = await cambiarEstadoCotizacion(cot.id, estado)
    setAccionId(null)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    const decision = estado === 'aceptada' || estado === 'rechazada'
    setCotizaciones((prev) =>
      prev.map((c) =>
        c.id === cot.id
          ? {
              ...c,
              estado,
              fecha_decision: decision ? new Date().toISOString().slice(0, 10) : null,
            }
          : c,
      ),
    )
    toast.success(`Estado actualizado a "${ESTADO_META[estado].label}"`)
  }

  async function handleGenerarPdf(cot: Cotizacion) {
    setAccionId(cot.id)
    const res = await generarPresupuestoPdf(cot.id)
    setAccionId(null)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    window.open(res.data.pdfUrl, '_blank')
  }

  function abrirAlta() {
    setEditando(null)
    setShowModal(true)
  }

  function abrirEdicion(cot: Cotizacion) {
    setEditando(cot)
    setShowModal(true)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Presupuestos</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Armá presupuestos para tus clientes y prospectos, seguí su estado y descargá el PDF.
          </p>
        </div>
        <Button onClick={abrirAlta}>
          <Plus size={16} />
          Armar presupuesto
        </Button>
      </div>

      {cotizaciones.length === 0 ? (
        <EmptyState
          variant="documents"
          title="Todavía no armaste ningún presupuesto"
          description="Generá tu primer presupuesto para un cliente o un prospecto del CRM. Elegís el destinatario, cargás el detalle y descargás el PDF listo para enviar."
          action={{ label: 'Armá tu primer presupuesto', onClick: abrirAlta }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-xs uppercase tracking-wider text-text-tertiary">
                <tr>
                  <th className="px-3 py-2 text-left">Concepto</th>
                  <th className="px-3 py-2 text-left">Destinatario</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cotizaciones.map((cot) => {
                  const ocupado = accionId === cot.id
                  return (
                    <tr
                      key={cot.id}
                      className="border-t border-border-subtle hover:bg-surface-sunken"
                    >
                      <td className="px-3 py-2 text-text-primary">
                        <span className="block max-w-[18rem] truncate font-medium">
                          {cot.concepto}
                        </span>
                        {cot.validez_dias != null && (
                          <span className="text-[11px] text-text-tertiary">
                            Validez {cot.validez_dias} días
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        <span className="block max-w-[12rem] truncate">
                          {destinatarioLabel(cot)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {cot.tipo === 'completo' ? 'Completo' : 'Específico'}
                      </td>
                      <td className="px-3 py-2 text-xs text-text-tertiary">
                        {formatFechaCorta(cot.fecha_emision, locale)}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={cot.estado}
                          disabled={ocupado}
                          onChange={(e) =>
                            void handleCambiarEstado(cot, e.target.value as CotizacionEstado)
                          }
                          aria-label="Cambiar estado del presupuesto"
                          className={`rounded-full border-0 px-2 py-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50 ${ESTADO_META[cot.estado].clase}`}
                        >
                          {ESTADO_OPCIONES.map((est) => (
                            <option key={est} value={est}>
                              {ESTADO_META[est].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-text-primary">
                        {formatMonto(Number(cot.monto_total) || 0, cot.moneda, locale)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void handleGenerarPdf(cot)}
                            disabled={ocupado}
                            aria-label="Generar PDF del presupuesto"
                            title="Generar PDF"
                            className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-base hover:text-brand-primary disabled:opacity-50"
                          >
                            <FileText size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEdicion(cot)}
                            disabled={ocupado}
                            aria-label="Editar presupuesto"
                            title="Editar"
                            className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-base hover:text-text-primary disabled:opacity-50"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleEliminar(cot)}
                            disabled={ocupado}
                            aria-label="Eliminar presupuesto"
                            title="Eliminar"
                            className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-base hover:text-danger disabled:opacity-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal alta / edición */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setEditando(null)
        }}
        title={editando ? 'Editar presupuesto' : 'Armar presupuesto'}
        size="full"
      >
        {/* key fuerza remount del form al cambiar entre alta/edición → resetea estado. */}
        <CotizacionForm
          key={editando?.id ?? 'nuevo'}
          cotizacion={editando}
          empresas={empresas}
          leads={leads}
          formasPago={formasPago}
          onFormaPagoCreada={handleFormaPagoCreada}
          moneda={moneda}
          locale={locale}
          onSuccess={handleSuccess}
        />
      </Modal>
    </div>
  )
}
