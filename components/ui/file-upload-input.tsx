'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react'

interface Props {
  name: string
  label: string
  accept: string
  maxSizeMB: number
  currentUrl?: string | null
  helpText?: string
  kind?: 'image' | 'document'
  required?: boolean
}

export function FileUploadInput({
  name,
  label,
  accept,
  maxSizeMB,
  currentUrl,
  helpText,
  kind = 'image',
  required = false,
}: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setError(null)
    if (!f) { setFile(null); setPreview(null); return }

    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`El archivo supera ${maxSizeMB} MB. Tamaño: ${(f.size / 1024 / 1024).toFixed(1)} MB`)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setFile(f)
    setRemoved(false)

    if (kind === 'image' && f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => setPreview(ev.target?.result as string)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }

  function handleRemove() {
    setFile(null)
    setPreview(null)
    setError(null)
    setRemoved(true)
    if (inputRef.current) inputRef.current.value = ''
  }

  const showCurrent = currentUrl && !file && !removed
  const showNew = !!file
  const Icon = kind === 'image' ? ImageIcon : FileText

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {showCurrent && (
        <div className="mb-2 flex items-center gap-3 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
          {kind === 'image' ? (
            <img
              src={currentUrl}
              alt="Actual"
              className="w-16 h-16 object-cover rounded border border-gray-200 bg-white"
            />
          ) : (
            <div className="w-16 h-16 flex items-center justify-center rounded border border-gray-200 bg-white">
              <Icon size={28} className="text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 mb-1">Archivo actual</p>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-sig-600 hover:text-sig-700"
            >
              Ver actual <ExternalLink size={11} />
            </a>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
          >
            Quitar
          </button>
        </div>
      )}

      {showNew && (
        <div className="mb-2 flex items-center gap-3 p-2.5 bg-sig-50 border border-sig-200 rounded-lg">
          {preview ? (
            <img
              src={preview}
              alt="Nuevo"
              className="w-16 h-16 object-cover rounded border border-sig-200 bg-white"
            />
          ) : (
            <div className="w-16 h-16 flex items-center justify-center rounded border border-sig-200 bg-white">
              <Icon size={28} className="text-sig-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sig-700 mb-0.5 truncate">{file.name}</p>
            <p className="text-[11px] text-sig-600/80">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-sig-600 hover:text-sig-700 p-1 rounded hover:bg-sig-100"
            aria-label="Quitar"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <label
          htmlFor={`fileinp_${name}`}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <Upload size={16} />
          {showCurrent || showNew ? 'Cambiar archivo' : 'Seleccionar archivo'}
        </label>
        <input
          ref={inputRef}
          id={`fileinp_${name}`}
          name={name}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="sr-only"
          required={required && !currentUrl}
        />
        {removed && currentUrl && (
          <input type="hidden" name={`${name}__remove`} value="1" />
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}
      {helpText && !error && (
        <p className="mt-1.5 text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  )
}
