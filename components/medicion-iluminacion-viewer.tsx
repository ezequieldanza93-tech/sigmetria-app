'use client'

import { useState, useEffect } from 'react'
import { getMedicionIluminacionByRegistro } from '@/lib/actions/medicion-iluminacion-view'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { Modal } from '@/components/ui/modal'
import {
  Lightbulb, Building2, FileText, BarChart3, ShieldCheck,
  XCircle, Loader2, Download,
} from 'lucide-react'

// ── Props ────────────────────────────────────────────────────────────
interface MedicionIluminacionViewerProps {
  /** gestiones_registros.id del protocolo ya ejecutado. */
  registroId: string
  /** Compañera de la referencia suelta (fecha_planificada del registro particionado). */
  rgFechaPlanificada: string | null
  /** Nombre de la gestión, para el título del modal. */
  gestionNombre?: string | null
  onClose: () => void
}

// ── Tipos laxos de lo que devuelve PostgREST (joins embebidos) ─────────
interface Celda {
  id?: string
  fila?: number | null
  columna?: number | null
  valor_lux?: number | null
}

interface PuntoMedicion {
  id?: string
  sector_id?: string | null
  puesto_id?: string | null
  turno?: string | null
  tipo_iluminacion?: string | null
  tipo_fuente?: string | null
  tipo_sistema?: string | null
  largo?: number | null
  ancho?: number | null
  altura?: number | null
  valor_requerido_lux?: number | null
  requisito_ref?: string | null
  localizada_lux?: number | null
  general_requerida_lux?: number | null
  observaciones?: string | null
  orden?: number | null
  establecimientos_sectores?: { nombre: string } | { nombre: string }[] | null
  puestos_de_trabajo?: { nombre: string } | { nombre: string }[] | null
  medicion_iluminacion_celdas?: Celda[] | null
}

interface CabeceraEmpresa {
  razon_social?: string | null
  cuit?: string | null
  domicilio?: string | null
}
interface CabeceraEstablecimiento {
  nombre?: string | null
  domicilio?: string | null
  codigo_postal?: string | null
  empresas?: CabeceraEmpresa | CabeceraEmpresa[] | null
}
interface CabeceraInstrumento {
  modelo?: string | null
  numero_serie?: string | null
}

interface MedicionIluminacionRow {
  firmante?: string | null
  metodologia?: string | null
  fecha_medicion?: string | null
  hora_inicio?: string | null
  hora_fin?: string | null
  altura_criterio?: string | null
  condiciones_atmosfericas?: Record<string, unknown> | null
  conclusiones?: string | null
  recomendaciones?: string | null
  observaciones?: string | null
  certificado_url?: string | null
  plano_url?: string | null
  establecimientos?: CabeceraEstablecimiento | CabeceraEstablecimiento[] | null
  mediciones_instrumentos?: CabeceraInstrumento | CabeceraInstrumento[] | null
  medicion_iluminacion_puntos?: PuntoMedicion[] | null
}

// PostgREST puede devolver el join embebido como objeto o como array de 1.
function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

function labelAltura(v: string | null | undefined): string {
  if (v === 'piso') return 'A nivel de piso'
  if (v === 'plano_trabajo') return 'Plano de trabajo'
  return '—'
}

/**
 * Vista READ-ONLY del Protocolo de Medición de Iluminación (SRT 84/2012 / Dec 351/79 Anexo IV)
 * ya ejecutado. Muestra cabecera, puntos de medición con su grilla de celdas, conclusiones
 * y adjuntos. No edita nada — la lectura viene de getMedicionIluminacionByRegistro (que reusa
 * getMedicionIluminacion).
 * Los adjuntos (certificado / plano) viven en bucket privado: se firman para "Ver".
 */
export function MedicionIluminacionViewer({
  registroId,
  rgFechaPlanificada,
  gestionNombre,
  onClose,
}: MedicionIluminacionViewerProps) {
  const [data, setData] = useState<MedicionIluminacionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getMedicionIluminacionByRegistro(registroId, rgFechaPlanificada)
      .then(res => {
        if (cancelled) return
        if (res.success) setData(res.data as MedicionIluminacionRow)
        else setError(res.error)
      })
      .catch(() => { if (!cancelled) setError('No se pudo cargar el protocolo') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [registroId, rgFechaPlanificada])

  const { getUrl } = useSignedUrls('documentos', [data?.certificado_url, data?.plano_url])

  const est = one(data?.establecimientos)
  const emp = one(est?.empresas)
  const inst = one(data?.mediciones_instrumentos)
  const puntos = (data?.medicion_iluminacion_puntos ?? [])
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  return (
    <Modal open title={gestionNombre || 'Protocolo de Medición de Iluminación'} onClose={onClose} size="wide">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-text-secondary">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Cargando protocolo…</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 py-12 text-text-secondary">
          <XCircle size={18} className="text-red-500" />
          <span className="text-sm">{error}</span>
        </div>
      ) : !data ? (
        <div className="py-12 text-center text-sm text-text-secondary">Sin datos.</div>
      ) : (
        <div className="space-y-6">
          {/* Cabecera: empresa / establecimiento */}
          <section className="rounded-xl border border-border-subtle p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
              <Building2 size={16} className="text-sig-500" />
              Empresa y establecimiento
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="Empresa" value={dash(emp?.razon_social)} />
              <Field label="CUIT" value={dash(emp?.cuit)} />
              <Field label="Establecimiento" value={dash(est?.nombre)} />
              <Field label="Domicilio" value={dash(est?.domicilio)} />
              <Field label="Código postal" value={dash(est?.codigo_postal)} />
            </dl>
          </section>

          {/* Datos del protocolo */}
          <section className="rounded-xl border border-border-subtle p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
              <FileText size={16} className="text-sig-500" />
              Datos del protocolo
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="Firmante" value={dash(data.firmante)} />
              <Field
                label="Instrumento"
                value={inst ? `${dash(inst.modelo)}${inst.numero_serie ? ` (S/N ${inst.numero_serie})` : ''}` : '—'}
              />
              <Field label="Fecha de medición" value={dash(data.fecha_medicion)} />
              <Field label="Hora inicio" value={dash(data.hora_inicio)} />
              <Field label="Hora fin" value={dash(data.hora_fin)} />
              <Field label="Altura criterio" value={labelAltura(data.altura_criterio)} />
            </dl>
            {data.metodologia ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-text-secondary">Metodología</p>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{data.metodologia}</p>
              </div>
            ) : null}
          </section>

          {/* Puntos de medición */}
          {puntos.length > 0 ? (
            <section className="rounded-xl border border-border-subtle p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-4">
                <BarChart3 size={16} className="text-sig-500" />
                Puntos de medición
                <span className="text-xs font-normal text-text-tertiary">({puntos.length})</span>
              </h3>
              <div className="space-y-5">
                {puntos.map((punto, pi) => {
                  const sector = one(punto.establecimientos_sectores)
                  const puesto = one(punto.puestos_de_trabajo)
                  const celdas = (punto.medicion_iluminacion_celdas ?? [])
                  // Armamos la grilla: detectamos filas y columnas únicas
                  const filas = [...new Set(celdas.map(c => c.fila ?? 0))].sort((a, b) => a - b)
                  const columnas = [...new Set(celdas.map(c => c.columna ?? 0))].sort((a, b) => a - b)
                  const celdasMap = new Map(celdas.map(c => [`${c.fila}-${c.columna}`, c.valor_lux]))

                  return (
                    <div key={punto.id ?? pi} className="rounded-lg border border-border-subtle/80 p-3">
                      {/* Cabecera del punto */}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3">
                        <span className="text-sm font-semibold text-text-primary">
                          Punto {pi + 1}{sector?.nombre ? ` — ${sector.nombre}` : ''}{puesto?.nombre ? ` / ${puesto.nombre}` : ''}
                        </span>
                        {punto.turno ? (
                          <span className="text-xs text-text-secondary">Turno: {punto.turno}</span>
                        ) : null}
                        {punto.tipo_iluminacion ? (
                          <span className="text-xs text-text-secondary">Iluminación: {punto.tipo_iluminacion}</span>
                        ) : null}
                        {punto.tipo_fuente ? (
                          <span className="text-xs text-text-secondary">Fuente: {punto.tipo_fuente}</span>
                        ) : null}
                        {punto.tipo_sistema ? (
                          <span className="text-xs text-text-secondary">Sistema: {punto.tipo_sistema}</span>
                        ) : null}
                      </div>

                      {/* Dimensiones y valores requeridos */}
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs mb-3">
                        {punto.largo != null ? <Field label="Largo (m)" value={String(punto.largo)} /> : null}
                        {punto.ancho != null ? <Field label="Ancho (m)" value={String(punto.ancho)} /> : null}
                        {punto.altura != null ? <Field label="Altura (m)" value={String(punto.altura)} /> : null}
                        {punto.valor_requerido_lux != null ? (
                          <Field label="Requerido (lux)" value={String(punto.valor_requerido_lux)} />
                        ) : null}
                        {punto.localizada_lux != null ? (
                          <Field label="Localizada (lux)" value={String(punto.localizada_lux)} />
                        ) : null}
                        {punto.general_requerida_lux != null ? (
                          <Field label="Gral. requerida (lux)" value={String(punto.general_requerida_lux)} />
                        ) : null}
                        {punto.requisito_ref ? (
                          <Field label="Referencia" value={punto.requisito_ref} />
                        ) : null}
                      </dl>

                      {/* Grilla de celdas (valores lux medidos) */}
                      {filas.length > 0 && columnas.length > 0 ? (
                        <div className="overflow-x-auto mb-2">
                          <table className="text-xs border-collapse">
                            <thead>
                              <tr className="text-left text-text-tertiary border-b border-border-subtle/60">
                                <th className="px-1.5 py-1 font-medium">Fila / Col</th>
                                {columnas.map(col => (
                                  <th key={col} className="px-1.5 py-1 font-medium text-right">Col {col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filas.map(fila => (
                                <tr key={fila} className="border-b border-border-subtle/40">
                                  <td className="px-1.5 py-1 font-medium text-text-secondary">Fila {fila}</td>
                                  {columnas.map(col => (
                                    <td key={col} className="px-1.5 py-1 text-right text-text-primary">
                                      {celdasMap.get(`${fila}-${col}`) ?? '—'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      {punto.observaciones ? (
                        <p className="text-xs text-text-secondary">{punto.observaciones}</p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}

          {/* Análisis / conclusiones */}
          {(data.conclusiones || data.recomendaciones || data.observaciones) ? (
            <section className="rounded-xl border border-border-subtle p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                <Lightbulb size={16} className="text-sig-500" />
                Análisis y observaciones
              </h3>
              <div className="space-y-3 text-sm">
                {data.conclusiones ? (
                  <TextBlock label="Conclusiones" value={data.conclusiones} />
                ) : null}
                {data.recomendaciones ? (
                  <TextBlock label="Recomendaciones" value={data.recomendaciones} />
                ) : null}
                {data.observaciones ? (
                  <TextBlock label="Observaciones" value={data.observaciones} />
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Adjuntos (bucket privado, firmados) */}
          {(data.certificado_url || data.plano_url) ? (
            <section className="rounded-xl border border-border-subtle p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                <ShieldCheck size={16} className="text-sig-500" />
                Adjuntos
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.certificado_url ? (
                  <Adjunto label="Certificado de calibración" href={getUrl(data.certificado_url)} />
                ) : null}
                {data.plano_url ? (
                  <Adjunto label="Plano" href={getUrl(data.plano_url)} />
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Lightbulb size={12} className="text-sig-500" />
            Protocolo de Medición de Iluminación — SRT 84/2012 / Dec 351/79 Anexo IV · vista de solo lectura
          </div>
        </div>
      )}
    </Modal>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-secondary">{label}</dt>
      <dd className="text-sm text-text-primary">{value}</dd>
    </div>
  )
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="text-sm text-text-primary whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function Adjunto({ label, href }: { label: string; href: string | null }) {
  return (
    <a
      href={href ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={!href}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-sig-500 text-sig-500 hover:bg-sig-500/10 transition-colors ${href ? '' : 'opacity-50 pointer-events-none'}`}
    >
      <Download size={14} />
      {label}
    </a>
  )
}
