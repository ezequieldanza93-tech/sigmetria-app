'use server'

/**
 * registrar-verificacion.ts — Server Action: persiste el snapshot de un protocolo en
 * `protocolo_verificaciones` y devuelve el QR (data URL PNG) que apunta a la página
 * pública de verificación (`/verificar-protocolo/{folio}`).
 *
 * FLUJO:
 *   1. Upsert del snapshot en `protocolo_verificaciones` (PK = folio, onConflict folio)
 *      usando el cliente ADMIN (service role) — la escritura de esta tabla solo es
 *      posible con service role (RLS: SELECT público, escritura service role).
 *   2. Construye la URL absoluta de verificación y genera el QR como data URL.
 *
 * BEST-EFFORT: si el upsert falla (red/RLS/lo que sea), igual devolvemos el QR para
 * NO romper la generación del PDF. La carátula se imprime con el QR aunque el snapshot
 * no se haya guardado (el peor caso es que la página de verificación diga "no encontrado").
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { generarQrDataUrl } from '@/lib/pdf/qr-verificacion'

/** Base URL canónica de la app (misma convención que sitemap/robots/layout). */
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hys-app-sig.vercel.app'

export interface SnapshotVerificacion {
  folio: string
  tipo: string
  medicionId?: string | null
  consultoraId?: string | null
  empresa?: string
  establecimiento?: string
  profesional?: string
  fechaEjecucion?: string
  fechaEmision?: string
  fechaVencimiento?: string
}

/**
 * Guarda el snapshot de verificación y devuelve el QR (data URL) de la página pública.
 *
 * @param snap - Datos del protocolo a snapshotear (folio + metadatos legibles).
 * @returns data URL PNG del QR de verificación, o '' si la generación del QR falla.
 */
export async function registrarVerificacion(snap: SnapshotVerificacion): Promise<string> {
  const folio = snap.folio

  // ── 1. Upsert del snapshot (best-effort: no rompe el PDF si falla) ──────────
  try {
    const admin = createAdminClient()
    const ahora = new Date().toISOString()
    await admin
      .from('protocolo_verificaciones')
      .upsert(
        {
          folio,
          tipo: snap.tipo,
          medicion_id: snap.medicionId ?? null,
          consultora_id: snap.consultoraId ?? null,
          empresa: snap.empresa ?? null,
          establecimiento: snap.establecimiento ?? null,
          profesional: snap.profesional ?? null,
          fecha_ejecucion: snap.fechaEjecucion ?? null,
          fecha_emision: snap.fechaEmision ?? null,
          fecha_vencimiento: snap.fechaVencimiento ?? null,
          updated_at: ahora,
        },
        { onConflict: 'folio' },
      )
  } catch (err) {
    console.error(
      '[REGISTRAR-VERIFICACION] no se pudo guardar el snapshot:',
      err instanceof Error ? err.message : String(err),
    )
  }

  // ── 2. URL absoluta + QR ────────────────────────────────────────────────────
  const url = `${BASE_URL}/verificar-protocolo/${folio}`
  return generarQrDataUrl(url)
}
