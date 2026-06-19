/**
 * GET /api/reportes/protocolo-iluminacion
 *
 * Route Handler de PRUEBA para validar el motor de render server-side.
 * Genera el Protocolo de Iluminación (Res. SRT 84/2012) con datos MOCK
 * y lo devuelve como PDF inline para visualización en browser.
 *
 * FASE A: datos hardcodeados. Fase B integrará datos reales desde Supabase.
 *
 * IMPORTANTE:
 *   - runtime: 'nodejs' — Chromium/puppeteer no funciona en Edge Runtime
 *   - maxDuration: 60 — el render de Chromium tarda 5-20s; el default (10s)
 *     no alcanza, especialmente en frío (cold start de Vercel).
 */

import { NextResponse } from 'next/server'
import { renderProtocoloPdf } from '@/lib/pdf/render-protocolo'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  try {
    const pdfBuffer = await renderProtocoloPdf()

    // NextResponse espera BodyInit = ReadableStream | XMLHttpRequestBodyInit.
    // Buffer<ArrayBufferLike> no satisface el tipo; pasamos el ArrayBuffer
    // subyacente (que sí es BufferSource, subconjunto de XMLHttpRequestBodyInit).
    return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        // inline: el browser lo muestra en pantalla (no fuerza descarga)
        // Para forzar descarga usar: attachment; filename="protocolo-iluminacion.pdf"
        'Content-Disposition': 'inline; filename="protocolo-iluminacion-fase-a.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[render-protocolo] Error generando PDF:', err)
    return NextResponse.json(
      { error: 'Error generando PDF', detail: String(err) },
      { status: 500 }
    )
  }
}
