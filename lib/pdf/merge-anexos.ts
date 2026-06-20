/**
 * merge-anexos.ts — Fusiona el PDF del protocolo con sus ANEXOS reales (post-render).
 *
 * Por qué post-merge y NO en el HTML: Chromium NO incrusta un PDF externo como páginas.
 * La forma correcta es generar el protocolo "lindo" con Chromium y, sobre ese Buffer,
 * anexar las páginas reales con pdf-lib:
 *   - Si el anexo es PDF → se copian sus páginas tal cual (calidad original, multipágina).
 *   - Si es imagen (JPG/PNG/HEIC/WebP) → se convierte a una página A4 con sharp.
 * Cada anexo lleva una hoja divisoria con su título.
 *
 * Best-effort: un anexo corrupto/ilegible se SALTEA (no rompe el PDF final).
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import sharp from 'sharp'

/**
 * Clave de orden canónico de un anexo. Define en qué posición aparece dentro del
 * PDF final (y por ende en la hoja índice "ANEXOS"). Ver ORDEN_CANONICO en
 * lib/pdf/ensamblar-anexos.ts.
 */
export type ClaveAnexo = 'certificado' | 'encomienda' | 'plano' | 'observaciones' | 'otro'

export interface AnexoInput {
  titulo: string
  buffer: Buffer
  /** mime opcional; si no viene se detecta por la firma del buffer. */
  mime?: string
  /** Clave de orden canónico (default 'otro'). Define la posición en el PDF final. */
  clave?: ClaveAnexo
}

const A4: [number, number] = [595.28, 841.89] // A4 portrait en puntos

/** ¿El buffer es un PDF? (firma "%PDF"). */
function esPdf(buf: Buffer, mime?: string): boolean {
  if (mime && mime.includes('pdf')) return true
  return buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46
}

/** Convierte una imagen a un PDF de 1 página A4 con el título arriba + la imagen debajo. */
async function imagenAPaginaPdf(buffer: Buffer, titulo: string): Promise<Buffer> {
  const png = await sharp(buffer).rotate().png().toBuffer() // rotate() respeta EXIF
  const doc = await PDFDocument.create()
  const page = doc.addPage(A4)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  page.drawText('ANEXO', { x: 36, y: 800, size: 9, font: bold, color: rgb(0.55, 0.6, 0.55) })
  const t = titulo.length > 60 ? titulo.slice(0, 59) + '…' : titulo
  page.drawText(t, { x: 36, y: 782, size: 14, font: bold, color: rgb(0.18, 0.49, 0.2) })
  const img = await doc.embedPng(png)
  const margin = 36
  const top = 768 // debajo del título
  const maxW = A4[0] - margin * 2
  const maxH = top - margin
  const scale = Math.min(maxW / img.width, maxH / img.height, 1)
  const w = img.width * scale
  const h = img.height * scale
  page.drawImage(img, { x: (A4[0] - w) / 2, y: margin + (maxH - h) / 2, width: w, height: h })
  return Buffer.from(await doc.save())
}

/**
 * Prepara un anexo como buffer PDF listo para fusionar:
 *   - PDF → se VALIDA (PDFDocument.load) y se devuelve el buffer original.
 *   - Imagen → se convierte a una página A4 con título.
 * Devuelve `null` si el anexo es ilegible/corrupto (así el caller puede excluirlo
 * tanto del PDF final COMO de la hoja índice — coherencia índice ↔ contenido).
 */
export async function anexoAPdfBuffer(ax: AnexoInput): Promise<Buffer | null> {
  try {
    if (!ax?.buffer || ax.buffer.length === 0) return null
    if (esPdf(ax.buffer, ax.mime)) {
      await PDFDocument.load(ax.buffer, { ignoreEncryption: true }) // valida que sea cargable
      return ax.buffer
    }
    // Imagen: una sola página A4 con el título arriba + la imagen.
    return await imagenAPaginaPdf(ax.buffer, ax.titulo)
  } catch (err) {
    console.error('[MERGE-ANEXOS] anexo ilegible, se omite:', ax.titulo, err instanceof Error ? err.message : String(err))
    return null
  }
}

/**
 * Fusiona el PDF base con los anexos provistos. Devuelve un nuevo Buffer.
 * Si `anexos` está vacío, devuelve el base intacto.
 */
export async function mergePdfConAnexos(base: Buffer, anexos: AnexoInput[]): Promise<Buffer> {
  const validos = anexos.filter(a => a?.buffer && a.buffer.length > 0)
  if (validos.length === 0) return base

  const merged = await PDFDocument.load(base)

  for (const ax of validos) {
    const pdf = await anexoAPdfBuffer(ax)
    if (!pdf) continue // anexo ilegible/corrupto → se saltea (no rompe el PDF final)
    try {
      const src = await PDFDocument.load(pdf, { ignoreEncryption: true })
      const pages = await merged.copyPages(src, src.getPageIndices())
      for (const p of pages) merged.addPage(p)
    } catch (err) {
      console.error('[MERGE-ANEXOS] no se pudo anexar:', ax.titulo, err instanceof Error ? err.message : String(err))
    }
  }

  return Buffer.from(await merged.save())
}
