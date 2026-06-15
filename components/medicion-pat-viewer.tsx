'use client'

import { useState, useEffect } from 'react'
import {
  getMedicionPatByRegistro,
} from '@/lib/actions/medicion-pat-view'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { Modal } from '@/components/ui/modal'
import {
  Zap, Building2, FileText, Gauge, MapPin, ShieldCheck,
  CheckCircle, XCircle, Loader2, Download,
} from 'lucide-react'

// ── Props ────────────────────────────────────────────────────────────
interface MedicionPatViewerProps {
  /** gestiones_registros.id del protocolo ya ejecutado. */
  registroId: string
  /** Compañera de la referencia suelta (fecha_planificada del registro particionado). */
  rgFechaPlanificada: string | null
  /** Nombre de la gestión, para el título del modal. */
  gestionNombre?: string | null
  onClose: () => void
}

// ── Tipos laxos de lo que devuelve PostgREST (joins embebidos) ─────────
// La action devuelve Record<string, unknown>; tipamos lo justo para el render.
interface Toma {
  id?: string
  numero_toma?: number | null
  seccion?: string | null
  condicion_terreno?: string | null
  uso_pat?: string | null
  ect?: string | null
  valor_medido_ohm?: number | null
  valor_exigido_ohm?: number | null
  cumple?: boolean | null
  continuidad?: boolean | null
  capacidad_carga?: boolean | null
  proteccion?: string | null
  desconexion_automatica?: boolean | null
  observaciones?: string | null
  orden?: number | null
  establecimientos_sectores?: { id: string; nombre: string } | null
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

interface MedicionPatRow {
  firmante?: string | null
  metodologia?: string | null
  fecha_medicion?: string | null
  fecha_medicion_fin?: string | null
  hora_inicio?: string | null
  hora_fin?: string | null
  conclusiones?: string | null
  recomendaciones?: string | null
  observaciones?: string | null
  certificado_url?: string | null
  plano_url?: string | null
  establecimientos?: CabeceraEstablecimiento | CabeceraEstablecimiento[] | null
  mediciones_instrumentos?: CabeceraInstrumento | CabeceraInstrumento[] | null
  medicion_pat_tomas?: Toma[] | null
}

// PostgREST puede devolver el join embebido como objeto o como array de 1.
function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

// Etiquetas legibles de los códigos de DB (mismo dominio que el ejecutor).
const PROTECCION_LABELS: Record<string, string> = {
  DD: 'Disp. diferencial',
  IA: 'Interruptor automático',
  Fus: 'Fusible',
}

function siNo(v: boolean | null | undefined): string {
  if (v === true) return 'Sí'
  if (v === false) return 'No'
  return '—'
}

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

/**
 * Vista READ-ONLY del Protocolo de Puesta a Tierra (PAT — SRT 900/2015) ya
 * ejecutado. Muestra en pantalla la cabecera (medicion_pat), las tomas
 * (medicion_pat_tomas) y las observaciones guardadas. No edita nada — la lectura
 * viene de getMedicionPatByRegistro (que reusa getMedicionPat). Los adjuntos
 * (certificado / plano) viven en bucket privado: se firman para el link "Ver".
 */
export function MedicionPatViewer({
  registroId,
  rgFechaPlanificada,
  gestionNombre,
  onClose,
}: MedicionPatViewerProps) {
  const [data, setData] = useState<MedicionPatRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getMedicionPatByRegistro(registroId, rgFechaPlanificada)
      .then(res => {
        if (cancelled) return
        if (res.success) setData(res.data as MedicionPatRow)
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
  const tomas = (data?.medicion_pat_tomas ?? []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  return (
    <Modal open title={gestionNombre || 'Protocolo de Puesta a Tierra'} onClose={onClose} size="wide">
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
              <Field label="Fecha de finalización" value={dash(data.fecha_medicion_fin)} />
              <Field label="Hora inicio" value={dash(data.hora_inicio)} />
              <Field label="Hora fin" value={dash(data.hora_fin)} />
            </dl>
            {data.metodologia ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-text-secondary">Metodología</p>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{data.metodologia}</p>
              </div>
            ) : null}
          </section>

          {/* Tomas de tierra */}
          <section className="rounded-xl border border-border-subtle p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
              <MapPin size={16} className="text-sig-500" />
              Tomas de tierra medidas
              <span className="text-xs font-normal text-text-tertiary">({tomas.length})</span>
            </h3>
            {tomas.length === 0 ? (
              <p className="text-sm text-text-tertiary">No se registraron tomas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-text-secondary border-b border-border-subtle">
                      <th className="px-2 py-1.5 font-medium">#</th>
                      <th className="px-2 py-1.5 font-medium">Sector</th>
                      <th className="px-2 py-1.5 font-medium">Sección</th>
                      <th className="px-2 py-1.5 font-medium">Terreno</th>
                      <th className="px-2 py-1.5 font-medium">Uso</th>
                      <th className="px-2 py-1.5 font-medium">ECT</th>
                      <th className="px-2 py-1.5 font-medium text-right">Medido (Ω)</th>
                      <th className="px-2 py-1.5 font-medium text-right">Exigido (Ω)</th>
                      <th className="px-2 py-1.5 font-medium text-center">Cumple</th>
                      <th className="px-2 py-1.5 font-medium text-center">Cont.</th>
                      <th className="px-2 py-1.5 font-medium text-center">Cap. carga</th>
                      <th className="px-2 py-1.5 font-medium">Protección</th>
                      <th className="px-2 py-1.5 font-medium text-center">Desc. auto.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tomas.map((t, i) => (
                      <tr key={t.id ?? i} className="border-b border-border-subtle/60">
                        <td className="px-2 py-1.5 text-text-primary">{t.numero_toma ?? i + 1}</td>
                        <td className="px-2 py-1.5 text-text-primary">{dash(t.establecimientos_sectores?.nombre)}</td>
                        <td className="px-2 py-1.5 text-text-primary">{dash(t.seccion)}</td>
                        <td className="px-2 py-1.5 text-text-primary">{dash(t.condicion_terreno)}</td>
                        <td className="px-2 py-1.5 text-text-primary">{dash(t.uso_pat)}</td>
                        <td className="px-2 py-1.5 text-text-primary">{dash(t.ect)}</td>
                        <td className="px-2 py-1.5 text-right text-text-primary">{dash(t.valor_medido_ohm)}</td>
                        <td className="px-2 py-1.5 text-right text-text-primary">{dash(t.valor_exigido_ohm)}</td>
                        <td className="px-2 py-1.5 text-center">
                          {t.cumple === true ? (
                            <CheckCircle size={14} className="inline text-emerald-600" />
                          ) : t.cumple === false ? (
                            <XCircle size={14} className="inline text-red-500" />
                          ) : (
                            <span className="text-text-tertiary">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center text-text-primary">{siNo(t.continuidad)}</td>
                        <td className="px-2 py-1.5 text-center text-text-primary">{siNo(t.capacidad_carga)}</td>
                        <td className="px-2 py-1.5 text-text-primary">{t.proteccion ? (PROTECCION_LABELS[t.proteccion] ?? t.proteccion) : '—'}</td>
                        <td className="px-2 py-1.5 text-center text-text-primary">{siNo(t.desconexion_automatica)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Análisis / conclusiones */}
          {(data.conclusiones || data.recomendaciones || data.observaciones) ? (
            <section className="rounded-xl border border-border-subtle p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                <Gauge size={16} className="text-sig-500" />
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
            <Zap size={12} className="text-sig-500" />
            Protocolo de Puesta a Tierra — SRT 900/2015 · vista de solo lectura
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
