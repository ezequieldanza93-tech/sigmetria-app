/**
 * qr-verificacion.ts — Genera un código QR como data URL (PNG base64) para embeber
 * en la carátula de los protocolos. El QR apunta a la página pública de verificación
 * (`/verificar-protocolo/{folio}`).
 *
 * Es best-effort: si la librería `qrcode` falla por cualquier motivo, devuelve ''
 * para que la generación del PDF NO se rompa (la carátula cae al placeholder CSS).
 *
 * SERVER-ONLY: depende de `qrcode` (Node). No importar desde el cliente.
 */

import QRCode from 'qrcode'

/**
 * Genera un QR como data URL (`data:image/png;base64,...`) a partir de un texto.
 *
 * @param texto - Contenido del QR (típicamente la URL de verificación absoluta).
 * @returns data URL PNG del QR, o '' si la generación falla.
 */
export async function generarQrDataUrl(texto: string): Promise<string> {
  try {
    return await QRCode.toDataURL(texto, {
      margin: 1,
      width: 240,
      errorCorrectionLevel: 'M',
    })
  } catch {
    // Best-effort: si falla, devolvemos '' y el motor cae al placeholder CSS.
    return ''
  }
}
