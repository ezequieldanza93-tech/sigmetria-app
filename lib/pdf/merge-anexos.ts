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

export interface AnexoInput {
  titulo: string
  buffer: Buffer
  /** mime opcional; si no viene se detecta por la firma del buffer. */
  mime?: string
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
 * Fusiona el PDF base con los anexos provistos. Devuelve un nuevo Buffer.
 * Si `anexos` está vacío, devuelve el base intacto.
 */
export async function mergePdfConAnexos(base: Buffer, anexos: AnexoInput[]): Promise<Buffer> {
  const validos = anexos.filter(a => a?.buffer && a.buffer.length > 0)
  if (validos.length === 0) return base

  const merged = await PDFDocument.load(base)

  for (const ax of validos) {
    try {
      if (esPdf(ax.buffer, ax.mime)) {
        // PDF: se anexan sus páginas TAL CUAL, sin hoja divisoria en blanco.
        const src = await PDFDocument.load(ax.buffer, { ignoreEncryption: true })
        const pages = await merged.copyPages(src, src.getPageIndices())
        for (const p of pages) merged.addPage(p)
      } else {
        // Imagen: una sola página A4 con el título arriba + la imagen (sin divisoria aparte).
        const src = await PDFDocument.load(await imagenAPaginaPdf(ax.buffer, ax.titulo))
        const [p] = await merged.copyPages(src, [0])
        merged.addPage(p)
      }
    } catch (err) {
      // Anexo ilegible/corrupto → se saltea (no rompe el PDF final).
      console.error('[MERGE-ANEXOS] no se pudo anexar:', ax.titulo, err instanceof Error ? err.message : String(err))
    }
  }

  return Buffer.from(await merged.save())
}
