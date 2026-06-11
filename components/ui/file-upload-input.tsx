'use client'

import { useState, useRef } from 'react'
import NextImage from 'next/image'
import { Upload, X, FileText, Image as ImageIcon, ExternalLink, Camera } from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'

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
  const captureRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()
  const isImage = kind === 'image'

  function processFile(f: File | undefined | null) {
    setError(null)
    if (!f) { setFile(null); setPreview(null); return }

    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`El archivo supera ${maxSizeMB} MB. Tamaño: ${(f.size / 1024 / 1024).toFixed(1)} MB`)
      if (inputRef.current) inputRef.current.value = ''
      if (captureRef.current) captureRef.current.value = ''
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    processFile(e.target.files?.[0])
  }

  // La foto sacada con la cámara se copia al input nombrado (el que envía el
  // form) vía DataTransfer, así el server action la recibe igual que una de galería.
  function handleCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f && inputRef.current) {
      const dt = new DataTransfer()
      dt.items.add(f)
      inputRef.current.files = dt.files
    }
    processFile(f)
    if (captureRef.current) captureRef.current.value = ''
  }

  function handleRemove() {
    setFile(null)
    setPreview(null)
    setError(null)
    setRemoved(true)
    if (inputRef.current) inputRef.current.value = ''
    if (captureRef.current) captureRef.current.value = ''
  }

  const showCurrent = currentUrl && !file && !removed
  const showNew = !!file
  const Icon = kind === 'image' ? ImageIcon : FileText

  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>

      {showCurrent && (
        <div className="mb-2 flex items-center gap-3 p-2.5 bg-surface-sunken border border-border-subtle rounded-lg">
          {kind === 'image' ? (
            <NextImage
              src={currentUrl!}
              alt="Actual"
              width={64}
              height={64}
              className="w-16 h-16 object-cover rounded border border-border-subtle bg-surface-elevated"
            />
          ) : (
            <div className="w-16 h-16 flex items-center justify-center rounded border border-border-subtle bg-surface-elevated">
              <Icon size={28} className="text-text-tertiary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary mb-1">Archivo actual</p>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-primary hover:text-brand-hover"
            >
              Ver actual <ExternalLink size={11} aria-hidden="true" />
            </a>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-danger hover:opacity-80 px-2 py-1 rounded hover:bg-danger-bg"
          >
            Quitar
          </button>
        </div>
      )}

      {showNew && (
        <div className="mb-2 flex items-center gap-3 p-2.5 bg-sig-50 border border-sig-200 rounded-lg">
          {preview ? (
            <NextImage
              src={preview}
              alt="Nuevo"
              width={64}
              height={64}
              className="w-16 h-16 object-cover rounded border border-sig-200 bg-surface-base"
            />
          ) : (
            <div className="w-16 h-16 flex items-center justify-center rounded border border-sig-200 bg-surface-base">
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

      <div className="flex flex-wrap items-center gap-2">
        {(() => {
          const btnClass =
            'inline-flex items-center gap-2 px-3 py-2 bg-surface-elevated border border-border-default rounded-lg text-sm text-text-primary hover:bg-surface-sunken cursor-pointer transition-colors'

          const elegir = (
            <label key="elegir" htmlFor={`fileinp_${name}`} className={btnClass}>
              {isImage ? <ImageIcon size={16} aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
              {isImage ? 'Elegir foto' : showCurrent || showNew ? 'Cambiar archivo' : 'Seleccionar archivo'}
            </label>
          )

          const sacar = (
            <button
              key="sacar"
              type="button"
              onClick={() => captureRef.current?.click()}
              className={btnClass}
            >
              <Camera size={16} aria-hidden="true" />
              Sacar foto
            </button>
          )

          // Solo imágenes ofrecen cámara. Orden: móvil → Sacar primero; desktop → Elegir primero.
          if (!isImage) return elegir
          return isMobile ? [sacar, elegir] : [elegir, sacar]
        })()}
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
        {isImage && (
          <input
            ref={captureRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            className="sr-only"
          />
        )}
        {removed && currentUrl && (
          <input type="hidden" name={`${name}__remove`} value="1" />
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      )}
      {helpText && !error && (
        <p className="mt-1.5 text-xs text-text-tertiary">{helpText}</p>
      )}
    </div>
  )
}
