'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { Modal } from '@/components/ui/modal'
import { DocumentoForm } from '@/components/forms/documento-form'
import { DocumentoHistorialModal } from '@/components/establecimiento/documento-historial-modal'
import { createDocumento } from '@/lib/actions/documento'
import { createTrabajadorDocumento } from '@/lib/actions/trabajador-documento'
import { setDocumentoOverride, getDocumentoOverrides } from '@/lib/actions/establecimiento-ficha'
import { CATEGORIAS_LEGAJO, periodicidadLabel } from '@/lib/legajo'
import type {
  ActionResult,
  DocumentType,
  LegajoGestion,
  CategoriaLegajo,
  LegajoEsperados,
  LegajoEsperadoRow,
  LegajoEsperadoPersona,
  LegajoVersion,
} from '@/lib/types'

interface LegajoTabProps {
  // Checklist de esperados (último + historial por tipo). Si es null, no se cargó.
  legajoEsperados: LegajoEsperados | null
  gestionesLegajo: LegajoGestion[]
  // Contexto para las acciones de carga.
  establecimientoId: string
  empresaId: string
  documentTypes: DocumentType[]
  canWrite?: boolean
}

// Identifica qué entidad/acción corresponde a cada categoría de documentos.
type CategoriaDoc = 'empresa' | 'empresa_por_establecimiento' | 'establecimiento'
type CategoriaPersona = 'persona' | 'persona_por_establecimiento'

type DocAction = (prev: ActionResult<null> | null, fd: FormData) => Promise<ActionResult<null>>

function vencimientoClass(fecha: string | null, now: number | null): string {
  if (!fecha || now === null) return 'text-text-tertiary'
  const days = Math.ceil((new Date(fecha).getTime() - now) / 86400000)
  if (days < 0) return 'text-danger font-medium'
  if (days <= 30) return 'text-warning font-medium'
  return 'text-text-secondary'
}

function EstadoUltimo({ ultimo, now }: { ultimo: LegajoVersion | null; now: number | null }) {
  if (!ultimo) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-base text-text-tertiary border border-border-subtle">
        Pendiente
      </span>
    )
  }
  const fecha = ultimo.fecha_vencimiento
  if (!fecha) {
    return <span className="text-xs text-text-secondary">Sin vencimiento</span>
  }
  if (now === null) {
    return <span className="text-xs text-text-secondary">{formatDate(fecha)}</span>
  }
  const days = Math.ceil((new Date(fecha).getTime() - now) / 86400000)
  const base = formatDate(fecha)
  let suffix = ''
  if (days < 0) suffix = ' · vencido'
  else if (days === 0) suffix = ' · hoy'
  else if (days <= 30) suffix = ` · ${days}d`
  return <span className={`text-xs ${vencimientoClass(fecha, now)}`}>{base}{suffix}</span>
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

// Tabla de esperados de una categoría/persona. Recibe el resolver de URLs firmadas
// y los callbacks de carga / historial.
function EsperadosTable({
  filas,
  now,
  getUrl,
  canWrite,
  onSubir,
  onHistorial,
  onQuitar,
}: {
  filas: LegajoEsperadoRow[]
  now: number | null
  getUrl: (p: string | null | undefined) => string | null
  canWrite: boolean
  onSubir: (fila: LegajoEsperadoRow) => void
  onHistorial: (fila: LegajoEsperadoRow) => void
  onQuitar?: (fila: LegajoEsperadoRow) => void
}) {
  if (filas.length === 0) {
    return <p className="text-xs text-text-tertiary px-4 py-3">Sin documentos esperados</p>
  }
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border-subtle dark:border-border-subtle bg-surface-base dark:bg-surface-sunken">
        <tr className="text-left">
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Documento</th>
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Renovación</th>
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Estado</th>
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Archivo</th>
          <th className="px-4 py-2.5 text-text-secondary font-medium text-xs text-right">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
        {filas.map(f => {
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
                  <span className="text-text-tertiary text-xs">Cargando…</span>
                ) : (
                  <span className="text-text-tertiary text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-3">
                  {f.historial.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onHistorial(f)}
                      className="text-xs text-text-secondary hover:text-text-primary hover:underline"
                    >
                      Historial ({f.historial.length})
                    </button>
                  )}
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => onSubir(f)}
                      className="text-xs font-medium text-sig-600 hover:text-sig-700 hover:underline"
                    >
                      Subir
                    </button>
                  )}
                  {canWrite && onQuitar && (
                    <button
                      type="button"
                      onClick={() => onQuitar(f)}
                      className="text-xs text-text-tertiary hover:text-danger hover:underline"
                      title="Quitar este documento del legajo de este establecimiento"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function LegajoTab({
  legajoEsperados,
  gestionesLegajo,
  establecimientoId,
  empresaId,
  documentTypes,
  canWrite = false,
}: LegajoTabProps) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { setNow(Date.now()) }, [])

  // Override por establecimiento: documentos quitados a mano del legajo.
  const router = useRouter()
  const [overrides, setOverrides] = useState<{ documento_tipo_id: string; incluido: boolean; nombre: string }[]>([])
  const reloadOverrides = useCallback(() => {
    getDocumentoOverrides(establecimientoId).then(setOverrides).catch(() => {})
  }, [establecimientoId])
  useEffect(() => { reloadOverrides() }, [reloadOverrides])

  const quitarDoc = async (fila: LegajoEsperadoRow) => {
    await setDocumentoOverride(establecimientoId, fila.tipo_id, false)
    reloadOverrides()
    router.refresh()
  }
  const restaurarDoc = async (documentoTipoId: string) => {
    await setDocumentoOverride(establecimientoId, documentoTipoId, null)
    reloadOverrides()
    router.refresh()
  }
  const quitados = overrides.filter(o => !o.incluido)

  // Modal de carga: tipo prefijado + acción según categoría/persona.
  const [subirState, setSubirState] = useState<{
    tipoId: string
    tipoNombre: string
    action: DocAction
    context: 'empresa' | 'establecimiento'
  } | null>(null)

  // Modal de historial.
  const [historialState, setHistorialState] = useState<{ tipoNombre: string; versiones: LegajoVersion[] } | null>(null)

  // Reunir TODOS los archivo_url de los últimos para firmar en batch.
  const todasLasUrls: (string | null)[] = []
  if (legajoEsperados) {
    const pushFilas = (filas: LegajoEsperadoRow[]) => filas.forEach(f => todasLasUrls.push(f.ultimo?.archivo_url ?? null))
    pushFilas(legajoEsperados.empresa)
    pushFilas(legajoEsperados.empresa_por_establecimiento)
    pushFilas(legajoEsperados.establecimiento)
    legajoEsperados.persona.forEach(p => pushFilas(p.filas))
    legajoEsperados.persona_por_establecimiento.forEach(p => pushFilas(p.filas))
  }
  const { getUrl } = useSignedUrls('documentos', todasLasUrls)

  // Acción de carga para categorías de DOCUMENTO (empresa / estab).
  const docActionPara = (cat: CategoriaDoc): { action: DocAction; context: 'empresa' | 'establecimiento' } => {
    if (cat === 'establecimiento') {
      return { action: createDocumento.bind(null, empresaId, establecimientoId), context: 'establecimiento' }
    }
    // empresa y empresa_por_establecimiento viven en empresas_documentos.
    return { action: createDocumento.bind(null, empresaId, null), context: 'empresa' }
  }

  // Acción de carga para PERSONA: createTrabajadorDocumento espera `tipo_id`,
  // pero DocumentoForm manda `document_type_id` — adaptamos el FormData.
  const personaActionPara = (personaId: string): DocAction => {
    const bound = createTrabajadorDocumento.bind(null, personaId, establecimientoId, empresaId)
    return (prev, fd) => {
      const tipo = fd.get('document_type_id')
      if (tipo) fd.set('tipo_id', tipo)
      return bound(prev, fd)
    }
  }

  const abrirSubirDoc = (cat: CategoriaDoc, fila: LegajoEsperadoRow) => {
    const { action, context } = docActionPara(cat)
    setSubirState({ tipoId: fila.tipo_id, tipoNombre: fila.nombre, action, context })
  }

  const abrirSubirPersona = (personaId: string, cat: CategoriaPersona, fila: LegajoEsperadoRow) => {
    void cat
    setSubirState({
      tipoId: fila.tipo_id,
      tipoNombre: fila.nombre,
      action: personaActionPara(personaId),
      context: 'establecimiento',
    })
  }

  const abrirHistorial = (fila: LegajoEsperadoRow) => {
    setHistorialState({ tipoNombre: fila.nombre, versiones: fila.historial })
  }

  // Cuenta cuántos esperados de una lista de filas están cargados (para el badge).
  const contarCargados = (filas: LegajoEsperadoRow[]) => filas.filter(f => f.ultimo).length

  const renderPersonas = (
    personas: LegajoEsperadoPersona[],
    cat: CategoriaPersona,
  ) => {
    if (personas.length === 0) {
      return <p className="text-xs text-text-tertiary px-4 py-3">Sin personas en el establecimiento</p>
    }
    return (
      <div className="divide-y divide-gray-100 dark:divide-border-subtle">
        {personas.map(p => (
          <div key={p.persona_id}>
            <p className="px-5 py-2.5 text-xs font-semibold text-text-secondary bg-surface-base border-b border-border-subtle">
              {p.persona ? `${p.persona.apellido}, ${p.persona.nombre}${p.persona.legajo ? ` · Leg. ${p.persona.legajo}` : ''}` : 'Trabajador'}
            </p>
            <EsperadosTable
              filas={p.filas}
              now={now}
              getUrl={getUrl}
              canWrite={canWrite}
              onSubir={fila => abrirSubirPersona(p.persona_id, cat, fila)}
              onHistorial={abrirHistorial}
            />
          </div>
        ))}
      </div>
    )
  }

  // Badge por sección (cantidad de esperados cargados / total, o gestiones).
  const badgePara = (key: CategoriaLegajo): number => {
    if (!legajoEsperados) return 0
    switch (key) {
      case 'empresa': return contarCargados(legajoEsperados.empresa)
      case 'empresa_por_establecimiento': return contarCargados(legajoEsperados.empresa_por_establecimiento)
      case 'establecimiento': return contarCargados(legajoEsperados.establecimiento)
      case 'persona': return legajoEsperados.persona.reduce((n, p) => n + contarCargados(p.filas), 0)
      case 'persona_por_establecimiento': return legajoEsperados.persona_por_establecimiento.reduce((n, p) => n + contarCargados(p.filas), 0)
      default: return 0
    }
  }

  return (
    <div className="space-y-4">
      {canWrite && quitados.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 mb-1.5">
            Documentos quitados de este legajo ({quitados.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {quitados.map(o => (
              <span
                key={o.documento_tipo_id}
                className="inline-flex items-center gap-1.5 text-xs bg-surface-base border border-amber-200 rounded-full pl-2.5 pr-1.5 py-0.5 text-text-secondary"
              >
                {o.nombre}
                <button
                  type="button"
                  onClick={() => restaurarDoc(o.documento_tipo_id)}
                  className="text-amber-700 hover:text-amber-900 font-medium"
                  title="Restaurar este documento al legajo"
                >
                  Restaurar
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      {CATEGORIAS_LEGAJO.map(({ key, titulo }) => {
        // Sección desde Gestiones de Agenda (no sale de documentos_tipos).
        if (key === 'empresa_gestiones') {
          return (
            <Seccion key={key} titulo={titulo} badge={gestionesLegajo.length}>
              {gestionesLegajo.length === 0 ? (
                <p className="text-xs text-text-tertiary px-4 py-3">Sin gestiones</p>
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

        if (!legajoEsperados) {
          return (
            <Seccion key={key} titulo={titulo} badge={0}>
              <p className="text-xs text-text-tertiary px-4 py-3">Cargando…</p>
            </Seccion>
          )
        }

        const esPersona = key === 'persona' || key === 'persona_por_establecimiento'
        return (
          <Seccion key={key} titulo={titulo} badge={badgePara(key)}>
            {esPersona ? (
              renderPersonas(
                key === 'persona' ? legajoEsperados.persona : legajoEsperados.persona_por_establecimiento,
                key as CategoriaPersona,
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
                now={now}
                getUrl={getUrl}
                canWrite={canWrite}
                onSubir={fila => abrirSubirDoc(key as CategoriaDoc, fila)}
                onHistorial={abrirHistorial}
                onQuitar={quitarDoc}
              />
            )}
          </Seccion>
        )
      })}

      {/* Modal: cargar una versión nueva del documento esperado (tipo prefijado). */}
      <Modal
        open={subirState !== null}
        onClose={() => setSubirState(null)}
        title={subirState ? `Subir · ${subirState.tipoNombre}` : 'Subir documento'}
      >
        {subirState && (
          <DocumentoForm
            action={subirState.action}
            documentTypes={documentTypes}
            context={subirState.context}
            fixedTipoId={subirState.tipoId}
            fixedTipoNombre={subirState.tipoNombre}
            onSuccess={() => setSubirState(null)}
          />
        )}
      </Modal>

      {/* Modal: historial de versiones de un documento esperado. */}
      <DocumentoHistorialModal
        open={historialState !== null}
        onClose={() => setHistorialState(null)}
        tipoNombre={historialState?.tipoNombre ?? ''}
        versiones={historialState?.versiones ?? []}
      />
    </div>
  )
}
