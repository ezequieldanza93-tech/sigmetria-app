'use client'

import { useState, useEffect } from 'react'
import { getCalculoCargaFuegoByRegistro } from '@/lib/actions/calculo-carga-fuego-view'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { Modal } from '@/components/ui/modal'
import {
  Flame, Building2, FileText, Layers, ShieldCheck,
  XCircle, Loader2, Download,
} from 'lucide-react'

// ── Props ────────────────────────────────────────────────────────────
interface CalculoCargaFuegoViewerProps {
  /** gestiones_registros.id del cálculo ya ejecutado. */
  registroId: string
  /** Compañera de la referencia suelta (fecha_planificada del registro particionado). */
  rgFechaPlanificada: string | null
  /** Nombre de la gestión, para el título del modal. */
  gestionNombre?: string | null
  onClose: () => void
}

// ── Tipos laxos de lo que devuelve PostgREST (joins embebidos) ─────────
interface Material {
  id?: string
  descripcion?: string | null
  estado?: string | null
  peso_kg?: number | null
  pci_kcal?: number | null
  coef_c?: number | null
  equiv_madera_kg?: number | null
  orden?: number | null
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

interface CalculoCargaFuegoRow {
  firmante?: string | null
  sector_incendio?: string | null
  superficie_m2?: number | null
  ventilacion?: string | null
  riesgo?: string | null
  qf_kg_m2?: number | null
  f_exigido?: string | null
  potencial_extintor_a?: string | null
  potencial_extintor_b?: string | null
  conclusiones?: string | null
  recomendaciones?: string | null
  observaciones?: string | null
  certificado_url?: string | null
  plano_url?: string | null
  establecimientos?: CabeceraEstablecimiento | CabeceraEstablecimiento[] | null
  calculo_carga_fuego_materiales?: Material[] | null
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

function labelVentilacion(v: string | null | undefined): string {
  if (v === 'natural') return 'Natural'
  if (v === 'mecanica') return 'Mecánica'
  return '—'
}

/**
 * Vista READ-ONLY del Cálculo de Carga de Fuego (Dec 351/79 Anexo VII) ya ejecutado.
 * Muestra cabecera, inventario de materiales con sus valores, resultados del cálculo
 * (Qf, resistencia exigida, potencial extintor) y adjuntos. No edita nada — la lectura
 * viene de getCalculoCargaFuegoByRegistro (que reusa getCalculoCargaFuego).
 * Los adjuntos (certificado / plano) viven en bucket privado: se firman para "Ver".
 */
export function CalculoCargaFuegoViewer({
  registroId,
  rgFechaPlanificada,
  gestionNombre,
  onClose,
}: CalculoCargaFuegoViewerProps) {
  const [data, setData] = useState<CalculoCargaFuegoRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getCalculoCargaFuegoByRegistro(registroId, rgFechaPlanificada)
      .then(res => {
        if (cancelled) return
        if (res.success) setData(res.data as CalculoCargaFuegoRow)
        else setError(res.error)
      })
      .catch(() => { if (!cancelled) setError('No se pudo cargar el cálculo') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [registroId, rgFechaPlanificada])

  const { getUrl } = useSignedUrls('documentos', [data?.certificado_url, data?.plano_url])

  const est = one(data?.establecimientos)
  const emp = one(est?.empresas)
  const materiales = (data?.calculo_carga_fuego_materiales ?? [])
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  return (
    <Modal open title={gestionNombre || 'Cálculo de Carga de Fuego'} onClose={onClose} size="wide">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-text-secondary">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Cargando cálculo…</span>
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

          {/* Datos del cálculo */}
          <section className="rounded-xl border border-border-subtle p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
              <FileText size={16} className="text-sig-500" />
              Datos del cálculo
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="Firmante" value={dash(data.firmante)} />
              <Field label="Sector de incendio" value={dash(data.sector_incendio)} />
              <Field label="Superficie (m²)" value={data.superficie_m2 != null ? String(data.superficie_m2) : '—'} />
              <Field label="Ventilación" value={labelVentilacion(data.ventilacion)} />
              <Field label="Riesgo" value={dash(data.riesgo)} />
            </dl>
          </section>

          {/* Resultados del cálculo */}
          {(data.qf_kg_m2 != null || data.f_exigido || data.potencial_extintor_a || data.potencial_extintor_b) ? (
            <section className="rounded-xl border border-border-subtle p-4 bg-surface-base">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                <Flame size={16} className="text-sig-500" />
                Resultados
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {data.qf_kg_m2 != null ? (
                  <div>
                    <dt className="text-xs font-medium text-text-secondary">Carga de fuego (Qf kg/m²)</dt>
                    <dd className="text-base font-semibold text-text-primary">{data.qf_kg_m2}</dd>
                  </div>
                ) : null}
                {data.f_exigido ? (
                  <Field label="Resistencia al fuego exigida (F)" value={data.f_exigido} />
                ) : null}
                {data.potencial_extintor_a ? (
                  <Field label="Potencial extintor clase A" value={data.potencial_extintor_a} />
                ) : null}
                {data.potencial_extintor_b ? (
                  <Field label="Potencial extintor clase B" value={data.potencial_extintor_b} />
                ) : null}
              </dl>
            </section>
          ) : null}

          {/* Inventario de materiales */}
          {materiales.length > 0 ? (
            <section className="rounded-xl border border-border-subtle p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-4">
                <Layers size={16} className="text-sig-500" />
                Inventario de materiales
                <span className="text-xs font-normal text-text-tertiary">({materiales.length})</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-text-tertiary border-b border-border-subtle/60">
                      <th className="px-1.5 py-1 font-medium">#</th>
                      <th className="px-1.5 py-1 font-medium">Descripción</th>
                      <th className="px-1.5 py-1 font-medium">Estado</th>
                      <th className="px-1.5 py-1 font-medium text-right">Peso (kg)</th>
                      <th className="px-1.5 py-1 font-medium text-right">PCI (kcal/kg)</th>
                      <th className="px-1.5 py-1 font-medium text-right">Coef. C</th>
                      <th className="px-1.5 py-1 font-medium text-right">Equiv. madera (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiales.map((m, mi) => (
                      <tr key={m.id ?? mi} className="border-b border-border-subtle/40">
                        <td className="px-1.5 py-1 text-text-primary">{mi + 1}</td>
                        <td className="px-1.5 py-1 text-text-primary">{dash(m.descripcion)}</td>
                        <td className="px-1.5 py-1 text-text-primary capitalize">{dash(m.estado)}</td>
                        <td className="px-1.5 py-1 text-right text-text-primary">{dash(m.peso_kg)}</td>
                        <td className="px-1.5 py-1 text-right text-text-primary">{dash(m.pci_kcal)}</td>
                        <td className="px-1.5 py-1 text-right text-text-primary">{dash(m.coef_c)}</td>
                        <td className="px-1.5 py-1 text-right text-text-primary">{dash(m.equiv_madera_kg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Análisis / conclusiones */}
          {(data.conclusiones || data.recomendaciones || data.observaciones) ? (
            <section className="rounded-xl border border-border-subtle p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                <Flame size={16} className="text-sig-500" />
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
                  <Adjunto label="Certificado" href={getUrl(data.certificado_url)} />
                ) : null}
                {data.plano_url ? (
                  <Adjunto label="Plano" href={getUrl(data.plano_url)} />
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Flame size={12} className="text-sig-500" />
            Cálculo de Carga de Fuego — Dec 351/79 Anexo VII · vista de solo lectura
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
