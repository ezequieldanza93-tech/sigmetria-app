'use client'

/**
 * Compresión de fotos de evidencia ANTES de encolar/subir.
 *
 * Por qué: una foto de cámara de celular pesa 3–8 MB. Como evidencia de una
 * observación de campo alcanza con ~1600px de lado mayor a calidad ~0.7 (queda
 * nítida y legible). Comprimir:
 *   - no revienta el almacenamiento local (IndexedDB) mientras está en la cola,
 *   - no quema datos móviles del profesional al sincronizar,
 *   - acelera el upload al volver la señal.
 *
 * Implementación: 100% browser (canvas). Sin dependencias nuevas. Si algo falla
 * (formato raro, sin canvas), devuelve el archivo original como fallback seguro.
 */

const MAX_EDGE = 1600
const QUALITY = 0.7

export interface CompressedPhoto {
  blob: Blob
  filename: string
}

/** Carga un File/Blob como HTMLImageElement vía object URL. */
function loadImage(src: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(src)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo decodificar la imagen'))
    }
    img.src = url
  })
}

/**
 * Comprime una imagen a JPEG ≤ MAX_EDGE px de lado mayor, calidad QUALITY.
 * Devuelve siempre algo usable: ante cualquier error, el original sin tocar.
 */
export async function compressImage(file: File): Promise<CompressedPhoto> {
  // No-imagen o entorno sin canvas → no tocar.
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) {
    return { blob: file, filename: file.name }
  }

  try {
    const img = await loadImage(file)
    const { width, height } = img
    const longest = Math.max(width, height)
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1
    const targetW = Math.round(width * scale)
    const targetH = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return { blob: file, filename: file.name }
    ctx.drawImage(img, 0, 0, targetW, targetH)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', QUALITY),
    )
    if (!blob) return { blob: file, filename: file.name }

    // Si por lo que sea quedó MÁS pesada que el original (raro), conservamos el original.
    if (blob.size >= file.size && scale === 1) {
      return { blob: file, filename: file.name }
    }

    const base = file.name.replace(/\.[^.]+$/, '') || 'foto'
    return { blob, filename: `${base}.jpg` }
  } catch {
    return { blob: file, filename: file.name }
  }
}
