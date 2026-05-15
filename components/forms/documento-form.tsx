'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { ActionResult, DocumentType } from '@/lib/types'

interface Props {
  action: (prev: ActionResult<null> | null, fd: FormData) => Promise<ActionResult<null>>
  documentTypes: DocumentType[]
  context: 'empresa' | 'establecimiento'
  onSuccess: () => void
}

export function DocumentoForm({ action, documentTypes, context, onSuccess }: Props) {
  const [uploading, setUploading] = useState(false)
  const [fileData, setFileData] = useState<{ url: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const filteredTypes = documentTypes.filter(
    dt => dt.is_active && (dt.applies_to === 'both' || dt.applies_to === context)
  )

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) { setFileData(null); return }

    setUploading(true)
    setError(null)

    const supabase = createClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${Date.now()}_${safeName}`

    const { data, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (uploadError) {
      setError('No se pudo subir el archivo. Verificá que el bucket "documentos" exista en Supabase Storage.')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(data.path)
    setFileData({ url: publicUrl, name: file.name })
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    if (fileData) {
      fd.set('file_url', fileData.url)
      fd.set('file_name', fileData.name)
    }

    setPending(true)
    const result = await action(null, fd)
    setPending(false)

    if (result.success) {
      onSuccess()
    } else {
      setError(result.error ?? 'Error desconocido')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de Documento <span className="text-red-500">*</span>
        </label>
        <select
          name="document_type_id"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Seleccionar tipo...</option>
          {filteredTypes.map(dt => (
            <option key={dt.id} value={dt.id}>{dt.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fecha de Vencimiento
        </label>
        <input
          name="fecha_vencimiento"
          type="date"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Adjunto
        </label>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
          onChange={handleFileChange}
          disabled={uploading}
          className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
        />
        {uploading && (
          <p className="text-xs text-blue-600 mt-1">Subiendo archivo...</p>
        )}
        {fileData && !uploading && (
          <p className="text-xs text-green-600 mt-1">✓ {fileData.name}</p>
        )}
      </div>

      <div className="flex items-center gap-3 py-1">
        <input
          id="include_in_legajo"
          name="include_in_legajo"
          type="checkbox"
          value="1"
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="include_in_legajo" className="text-sm text-gray-700 cursor-pointer">
          Incluir en el <span className="font-medium">Legajo Técnico Digital</span>
        </label>
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={pending || uploading}>
          {pending ? 'Guardando...' : 'Agregar Documento'}
        </Button>
      </div>
    </form>
  )
}
