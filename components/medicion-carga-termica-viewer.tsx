'use client'

import { useState, useEffect } from 'react'
import {
  getMedicionCargaTermicaByRegistro,
} from '@/lib/actions/medicion-carga-termica-view'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { Modal } from '@/components/ui/modal'
import {
  Thermometer, Building2, FileText, Gauge, ShieldCheck,
  XCircle, Loader2, Download, Sun,
} from 'lucide-react'

// ── Props ────────────────────────────────────────────────────────────
interface MedicionCargaTermicaViewerProps {
  /** gestiones_registros.id del protocolo ya ejecutado. */
  registroId: string
  /** Compañera de la referencia suelta (fecha_planificada del registro particionado). */
  rgFechaPlanificada: string | null
  /** Nombre de la gestión, para el título del modal. */
  gestionNombre?: string | null
  onClose: () => void
}

// ── Tipos laxos de lo que devuelve PostgREST (joins embebidos) ─────────
interface Tarea {
  id?: string
  numero?: number | null
  descripcion?: string | null
  tiempo_min?: number | null
  tm_w?: number | null
  tgbh?: number | null
  var?: number | null
  orden?: number | null
}

interface Periodo {
  id?: string
  numero?: number | null
  hora_inicio?: string | null
  exterior?: boolean | null
  tgbh_ponderado?: number | null
  tm_ponderado?: number | null
  var_ponderado?: number | null
  tgbhef?: number | null
  vlp?: number | null
  vla?: number | null
  supera_vlp?: boolean | null
  supera_vla?: boolean | null
  regimen_ft?: number | null
  info_adicional?: string | null
  orden?: number | null
  medicion_carga_termica_tareas?: Tarea[] | null
}

interface Puesto {
  id?: string
  nombre_puesto?: string | null
  ambiente_homogeneo?: boolean | null
  altura_medicion?: number | null
  tipo_fuente?: string | null
  trabajador?: string | null
  ghe?: boolean | null
  aclimatado?: boolean | null
  conclusion?: string | null
  orden?: number | null
  medicion_carga_termica_periodos?: Periodo[] | null
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

interface MedicionCargaTermicaRow {
  firmante?: string | null
  fecha_medicion?: string | null
  fecha_medicion_fin?: string | null
  hora_inicio?: string | null
  hora_fin?: string | null
  turnos?: string | null
  fuente_datos_atm?: string | null
  atm_temp_max?: number | null
  atm_temp_min?: number | null
  atm_humedad?: number | null
  atm_presion?: number | null
  atm_viento?: string | null
  condiciones_puesto?: string | null
  representante_trabajadores?: string | null
  representante_empresa?: string | null
  observaciones?: string | null
  conclusiones_aclimatado?: string | null
  conclusiones_no_aclimatado?: string | null
  recomendaciones?: string | null
  certificado_url?: string | null
  plano_url?: string | null
  establecimientos?: CabeceraEstablecimiento | CabeceraEstablecimiento[] | null
  mediciones_instrumentos?: CabeceraInstrumento | CabeceraInstrumento[] | null
  medicion_carga_termica_puestos?: Puesto[] | null
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

/**
 * Vista READ-ONLY del Protocolo de Estrés Térmico por Calor / Carga Térmica
 * (SRT 30/2023) ya ejecutado. Muestra cabecera, condiciones atmosféricas, puestos
 * con sus períodos y tareas, conclusiones y adjuntos. No edita nada — la lectura
 * viene de getMedicionCargaTermicaByRegistro (que reusa getMedicionCargaTermica).
 * Los adjuntos (certificado / plano) viven en bucket privado: se firman para "Ver".
 */
export function MedicionCargaTermicaViewer({
  registroId,
  rgFechaPlanificada,
  gestionNombre,
  onClose,
}: MedicionCargaTermicaViewerProps) {
  const [data, setData] = useState<MedicionCargaTermicaRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getMedicionCargaTermicaByRegistro(registroId, rgFechaPlanificada)
      .then(res => {
        if (cancelled) return
        if (res.success) setData(res.data as MedicionCargaTermicaRow)
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
  const puestos = (data?.medicion_carga_termica_puestos ?? [])
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  return (
    <Modal open title={gestionNombre || 'Protocolo de Estrés Térmico / Carga Térmica'} onClose={onClose} size="wide">
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
              <Field label="Turnos" value={dash(data.turnos)} />
            </dl>
            {(data.representante_trabajadores || data.representante_empresa) ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mt-3">
                {data.representante_trabajadores ? (
                  <Field label="Representante trabajadores" value={data.representante_trabajadores} />
                ) : null}
                {data.representante_empresa ? (
                  <Field label="Representante empresa" value={data.representante_empresa} />
                ) : null}
              </dl>
            ) : null}
            {data.condiciones_puesto ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-text-secondary">Condiciones del puesto</p>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{data.condiciones_puesto}</p>
              </div>
            ) : null}
          </section>

          {/* Condiciones atmosféricas */}
          {(data.fuente_datos_atm || data.atm_temp_max != null || data.atm_temp_min != null ||
            data.atm_humedad != null || data.atm_presion != null || data.atm_viento) ? (
            <section className="rounded-xl border border-border-subtle p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                <Sun size={16} className="text-sig-500" />
                Condiciones atmosféricas
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                {data.fuente_datos_atm ? (
                  <Field label="Fuente de datos" value={data.fuente_datos_atm} />
                ) : null}
                {data.atm_temp_max != null ? (
                  <Field label="Temp. máx. (°C)" value={String(data.atm_temp_max)} />
                ) : null}
                {data.atm_temp_min != null ? (
                  <Field label="Temp. mín. (°C)" value={String(data.atm_temp_min)} />
                ) : null}
                {data.atm_humedad != null ? (
                  <Field label="Humedad (%)" value={String(data.atm_humedad)} />
                ) : null}
                {data.atm_presion != null ? (
                  <Field label="Presión (hPa)" value={String(data.atm_presion)} />
                ) : null}
                {data.atm_viento ? (
                  <Field label="Viento" value={data.atm_viento} />
                ) : null}
              </dl>
            </section>
          ) : null}

          {/* Puestos medidos */}
          {puestos.length > 0 ? (
            <section className="rounded-xl border border-border-subtle p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-4">
                <Gauge size={16} className="text-sig-500" />
                Puestos medidos
                <span className="text-xs font-normal text-text-tertiary">({puestos.length})</span>
              </h3>
              <div className="space-y-6">
                {puestos.map((puesto, pi) => {
                  const periodos = (puesto.medicion_carga_termica_periodos ?? [])
                    .slice()
                    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

                  return (
                    <div key={puesto.id ?? pi} className="rounded-lg border border-border-subtle/80 p-3">
                      {/* Cabecera del puesto */}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3">
                        <span className="text-sm font-semibold text-text-primary">
                          {dash(puesto.nombre_puesto)}
                        </span>
                        {puesto.trabajador ? (
                          <span className="text-xs text-text-secondary">Trabajador: {puesto.trabajador}</span>
                        ) : null}
                        {puesto.ghe != null ? (
                          <span className="text-xs text-text-secondary">GHE: {siNo(puesto.ghe)}</span>
                        ) : null}
                        {puesto.aclimatado != null ? (
                          <span className="text-xs text-text-secondary">Aclimatado: {siNo(puesto.aclimatado)}</span>
                        ) : null}
                        {puesto.tipo_fuente ? (
                          <span className="text-xs text-text-secondary">Fuente: {puesto.tipo_fuente}</span>
                        ) : null}
                        {puesto.altura_medicion != null ? (
                          <span className="text-xs text-text-secondary">Altura: {puesto.altura_medicion} m</span>
                        ) : null}
                      </div>

                      {/* Períodos del puesto */}
                      {periodos.length > 0 ? (
                        <div className="space-y-3 mb-3">
                          {periodos.map((per, peri) => {
                            const tareas = (per.medicion_carga_termica_tareas ?? [])
                              .slice()
                              .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

                            return (
                              <div key={per.id ?? peri} className="rounded-md bg-surface-base p-2">
                                {/* Fila resumen del período */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-2">
                                  <span className="font-medium text-text-secondary">
                                    Período {per.numero ?? peri + 1}
                                    {per.hora_inicio ? ` — ${per.hora_inicio}` : ''}
                                  </span>
                                  {per.exterior != null ? (
                                    <span className="text-text-tertiary">
                                      {per.exterior ? 'Exterior' : 'Interior'}
                                    </span>
                                  ) : null}
                                  {per.tgbhef != null ? (
                                    <span className="text-text-primary">TGBHef: <strong>{per.tgbhef}</strong></span>
                                  ) : null}
                                  {per.vlp != null ? (
                                    <span className="text-text-primary">VLP: {per.vlp}</span>
                                  ) : null}
                                  {per.vla != null ? (
                                    <span className="text-text-primary">VLA: {per.vla}</span>
                                  ) : null}
                                  {per.supera_vlp != null ? (
                                    <span className={per.supera_vlp ? 'text-red-500 font-medium' : 'text-emerald-600'}>
                                      {per.supera_vlp ? 'Supera VLP' : 'No supera VLP'}
                                    </span>
                                  ) : null}
                                  {per.supera_vla != null ? (
                                    <span className={per.supera_vla ? 'text-amber-500 font-medium' : 'text-emerald-600'}>
                                      {per.supera_vla ? 'Supera VLA' : 'No supera VLA'}
                                    </span>
                                  ) : null}
                                  {per.regimen_ft != null ? (
                                    <span className="text-text-secondary">Régimen f/t: {per.regimen_ft} min</span>
                                  ) : null}
                                </div>

                                {/* Tareas del período */}
                                {tareas.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs border-collapse">
                                      <thead>
                                        <tr className="text-left text-text-tertiary border-b border-border-subtle/60">
                                          <th className="px-1.5 py-1 font-medium">#</th>
                                          <th className="px-1.5 py-1 font-medium">Tarea</th>
                                          <th className="px-1.5 py-1 font-medium text-right">t (min)</th>
                                          <th className="px-1.5 py-1 font-medium text-right">TM (W)</th>
                                          <th className="px-1.5 py-1 font-medium text-right">TGBH</th>
                                          <th className="px-1.5 py-1 font-medium text-right">VAR</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {tareas.map((t, ti) => (
                                          <tr key={t.id ?? ti} className="border-b border-border-subtle/40">
                                            <td className="px-1.5 py-1 text-text-primary">{t.numero ?? ti + 1}</td>
                                            <td className="px-1.5 py-1 text-text-primary">{dash(t.descripcion)}</td>
                                            <td className="px-1.5 py-1 text-right text-text-primary">{dash(t.tiempo_min)}</td>
                                            <td className="px-1.5 py-1 text-right text-text-primary">{dash(t.tm_w)}</td>
                                            <td className="px-1.5 py-1 text-right text-text-primary">{dash(t.tgbh)}</td>
                                            <td className="px-1.5 py-1 text-right text-text-primary">{dash(t.var)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : null}

                                {per.info_adicional ? (
                                  <p className="mt-1.5 text-xs text-text-secondary">{per.info_adicional}</p>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      ) : null}

                      {/* Conclusión del puesto */}
                      {puesto.conclusion ? (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-text-secondary">Conclusión</p>
                          <p className="text-sm text-text-primary whitespace-pre-wrap">{puesto.conclusion}</p>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}

          {/* Análisis / conclusiones */}
          {(data.conclusiones_aclimatado || data.conclusiones_no_aclimatado || data.recomendaciones || data.observaciones) ? (
            <section className="rounded-xl border border-border-subtle p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                <Thermometer size={16} className="text-sig-500" />
                Análisis y observaciones
              </h3>
              <div className="space-y-3 text-sm">
                {data.conclusiones_aclimatado ? (
                  <TextBlock label="Conclusiones (aclimatado)" value={data.conclusiones_aclimatado} />
                ) : null}
                {data.conclusiones_no_aclimatado ? (
                  <TextBlock label="Conclusiones (no aclimatado)" value={data.conclusiones_no_aclimatado} />
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
            <Thermometer size={12} className="text-sig-500" />
            Protocolo de Estrés Térmico / Carga Térmica — SRT 30/2023 · vista de solo lectura
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
