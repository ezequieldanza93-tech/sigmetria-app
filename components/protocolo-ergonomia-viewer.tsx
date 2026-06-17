'use client'

import { useState, useEffect } from 'react'
import { getProtocoloErgonomiaByRegistro } from '@/lib/actions/protocolo-ergonomia-view'
import type { ErgonomiaEvaluacionDetalle, FactorErgonomia, NivelRiesgoErgonomia } from '@/lib/types'
import { Modal } from '@/components/ui/modal'
import {
  AlertCircle, Building2, Calendar, Check, CheckCircle,
  ClipboardList, FileCheck, Loader2, Wrench,
} from 'lucide-react'

// ── Props ─────────────────────────────────────────────────────────────────

interface ProtocoloErgonomiaViewerProps {
  registroId: string
  rgFechaPlanificada: string | null
  gestionNombre?: string | null
  onClose: () => void
}

// ── Helpers visuales ──────────────────────────────────────────────────────

const FACTOR_LABEL: Record<FactorErgonomia, string> = {
  A: 'Levantamiento y descenso',
  B: 'Empuje / arrastre',
  C: 'Transporte',
  D: 'Bipedestación',
  E: 'Movimientos repetitivos',
  F: 'Postura forzada',
  G: 'Vibraciones',
  H: 'Confort térmico',
  I: 'Estrés de contacto',
}

const NIVEL_LABEL: Record<NivelRiesgoErgonomia, string> = {
  tolerable: 'Tolerable',
  no_tolerable: 'No tolerable',
  requiere_evaluacion: 'Requiere evaluación',
}

const NIVEL_COLOR: Record<NivelRiesgoErgonomia, string> = {
  tolerable: 'text-green-700 bg-green-50 border-green-200',
  no_tolerable: 'text-red-700 bg-red-50 border-red-200',
  requiere_evaluacion: 'text-amber-700 bg-amber-50 border-amber-200',
}

function SiNoChip({ value }: { value: boolean | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-text-tertiary text-xs">—</span>
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${
      value ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'
    }`}>
      {value ? <Check size={10} /> : null}
      {value ? 'SÍ' : 'NO'}
    </span>
  )
}

function SeccionTitulo({ icon: Icon, title }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-border-default mb-3">
      <Icon size={16} className="text-sig-600" />
      <h3 className="font-semibold text-sm text-text-primary">{title}</h3>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────

export function ProtocoloErgonomiaViewer({
  registroId,
  rgFechaPlanificada,
  gestionNombre,
  onClose,
}: ProtocoloErgonomiaViewerProps) {
  const [evaluacion, setEvaluacion] = useState<ErgonomiaEvaluacionDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getProtocoloErgonomiaByRegistro(registroId, rgFechaPlanificada)
      .then(res => {
        if (!res.success) { setError(res.error); return }
        setEvaluacion(res.data)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [registroId, rgFechaPlanificada])

  // ── Loading ──

  if (loading) {
    return (
      <Modal open title="Protocolo de Ergonomía" onClose={onClose} size="full">
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 size={20} className="animate-spin text-sig-600" />
          <span className="text-sm text-text-secondary">Cargando protocolo…</span>
        </div>
      </Modal>
    )
  }

  // ── Error ──

  if (error || !evaluacion) {
    return (
      <Modal open title="Protocolo de Ergonomía" onClose={onClose} size="full">
        <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">No se pudo cargar el protocolo</p>
            <p className="text-xs text-red-600 mt-0.5">{error ?? 'Evaluación no encontrada'}</p>
          </div>
        </div>
      </Modal>
    )
  }

  const ev = evaluacion
  const empresa = ev.establecimientos?.empresas
  const estab = ev.establecimientos

  const tareasOrdenadas = [...(ev.ergonomia_tareas ?? [])].sort((a, b) => a.numero - b.numero)
  const factoresPresentes = (ev.ergonomia_factores_tarea ?? []).filter(f => f.presente)
  const seguimientoOrdenado = [...(ev.ergonomia_seguimiento ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  return (
    <Modal
      open
      title={gestionNombre ? `Protocolo de Ergonomía — ${gestionNombre}` : 'Protocolo de Ergonomía — Res. SRT 886/15'}
      onClose={onClose}
      size="full"
    >
      <div className="space-y-6 text-sm">

        {/* ── Empresa / Establecimiento ─────────────────────────────── */}
        <section>
          <SeccionTitulo icon={Building2} title="Datos de la empresa" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Razón social</p>
              <p className="font-medium">{empresa?.razon_social ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">CUIT</p>
              <p className="font-medium">{empresa?.cuit ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Establecimiento</p>
              <p className="font-medium">{estab?.nombre ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Dirección</p>
              <p className="font-medium">{estab?.domicilio ?? '—'}</p>
            </div>
          </div>
        </section>

        {/* ── Planilla 1 — Datos del puesto ─────────────────────────── */}
        <section>
          <SeccionTitulo icon={ClipboardList} title="Planilla 1 — Identificación del puesto" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Área y Sector</p>
              <p className="font-medium">{ev.area_sector ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Puesto de trabajo</p>
              <p className="font-medium">{ev.puesto_de_trabajo ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">N° trabajadores</p>
              <p className="font-medium">{ev.n_trabajadores ?? '—'}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-text-tertiary">Capacitación:</p>
              <SiNoChip value={ev.capacitacion} />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-text-tertiary">Proc. escrito:</p>
              <SiNoChip value={ev.procedimiento_escrito} />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-text-tertiary">Manifestación temprana:</p>
              <SiNoChip value={ev.manifestacion_temprana} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Ubicación del síntoma</p>
              <p className="font-medium">{ev.ubicacion_sintoma ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Trabajador/es</p>
              <p className="font-medium">{ev.nombre_trabajadores ?? '—'}</p>
            </div>
          </div>

          {/* Tareas habituales */}
          {tareasOrdenadas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-1">Tareas habituales del puesto:</p>
              <div className="flex flex-wrap gap-2">
                {tareasOrdenadas.map(t => (
                  <div key={t.id} className="flex items-center gap-1.5 px-3 py-1 bg-surface-base rounded-full border border-border-default text-xs">
                    <span className="font-bold text-sig-700">T{t.numero}</span>
                    <span className="text-text-primary">{t.descripcion ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grilla de factores */}
          {factoresPresentes.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <p className="text-xs font-semibold text-text-secondary mb-1">Factores de riesgo identificados:</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-base">
                    <th className="border border-border-default px-2 py-1.5 text-left font-semibold w-6">Cód.</th>
                    <th className="border border-border-default px-2 py-1.5 text-left font-semibold">Factor</th>
                    <th className="border border-border-default px-2 py-1.5 text-center font-semibold">Tarea</th>
                    <th className="border border-border-default px-2 py-1.5 text-center font-semibold">Tiempo expos.</th>
                    <th className="border border-border-default px-2 py-1.5 text-center font-semibold">Nivel riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {factoresPresentes.map(ft => (
                    <tr key={ft.id}>
                      <td className="border border-border-default px-2 py-1.5 text-center font-bold text-sig-700">{ft.factor}</td>
                      <td className="border border-border-default px-2 py-1.5">{FACTOR_LABEL[ft.factor]}</td>
                      <td className="border border-border-default px-2 py-1.5 text-center">{ft.tarea_numero}</td>
                      <td className="border border-border-default px-2 py-1.5 text-center">{ft.tiempo_exposicion ?? '—'}</td>
                      <td className="border border-border-default px-2 py-1.5 text-center">
                        {ft.nivel_riesgo ? (
                          <span className={`px-2 py-0.5 rounded-full font-semibold border text-xs ${NIVEL_COLOR[ft.nivel_riesgo]}`}>
                            {NIVEL_LABEL[ft.nivel_riesgo]}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Planilla 2 — Evaluación inicial ───────────────────────── */}
        {(ev.ergonomia_evaluacion_factor ?? []).length > 0 && (
          <section>
            <SeccionTitulo icon={FileCheck} title="Planilla 2 — Evaluación inicial de factores" />
            <div className="space-y-3">
              {(ev.ergonomia_evaluacion_factor ?? []).map(ef => (
                <div key={ef.id} className="border border-border-default rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-sig-700 mr-2">{ef.factor}</span>
                      <span className="font-medium text-text-primary">{FACTOR_LABEL[ef.factor]}</span>
                      <span className="text-text-tertiary ml-1.5 text-xs">— Tarea {ef.tarea_numero}</span>
                      {ef.vibracion_subtipo && (
                        <span className="ml-1.5 text-xs text-text-secondary">
                          ({ef.vibracion_subtipo === 'mano_brazo' ? 'Mano-brazo' : 'Cuerpo entero'})
                        </span>
                      )}
                    </div>
                    {ef.nivel_resultante ? (
                      <span className={`px-2 py-0.5 rounded-full font-semibold border text-xs shrink-0 ${NIVEL_COLOR[ef.nivel_resultante]}`}>
                        {NIVEL_LABEL[ef.nivel_resultante]}
                      </span>
                    ) : null}
                  </div>

                  {/* Paso 1 */}
                  {(ef.paso1_respuestas ?? []).length > 0 && (
                    <div>
                      <p className="text-xs text-text-tertiary mb-1 font-semibold">PASO 1:</p>
                      <div className="flex flex-wrap gap-1">
                        {(ef.paso1_respuestas as Array<{n:number;respuesta:boolean}>).map(r => (
                          <span key={r.n} className={`text-xs px-2 py-0.5 rounded border font-medium ${
                            r.respuesta ? 'text-green-700 bg-green-50 border-green-200' : 'text-text-tertiary bg-surface-base border-border-default'
                          }`}>
                            {r.n}: {r.respuesta ? 'SÍ' : 'NO'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Paso 2 */}
                  {(ef.paso2_respuestas ?? []).length > 0 && ef.paso1_implica && (
                    <div>
                      <p className="text-xs text-text-tertiary mb-1 font-semibold">PASO 2:</p>
                      <div className="flex flex-wrap gap-1">
                        {(ef.paso2_respuestas as Array<{n:number;respuesta:boolean}>).map(r => (
                          <span key={r.n} className={`text-xs px-2 py-0.5 rounded border font-medium ${
                            r.respuesta ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-text-tertiary bg-surface-base border-border-default'
                          }`}>
                            {r.n}: {r.respuesta ? 'SÍ' : 'NO'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {ef.observaciones && (
                    <p className="text-xs text-text-secondary italic">{ef.observaciones}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Planilla 3 — Medidas ───────────────────────────────────── */}
        {(ev.ergonomia_medidas ?? []).length > 0 && (
          <section>
            <SeccionTitulo icon={Wrench} title="Planilla 3 — Medidas Correctivas y Preventivas" />
            {(ev.ergonomia_medidas ?? []).map((m, _mi) => (
              <div key={m.id} className="border border-border-default rounded-lg p-3 mb-3 space-y-3">
                {m.tarea_numero !== null && (
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    Tarea {m.tarea_numero}
                  </h4>
                )}

                {/* Medidas generales */}
                <div className="space-y-1.5">
                  {[
                    { key: 'mg1_informado' as const, label: 'MG1 — Informado al trabajador/es y directivos' },
                    { key: 'mg2_capacitado_sintomas' as const, label: 'MG2 — Capacitado en identificación de síntomas' },
                    { key: 'mg3_capacitado_medidas' as const, label: 'MG3 — Capacitado en medidas preventivas' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">{label}</span>
                      <SiNoChip value={m[key] as boolean | null} />
                    </div>
                  ))}
                </div>

                {/* Medidas específicas */}
                {(m.medidas_especificas as Array<{ descripcion: string; tipo: string; fecha?: string | null }>).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-text-secondary mb-1">Medidas específicas:</p>
                    <div className="space-y-1">
                      {(m.medidas_especificas as Array<{ descripcion: string; tipo: string; fecha?: string | null }>).map((me, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs p-2 bg-surface-base rounded border border-border-default">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold border shrink-0 ${
                            me.tipo === 'administrativa'
                              ? 'text-blue-700 bg-blue-50 border-blue-200'
                              : 'text-purple-700 bg-purple-50 border-purple-200'
                          }`}>
                            {me.tipo === 'administrativa' ? 'Admin.' : 'Ing.'}
                          </span>
                          <span className="flex-1 text-text-primary">{me.descripcion}</span>
                          {me.fecha && <span className="text-text-tertiary shrink-0">{me.fecha}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* ── Planilla 4 — Seguimiento ───────────────────────────────── */}
        {seguimientoOrdenado.length > 0 && (
          <section>
            <SeccionTitulo icon={Calendar} title="Planilla 4 — Matriz de Seguimiento" />
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-surface-base">
                    <th className="border border-border-default px-2 py-1.5 font-semibold text-center w-10">N° MCP</th>
                    <th className="border border-border-default px-2 py-1.5 font-semibold text-left">Puesto</th>
                    <th className="border border-border-default px-2 py-1.5 font-semibold text-center">Eval.</th>
                    <th className="border border-border-default px-2 py-1.5 font-semibold text-center">Nivel riesgo</th>
                    <th className="border border-border-default px-2 py-1.5 font-semibold text-center">Impl. Admin.</th>
                    <th className="border border-border-default px-2 py-1.5 font-semibold text-center">Impl. Ing.</th>
                    <th className="border border-border-default px-2 py-1.5 font-semibold text-center">Cierre</th>
                  </tr>
                </thead>
                <tbody>
                  {seguimientoOrdenado.map(s => (
                    <tr key={s.id} className="hover:bg-surface-base/50">
                      <td className="border border-border-default px-2 py-1.5 text-center font-semibold text-sig-700">{s.numero_mcp ?? '—'}</td>
                      <td className="border border-border-default px-2 py-1.5">{s.nombre_puesto ?? '—'}</td>
                      <td className="border border-border-default px-2 py-1.5 text-center">{s.fecha_evaluacion ?? '—'}</td>
                      <td className="border border-border-default px-2 py-1.5 text-center">{s.nivel_riesgo ?? '—'}</td>
                      <td className="border border-border-default px-2 py-1.5 text-center">{s.fecha_implementacion_admin ?? '—'}</td>
                      <td className="border border-border-default px-2 py-1.5 text-center">{s.fecha_implementacion_ingenieria ?? '—'}</td>
                      <td className="border border-border-default px-2 py-1.5 text-center">{s.fecha_cierre ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Conclusiones / Recomendaciones / Firmante ─────────────── */}
        {(ev.conclusiones || ev.recomendaciones || ev.observaciones || ev.firmante) && (
          <section>
            <SeccionTitulo icon={CheckCircle} title="Conclusiones y firmante" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ev.conclusiones && (
                <div>
                  <p className="text-xs text-text-tertiary mb-0.5">Conclusiones</p>
                  <p className="text-sm text-text-primary whitespace-pre-line">{ev.conclusiones}</p>
                </div>
              )}
              {ev.recomendaciones && (
                <div>
                  <p className="text-xs text-text-tertiary mb-0.5">Recomendaciones</p>
                  <p className="text-sm text-text-primary whitespace-pre-line">{ev.recomendaciones}</p>
                </div>
              )}
              {ev.observaciones && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-text-tertiary mb-0.5">Observaciones generales</p>
                  <p className="text-sm text-text-primary whitespace-pre-line">{ev.observaciones}</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-border-default flex items-center justify-between text-xs text-text-secondary">
              <div>
                <span className="font-semibold">Firmante:</span>{' '}
                {ev.firmante ?? '—'}
              </div>
              <div>
                <span className="font-semibold">Fecha de evaluación:</span>{' '}
                {ev.fecha_evaluacion ?? '—'}
              </div>
            </div>
          </section>
        )}

      </div>
    </Modal>
  )
}
