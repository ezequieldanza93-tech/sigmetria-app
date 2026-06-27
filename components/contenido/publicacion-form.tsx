'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
import { Select } from '@/components/ui/select'
import { MultiMediaUpload, type MediaFormSlot } from '@/components/contenido/multi-media-upload'
import { createPublicacion, updatePublicacion } from '@/lib/actions/contenido'
import { pulirObservacion } from '@/lib/actions/pulir-observacion'
import { toast } from '@/lib/hooks/use-toast'
import type { ContenidoCatalogos, ContenidoPublicacionFull } from '@/lib/contenido/types'

interface PublicacionFormProps {
  open: boolean
  onClose: () => void
  catalogos: ContenidoCatalogos
  editing: ContenidoPublicacionFull | null
  getUrl: (pathOrUrl: string | null | undefined) => string | null
  onSaved: () => void
}

/** Convierte un timestamptz ISO a el formato de <input type="datetime-local">. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function PublicacionForm({ open, onClose, catalogos, editing, getUrl, onSaved }: PublicacionFormProps) {
  const { canales, formatos, estados } = catalogos

  const initialCanalId = editing?.formato.canal_id ?? canales[0]?.id ?? 0
  const [canalId, setCanalId] = useState<number>(initialCanalId)
  const [formatoId, setFormatoId] = useState<number>(
    editing?.formato_id ?? formatos.find((f) => f.canal_id === initialCanalId)?.id ?? 0,
  )
  const [estadoId, setEstadoId] = useState<number>(editing?.estado_id ?? estados[0]?.id ?? 0)
  const [titulo, setTitulo] = useState(editing?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(editing?.descripcion ?? '')
  const [fecha, setFecha] = useState(toLocalInput(editing?.fecha_programada ?? null))
  const [hashtags, setHashtags] = useState(editing ? editing.hashtags.map((h) => `#${h.texto}`).join(' ') : '')
  const [slots, setSlots] = useState<MediaFormSlot[]>(
    editing
      ? editing.media
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((m) => ({
            kind: 'existing' as const,
            id: m.id,
            url: getUrl(m.storage_path),
            tipoMedia: m.mime?.startsWith('video/') ? ('video' as const) : ('imagen' as const),
          }))
      : [],
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleCerrarConConfirmacion() {
    if (pending) return
    // Si no hay cambios significativos, cerrar sin preguntar.
    const hayCambios = titulo || descripcion || hashtags || fecha || slots.length > 0
    if (!hayCambios && !editing) {
      onClose()
      return
    }
    if (!window.confirm('Si cerrás ahora se pierden los cambios sin guardar. ¿Querés continuar?')) return
    onClose()
  }

  const formatosDelCanal = useMemo(
    () => formatos.filter((f) => f.canal_id === canalId),
    [formatos, canalId],
  )

  function handleCanalChange(value: string) {
    const nuevoCanal = Number(value)
    setCanalId(nuevoCanal)
    // Al cambiar de canal, el formato actual ya no aplica → primer formato del canal.
    const primero = formatos.find((f) => f.canal_id === nuevoCanal)
    setFormatoId(primero?.id ?? 0)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)

    const fd = new FormData()
    fd.set('titulo', titulo)
    fd.set('descripcion', descripcion)
    fd.set('formato_id', String(formatoId))
    fd.set('estado_id', String(estadoId))
    fd.set('fecha_programada', fecha)
    fd.set('hashtags', hashtags)

    // El orden visual ES el orden final. Adjuntamos los File nuevos y describimos
    // el orden con referencias (existing por id, new por fileIndex).
    const orden: ({ type: 'existing'; id: string } | { type: 'new'; fileIndex: number })[] = []
    let fileIndex = 0
    for (const slot of slots) {
      if (slot.kind === 'existing') {
        orden.push({ type: 'existing', id: slot.id })
      } else {
        orden.push({ type: 'new', fileIndex })
        fd.append('media', slot.file)
        fileIndex++
      }
    }
    fd.set('orden', JSON.stringify(orden))

    const result = editing
      ? await updatePublicacion(editing.id, null, fd)
      : await createPublicacion(null, fd)

    setPending(false)

    if (result.success) {
      toast.success(editing ? 'Publicación actualizada' : 'Publicación creada')
      onSaved()
      onClose()
    } else {
      setError(result.error)
    }
  }

  return (
    <Modal open={open} onClose={handleCerrarConConfirmacion} dismissable={false} title={editing ? 'Editar publicación' : 'Nueva publicación'} size="full">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Canal"
            required
            value={String(canalId)}
            onChange={(e) => handleCanalChange(e.target.value)}
            options={canales.map((c) => ({ value: String(c.id), label: c.nombre }))}
          />
          <Select
            label="Formato"
            required
            value={String(formatoId)}
            onChange={(e) => setFormatoId(Number(e.target.value))}
            options={formatosDelCanal.map((f) => ({
              value: String(f.id),
              label: f.relacion_aspecto ? `${f.nombre} (${f.relacion_aspecto})` : f.nombre,
            }))}
          />
          <Select
            label="Estado"
            required
            value={String(estadoId)}
            onChange={(e) => setEstadoId(Number(e.target.value))}
            options={estados.map((s) => ({ value: String(s.id), label: s.nombre }))}
          />
        </div>

        <Input
          label="Título"
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título interno de la publicación"
        />

        <VoiceTextarea
          label="Descripción / copy"
          value={descripcion}
          onValueChange={setDescripcion}
          rows={10}
          className="w-full"
          pulirAction={pulirObservacion}
          placeholder="El texto que va a acompañar la publicación…"
        />

        <Input
          label="Hashtags"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          placeholder="#seguridad #higiene #trabajo"
        />

        <Input
          label="Fecha programada"
          type="datetime-local"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />

        <MultiMediaUpload slots={slots} onChange={setSlots} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 size={16} className="animate-spin" />}
            {editing ? 'Guardar cambios' : 'Crear publicación'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
