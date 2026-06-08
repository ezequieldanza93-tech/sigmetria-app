'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ActionResult, DocumentType } from '@/lib/types'

interface Props {
  action: (prev: ActionResult<null> | null, fd: FormData) => Promise<ActionResult<null>>
  documentTypes: DocumentType[]
  context: 'empresa' | 'establecimiento' | 'empleado'
  onSuccess: () => void
  /**
   * Si viene, el tipo de documento queda PREFIJADO y bloqueado: no se muestra el
   * select editable, sino el nombre fijo, y el FormData manda este `tipo_id`.
   * Se usa desde el Legajo Técnico (checklist de esperados): cargar ahí = crear
   * una versión nueva de ESE tipo.
   */
  fixedTipoId?: string
  fixedTipoNombre?: string
}

export function DocumentoForm({ action, documentTypes, context, onSuccess, fixedTipoId, fixedTipoNombre }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const filteredTypes = documentTypes.filter(dt => {
    if (!dt.is_active) return false
    if (context === 'empresa') return dt.aplica_empresa
    if (context === 'establecimiento') return dt.aplica_establecimiento
    if (context === 'empleado') return dt.aplica_empleado
    return false
  })

  // El upload se hace SERVER-SIDE: acá solo guardamos el File seleccionado y lo
  // mandamos en el FormData. El cliente NO conoce el consultora_id, así que la
  // server action resuelve el tenant y sube al bucket privado `documentos`.
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setSelectedFile(file ?? null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    // El input file ya viaja en el FormData con name="archivo"; la action lo lee.

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
        <div role="alert" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="doc-tipo" className="block text-sm font-medium text-text-secondary mb-1">
          Tipo de Documento <span className="text-danger" aria-hidden="true">*</span>
        </label>
        {fixedTipoId ? (
          <>
            {/* Tipo PREFIJADO (desde el checklist del Legajo): no editable. */}
            <input type="hidden" name="document_type_id" value={fixedTipoId} />
            <div
              id="doc-tipo"
              className="w-full border border-border-subtle bg-surface-base rounded-lg px-3 py-2 text-sm text-text-secondary"
            >
              {fixedTipoNombre ?? 'Documento'}
            </div>
          </>
        ) : (
          <select
            id="doc-tipo"
            name="document_type_id"
            required
            aria-required="true"
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
          >
            <option value="">Seleccionar tipo...</option>
            {filteredTypes.map(dt => (
              <option key={dt.id} value={dt.id}>{dt.nombre}</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label htmlFor="doc-fecha-vencimiento" className="block text-sm font-medium text-text-secondary mb-1">
          Fecha de Vencimiento
        </label>
        <input
          id="doc-fecha-vencimiento"
          name="fecha_vencimiento"
          type="date"
          className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
      </div>

      <div>
        <label htmlFor="doc-adjunto" className="block text-sm font-medium text-text-secondary mb-1">
          Adjunto
        </label>
        <input
          id="doc-adjunto"
          name="archivo"
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
          onChange={handleFileChange}
          disabled={pending}
          aria-label="Seleccionar archivo adjunto"
          className="w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sig-50 file:text-sig-700 hover:file:bg-sig-100 cursor-pointer"
        />
        {selectedFile && (
          <p className="text-xs text-success mt-1">✓ {selectedFile.name}</p>
        )}
      </div>

      <div className="flex items-center gap-3 py-1">
        <input
          id="include_in_legajo"
          name="include_in_legajo"
          type="checkbox"
          value="1"
          className="w-4 h-4 rounded border-border-default text-sig-500 focus:ring-sig-500"
        />
        <label htmlFor="include_in_legajo" className="text-sm text-text-secondary cursor-pointer">
          Incluir en el <span className="font-medium">Legajo Técnico Digital</span>
        </label>
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando...' : 'Agregar Documento'}
        </Button>
      </div>
    </form>
  )
}
