'use client'

import { useState } from 'react'
import JSZip from 'jszip'
import { Download, Copy, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/hooks/use-toast'
import type { ContenidoPublicacionFull } from '@/lib/contenido/types'

interface DownloadButtonProps {
  pub: ContenidoPublicacionFull
  getUrl: (pathOrUrl: string | null | undefined) => string | null
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

function extFor(mime: string | null, fallback = 'bin'): string {
  if (mime && EXT_BY_MIME[mime]) return EXT_BY_MIME[mime]
  return fallback
}

function safeName(s: string): string {
  // Reemplaza cualquier cosa que no sea alfanumérica/-/_ por "_" (acentos incluidos).
  const cleaned = s.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
  return cleaned || 'publicacion'
}

/** Texto listo para pegar en la red: descripción + hashtags. */
function buildCaption(pub: ContenidoPublicacionFull): string {
  const tags = pub.hashtags.map((h) => `#${h.texto}`).join(' ')
  return [pub.descripcion?.trim(), tags].filter(Boolean).join('\n\n')
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function DownloadButton({ pub, getUrl }: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)

  const ordered = pub.media.slice().sort((a, b) => a.orden - b.orden)
  const base = safeName(pub.titulo)

  async function handleDownload() {
    if (ordered.length === 0) {
      toast.warning('Esta publicación no tiene archivos para descargar')
      return
    }
    setDownloading(true)
    try {
      // Resolvemos las URLs firmadas y bajamos cada archivo como blob.
      const blobs = await Promise.all(
        ordered.map(async (m) => {
          const url = getUrl(m.storage_path)
          if (!url) throw new Error('No se pudo resolver la URL del archivo')
          const res = await fetch(url)
          if (!res.ok) throw new Error(`Descarga fallida (${res.status})`)
          return { blob: await res.blob(), mime: m.mime }
        }),
      )

      if (blobs.length === 1) {
        triggerDownload(blobs[0].blob, `${base}.${extFor(blobs[0].mime)}`)
      } else {
        // Carrusel → zip respetando el orden (prefijo numérico).
        const zip = new JSZip()
        blobs.forEach((b, i) => {
          const n = String(i + 1).padStart(2, '0')
          zip.file(`${n}-${base}.${extFor(b.mime)}`, b.blob)
        })
        const out = await zip.generateAsync({ type: 'blob' })
        triggerDownload(out, `${base}.zip`)
      }
      toast.success('Descarga lista')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo descargar')
    } finally {
      setDownloading(false)
    }
  }

  async function handleCopy() {
    const text = buildCaption(pub)
    if (!text) {
      toast.warning('No hay texto para copiar')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Texto y hashtags copiados')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={handleDownload} disabled={downloading}>
        {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {ordered.length > 1 ? `Descargar (${ordered.length})` : 'Descargar'}
      </Button>
      <Button type="button" variant="secondary" onClick={handleCopy}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        Copiar texto
      </Button>
    </div>
  )
}
