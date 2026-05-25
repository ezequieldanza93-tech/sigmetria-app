'use client'

import { useState, useRef, useActionState, useEffect } from 'react'
import { crearReporteFotografico } from '@/lib/actions/reporte-fotografico'
import { PhotoCanvasEditor } from '@/components/photo-canvas-editor'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Camera } from 'lucide-react'

interface ReporteFotograficoModalProps {
  establecimientoId: string
  onClose: () => void
  onSuccess: () => void
}

interface ObsDraft {
  key: number
  descripcion: string
  clasificacion_id: string
  responsable_id: string
  fecha_subsanacion: string
  foto_preview: string | null
  foto_blob: Blob | null
  foto_editing: boolean
}

export function ReporteFotograficoModal({ establecimientoId, onClose, onSuccess }: ReporteFotograficoModalProps) {
  const [state, formAction, pending] = useActionState(crearReporteFotografico, null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null)
  const [comentario, setComentario] = useState('')
  const [observaciones, setObservaciones] = useState<ObsDraft[]>([])
  const [personas, setPersonas] = useState<{ id: string; nombre: string; apellido: string }[]>([])
  const [clasificaciones, setClasificaciones] = useState<{ id: string; nombre: string }[]>([])
  const obsKeyRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => {
    if (state?.success) onSuccessRef.current()
  }, [state])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('personas_establecimientos')
      .select('personas_directorio!persona_id(id, nombre, apellido)')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ps = ((data ?? []) as any[])
          .map(pe => pe.personas_directorio)
          .filter(Boolean)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => a.apellido.localeCompare(b.apellido))
        setPersonas(ps)
      })
    supabase
      .from('observaciones_clasificaciones')
      .select('id, nombre')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setClasificaciones((data ?? []) as { id: string; nombre: string }[]))
  }, [establecimientoId])

  function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const url = URL.createObjectURL(file)
    setImagePreviewUrl(url)
    setEditedBlob(null)
  }

  function handleEditedBlobChange(blob: Blob) {
    setEditedBlob(blob)
  }

  function addObs() {
    setObservaciones(prev => [...prev, {
      key: obsKeyRef.current++,
      descripcion: '',
      clasificacion_id: '',
      responsable_id: '',
      fecha_subsanacion: '',
      foto_preview: null,
      foto_blob: null,
      foto_editing: false,
    }])
  }

  function updateObsFoto(key: number, preview: string | null, blob: Blob | null, editing?: boolean) {
    setObservaciones(prev => prev.map(o =>
      o.key === key ? { ...o, foto_preview: preview, foto_blob: blob, foto_editing: editing ?? o.foto_editing } : o
    ))
  }

  function removeObs(key: number) {
    setObservaciones(prev => prev.filter(o => o.key !== key))
  }

  function updateObs(key: number, field: keyof Omit<ObsDraft, 'key'>, value: string) {
    setObservaciones(prev => prev.map(o => o.key === key ? { ...o, [field]: value } : o))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('establecimiento_id', establecimientoId)
    fd.set('comentario', comentario)

    const finalBlob = editedBlob || (imageFile ? await new Promise<Blob | null>(resolve => {
      if (!imageFile) { resolve(null); return }
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0)
          canvas.toBlob(b => resolve(b), 'image/png')
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(imageFile)
    }) : null)

    if (finalBlob) {
      const finalFile = new File([finalBlob], `reporte-${Date.now()}.png`, { type: 'image/png' })
      fd.set('imagen', finalFile)
    }

    const validObs = observaciones.filter(o => o.descripcion.trim())
    if (validObs.length > 0) {
      const supabase = createClient()
      const obsConFotos = await Promise.all(validObs.map(async o => {
        let foto_url: string | null = null
        if (o.foto_blob) {
          const file = new File([o.foto_blob], `obs-foto-${Date.now()}-${o.key}.png`, { type: 'image/png' })
          const path = `observaciones-fotos/${establecimientoId}/${file.name}`
          const { data: up } = await supabase.storage.from('documentos').upload(path, file, { upsert: false })
          if (up) foto_url = supabase.storage.from('documentos').getPublicUrl(up.path).data.publicUrl
        }
        return { descripcion: o.descripcion, clasificacion_id: o.clasificacion_id, responsable_id: o.responsable_id, fecha_subsanacion: o.fecha_subsanacion, foto_url }
      }))
      fd.set('observaciones', JSON.stringify(obsConFotos))
    }

    formAction(fd)
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500'

  const today = new Date().toISOString().split('T')[0]

  return (
    <Modal open title="Reporte Fotográfico" onClose={onClose} size="full">
      <form onSubmit={handleSubmit} className="space-y-4">
        {state && !state.success && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {state.error}
          </div>
        )}

        <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
          Reportes Fotográficos del Sitio · <span className="text-gray-400">Fecha: {today}</span>
        </div>

        {/* Image upload */}
        {!imagePreviewUrl ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-sig-400 hover:bg-sig-50/30 transition-colors"
          >
            <Camera size={40} strokeWidth={1.5} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">Hacé clic para seleccionar una imagen</p>
            <p className="text-xs text-gray-400 mt-1">O usá la cámara si estás en el celular</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelected}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Imagen seleccionada</span>
              <button
                type="button"
                onClick={() => { setImagePreviewUrl(null); setImageFile(null); setEditedBlob(null) }}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Eliminar imagen
              </button>
            </div>
            <PhotoCanvasEditor imageUrl={imagePreviewUrl} onImageChange={handleEditedBlobChange} />
          </div>
        )}

        {/* Comentario */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Comentario</label>
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={2}
            placeholder="Agregá un comentario opcional…"
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Observaciones */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Observaciones
              {observaciones.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">({observaciones.length})</span>
              )}
            </h3>
            <button
              type="button"
              onClick={addObs}
              className="text-xs text-sig-600 hover:text-sig-700 font-medium flex items-center gap-1"
            >
              + Agregar
            </button>
          </div>
          {observaciones.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg">
              Sin observaciones. Hacé clic en &quot;+ Agregar&quot; para registrar una.
            </p>
          ) : (
            <div className="space-y-2">
              {observaciones.map((obs, idx) => (
                <div key={obs.key} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 mt-2 w-4 shrink-0">{idx + 1}.</span>
                    <textarea
                      value={obs.descripcion}
                      onChange={e => updateObs(obs.key, 'descripcion', e.target.value)}
                      placeholder="Descripción de la observación…"
                      rows={2}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeObs(obs.key)}
                      className="text-gray-300 hover:text-red-400 mt-1 text-base leading-none shrink-0"
                      title="Eliminar observación"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pl-6">
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">Tipo de riesgo</label>
                      <select
                        value={obs.clasificacion_id}
                        onChange={e => updateObs(obs.key, 'clasificacion_id', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
                      >
                        <option value="">Sin clasificar</option>
                        {clasificaciones.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">Responsable</label>
                      <select
                        value={obs.responsable_id}
                        onChange={e => updateObs(obs.key, 'responsable_id', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
                      >
                        <option value="">Sin asignar</option>
                        {personas.map(p => (
                          <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">Fecha subsanación</label>
                      <input
                        type="date"
                        value={obs.fecha_subsanacion}
                        onChange={e => updateObs(obs.key, 'fecha_subsanacion', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sig-500"
                      />
                    </div>
                  </div>

                  {/* Foto de la observación */}
                  <div className="pl-6">
                    {!obs.foto_preview ? (
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-sig-600 cursor-pointer transition-colors">
                        <Camera size={13} />
                        Adjuntar foto
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            updateObsFoto(obs.key, URL.createObjectURL(f), f, false)
                          }}
                        />
                      </label>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={obs.foto_preview} alt="Foto observación" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => setObservaciones(prev => prev.map(o => o.key === obs.key ? { ...o, foto_editing: !o.foto_editing } : o))}
                              className="text-xs text-sig-600 hover:text-sig-700 font-medium"
                            >
                              {obs.foto_editing ? 'Cerrar editor' : 'Editar con herramientas'}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateObsFoto(obs.key, null, null, false)}
                              className="text-xs text-red-400 hover:text-red-500"
                            >
                              Eliminar foto
                            </button>
                          </div>
                        </div>
                        {obs.foto_editing && (
                          <PhotoCanvasEditor
                            imageUrl={obs.foto_preview}
                            onImageChange={blob => setObservaciones(prev => prev.map(o => o.key === obs.key ? { ...o, foto_blob: blob } : o))}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={pending || !imageFile}>
            {pending ? 'Guardando…' : 'Guardar Reporte'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  )
}
