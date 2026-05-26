'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cerrarObservacion, actualizarCategoriaObservacion } from '@/lib/actions/observacion-gestion'
import { addObservacionComentario, addObservacionFoto, marcarObservacionVista } from '@/lib/actions/observacion-comentarios'
import { createPersonaDirectorio } from '@/lib/actions/persona-directorio'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import type { ObservacionGestion, ObservacionComentario, ObservacionFotoCliente } from '@/lib/types'

interface Persona {
  id: string
  nombre: string
  apellido: string
  dni: string | null
}

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

export function CierreObservacionModal({ observacion, onClose, onSuccess, canWrite = true }: Props) {
  const [fechaCierre, setFechaCierre] = useState(todayStr())
  const [responsableCierreId, setResponsableCierreId] = useState<string | ''>('')
  const [responsableLabel, setResponsableLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [evidenciaUrl, setEvidenciaUrl] = useState<string | null>(null)
  const [evidenciaName, setEvidenciaName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmNoPhoto, setConfirmNoPhoto] = useState(false)

  // Persona combobox
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Persona[]>([])
  const [searching, setSearching] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const [showNewPersona, setShowNewPersona] = useState(false)
  const [newNombre, setNewNombre] = useState('')
  const [newApellido, setNewApellido] = useState('')
  const [newDni, setNewDni] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
      const defaultRespId = observacion.responsable_cierre_id ?? observacion.responsable_id ?? ''
      setResponsableCierreId(defaultRespId)
      setResponsableLabel(defaultRespId && observacion.personas_directorio
        ? `${observacion.personas_directorio.apellido}, ${observacion.personas_directorio.nombre}`
        : '')
      setEvidenciaUrl(null)
      setEvidenciaName(null)
      setError(null)
      setSuccess(false)
      setSearchQuery('')
      setDropOpen(false)
      setShowNewPersona(false)
      setSearchResults([])
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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function searchPersonas(q: string) {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!q.trim()) {
      setSearchResults([])
      setDropOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const supabase = createClient()
      const pattern = `%${q.trim()}%`
      const { data } = await supabase
        .from('personas_directorio')
        .select('id, nombre, apellido, dni')
        .eq('is_active', true)
        .or(`apellido.ilike.${pattern},nombre.ilike.${pattern},dni.ilike.${pattern}`)
        .order('apellido')
        .limit(20)

      setSearchResults((data ?? []) as Persona[])
      setSearching(false)
      setDropOpen(true)
    }, 300)
  }

  function selectPersona(p: Persona) {
    setResponsableCierreId(p.id)
    setResponsableLabel(`${p.apellido}, ${p.nombre}`)
    setSearchQuery('')
    setSearchResults([])
    setDropOpen(false)
  }

  function clearResponsable() {
    setResponsableCierreId('')
    setResponsableLabel('')
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const supabase = createClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `evidencias/${Date.now()}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (uploadError) {
      setError('No se pudo subir la imagen. Verificá que el bucket exista.')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path)
    setEvidenciaUrl(publicUrl)
    setEvidenciaName(file.name)
    setUploading(false)
  }

  async function handleFotoClienteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !observacion) return

    setUploadingFoto(true)
    const supabase = createClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `observaciones-cliente/${Date.now()}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (uploadError) {
      setError('No se pudo subir la foto.')
      setUploadingFoto(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path)
    const result = await addObservacionFoto(observacion.id, publicUrl, null)
    if (result.success) {
      await loadFotosCliente(observacion.id)
    } else {
      setError(result.error ?? 'Error al guardar foto')
    }
    setUploadingFoto(false)
  }

  async function createPersona(e: React.FormEvent) {
    e.preventDefault()
    if (!newNombre.trim() || !newApellido.trim()) return

    const fd = new FormData()
    fd.set('nombre', newNombre.trim())
    fd.set('apellido', newApellido.trim())
    fd.set('dni', newDni.trim())

    const result = await createPersonaDirectorio(null, fd)
    if (result.success && result.data) {
      setResponsableCierreId(result.data.id)
      setResponsableLabel(`${newApellido.trim()}, ${newNombre.trim()}`)
      setShowNewPersona(false)
      setNewNombre('')
      setNewApellido('')
      setNewDni('')
    } else if (!result.success) {
      setError(result.error)
    }
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
      evidenciaUrl
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
    if (!evidenciaUrl) {
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
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Observación */}
        <div>
          <p className="text-sm text-text-tertiary mb-0.5">Observación</p>
          <p className="text-sm font-medium text-text-primary">{obs.descripcion}</p>
          {obs.foto_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={obs.foto_url} alt="Foto de la observación" className="mt-3 max-w-full rounded-xl border border-border-subtle object-contain" />
          )}
        </div>

        {/* Evidencia de cierre */}
        {obs.evidencia_cierre_url && (
          <div>
            <p className="text-xs text-text-tertiary mb-1">Foto de evidencia de cierre</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={obs.evidencia_cierre_url}
              alt="Evidencia de cierre"
              className="max-w-full rounded-xl border border-border-subtle object-contain cursor-pointer hover:opacity-90"
              onClick={() => window.open(obs.evidencia_cierre_url!, '_blank')}
            />
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
              className="flex-1 rounded-full bg-surface-base border-0 px-4 py-2 text-sm focus:outline-none shadow-sm"
            />
            <button
              type="submit"
              disabled={addingComentario || !nuevoComentario.trim()}
              className="w-9 h-9 rounded-full bg-[#075E54] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#128C7E] transition-colors shrink-0"
            >
              <Send size={14} />
            </button>
          </form>
        </div>

        {/* Fotos del cliente */}
        <div>
          <p className="text-xs font-medium text-text-tertiary mb-2">Fotos del cliente</p>
          {fotosCliente.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {fotosCliente.map(f => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={f.id}
                  src={f.url}
                  alt={f.categoria ?? 'Foto cliente'}
                  className="h-20 w-auto rounded-lg border border-border-subtle object-cover cursor-pointer hover:opacity-90"
                  onClick={() => window.open(f.url, '_blank')}
                />
              ))}
            </div>
          )}
          <label className="inline-block cursor-pointer">
            <span className="text-xs text-brand-primary hover:text-brand-primary/80 font-medium">
              {uploadingFoto ? 'Subiendo…' : '+ Agregar foto'}
            </span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={handleFotoClienteChange}
              disabled={uploadingFoto}
              className="hidden"
            />
          </label>
        </div>

        {/* Close form — only for professionals */}
        {canWrite && (
          <form onSubmit={handleSubmit} className="space-y-5 border-t border-border-subtle pt-5">
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Cierre de observación</p>

            {/* Fecha de cierre */}
            <div>
              <label className="text-sm font-medium text-text-primary block mb-1">
                Fecha de cierre <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                value={fechaCierre}
                onChange={e => setFechaCierre(e.target.value)}
                required
                className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>

            {/* Responsable de cierre — combobox con búsqueda */}
            <div>
              <label className="text-sm font-medium text-text-primary block mb-1">
                Responsable de cierre
              </label>

              {responsableCierreId && !showNewPersona ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-text-primary bg-surface-sunken rounded-lg px-3 py-2 border border-border-subtle">
                    {responsableLabel}
                  </span>
                  <button type="button" onClick={clearResponsable} className="text-xs text-text-tertiary hover:text-text-primary shrink-0">
                    Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={() => { clearResponsable(); setShowNewPersona(true) }}
                    className="text-xs text-brand-primary hover:text-brand-primary/80 font-medium shrink-0"
                  >
                    + Nueva
                  </button>
                </div>
              ) : showNewPersona ? (
                <div className="space-y-2 bg-surface-sunken rounded-lg p-3 border border-border-subtle">
                  <input
                    value={newNombre}
                    onChange={e => setNewNombre(e.target.value)}
                    placeholder="Nombre *"
                    className="w-full border border-border-default rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                  <input
                    value={newApellido}
                    onChange={e => setNewApellido(e.target.value)}
                    placeholder="Apellido *"
                    className="w-full border border-border-default rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                  <input
                    value={newDni}
                    onChange={e => setNewDni(e.target.value)}
                    placeholder="DNI (opcional)"
                    className="w-full border border-border-default rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                  <div className="flex gap-2">
                    <Button type="button" onClick={createPersona} className="text-xs">
                      Crear persona
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setShowNewPersona(false); if (responsableCierreId) setSearchQuery('') }}
                      className="text-xs text-text-tertiary hover:text-text-primary"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative" ref={searchRef}>
                  <div className="flex gap-2">
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={e => searchPersonas(e.target.value)}
                      onFocus={() => { if (searchResults.length > 0) setDropOpen(true) }}
                      placeholder="Buscá por apellido, nombre o DNI…"
                      className="flex-1 border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPersona(true)}
                      className="text-xs text-brand-primary hover:text-brand-primary/80 font-medium shrink-0"
                    >
                      + Nueva
                    </button>
                  </div>

                  {searching && (
                    <p className="text-xs text-text-tertiary mt-1">Buscando...</p>
                  )}

                  {dropOpen && searchResults.length === 0 && searchQuery.trim() && !searching && (
                    <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-surface-base border border-border-default rounded-xl shadow-xl overflow-hidden">
                      <div className="px-3 py-3 text-xs text-text-tertiary text-center">
                        Sin resultados.
                      </div>
                    </div>
                  )}

                  {dropOpen && searchResults.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-surface-base border border-border-default rounded-xl shadow-xl overflow-hidden">
                      {searchResults.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectPersona(p)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-text-primary hover:bg-surface-sunken transition-colors"
                        >
                          <span>{p.apellido}, {p.nombre}</span>
                          {p.dni && (
                            <span className="text-text-tertiary text-xs ml-auto">DNI: {p.dni}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Evidencia foto */}
            <div>
              <label className="text-sm font-medium text-text-primary block mb-1">
                Foto de evidencia
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                disabled={uploading}
                className="w-full text-sm text-text-tertiary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-muted file:text-brand-primary hover:file:bg-brand-muted/80 cursor-pointer"
              />
              {uploading && <p className="text-xs text-brand-primary mt-1">Subiendo imagen...</p>}
              {evidenciaUrl && !uploading && (
                <p className="text-xs text-success mt-1">✓ {evidenciaName}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving || uploading}>
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
