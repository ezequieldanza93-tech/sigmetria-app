'use client'

/**
 * Visor de SOLO LECTURA del Legajo Técnico cacheado, para usar SIN señal
 * (PRIORIDAD #1 del modo offline: un inspector en obra/planta sin conexión le
 * muestra el legajo al profesional). Renderiza un `LegajoSnapshot` (metadatos:
 * documentos esperados, estados, vencimientos y gestiones del legajo) y abre los
 * documentos desde los bytes cacheados en IndexedDB (object URLs), porque las
 * signed URLs de Storage expiran y no se pueden re-firmar sin red.
 *
 * Se reusa en dos lugares:
 *   - fallback dentro de LegajoTab cuando no hay datos del server (offline), y
 *   - la página /offline (único entry-point que carga sin conexión).
 */

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { CATEGORIAS_LEGAJO, periodicidadLabel } from '@/lib/legajo'
import { getLegajoBlob } from '@/lib/offline/legajo-cache'
import type {
  CategoriaLegajo,
  LegajoEsperadoRow,
  LegajoEsperadoPersona,
  LegajoVersion,
} from '@/lib/types'
import type { LegajoSnapshot } from '@/lib/offline/types'
import { WifiOff, FileCheck, Clock } from 'lucide-react'

function vencimientoClass(fecha: string | null, now: number): string {
  if (!fecha) return 'text-text-tertiary'
  const days = Math.ceil((new Date(fecha).getTime() - now) / 86400000)
  if (days < 0) return 'text-danger font-medium'
  if (days <= 30) return 'text-warning font-medium'
  return 'text-text-secondary'
}

function EstadoUltimo({ ultimo, now }: { ultimo: LegajoVersion | null; now: number }) {
  if (!ultimo) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-base text-text-tertiary border border-border-subtle">
        Pendiente
      </span>
    )
  }
  const fecha = ultimo.fecha_vencimiento
  if (!fecha) return <span className="text-xs text-text-secondary">Sin vencimiento</span>
  const days = Math.ceil((new Date(fecha).getTime() - now) / 86400000)
  let suffix = ''
  if (days < 0) suffix = ' · vencido'
  else if (days === 0) suffix = ' · hoy'
  else if (days <= 30) suffix = ` · ${days}d`
  return <span className={`text-xs ${vencimientoClass(fecha, now)}`}>{formatDate(fecha)}{suffix}</span>
}

/**
 * Hook: resuelve object URLs (blob:) para los paths cacheados visibles y los
 * revoca al desmontar. Devuelve un resolver síncrono `getUrl(path)`.
 */
function useCachedBlobUrls(paths: (string | null | undefined)[]): {
  getUrl: (path: string | null | undefined) => string | null
} {
  const [urls, setUrls] = useState<Map<string, string>>(new Map())

  // Clave estable de paths para no re-resolver de más.
  const key = Array.from(
    new Set(paths.filter((p): p is string => typeof p === 'string' && p.length > 0)),
  )
    .sort()
    .join('|')

  useEffect(() => {
    let cancelled = false
    const created: string[] = []
    const next = new Map<string, string>()
    const list = key ? key.split('|') : []
    Promise.all(
      list.map(async (path) => {
        const blob = await getLegajoBlob(path)
        if (blob) {
          const url = URL.createObjectURL(blob.blob)
          created.push(url)
          next.set(path, url)
        }
      }),
    ).then(() => {
      if (cancelled) {
        created.forEach((u) => URL.revokeObjectURL(u))
        return
      }
      setUrls(next)
    })
    return () => {
      cancelled = true
      created.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [key])

  return {
    getUrl: (path) => (path ? urls.get(path) ?? null : null),
  }
}

function Seccion({ titulo, badge, children }: { titulo: string; badge: number; children: React.ReactNode }) {
  return (
    <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border-subtle bg-surface-base dark:bg-surface-sunken">
        <h4 className="text-sm font-semibold text-text-primary dark:text-white">{titulo}</h4>
        <span className="text-xs text-text-tertiary dark:text-white bg-surface-elevated dark:bg-surface-base rounded-full px-2 py-0.5">{badge}</span>
      </div>
      {children}
    </div>
  )
}

function EsperadosTable({
  filas,
  now,
  getUrl,
}: {
  filas: LegajoEsperadoRow[]
  now: number
  getUrl: (p: string | null | undefined) => string | null
}) {
  if (filas.length === 0) {
    return <p className="text-xs text-text-tertiary px-4 py-3">Sin documentos esperados</p>
  }
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border-subtle bg-surface-base dark:bg-surface-sunken">
        <tr className="text-left">
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Documento</th>
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Renovación</th>
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Estado</th>
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Archivo</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
        {filas.map((f) => {
          const url = getUrl(f.ultimo?.archivo_url)
          return (
            <tr key={f.tipo_id} className="hover:bg-surface-base">
              <td className="px-4 py-3 font-medium text-text-primary dark:text-white text-sm">{f.nombre}</td>
              <td className="px-4 py-3 text-xs text-text-secondary">{periodicidadLabel(f.periodicidad)}</td>
              <td className="px-4 py-3"><EstadoUltimo ultimo={f.ultimo} now={now} /></td>
              <td className="px-4 py-3">
                {f.ultimo?.archivo_url && url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-sig-500 hover:underline text-xs">
                    Ver ↗
                  </a>
                ) : f.ultimo?.archivo_url ? (
                  <span className="text-text-tertiary text-xs" title="No se descargó este archivo para uso offline">
                    No disponible offline
                  </span>
                ) : (
                  <span className="text-text-tertiary text-xs">—</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function LegajoOfflineViewer({ snapshot }: { snapshot: LegajoSnapshot }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { setNow(Date.now()) }, [])

  const { legajoEsperados, gestionesLegajo } = snapshot

  // Reunir paths de los últimos para resolver blobs cacheados.
  const allPaths: (string | null | undefined)[] = []
  const push = (filas: LegajoEsperadoRow[]) => filas.forEach((f) => allPaths.push(f.ultimo?.archivo_url))
  push(legajoEsperados.empresa)
  push(legajoEsperados.empresa_por_establecimiento)
  push(legajoEsperados.establecimiento)
  legajoEsperados.persona.forEach((p) => push(p.filas))
  legajoEsperados.persona_por_establecimiento.forEach((p) => push(p.filas))
  const { getUrl } = useCachedBlobUrls(allPaths)

  const nowSafe = now ?? Date.now()

  const contarCargados = (filas: LegajoEsperadoRow[]) => filas.filter((f) => f.ultimo).length
  const badgePara = (key: CategoriaLegajo): number => {
    switch (key) {
      case 'empresa': return contarCargados(legajoEsperados.empresa)
      case 'empresa_por_establecimiento': return contarCargados(legajoEsperados.empresa_por_establecimiento)
      case 'establecimiento': return contarCargados(legajoEsperados.establecimiento)
      case 'persona': return legajoEsperados.persona.reduce((n, p) => n + contarCargados(p.filas), 0)
      case 'persona_por_establecimiento': return legajoEsperados.persona_por_establecimiento.reduce((n, p) => n + contarCargados(p.filas), 0)
      default: return 0
    }
  }

  const renderPersonas = (personas: LegajoEsperadoPersona[]) => {
    if (personas.length === 0) {
      return <p className="text-xs text-text-tertiary px-4 py-3">Sin personas en el establecimiento</p>
    }
    return (
      <div className="divide-y divide-gray-100 dark:divide-border-subtle">
        {personas.map((p) => (
          <div key={p.persona_id}>
            <p className="px-5 py-2.5 text-xs font-semibold text-text-secondary bg-surface-base border-b border-border-subtle">
              {p.persona ? `${p.persona.apellido}, ${p.persona.nombre}${p.persona.legajo ? ` · Leg. ${p.persona.legajo}` : ''}` : 'Trabajador'}
            </p>
            <EsperadosTable filas={p.filas} now={nowSafe} getUrl={getUrl} />
          </div>
        ))}
      </div>
    )
  }

  const guardadoHace = (() => {
    const saved = new Date(snapshot.savedAt).getTime()
    const mins = Math.round((nowSafe - saved) / 60000)
    if (mins < 1) return 'recién'
    if (mins < 60) return `hace ${mins} min`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `hace ${hrs} h`
    return `el ${formatDate(snapshot.savedAt)}`
  })()

  return (
    <div className="space-y-4">
      {/* Aviso de modo offline + frescura del snapshot. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
        <WifiOff size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="text-xs leading-snug text-amber-900 dark:text-amber-200">
          <p className="font-semibold">Legajo en modo offline (solo lectura)</p>
          <p className="opacity-90">
            Datos cacheados {guardadoHace}. {snapshot.blobsCached} de {snapshot.blobPaths.length} documentos disponibles para ver sin conexión.
          </p>
        </div>
      </div>

      {/* Cabecera del establecimiento. */}
      <div className="rounded-xl border border-border-subtle bg-surface-base px-4 py-3 dark:bg-surface-elevated">
        <div className="flex items-center gap-2">
          <FileCheck size={16} className="shrink-0 text-sig-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-text-primary dark:text-white">{snapshot.establecimiento.nombre}</p>
        </div>
        {snapshot.establecimiento.empresaRazonSocial && (
          <p className="mt-0.5 text-xs text-text-secondary">{snapshot.establecimiento.empresaRazonSocial}</p>
        )}
        {(snapshot.establecimiento.domicilio || snapshot.establecimiento.localidad) && (
          <p className="text-xs text-text-tertiary">
            {[snapshot.establecimiento.domicilio, snapshot.establecimiento.localidad, snapshot.establecimiento.provincia]
              .filter(Boolean)
              .join(', ')}
          </p>
        )}
      </div>

      {CATEGORIAS_LEGAJO.map(({ key, titulo }) => {
        if (key === 'empresa_gestiones') {
          return (
            <Seccion key={key} titulo={titulo} badge={gestionesLegajo.length}>
              {gestionesLegajo.length === 0 ? (
                <p className="text-xs text-text-tertiary px-4 py-3">Sin gestiones</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border-subtle bg-surface-base dark:bg-surface-sunken">
                    <tr className="text-left">
                      <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Categoría</th>
                      <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Gestión</th>
                      <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Fecha planificada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
                    {gestionesLegajo.map((g) => {
                      const gestion = g.gestiones_establecimientos?.gestiones
                      return (
                        <tr key={g.id} className="hover:bg-surface-base">
                          <td className="px-4 py-3 text-xs text-text-secondary">{gestion?.gestiones_categorias?.nombre ?? '—'}</td>
                          <td className="px-4 py-3 font-medium text-text-primary dark:text-white text-sm">{gestion?.nombre ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-text-secondary">{formatDate(g.fecha_planificada)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Seccion>
          )
        }

        const esPersona = key === 'persona' || key === 'persona_por_establecimiento'
        return (
          <Seccion key={key} titulo={titulo} badge={badgePara(key)}>
            {esPersona ? (
              renderPersonas(
                key === 'persona' ? legajoEsperados.persona : legajoEsperados.persona_por_establecimiento,
              )
            ) : (
              <EsperadosTable
                filas={
                  key === 'empresa'
                    ? legajoEsperados.empresa
                    : key === 'empresa_por_establecimiento'
                      ? legajoEsperados.empresa_por_establecimiento
                      : legajoEsperados.establecimiento
                }
                now={nowSafe}
                getUrl={getUrl}
              />
            )}
          </Seccion>
        )
      })}

      <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-text-tertiary">
        <Clock size={12} aria-hidden="true" />
        Vista de solo lectura. Volvé a abrir el legajo con conexión para actualizarlo.
      </p>
    </div>
  )
}
