'use client'

import React, { useState, useEffect } from 'react'
import { formatDate } from '@/lib/utils'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { CATEGORIAS_LEGAJO, periodicidadLabel } from '@/lib/legajo'
import type {
  Documento,
  EmpresaDocumento,
  EmpleadoDocumentoLegajo,
  LegajoGestion,
  CategoriaLegajo,
  PeriodicidadDoc,
} from '@/lib/types'

interface LegajoTabProps {
  empresaDocumentos: EmpresaDocumento[]
  establecimientoDocumentos: Documento[]
  gestionesLegajo: LegajoGestion[]
  trabajadorDocumentos: EmpleadoDocumentoLegajo[]
}

// Fila normalizada para la tabla de documentos (cualquier entidad).
interface DocRow {
  id: string
  tipo: string
  renovacion: string
  vencimiento: string | null
  url: string | null
  // Solo para la categoría 'persona*': agrupar por trabajador.
  persona?: EmpleadoDocumentoLegajo['personas_directorio']
  personaId?: string
}

// Documento crudo que comparten las 3 entidades del legajo.
type DocComun = {
  id: string
  archivo_url: string | null
  fecha_vencimiento: string | null
  documentos_tipos:
    | { nombre: string; categoria_legajo?: CategoriaLegajo | null; periodicidad?: PeriodicidadDoc | null }
    | null
}

function vencimientoClass(fecha: string | null, now: number | null): string {
  if (!fecha || now === null) return 'text-text-tertiary'
  const days = Math.ceil((new Date(fecha).getTime() - now) / 86400000)
  if (days < 0) return 'text-danger font-medium'
  if (days <= 30) return 'text-warning font-medium'
  return 'text-text-secondary'
}

function vencimientoLabel(fecha: string | null, now: number | null): string {
  if (!fecha) return '—'
  if (now === null) return formatDate(fecha)
  const days = Math.ceil((new Date(fecha).getTime() - now) / 86400000)
  const base = formatDate(fecha)
  if (days < 0) return `${base} · vencido`
  if (days === 0) return `${base} · hoy`
  if (days <= 30) return `${base} · ${days}d`
  return base
}

function DocTable({ rows, now }: { rows: DocRow[]; now: number | null }) {
  if (rows.length === 0) {
    return <p className="text-xs text-text-tertiary px-4 py-3">Sin documentos</p>
  }
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border-subtle dark:border-border-subtle bg-surface-base dark:bg-surface-sunken">
        <tr className="text-left">
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Tipo</th>
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Renovación</th>
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Vencimiento</th>
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Archivo</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
        {rows.map(r => (
          <tr key={r.id} className="hover:bg-surface-base">
            <td className="px-4 py-3 font-medium text-text-primary dark:text-white text-sm">{r.tipo}</td>
            <td className="px-4 py-3 text-xs text-text-secondary">{r.renovacion}</td>
            <td className={`px-4 py-3 text-xs ${vencimientoClass(r.vencimiento, now)}`}>{vencimientoLabel(r.vencimiento, now)}</td>
            <td className="px-4 py-3">
              {r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sig-500 hover:underline text-xs">
                  Ver archivo ↗
                </a>
              ) : <span className="text-text-tertiary text-xs">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Seccion({ titulo, badge, children }: { titulo: string; badge: number; children: React.ReactNode }) {
  return (
    <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border-subtle dark:border-border-subtle bg-surface-base dark:bg-surface-sunken">
        <h4 className="text-sm font-semibold text-text-primary dark:text-white">{titulo}</h4>
        <span className="text-xs text-text-tertiary dark:text-white bg-surface-elevated dark:bg-surface-base rounded-full px-2 py-0.5">{badge}</span>
      </div>
      {children}
    </div>
  )
}

export function LegajoTab({ empresaDocumentos, establecimientoDocumentos, gestionesLegajo, trabajadorDocumentos }: LegajoTabProps) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { setNow(Date.now()) }, [])

  // Bucket privado `documentos`: firmamos todas las URLs en el cliente (batch).
  const { getUrl } = useSignedUrls('documentos', [
    ...empresaDocumentos.map(d => d.archivo_url),
    ...establecimientoDocumentos.map(d => d.archivo_url),
    ...trabajadorDocumentos.map(d => d.archivo_url),
  ])

  // Normaliza un documento de cualquier entidad a fila de tabla.
  const toRow = (d: DocComun, extra?: Partial<DocRow>): DocRow => ({
    id: d.id,
    tipo: d.documentos_tipos?.nombre ?? '—',
    renovacion: periodicidadLabel(d.documentos_tipos?.periodicidad),
    vencimiento: d.fecha_vencimiento,
    url: getUrl(d.archivo_url),
    ...extra,
  })

  // Agrupa cualquier lista de documentos por su categoria_legajo.
  // Devuelve solo las que matchean la categoría pedida.
  const docsDeCategoria = (cat: CategoriaLegajo): DocRow[] => {
    const out: DocRow[] = []
    for (const d of empresaDocumentos) {
      if ((d.documentos_tipos?.categoria_legajo ?? null) === cat) out.push(toRow(d))
    }
    for (const d of establecimientoDocumentos) {
      if ((d.documentos_tipos?.categoria_legajo ?? null) === cat) out.push(toRow(d))
    }
    for (const d of trabajadorDocumentos) {
      if ((d.documentos_tipos?.categoria_legajo ?? null) === cat) {
        out.push(toRow(d, { persona: d.personas_directorio, personaId: d.persona_id }))
      }
    }
    return out
  }

  // Las categorías 'persona*' se muestran agrupadas por trabajador.
  const renderPersonas = (rows: DocRow[]) => {
    if (rows.length === 0) {
      return <p className="text-xs text-text-tertiary px-4 py-3">Sin documentos</p>
    }
    const agrupados = rows.reduce<Record<string, { persona: DocRow['persona']; docs: DocRow[] }>>((acc, r) => {
      const key = r.personaId ?? '—'
      if (!acc[key]) acc[key] = { persona: r.persona, docs: [] }
      acc[key].docs.push(r)
      return acc
    }, {})
    return (
      <div className="divide-y divide-gray-100 dark:divide-border-subtle">
        {Object.entries(agrupados).map(([personaId, { persona, docs }]) => (
          <div key={personaId}>
            <p className="px-5 py-2.5 text-xs font-semibold text-text-secondary bg-surface-base border-b border-border-subtle">
              {persona ? `${persona.apellido}, ${persona.nombre}${persona.legajo ? ` · Leg. ${persona.legajo}` : ''}` : 'Trabajador'}
            </p>
            <DocTable now={now} rows={docs} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {CATEGORIAS_LEGAJO.map(({ key, titulo }) => {
        // Sección desde Gestiones de Agenda (no sale de documentos_tipos).
        if (key === 'empresa_gestiones') {
          return (
            <Seccion key={key} titulo={titulo} badge={gestionesLegajo.length}>
              {gestionesLegajo.length === 0 ? (
                <p className="text-xs text-text-tertiary px-4 py-3">Sin documentos</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border-subtle dark:border-border-subtle bg-surface-base dark:bg-surface-sunken">
                    <tr className="text-left">
                      <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Categoría</th>
                      <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Gestión</th>
                      <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Renovación</th>
                      <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Fecha planificada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
                    {gestionesLegajo.map(g => {
                      const gestion = g.gestiones_establecimientos?.gestiones
                      return (
                        <tr key={g.id} className="hover:bg-surface-base">
                          <td className="px-4 py-3 text-xs text-text-secondary">{gestion?.gestiones_categorias?.nombre ?? '—'}</td>
                          <td className="px-4 py-3 font-medium text-text-primary dark:text-white text-sm">{gestion?.nombre ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-text-secondary">{periodicidadLabel('por_gestion')}</td>
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

        const rows = docsDeCategoria(key)
        const esPersona = key === 'persona' || key === 'persona_por_establecimiento'
        return (
          <Seccion key={key} titulo={titulo} badge={rows.length}>
            {esPersona ? renderPersonas(rows) : <DocTable now={now} rows={rows} />}
          </Seccion>
        )
      })}
    </div>
  )
}
