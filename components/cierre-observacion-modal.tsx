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
  const [uploading, setUploading] = useState(false)
  const [evidenciaUrl, setEvidenciaUrl] = useState<string | null>(null)
  const [evidenciaName, setEvidenciaName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Persona search
  const [personas, setPersonas] = useState<Persona[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewPersona, setShowNewPersona] = useState(false)
  const [newNombre, setNewNombre] = useState('')
  const [newApellido, setNewApellido] = useState('')
  const [newDni, setNewDni] = useState('')

  useEffect(() => {
    if (observacion) {
      setFechaCierre(observacion.fecha_cierre ?? todayStr())
      setResponsableCierreId(observacion.responsable_cierre_id ?? '')
      setEvidenciaUrl(null)
      setEvidenciaName(null)
      setError(null)
      setSuccess(false)
      setSearchQuery('')
      setShowNewPersona(false)
    }
  }, [observacion])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('personas_directorio')
      .select('id, nombre, apellido, dni')
      .eq('is_active', true)
      .order('apellido')
      .then(({ data }) => setPersonas((data ?? []) as Persona[]))
  }, [])

  const filteredPersonas = personas.filter(p => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      p.apellido?.toLowerCase().includes(q) ||
      p.nombre?.toLowerCase().includes(q) ||
      p.dni?.includes(q)
    )
  })

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
      const newPersona: Persona = {
        id: result.data.id,
        nombre: newNombre.trim(),
        apellido: newApellido.trim(),
        dni: newDni.trim() || null,
      }
      setPersonas(prev => [...prev, newPersona].sort((a, b) => a.apellido.localeCompare(b.apellido)))
      setResponsableCierreId(result.data.id)
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

        {/* Responsable de cierre */}
        <div>
          <label className="text-sm font-medium text-text-primary block mb-1">
            Responsable de cierre
          </label>

          {showNewPersona ? (
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
                  onClick={() => setShowNewPersona(false)}
                  className="text-xs text-text-tertiary hover:text-text-primary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar persona por apellido, nombre o DNI…"
                  className="flex-1 border border-border-default rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPersona(true)}
                  className="text-xs text-brand-primary hover:text-brand-primary/80 font-medium shrink-0"
                >
                  + Nueva
                </button>
              </div>

              {filteredPersonas.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-border-default rounded-lg divide-y divide-border-subtle">
                  {filteredPersonas.map(p => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-sunken transition-colors ${
                        responsableCierreId === p.id ? 'bg-brand-muted/30' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="responsable_cierre"
                        value={p.id}
                        checked={responsableCierreId === p.id}
                        onChange={() => setResponsableCierreId(p.id)}
                        className="text-brand-primary focus:ring-brand-primary/30"
                      />
                      <span className="text-text-primary">
                        {p.apellido}, {p.nombre}
                      </span>
                      {p.dni && (
                        <span className="text-text-tertiary text-xs ml-auto">DNI: {p.dni}</span>
                      )}
                    </label>
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
