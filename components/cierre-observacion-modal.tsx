'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { cerrarObservacion, actualizarCategoriaObservacion } from '@/lib/actions/observacion-gestion'
import { addObservacionComentario, addObservacionFoto, marcarObservacionVista } from '@/lib/actions/observacion-comentarios'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { FotoInput } from '@/components/ui/foto-input'
import { AuditHistorialLink } from '@/components/auditoria/audit-historial-link'
import { PersonaSelectorConAlta } from '@/components/persona-selector-con-alta'
import { Send } from 'lucide-react'
import type { ObservacionGestion, ObservacionComentario, ObservacionFotoCliente } from '@/lib/types'

interface CategoriaObs {
  id: string
  nombre: string
  nivel: number
  color: string
}

interface Props {
  observacion: ObservacionGestion | null
  onClose: () => void
  onSuccess: () => void
  canWrite?: boolean
  /** Scope para PersonaSelectorConAlta: lista personas vinculadas a este establecimiento. */
  establecimientoId?: string
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function formatTime(ts: string) {
  const d = new Date(ts)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return time
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + time
}

export function CierreObservacionModal({ observacion, onClose, onSuccess, canWrite = true, establecimientoId }: Props) {
  const [fechaCierre, setFechaCierre] = useState(todayStr())
  const [responsableCierreId, setResponsableCierreId] = useState<string | null>(null)
  const [evidenciaFile, setEvidenciaFile] = useState<File | null>(null)
  const [evidenciaName, setEvidenciaName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmNoPhoto, setConfirmNoPhoto] = useState(false)

  // Chat
  const [comentarios, setComentarios] = useState<ObservacionComentario[]>([])
  const [authorNames, setAuthorNames] = useState<Map<string, string>>(new Map())
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [addingComentario, setAddingComentario] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [infoMsgId, setInfoMsgId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  // Viewer photos
  const [fotosCliente, setFotosCliente] = useState<ObservacionFotoCliente[]>([])
  const [uploadingFoto, setUploadingFoto] = useState(false)

  // Edición de categoría
  const [categorias, setCategorias] = useState<CategoriaObs[]>([])
  const [editingCategoria, setEditingCategoria] = useState(false)
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [savingCategoria, setSavingCategoria] = useState(false)

  useEffect(() => {
    createClient()
      .from('observaciones_categorias')
      .select('id, nombre, nivel, color')
      .eq('is_active', true)
      .order('nivel')
      .then(({ data }) => setCategorias((data ?? []) as CategoriaObs[]))
  }, [])

  useEffect(() => {
    if (observacion) {
      setCategoriaId(observacion.categoria_id ?? null)
      setEditingCategoria(false)
    }
  }, [observacion])

  async function handleSaveCategoria() {
    if (!observacion || !categoriaId) return
    setSavingCategoria(true)
    setError(null)
    const result = await actualizarCategoriaObservacion(observacion.id, categoriaId)
    setSavingCategoria(false)
    if (result.success) {
      setEditingCategoria(false)
      onSuccess()
    } else {
      setError(result.error ?? 'Error al actualizar categoría')
    }
  }

  useEffect(() => {
    if (observacion) {
      setFechaCierre(observacion.fecha_cierre ?? todayStr())
      setResponsableCierreId(observacion.responsable_cierre_id ?? observacion.responsable_id ?? null)
      setEvidenciaFile(null)
      setEvidenciaName(null)
      setError(null)
      setSuccess(false)
      setNuevoComentario('')
      setInfoMsgId(null)
      setAuthorNames(new Map())

      loadComentarios(observacion.id)
      loadFotosCliente(observacion.id)

      if (!canWrite) {
        marcarObservacionVista(observacion.id).catch(() => { /* ignore */ })
      }
    }
  }, [observacion, canWrite])

  async function loadComentarios(obsId: string) {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('observaciones_comentarios')
        .select('id, observacion_id, autor_id, es_viewer, contenido, created_at')
        .eq('observacion_id', obsId)
        .order('created_at', { ascending: true })

      const comments = (data ?? []) as ObservacionComentario[]
      setComentarios(comments)

      if (comments.length > 0) {
        const authorIds = [...new Set(comments.map(c => c.autor_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', authorIds)
        const nameMap = new Map<string, string>()
        for (const p of (profiles ?? [])) {
          if (p.full_name) nameMap.set(p.id, p.full_name)
        }
        setAuthorNames(nameMap)
      }
    } catch {
      setComentarios([])
    }
  }

  async function loadFotosCliente(obsId: string) {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('observaciones_fotos_cliente')
        .select('id, observacion_id, autor_id, url, categoria, created_at')
        .eq('observacion_id', obsId)
        .order('created_at', { ascending: true })
      setFotosCliente((data ?? []) as ObservacionFotoCliente[])
    } catch {
      setFotosCliente([])
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comentarios])

  // El upload se hace SERVER-SIDE en cerrarObservacion (path tenant-prefijado).
  // Acá solo retenemos el File seleccionado hasta el submit.
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setEvidenciaFile(file)
    setEvidenciaName(file.name)
  }

  async function handleFotoClienteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !observacion) return

    setUploadingFoto(true)
    setError(null)

    // El upload se hace SERVER-SIDE en addObservacionFoto (path tenant-prefijado).
    const result = await addObservacionFoto(observacion.id, file, null)
    if (result.success) {
      await loadFotosCliente(observacion.id)
    } else {
      setError(result.error ?? 'Error al guardar foto')
    }
    setUploadingFoto(false)
  }

  async function executeClose() {
    if (!observacion) return
    setSaving(true)
    setError(null)
    setConfirmNoPhoto(false)
    const result = await cerrarObservacion(
      observacion.id,
      fechaCierre,
      responsableCierreId || null,
      evidenciaFile
    )
    setSaving(false)
    if (result.success) {
      setSuccess(true)
      onSuccess()
      setTimeout(onClose, 800)
    } else {
      setError(result.error ?? 'Error al cerrar observación')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!observacion) return
    if (!evidenciaFile) {
      setConfirmNoPhoto(true)
      return
    }
    await executeClose()
  }

  async function handleEnviarComentario(e: React.FormEvent) {
    e.preventDefault()
    if (!observacion || !nuevoComentario.trim()) return
    setAddingComentario(true)
    const result = await addObservacionComentario(observacion.id, nuevoComentario)
    if (result.success) {
      setNuevoComentario('')
      await loadComentarios(observacion.id)
    } else {
      setError(result.error ?? 'Error al enviar comentario')
    }
    setAddingComentario(false)
  }

  // Bucket privado `documentos`: firmamos todas las fotos/evidencias en el cliente (batch).
  const { getUrl } = useSignedUrls('documentos', [
    observacion?.foto_url,
    observacion?.evidencia_cierre_url,
    ...fotosCliente.map(f => f.url),
  ])

  const obs = observacion
  if (!obs) return null

  const isCerrado = obs.fecha_cierre != null

  return (
    <Modal open={true} onClose={onClose} title={isCerrado ? 'Editar cierre de observación' : 'Observación'} className="max-w-lg">
      <div className="space-y-5">
        {success && (
          <div className="bg-success-bg border border-green-200 text-success text-sm rounded-lg px-4 py-3">
            Observación cerrada correctamente ✓
          </div>
        )}

        {confirmNoPhoto && (
          <div className="bg-warning-bg border border-yellow-300 text-warning text-sm rounded-lg px-4 py-3 space-y-3">
            <p className="font-medium">¿Estás seguro de cerrar esta observación sin evidencia de cierre?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmNoPhoto(false)}
                className="flex-1 text-xs border border-yellow-400 text-warning rounded-lg px-3 py-1.5 font-medium hover:bg-yellow-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeClose}
                className="flex-1 text-xs bg-warning text-white rounded-lg px-3 py-1.5 font-medium hover:opacity-90 transition-opacity"
              >
                Sí, cerrar sin evidencia
              </button>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Observación */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-0.5">
            <p className="text-sm text-text-tertiary">Observación</p>
            <AuditHistorialLink tabla="gestiones_observaciones" id={obs.id} className="shrink-0" />
          </div>
          <p className="text-sm font-medium text-text-primary">{obs.descripcion}</p>
          {obs.foto_url && getUrl(obs.foto_url) && (
            <div className="relative mt-3 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border-subtle">
              <Image src={getUrl(obs.foto_url)!} alt="Foto de la observación" fill sizes="(max-width: 768px) 100vw, 600px" className="object-contain" />
            </div>
          )}
        </div>

        {/* Evidencia de cierre */}
        {obs.evidencia_cierre_url && getUrl(obs.evidencia_cierre_url) && (
          <div>
            <p className="text-xs text-text-tertiary mb-1">Foto de evidencia de cierre</p>
            <div
              className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-border-subtle cursor-pointer hover:opacity-90"
              onClick={() => window.open(getUrl(obs.evidencia_cierre_url!) ?? '#', '_blank')}
            >
              <Image
                src={getUrl(obs.evidencia_cierre_url)!}
                alt="Evidencia de cierre"
                fill
                sizes="(max-width: 768px) 100vw, 600px"
                className="object-contain"
              />
            </div>
          </div>
        )}

        {/* Sector / Puesto */}
        {(obs.establecimientos_sectores || obs.puestos_de_trabajo) && (
          <div className="flex gap-4">
            {obs.establecimientos_sectores && (
              <div>
                <p className="text-xs text-text-tertiary mb-0.5">Sector</p>
                <p className="text-sm text-text-primary">{obs.establecimientos_sectores.nombre}</p>
              </div>
            )}
            {obs.puestos_de_trabajo && (
              <div>
                <p className="text-xs text-text-tertiary mb-0.5">Puesto</p>
                <p className="text-sm text-text-primary">{obs.puestos_de_trabajo.nombre}</p>
              </div>
            )}
          </div>
        )}

        {/* Categoría (badge + edición inline) */}
        <div>
          <p className="text-xs text-text-tertiary mb-1">Categoría</p>
          {!editingCategoria ? (
            <div className="flex items-center gap-2">
              {(() => {
                const cat = categorias.find(c => c.id === categoriaId)
                if (!cat) return <span className="text-sm text-text-tertiary">—</span>
                return (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border border-border-default"
                    style={{ backgroundColor: cat.color, color: '#000' }}
                  >
                    {cat.nombre}
                  </span>
                )
              })()}
              {canWrite && (
                <button
                  type="button"
                  onClick={() => setEditingCategoria(true)}
                  className="text-xs text-brand-primary hover:text-brand-primary/80 font-medium"
                >
                  Cambiar
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2 bg-surface-sunken rounded-lg p-3 border border-border-subtle">
              <div className="grid grid-cols-1 gap-1">
                {categorias.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoriaId(cat.id)}
                    className={`flex items-center gap-2 text-left px-3 py-2 rounded-lg border text-sm ${
                      categoriaId === cat.id ? 'border-brand-primary bg-brand-muted' : 'border-border-default hover:bg-surface-sunken'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded border border-border-default shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span>{cat.nombre}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCategoriaId(observacion?.categoria_id ?? null)
                    setEditingCategoria(false)
                  }}
                  className="text-xs text-text-tertiary hover:text-text-primary px-3 py-1.5"
                >
                  Cancelar
                </button>
                <Button
                  type="button"
                  onClick={handleSaveCategoria}
                  disabled={savingCategoria || !categoriaId || categoriaId === observacion?.categoria_id}
                  className="text-xs"
                >
                  {savingCategoria ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Responsable asignado original */}
        <div>
          <p className="text-xs text-text-tertiary mb-1">Responsable asignado</p>
          {obs.personas_directorio ? (
            <p className="text-sm text-text-primary">
              {obs.personas_directorio.apellido}, {obs.personas_directorio.nombre}
            </p>
          ) : (
            <p className="text-sm text-text-tertiary">—</p>
          )}
        </div>

        {/* Chat thread — estilo WhatsApp */}
        <div className="rounded-xl overflow-hidden border border-border-subtle">
          <div className="px-3 py-2 bg-[#075E54] text-white text-xs font-medium">Conversación</div>

          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto bg-[#efeae2] px-3 py-3">
            {comentarios.length === 0 && (
              <p className="text-xs text-[#667781] text-center py-4">Sin mensajes aún.</p>
            )}
            {comentarios.map(c => {
              const isOwn = c.autor_id === currentUserId
              const name = authorNames.get(c.autor_id) ?? (c.es_viewer ? 'Cliente' : 'Profesional')
              const clienteVio = obs.cliente_visto_at
              const vistoPorCliente = clienteVio != null && c.created_at <= clienteVio
              return (
                <div key={c.id}>
                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[78%] px-3 pt-1.5 pb-1.5 shadow-sm text-sm cursor-pointer
                        ${isOwn
                          ? 'bg-[#d9fdd3] rounded-2xl rounded-tr-sm'
                          : 'bg-surface-base rounded-2xl rounded-tl-sm'
                        }`}
                      onClick={() => setInfoMsgId(prev => prev === c.id ? null : c.id)}
                    >
                      {!isOwn && (
                        <p className="text-[11px] font-semibold text-[#075E54] mb-0.5 leading-tight">{name}</p>
                      )}
                      <p className="text-text-primary leading-snug text-sm">{c.contenido}</p>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <span className="text-[10px] text-[#667781] whitespace-nowrap">{formatTime(c.created_at)}</span>
                        {isOwn && (
                          <span className={`text-[11px] font-bold leading-none ${vistoPorCliente ? 'text-[#53bdeb]' : 'text-[#4fc3f7]'}`}>
                            ✓✓
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {infoMsgId === c.id && (
                    <p className={`text-[10px] text-[#667781] px-2 mt-0.5 ${isOwn ? 'text-right' : 'text-left'}`}>
                      {vistoPorCliente
                        ? `Visto por cliente · ${formatTime(clienteVio!)}`
                        : 'Sin información de lectura'}
                    </p>
                  )}
                </div>
              )
            })}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleEnviarComentario} className="flex items-center gap-2 bg-[#f0f2f5] px-3 py-2">
            <input
              type="text"
              value={nuevoComentario}
              onChange={e => setNuevoComentario(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviarComentario(e) } }}
              placeholder="Escribí un mensaje…"
              maxLength={2000}
              aria-label="Escribir mensaje en conversación"
              className="flex-1 rounded-full bg-surface-base border-0 px-4 py-2 text-sm focus:outline-none shadow-sm"
            />
            <button
              type="submit"
              disabled={addingComentario || !nuevoComentario.trim()}
              aria-label="Enviar mensaje"
              className="w-9 h-9 rounded-full bg-[#075E54] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#128C7E] transition-colors shrink-0"
            >
              <Send size={14} aria-hidden="true" />
            </button>
          </form>
        </div>

        {/* Fotos del cliente */}
        <div>
          <p className="text-xs font-medium text-text-tertiary mb-2">Fotos del cliente</p>
          {fotosCliente.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {fotosCliente.filter(f => getUrl(f.url)).map(f => (
                <div
                  key={f.id}
                  className="relative h-20 w-28 rounded-lg overflow-hidden border border-border-subtle cursor-pointer hover:opacity-90"
                  onClick={() => window.open(getUrl(f.url) ?? '#', '_blank')}
                >
                  <Image
                    src={getUrl(f.url)!}
                    alt={f.categoria ?? 'Foto cliente'}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
          <FotoInput
            size="sm"
            accept=".jpg,.jpeg,.png,.webp"
            disabled={uploadingFoto}
            onChange={handleFotoClienteChange}
          />
          {uploadingFoto && (
            <p className="text-xs text-text-tertiary mt-1">Subiendo…</p>
          )}
        </div>

        {/* Close form — only for professionals */}
        {canWrite && (
          <form onSubmit={handleSubmit} className="space-y-5 border-t border-border-subtle pt-5">
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Cierre de observación</p>

            {/* Fecha de cierre */}
            <div>
              <label htmlFor="cierre-fecha" className="text-sm font-medium text-text-primary block mb-1">
                Fecha de cierre <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="cierre-fecha"
                type="date"
                value={fechaCierre}
                onChange={e => setFechaCierre(e.target.value)}
                required
                aria-required="true"
                className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>

            {/* Responsable de cierre */}
            <PersonaSelectorConAlta
              label="Responsable de cierre"
              value={responsableCierreId}
              onChange={p => setResponsableCierreId(p?.id ?? null)}
              establecimientoId={establecimientoId}
            />

            {/* Evidencia foto */}
            <div>
              <span className="text-sm font-medium text-text-primary block mb-1">
                Foto de evidencia
              </span>
              <FotoInput
                accept=".jpg,.jpeg,.png,.webp"
                disabled={saving}
                onChange={handleFileChange}
              />
              {evidenciaFile && (
                <p className="text-xs text-success mt-1">✓ {evidenciaName}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : isCerrado ? 'Actualizar cierre' : 'Cerrar observación'}
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-text-tertiary hover:text-text-primary px-4"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {!canWrite && (
          <div className="flex justify-end pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-text-tertiary hover:text-text-primary px-4 py-2"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
