/**
 * brand-color-server.ts — Fetch server-side del color de marca de la consultora
 * para los PDF. Devuelve el color resuelto (con fallback al verde de Sigmetría).
 *
 * SERVER-ONLY: usa el cliente Supabase de servidor (next/headers). No importar
 * desde código cliente ni desde los builders de PDF (que son client-safe).
 */
import { createClient } from '@/lib/supabase/server'
import { resolveBrandColor, type BrandColor } from './brand-color'

/**
 * Trae el color de marca de la consultora (fallback a Sigmetría si no setea).
 * Pensado para que cada generador de PDF lo llame con su `consultoraId` y pase
 * el resultado a `renderProtocolo` / `renderProtocoloPdf` / `renderHtmlToPdf`.
 */
export async function getBrandColorConsultora(
  consultoraId: string | null | undefined,
): Promise<BrandColor> {
  if (!consultoraId) return resolveBrandColor()
  const supabase = await createClient()
  const { data } = await supabase
    .from('consultoras')
    .select('color_marca_primario, color_marca_secundario')
    .eq('id', consultoraId)
    .maybeSingle()
  return resolveBrandColor(
    (data?.color_marca_primario as string | null) ?? null,
    (data?.color_marca_secundario as string | null) ?? null,
  )
}
