'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  FileSignature,
  Download,
  AlertTriangle,
  Info,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
import { toast } from '@/lib/hooks/use-toast'
import {
  getDatosContrato,
  generarContratoPdf,
  type ContratoFormInput,
} from '@/lib/actions/generar-contrato'
import type { ContratoDatos } from '@/lib/pdf/contrato-html'

interface EmpresaLite {
  id: string
  razon_social: string
}

interface Props {
  empresas: EmpresaLite[]
  /** Empresa preseleccionada (desde la conversión de un presupuesto). */
  empresaInicial?: string
  /** Honorarios precargados (monto del presupuesto convertido). */
  honorariosInicial?: string
}

// ─── Estado del formulario (espejo de ContratoFormInput) ──────────────────────
//
// Inicializamos cada campo con lo que vino del prefill (si existe) para que el
// usuario edite sobre datos reales en lugar de tipear todo de cero.

const FORM_FIELDS = [
  'ciudad',
  'provincia',
  'dia',
  'mes',
  'anio',
  'clienteRepresentante',
  'clienteRepresentanteDni',
  'clienteRepresentanteCaracter',
  'clienteReferenteNombre',
  'clienteReferenteCargo',
  'clienteCodigoSrt',
  'responsableDni',
  'responsableCaracter',
  'responsableMatriculaEmisor',
  'frecuenciaVisitas',
  'plazoRespuesta',
  'honorarios',
  'honorariosEnLetras',
  'honorariosModalidad',
  'honorariosPlazoPagoDias',
  'honorariosMedioPago',
  'actualizacionPeriodicidad',
  'actualizacionIndice',
  'fechaInicioVigencia',
  'diasNoRenovacion',
  'sumaAseguradaRC',
  'sumaAseguradaRCEnLetras',
  'jurisdiccion',
] as const

type FormField = (typeof FORM_FIELDS)[number]
type FormState = Record<FormField, string>

const EMPTY_FORM: FormState = FORM_FIELDS.reduce(
  (acc, k) => ({ ...acc, [k]: '' }),
  {} as FormState,
)

/** Toma del prefill los campos que también son del form para precargarlos. */
function prefillToForm(datos: Partial<ContratoDatos>): FormState {
  const next = { ...EMPTY_FORM }
  for (const k of FORM_FIELDS) {
    const v = datos[k as keyof ContratoDatos]
    if (typeof v === 'string') next[k] = v
  }
  return next
}

// ─── Helpers de presentación del prefill (read-only) ──────────────────────────

interface DatoLineaProps {
  label: string
  value?: string | null
}

/** Una línea "Etiqueta: valor" del bloque de datos prellenados (read-only). */
function DatoLinea({ label, value }: DatoLineaProps) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-text-tertiary sm:w-44">
        {label}
      </span>
      <span className="text-sm text-text-primary">
        {value ? value : <span className="italic text-text-tertiary">(sin dato)</span>}
      </span>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ContratoGenerador({ empresas, empresaInicial, honorariosInicial }: Props) {
  const [empresaId, setEmpresaId] = useState('')
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const [datos, setDatos] = useState<Partial<ContratoDatos> | null>(null)
  const [faltantes, setFaltantes] = useState<string[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [generando, setGenerando] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // Si llegamos desde la conversión de un presupuesto, preseleccionamos la
  // empresa (carga sus datos desde la base) y sembramos los honorarios con el
  // monto del presupuesto. El seed de honorarios va DESPUÉS del prefill de la
  // empresa, porque ese prefill reescribe todo el form. Solo al montar.
  useEffect(() => {
    if (!empresaInicial) return
    void handleSeleccionEmpresa(empresaInicial, honorariosInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Falta un dato crítico de la consultora que NO se completa en este form
  // (debe cargarse en Configuración): domicilio legal/fiscal de la consultora.
  const faltaDomicilioConsultora = datos != null && !datos.consultorDomicilio

  function setField(key: FormField, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSeleccionEmpresa(id: string, honorariosOverride?: string) {
    setEmpresaId(id)
    setDatos(null)
    setFaltantes([])
    setForm(EMPTY_FORM)
    setErrorCarga(null)
    if (!id) return

    setCargandoDatos(true)
    const res = await getDatosContrato(id)
    setCargandoDatos(false)

    if (!res.success) {
      setErrorCarga(res.error)
      return
    }
    setDatos(res.data.datos)
    setFaltantes(res.data.faltantes)
    // El prefill de la empresa reescribe el form; si vino un override de
    // honorarios (conversión de presupuesto), lo sembramos por encima.
    const next = prefillToForm(res.data.datos)
    if (honorariosOverride) next.honorarios = honorariosOverride
    setForm(next)
  }

  async function handleGenerar() {
    if (!empresaId) return
    setGenerando(true)

    // El form ya es ContratoFormInput (todos string opcionales): los vacíos los
    // descarta la server action al hacer merge con el prefill.
    const input: ContratoFormInput = { ...form }
    const res = await generarContratoPdf(empresaId, input)
    setGenerando(false)

    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success('Contrato generado')
    window.open(res.data.pdfUrl, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary">
          <FileSignature size={24} className="text-brand-primary" aria-hidden="true" />
          Generador de contrato
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Armá el contrato de prestación de servicios de Higiene y Seguridad para una
          empresa-cliente. Prellenamos lo que sabemos de tu consultora y de la empresa; vos
          completás el resto (honorarios, vigencia, firmantes) y descargás el PDF.
        </p>
      </div>

      {/* Aviso legal: es un modelo a validar con abogado. */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
        <p>
          Este documento es un <strong>modelo orientativo</strong>. Antes de firmarlo, hacelo
          revisar por tu asesor legal: cada relación contractual puede requerir cláusulas
          específicas según la actividad, la jurisdicción y el alcance del servicio.
        </p>
      </div>

      {empresas.length === 0 ? (
        <EmptyState
          variant="generic"
          title="No tenés empresas-cliente cargadas"
          description="Para generar un contrato primero necesitás dar de alta al menos una empresa-cliente en tu consultora."
        />
      ) : (
        <>
          {/* Selector de empresa-cliente */}
          <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4 md:p-5">
            <Select
              label="Empresa-cliente"
              value={empresaId}
              onChange={(e) => handleSeleccionEmpresa(e.target.value)}
              placeholder="Elegí la empresa para la que vas a generar el contrato…"
              options={empresas.map((e) => ({ value: e.id, label: e.razon_social }))}
            />
          </div>

          {cargandoDatos && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-tertiary">
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Cargando datos de la empresa…
            </div>
          )}

          {errorCarga && (
            <div className="rounded-lg border border-red-200 bg-danger-bg px-4 py-3 text-sm text-danger">
              {errorCarga}
            </div>
          )}

          {datos && !cargandoDatos && (
            <>
              {/* Aviso si falta domicilio de la consultora (se carga en Configuración) */}
              {faltaDomicilioConsultora && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-danger-bg px-4 py-3 text-sm text-danger">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Falta el domicilio de tu consultora</p>
                    <p className="mt-0.5">
                      El contrato necesita el domicilio legal de la consultora. Cargalo en la
                      configuración para que aparezca en el documento.
                    </p>
                    <Link
                      href="/dashboard/configuracion/consultora"
                      className="mt-1.5 inline-flex items-center gap-1 font-medium text-danger underline"
                    >
                      Ir a configuración de la consultora
                      <ExternalLink size={13} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Faltantes informativos: lo que conviene completar antes de generar */}
              {faltantes.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  <Info size={18} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
                  <div>
                    <p className="font-medium">
                      Conviene completar estos datos (si los dejás vacíos, quedan en blanco en el
                      PDF para llenar a mano):
                    </p>
                    <ul className="mt-1 list-inside list-disc">
                      {faltantes.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* ── Datos prellenados (read-only) ── */}
              <section className="rounded-xl border border-border-subtle bg-surface-elevated p-4 md:p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
                  Datos prellenados
                </h2>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-text-secondary">El Consultor</p>
                    <DatoLinea label="Razón social" value={datos.consultorRazonSocial} />
                    <DatoLinea label="CUIT" value={datos.consultorCuit} />
                    <DatoLinea label="Domicilio" value={datos.consultorDomicilio} />
                    <DatoLinea label="Responsable técnico" value={datos.responsableNombre} />
                    <DatoLinea label="Título" value={datos.responsableTitulo} />
                    <DatoLinea label="Matrícula" value={datos.responsableMatricula} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-text-secondary">El Cliente</p>
                    <DatoLinea label="Razón social" value={datos.clienteRazonSocial} />
                    <DatoLinea label="CUIT" value={datos.clienteCuit} />
                    <DatoLinea label="Domicilio fiscal" value={datos.clienteDomicilioFiscal} />
                    <DatoLinea label="Actividad" value={datos.clienteActividad} />
                    <DatoLinea label="ART" value={datos.clienteArtNombre} />
                    <DatoLinea
                      label="Establecimientos"
                      value={
                        datos.establecimientos && datos.establecimientos.length > 0
                          ? `${datos.establecimientos.length} (van en el Anexo)`
                          : null
                      }
                    />
                  </div>
                </div>
              </section>

              {/* ── Formulario: datos a completar ── */}
              <section className="space-y-6 rounded-xl border border-border-subtle bg-surface-elevated p-4 md:p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
                  Datos a completar
                </h2>

                {/* Comparecencia */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-text-secondary">
                    Lugar y fecha de firma
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Ciudad"
                      value={form.ciudad}
                      onChange={(e) => setField('ciudad', e.target.value)}
                      placeholder="Ej: Córdoba"
                    />
                    <Input
                      label="Provincia"
                      value={form.provincia}
                      onChange={(e) => setField('provincia', e.target.value)}
                      placeholder="Ej: Córdoba"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      label="Día"
                      value={form.dia}
                      onChange={(e) => setField('dia', e.target.value)}
                      placeholder="Ej: 15"
                    />
                    <Input
                      label="Mes"
                      value={form.mes}
                      onChange={(e) => setField('mes', e.target.value)}
                      placeholder="Ej: junio"
                    />
                    <Input
                      label="Año"
                      value={form.anio}
                      onChange={(e) => setField('anio', e.target.value)}
                      placeholder="Ej: 2026"
                    />
                  </div>
                </div>

                {/* Firmante y referente del cliente */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-text-secondary">
                    Firmante y referente del cliente
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Representante legal (firmante)"
                      value={form.clienteRepresentante}
                      onChange={(e) => setField('clienteRepresentante', e.target.value)}
                      placeholder="Nombre y apellido"
                    />
                    <Input
                      label="DNI del representante"
                      value={form.clienteRepresentanteDni}
                      onChange={(e) => setField('clienteRepresentanteDni', e.target.value)}
                      placeholder="Ej: 30.123.456"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Carácter del representante"
                      value={form.clienteRepresentanteCaracter}
                      onChange={(e) => setField('clienteRepresentanteCaracter', e.target.value)}
                      placeholder="Ej: socio gerente, apoderado…"
                    />
                    <Input
                      label="Código de SRT del cliente"
                      value={form.clienteCodigoSrt}
                      onChange={(e) => setField('clienteCodigoSrt', e.target.value)}
                      placeholder="Ej: 12345"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Referente interno"
                      value={form.clienteReferenteNombre}
                      onChange={(e) => setField('clienteReferenteNombre', e.target.value)}
                      placeholder="Contacto operativo del cliente"
                    />
                    <Input
                      label="Cargo del referente"
                      value={form.clienteReferenteCargo}
                      onChange={(e) => setField('clienteReferenteCargo', e.target.value)}
                      placeholder="Ej: Jefe de RR.HH."
                    />
                  </div>
                </div>

                {/* Datos del responsable técnico */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-text-secondary">
                    Responsable técnico (datos del firmante por el Consultor)
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      label="DNI"
                      value={form.responsableDni}
                      onChange={(e) => setField('responsableDni', e.target.value)}
                      placeholder="Ej: 28.111.222"
                    />
                    <Input
                      label="Carácter"
                      value={form.responsableCaracter}
                      onChange={(e) => setField('responsableCaracter', e.target.value)}
                      placeholder="Ej: titular"
                    />
                    <Input
                      label="Emisor de la matrícula"
                      value={form.responsableMatriculaEmisor}
                      onChange={(e) => setField('responsableMatriculaEmisor', e.target.value)}
                      placeholder="Ej: Consejo Profesional…"
                    />
                  </div>
                </div>

                {/* Alcance del servicio */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-text-secondary">Alcance del servicio</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Frecuencia de visitas"
                      value={form.frecuenciaVisitas}
                      onChange={(e) => setField('frecuenciaVisitas', e.target.value)}
                      placeholder="Ej: 2 visitas mensuales"
                    />
                    <Input
                      label="Plazo de respuesta"
                      value={form.plazoRespuesta}
                      onChange={(e) => setField('plazoRespuesta', e.target.value)}
                      placeholder="Ej: 48 horas hábiles"
                    />
                  </div>
                </div>

                {/* Honorarios y vigencia */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-text-secondary">
                    Honorarios y vigencia
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Honorarios (monto)"
                      value={form.honorarios}
                      onChange={(e) => setField('honorarios', e.target.value)}
                      placeholder="Ej: $ 350.000"
                    />
                    <Input
                      label="Honorarios en letras"
                      value={form.honorariosEnLetras}
                      onChange={(e) => setField('honorariosEnLetras', e.target.value)}
                      placeholder="Ej: trescientos cincuenta mil pesos"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      label="Modalidad"
                      value={form.honorariosModalidad}
                      onChange={(e) => setField('honorariosModalidad', e.target.value)}
                      placeholder="Ej: mensual"
                    />
                    <Input
                      label="Plazo de pago (días)"
                      value={form.honorariosPlazoPagoDias}
                      onChange={(e) => setField('honorariosPlazoPagoDias', e.target.value)}
                      placeholder="Ej: 10"
                    />
                    <Input
                      label="Medio de pago"
                      value={form.honorariosMedioPago}
                      onChange={(e) => setField('honorariosMedioPago', e.target.value)}
                      placeholder="Ej: transferencia bancaria"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Periodicidad de actualización"
                      value={form.actualizacionPeriodicidad}
                      onChange={(e) => setField('actualizacionPeriodicidad', e.target.value)}
                      placeholder="Ej: trimestral"
                    />
                    <Input
                      label="Índice de actualización"
                      value={form.actualizacionIndice}
                      onChange={(e) => setField('actualizacionIndice', e.target.value)}
                      placeholder="Ej: IPC INDEC"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Fecha de inicio de vigencia"
                      type="date"
                      value={form.fechaInicioVigencia}
                      onChange={(e) => setField('fechaInicioVigencia', e.target.value)}
                    />
                    <Input
                      label="Días de aviso de no renovación"
                      value={form.diasNoRenovacion}
                      onChange={(e) => setField('diasNoRenovacion', e.target.value)}
                      placeholder="Ej: 30"
                    />
                  </div>
                </div>

                {/* Seguros */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-text-secondary">
                    Seguro de responsabilidad civil profesional
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Suma asegurada de RC"
                      value={form.sumaAseguradaRC}
                      onChange={(e) => setField('sumaAseguradaRC', e.target.value)}
                      placeholder="Ej: $ 10.000.000"
                    />
                    <Input
                      label="Suma asegurada en letras"
                      value={form.sumaAseguradaRCEnLetras}
                      onChange={(e) => setField('sumaAseguradaRCEnLetras', e.target.value)}
                      placeholder="Ej: diez millones de pesos"
                    />
                  </div>
                </div>

                {/* Jurisdicción */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-secondary">
                    Jurisdicción de los tribunales
                  </label>
                  <VoiceTextarea
                    value={form.jurisdiccion}
                    onValueChange={(v) => setField('jurisdiccion', v)}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
                    placeholder="Ej: Tribunales Ordinarios de la ciudad de Córdoba"
                  />
                </div>
              </section>

              {/* Acción */}
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                <p className="text-xs text-text-tertiary sm:mr-auto">
                  Se descargará un PDF. Revisalo y validalo con tu asesor legal antes de firmar.
                </p>
                <Button onClick={handleGenerar} disabled={generando}>
                  {generando ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      Generando…
                    </>
                  ) : (
                    <>
                      <Download size={16} aria-hidden="true" />
                      Generar contrato (PDF)
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
