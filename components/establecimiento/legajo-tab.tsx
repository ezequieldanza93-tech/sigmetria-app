'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { Modal } from '@/components/ui/modal'
import { DocumentoForm } from '@/components/forms/documento-form'
import { DocumentoHistorialModal } from '@/components/establecimiento/documento-historial-modal'
import { ProtocolosVencimientos } from '@/components/establecimiento/protocolos-vencimientos'
import { createDocumento } from '@/lib/actions/documento'
import { createTrabajadorDocumento } from '@/lib/actions/trabajador-documento'
import {
  setDocumentoOverride,
  getDocumentoOverrides,
  createDocumentoCustom,
  confirmarLegajo,
  getLegajoRevision,
  getCatalogoGlobal,
  type LegajoRevision,
  type CatalogoGlobalItem,
} from '@/lib/actions/establecimiento-ficha'
import type { PeriodicidadDoc } from '@/lib/types'
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

// Form para crear un documento PROPIO de la consultora (custom) desde el legajo.
function AgregarDocForm({ empresaId, onDone }: { empresaId: string; onDone: () => void }) {
  const [nombre, setNombre] = useState('')
  const [nivel, setNivel] = useState<'empresa' | 'establecimiento' | 'persona'>('establecimiento')
  const [periodicidad, setPeriodicidad] = useState<PeriodicidadDoc | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!nombre.trim()) { setError('Poné un nombre'); return }
    setSaving(true)
    const res = await createDocumentoCustom(empresaId, { nombre, nivel, periodicidad: periodicidad || null })
    setSaving(false)
    if (!res.success) { setError(res.error); return }
    onDone()
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary'
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Nombre del documento</label>
        <input className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Certificado interno de capacitación" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Nivel</label>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {([['empresa', 'Empresa'], ['establecimiento', 'Establecimiento'], ['persona', 'Persona']] as const).map(([v, l]) => (
            <label key={v} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="radio" name="nivel-custom" checked={nivel === v} onChange={() => setNivel(v)} className="accent-brand-primary" />
              <span className="text-sm text-text-primary">{l}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Renovación</label>
        <select className={inputCls} value={periodicidad} onChange={e => setPeriodicidad(e.target.value as PeriodicidadDoc | '')}>
          <option value="">Sin vencimiento</option>
          <option value="mensual">Mensual</option>
          <option value="semestral">Semestral</option>
          <option value="anual">Anual</option>
        </select>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={submit} disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50">
          {saving ? 'Agregando…' : 'Agregar al catálogo de la consultora'}
        </button>
      </div>
    </div>
  )
}

// Label de cada categoría para agrupar en el picker del catálogo global.
const CATEGORIA_LABEL: Record<CategoriaLegajo, string> = CATEGORIAS_LEGAJO.reduce(
  (acc, { key, titulo }) => { acc[key] = titulo; return acc },
  {} as Record<CategoriaLegajo, string>,
)

// Picker "Elegir del catálogo global" (B2 · force-in). Lista TODOS los docs
// activos del catálogo (genéricos + propios de la consultora) agrupados por
// categoría, marcando los que ya están en el legajo. Force-in con override.
function CatalogoGlobalPicker({
  establecimientoId,
  empresaId,
  onChanged,
}: {
  establecimientoId: string
  empresaId: string
  onChanged: () => void
}) {
  const [items, setItems] = useState<CatalogoGlobalItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const reload = useCallback(() => {
    setError(null)
    getCatalogoGlobal(establecimientoId, empresaId)
      .then(setItems)
      .catch(() => setError('No se pudo cargar el catálogo'))
  }, [establecimientoId, empresaId])
  useEffect(() => { reload() }, [reload])

  const agregar = async (tipoId: string) => {
    setSavingId(tipoId)
    const res = await setDocumentoOverride(establecimientoId, tipoId, true)
    setSavingId(null)
    if (!res.success) { setError(res.error); return }
    // Optimista: marcar como incluido y avisar al padre para refrescar el legajo.
    setItems(prev => prev?.map(it => it.tipo_id === tipoId ? { ...it, ya_incluido: true } : it) ?? prev)
    onChanged()
  }

  if (error && !items) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">{error}</p>
        <button type="button" onClick={reload} className="text-xs font-medium text-sig-600 hover:underline">Reintentar</button>
      </div>
    )
  }
  if (!items) {
    return <p className="text-sm text-text-tertiary py-6 text-center">Cargando catálogo…</p>
  }

  const q = busca.trim().toLowerCase()
  const filtrados = q ? items.filter(it => it.nombre.toLowerCase().includes(q)) : items

  // Agrupar por categoría, respetando el orden de CATEGORIAS_LEGAJO.
  const porCategoria = new Map<CategoriaLegajo, CatalogoGlobalItem[]>()
  for (const it of filtrados) {
    const arr = porCategoria.get(it.categoria) ?? []
    arr.push(it)
    porCategoria.set(it.categoria, arr)
  }
  const categoriasOrdenadas = CATEGORIAS_LEGAJO
    .map(c => c.key)
    .filter(k => porCategoria.has(k))

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-secondary">
        Elegí un documento del catálogo para incluirlo en el legajo de este establecimiento,
        aunque las reglas automáticas no lo incluyan. Después lo podés quitar cuando quieras.
      </p>
      <input
        type="search"
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder="Buscar documento…"
        className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      {filtrados.length === 0 ? (
        <p className="text-sm text-text-tertiary py-6 text-center">No hay documentos que coincidan.</p>
      ) : (
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {categoriasOrdenadas.map(cat => (
            <div key={cat}>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                {CATEGORIA_LABEL[cat]}
              </p>
              <ul className="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden">
                {porCategoria.get(cat)!.map(it => (
                  <li key={it.tipo_id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-surface-base">
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">{it.nombre}</p>
                      <p className="text-xs text-text-tertiary">{periodicidadLabel(it.periodicidad)}</p>
                    </div>
                    {it.ya_incluido ? (
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                        En el legajo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => agregar(it.tipo_id)}
                        disabled={savingId === it.tipo_id}
                        className="shrink-0 text-xs font-medium text-sig-600 hover:text-sig-700 hover:underline disabled:opacity-50"
                      >
                        {savingId === it.tipo_id ? 'Agregando…' : '+ Agregar'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
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
  const [agregarOpen, setAgregarOpen] = useState(false)
  // Solapa activa del modal "Agregar documento": catálogo global (default) o crear propio.
  const [agregarTab, setAgregarTab] = useState<'catalogo' | 'propio'>('catalogo')

  // F2: estado de revisión del legajo (sello de cadena de custodia).
  const [revision, setRevision] = useState<LegajoRevision | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const reloadRevision = useCallback(() => {
    getLegajoRevision(establecimientoId).then(setRevision).catch(() => {})
  }, [establecimientoId])
  useEffect(() => { reloadRevision() }, [reloadRevision])

  const confirmar = async () => {
    setConfirmando(true)
    const res = await confirmarLegajo(establecimientoId)
    setConfirmando(false)
    if (res.success) {
      setRevision({ revisado_at: res.data.revisado_at, revisado_by: null, revisor_nombre: res.data.revisor_nombre })
    }
  }

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

  // Formato corto de fecha+hora para el sello de revisión.
  const fechaHora = (iso: string): string => {
    const d = new Date(iso)
    return `${formatDate(iso)} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
  }
  const estaRevisado = Boolean(revision?.revisado_at)

  return (
    <div className="space-y-4">
      {/* F2 · Sello de revisión del legajo (cadena de custodia, Disp. 15/2026). */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface-base dark:bg-surface-elevated border border-border-subtle rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {estaRevisado ? (
            <>
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                Legajo revisado
              </span>
              <span className="text-xs text-text-secondary truncate">
                {revision?.revisor_nombre ? `por ${revision.revisor_nombre} · ` : ''}
                {revision?.revisado_at ? fechaHora(revision.revisado_at) : ''}
              </span>
            </>
          ) : (
            <>
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                Revisión pendiente
              </span>
              <span className="text-xs text-text-tertiary truncate">
                Confirmá el legajo cuando hayas revisado los documentos esperados.
              </span>
            </>
          )}
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={confirmar}
            disabled={confirmando}
            className="shrink-0 self-start sm:self-auto px-3 py-1.5 text-xs font-medium bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50"
          >
            {confirmando ? 'Confirmando…' : estaRevisado ? 'Volver a confirmar' : 'Confirmar legajo'}
          </button>
        )}
      </div>

      {canWrite && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setAgregarTab('catalogo'); setAgregarOpen(true) }}
            className="text-xs font-medium text-sig-600 hover:text-sig-700 hover:underline"
          >
            + Agregar documento al legajo
          </button>
        </div>
      )}
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

      {/* Protocolos de medición (ruido, iluminación, etc.) con su vencimiento anual. */}
      <ProtocolosVencimientos establecimientoId={establecimientoId} />

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

      {/* Modal: agregar un documento al legajo — del catálogo global (force-in)
          o creando uno propio de la consultora. */}
      <Modal
        open={agregarOpen}
        onClose={() => setAgregarOpen(false)}
        title="Agregar documento al legajo"
        size="wide"
      >
        {agregarOpen && (
        <div className="space-y-4">
          {/* Solapas */}
          <div role="tablist" aria-label="Modo de agregar documento" className="flex gap-1 border-b border-border-subtle">
            {([['catalogo', 'Elegir del catálogo global'], ['propio', 'Crear documento propio']] as const).map(([id, label]) => {
              const active = agregarTab === id
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setAgregarTab(id)}
                  className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                    active
                      ? 'border-brand-primary text-brand-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {agregarTab === 'catalogo' ? (
            <CatalogoGlobalPicker
              establecimientoId={establecimientoId}
              empresaId={empresaId}
              onChanged={() => { reloadOverrides(); router.refresh() }}
            />
          ) : (
            <AgregarDocForm
              empresaId={empresaId}
              onDone={() => { setAgregarOpen(false); router.refresh() }}
            />
          )}
        </div>
        )}
      </Modal>
    </div>
  )
}
