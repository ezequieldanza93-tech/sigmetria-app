'use client'

import { useState, useEffect } from 'react'
import { getMedicionRuidoByRegistro } from '@/lib/actions/medicion-ruido-view'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { Modal } from '@/components/ui/modal'
import {
  Volume2, Building2, FileText, BarChart3, ShieldCheck,
  XCircle, Loader2, Download,
} from 'lucide-react'

// ── Props ────────────────────────────────────────────────────────────
interface MedicionRuidoViewerProps {
  /** gestiones_registros.id del protocolo ya ejecutado. */
  registroId: string
  /** Compañera de la referencia suelta (fecha_planificada del registro particionado). */
  rgFechaPlanificada: string | null
  /** Nombre de la gestión, para el título del modal. */
  gestionNombre?: string | null
  onClose: () => void
}

// ── Tipos laxos de lo que devuelve PostgREST (joins embebidos) ─────────
interface PeriodoRuido {
  id?: string
  laeq_dba?: number | null
  tiempo_exposicion_horas?: number | null
  orden?: number | null
}

interface PuntoRuido {
  id?: string
  sector_id?: string | null
  puesto_id?: string | null
  tipo_puesto?: string | null
  te_horas?: number | null
  tiempo_integracion?: string | null
  caracteristicas_ruido?: string | null
  lcpico_dbc?: number | null
  metodo?: string | null
  dosis_pct?: number | null
  laeq_dba?: number | null
  suma_fracciones?: number | null
  cumple?: boolean | null
  info_adicional?: string | null
  orden?: number | null
  establecimientos_sectores?: { nombre: string } | { nombre: string }[] | null
  puestos_de_trabajo?: { nombre: string } | { nombre: string }[] | null
  medicion_ruido_periodos?: PeriodoRuido[] | null
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

interface MedicionRuidoRow {
  firmante?: string | null
  fecha_medicion?: string | null
  fecha_medicion_fin?: string | null
  hora_inicio?: string | null
  hora_fin?: string | null
  jornada_horas?: number | null
  turnos?: string | null
  condiciones_normales?: string | null
  condiciones_medicion?: string | null
  conclusiones?: string | null
  recomendaciones?: string | null
  observaciones?: string | null
  certificado_url?: string | null
  plano_url?: string | null
  establecimientos?: CabeceraEstablecimiento | CabeceraEstablecimiento[] | null
  mediciones_instrumentos?: CabeceraInstrumento | CabeceraInstrumento[] | null
  medicion_ruido_puntos?: PuntoRuido[] | null
}

// PostgREST puede devolver el join embebido como objeto o como array de 1.
function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
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

function labelTipoPuesto(v: string | null | undefined): string {
  if (v === 'puesto') return 'Puesto fijo'
  if (v === 'puesto_tipo') return 'Puesto tipo'
  if (v === 'movil') return 'Móvil'
  return '—'
}

/**
 * Vista READ-ONLY del Protocolo de Medición de Ruido (SRT 85/2012 / Res 295/03 Anexo V)
 * ya ejecutado. Muestra cabecera, puntos de medición con períodos (método sonómetro),
 * conclusiones y adjuntos. No edita nada — la lectura viene de getMedicionRuidoByRegistro
 * (que reusa getMedicionRuido).
 * Los adjuntos (certificado / plano) viven en bucket privado: se firman para "Ver".
 */
export function MedicionRuidoViewer({
  registroId,
  rgFechaPlanificada,
  gestionNombre,
  onClose,
}: MedicionRuidoViewerProps) {
  const [data, setData] = useState<MedicionRuidoRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getMedicionRuidoByRegistro(registroId, rgFechaPlanificada)
      .then(res => {
        if (cancelled) return
        if (res.success) setData(res.data as MedicionRuidoRow)
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
  const puntos = (data?.medicion_ruido_puntos ?? [])
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  return (
    <Modal open title={gestionNombre || 'Protocolo de Medición de Ruido'} onClose={onClose} size="wide">
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
              {data.jornada_horas != null ? (
                <Field label="Jornada (h)" value={String(data.jornada_horas)} />
              ) : null}
              {data.turnos ? (
                <Field label="Turnos" value={data.turnos} />
              ) : null}
            </dl>
            {data.condiciones_normales ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-text-secondary">Condiciones normales de trabajo</p>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{data.condiciones_normales}</p>
              </div>
            ) : null}
            {data.condiciones_medicion ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-text-secondary">Condiciones durante la medición</p>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{data.condiciones_medicion}</p>
              </div>
            ) : null}
          </section>

          {/* Puntos medidos */}
          {puntos.length > 0 ? (
            <section className="rounded-xl border border-border-subtle p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-4">
                <BarChart3 size={16} className="text-sig-500" />
                Puntos medidos
                <span className="text-xs font-normal text-text-tertiary">({puntos.length})</span>
              </h3>
              <div className="space-y-5">
                {puntos.map((punto, pi) => {
                  const sector = one(punto.establecimientos_sectores)
                  const puesto = one(punto.puestos_de_trabajo)
                  const periodos = (punto.medicion_ruido_periodos ?? [])
                    .slice()
                    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

                  return (
                    <div key={punto.id ?? pi} className="rounded-lg border border-border-subtle/80 p-3">
                      {/* Cabecera del punto */}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3">
                        <span className="text-sm font-semibold text-text-primary">
                          Punto {pi + 1}{sector?.nombre ? ` — ${sector.nombre}` : ''}{puesto?.nombre ? ` / ${puesto.nombre}` : ''}
                        </span>
                        {punto.tipo_puesto ? (
                          <span className="text-xs text-text-secondary">{labelTipoPuesto(punto.tipo_puesto)}</span>
                        ) : null}
                        {punto.metodo ? (
                          <span className="text-xs text-text-secondary capitalize">Método: {punto.metodo}</span>
                        ) : null}
                        {punto.caracteristicas_ruido ? (
                          <span className="text-xs text-text-secondary capitalize">Ruido: {punto.caracteristicas_ruido}</span>
                        ) : null}
                      </div>

                      {/* Valores del punto */}
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs mb-3">
                        {punto.te_horas != null ? <Field label="TE (h)" value={String(punto.te_horas)} /> : null}
                        {punto.laeq_dba != null ? <Field label="LAeq (dBA)" value={String(punto.laeq_dba)} /> : null}
                        {punto.lcpico_dbc != null ? <Field label="LCpico (dBC)" value={String(punto.lcpico_dbc)} /> : null}
                        {punto.dosis_pct != null ? <Field label="Dosis (%)" value={String(punto.dosis_pct)} /> : null}
                        {punto.suma_fracciones != null ? <Field label="Suma fracciones" value={String(punto.suma_fracciones)} /> : null}
                        {punto.cumple != null ? (
                          <div>
                            <dt className="text-xs font-medium text-text-secondary">Cumple</dt>
                            <dd className={`text-sm font-medium ${punto.cumple ? 'text-emerald-600' : 'text-red-500'}`}>
                              {siNo(punto.cumple)}
                            </dd>
                          </div>
                        ) : null}
                      </dl>

                      {/* Períodos (método sonómetro) */}
                      {periodos.length > 0 ? (
                        <div className="overflow-x-auto mb-2">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="text-left text-text-tertiary border-b border-border-subtle/60">
                                <th className="px-1.5 py-1 font-medium">#</th>
                                <th className="px-1.5 py-1 font-medium text-right">LAeq (dBA)</th>
                                <th className="px-1.5 py-1 font-medium text-right">Tiempo exp. (h)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {periodos.map((per, peri) => (
                                <tr key={per.id ?? peri} className="border-b border-border-subtle/40">
                                  <td className="px-1.5 py-1 text-text-primary">{peri + 1}</td>
                                  <td className="px-1.5 py-1 text-right text-text-primary">{dash(per.laeq_dba)}</td>
                                  <td className="px-1.5 py-1 text-right text-text-primary">{dash(per.tiempo_exposicion_horas)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      {punto.info_adicional ? (
                        <p className="text-xs text-text-secondary">{punto.info_adicional}</p>
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
                <Volume2 size={16} className="text-sig-500" />
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
            <Volume2 size={12} className="text-sig-500" />
            Protocolo de Medición de Ruido — SRT 85/2012 / Res 295/03 Anexo V · vista de solo lectura
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
