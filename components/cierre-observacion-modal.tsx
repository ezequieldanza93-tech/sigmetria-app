'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cerrarObservacion } from '@/lib/actions/observacion-gestion'
import { createPersonaDirectorio } from '@/lib/actions/persona-directorio'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import type { ObservacionGestion } from '@/lib/types'

interface Persona {
  id: string
  nombre: string
  apellido: string
  dni: string | null
}

interface Props {
  observacion: ObservacionGestion | null
  onClose: () => void
  onSuccess: () => void
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function CierreObservacionModal({ observacion, onClose, onSuccess }: Props) {
  const [fechaCierre, setFechaCierre] = useState(todayStr())
  const [responsableCierreId, setResponsableCierreId] = useState<string | ''>('')
  const [responsableLabel, setResponsableLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [evidenciaUrl, setEvidenciaUrl] = useState<string | null>(null)
  const [evidenciaName, setEvidenciaName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
    }
  }, [observacion])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!observacion) return

    setSaving(true)
    setError(null)

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

  const obs = observacion
  if (!obs) return null

  const isCerrado = obs.fecha_cierre != null

  return (
    <Modal open={true} onClose={onClose} title={isCerrado ? 'Editar cierre de observación' : 'Cerrar observación'} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
            Observación cerrada correctamente ✓
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Observación */}
        <div>
          <p className="text-sm text-text-tertiary mb-0.5">Observación</p>
          <p className="text-sm font-medium text-text-primary">{obs.descripcion}</p>
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

        {/* Fecha de cierre */}
        <div>
          <label className="text-sm font-medium text-text-primary block mb-1">
            Fecha de cierre <span className="text-red-500">*</span>
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
                <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-border-default rounded-xl shadow-xl overflow-hidden">
                  <div className="px-3 py-3 text-xs text-text-tertiary text-center">
                    Sin resultados.
                  </div>
                </div>
              )}

              {dropOpen && searchResults.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-border-default rounded-xl shadow-xl overflow-hidden">
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
            <p className="text-xs text-green-600 mt-1">✓ {evidenciaName}</p>
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
    </Modal>
  )
}
