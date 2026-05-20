'use client'

import React from 'react'
import { formatDate } from '@/lib/utils'
import type {
  Documento,
  EmpresaDocumento,
  EmpleadoDocumentoLegajo,
  LegajoGestion,
} from '@/lib/types'

interface LegajoTabProps {
  empresaDocumentos: EmpresaDocumento[]
  establecimientoDocumentos: Documento[]
  gestionesLegajo: LegajoGestion[]
  trabajadorDocumentos: EmpleadoDocumentoLegajo[]
}

function vencimientoClass(fecha: string | null): string {
  if (!fecha) return 'text-gray-400'
  const days = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'text-red-600 font-medium'
  if (days <= 30) return 'text-yellow-600 font-medium'
  return 'text-gray-500'
}

function vencimientoLabel(fecha: string | null): string {
  if (!fecha) return '—'
  const days = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  const base = formatDate(fecha)
  if (days < 0) return `${base} · vencido`
  if (days === 0) return `${base} · hoy`
  if (days <= 30) return `${base} · ${days}d`
  return base
}

function DocTable({ rows }: { rows: { id: string; tipo: string; vencimiento: string | null; url: string | null }[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-gray-400 px-1 py-2">Sin documentos cargados.</p>
  }
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-100 dark:border-border-subtle bg-gray-50 dark:bg-surface-sunken">
        <tr className="text-left">
          <th className="px-4 py-2.5 text-gray-500 font-medium text-xs">Tipo</th>
          <th className="px-4 py-2.5 text-gray-500 font-medium text-xs">Vencimiento</th>
          <th className="px-4 py-2.5 text-gray-500 font-medium text-xs">Archivo</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
        {rows.map(r => (
          <tr key={r.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white text-sm">{r.tipo}</td>
            <td className={`px-4 py-3 text-xs ${vencimientoClass(r.vencimiento)}`}>{vencimientoLabel(r.vencimiento)}</td>
            <td className="px-4 py-3">
              {r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sig-500 hover:underline text-xs">
                  Ver archivo ↗
                </a>
              ) : <span className="text-gray-300 text-xs">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Seccion({ titulo, badge, children }: { titulo: string; badge: number; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 dark:border-border-subtle bg-gray-50 dark:bg-surface-sunken">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-white">{titulo}</h4>
        <span className="text-xs text-gray-400 dark:text-white bg-gray-100 dark:bg-surface-base rounded-full px-2 py-0.5">{badge}</span>
      </div>
      {children}
    </div>
  )
}

export function LegajoTab({ empresaDocumentos, establecimientoDocumentos, gestionesLegajo, trabajadorDocumentos }: LegajoTabProps) {
  const trabajadoresAgrupados = trabajadorDocumentos.reduce<Record<string, { persona: EmpleadoDocumentoLegajo['personas_directorio']; docs: EmpleadoDocumentoLegajo[] }>>((acc, d) => {
    const key = d.persona_id
    if (!acc[key]) acc[key] = { persona: d.personas_directorio, docs: [] }
    acc[key].docs.push(d)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <Seccion titulo="Documentos de la Empresa" badge={empresaDocumentos.length}>
        <DocTable rows={empresaDocumentos.map(d => ({
          id: d.id,
          tipo: d.documentos_tipos?.nombre ?? '—',
          vencimiento: d.fecha_vencimiento,
          url: d.archivo_url,
        }))} />
      </Seccion>

      <Seccion titulo="Documentos del Establecimiento" badge={establecimientoDocumentos.length}>
        <DocTable rows={establecimientoDocumentos.map(d => ({
          id: d.id,
          tipo: d.documentos_tipos?.nombre ?? '—',
          vencimiento: d.fecha_vencimiento,
          url: d.archivo_url,
        }))} />
      </Seccion>

      <Seccion titulo="Gestiones de Agenda" badge={gestionesLegajo.length}>
        {gestionesLegajo.length === 0 ? (
          <p className="text-xs text-gray-400 px-5 py-3">Sin gestiones pendientes próximas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-border-subtle bg-gray-50 dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-4 py-2.5 text-gray-500 font-medium text-xs">Categoría</th>
                <th className="px-4 py-2.5 text-gray-500 font-medium text-xs">Gestión</th>
                <th className="px-4 py-2.5 text-gray-500 font-medium text-xs">Fecha planificada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {gestionesLegajo.map(g => {
                const gestion = g.gestiones_establecimientos?.gestiones
                return (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">{gestion?.gestiones_categorias?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white text-sm">{gestion?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(g.fecha_planificada)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Seccion>

      <Seccion titulo="Documentación de Trabajadores" badge={trabajadorDocumentos.length}>
        {Object.keys(trabajadoresAgrupados).length === 0 ? (
          <p className="text-xs text-gray-400 px-5 py-3">Sin documentación de trabajadores cargada.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {Object.entries(trabajadoresAgrupados).map(([personaId, { persona, docs }]) => (
              <div key={personaId}>
                <p className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-100">
                  {persona ? `${persona.apellido}, ${persona.nombre}${persona.legajo ? ` · Leg. ${persona.legajo}` : ''}` : 'Trabajador'}
                </p>
                <DocTable rows={docs.map(d => ({
                  id: d.id,
                  tipo: d.documentos_tipos?.nombre ?? '—',
                  vencimiento: d.fecha_vencimiento,
                  url: d.archivo_url,
                }))} />
              </div>
            ))}
          </div>
        )}
      </Seccion>
    </div>
  )
}
