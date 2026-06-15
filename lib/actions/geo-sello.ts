'use server'

import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

const ESTADOS_VALIDOS = new Set([
  'capturada',
  'sin_permiso',
  'no_soportado',
  'error',
  'timeout',
])

/**
 * Parsea un campo numérico de FormData de forma segura.
 * Devuelve null si está vacío, ausente o no es un número finito.
 */
function parsearNumero(valor: FormDataEntryValue | null): number | null {
  if (valor === null) return null
  const str = String(valor).trim()
  if (str === '') return null
  const num = Number(str)
  return Number.isFinite(num) ? num : null
}

/**
 * Aplica el sello geo a un registro de gestión a partir de los campos geo_*
 * del FormData (ver contrato del geo-sello).
 *
 * NO-BLOQUEANTE: si el UPDATE falla, loguea y sigue. Nunca lanza ni rompe la
 * completación de la gestión. geo_estado se guarda SIEMPRE (incluso
 * 'sin_permiso' es un dato relevante: el operario rechazó el permiso).
 */
export async function aplicarSelloGeo(
  supabase: SupabaseServerClient,
  registroId: string,
  fechaPlanificada: string,
  fd: FormData
): Promise<void> {
  try {
    const geoLat = parsearNumero(fd.get('geo_lat'))
    const geoLng = parsearNumero(fd.get('geo_lng'))
    const geoAccuracy = parsearNumero(fd.get('geo_accuracy'))

    const estadoRaw = String(fd.get('geo_estado') ?? '').trim()
    const geoEstado = ESTADOS_VALIDOS.has(estadoRaw) ? estadoRaw : null

    const { error } = await supabase
      .from('gestiones_registros')
      .update({
        geo_lat: geoLat,
        geo_lng: geoLng,
        geo_precision_m: geoAccuracy,
        geo_captured_at: new Date().toISOString(),
        geo_estado: geoEstado,
      })
      .eq('id', registroId)
      .eq('fecha_planificada', fechaPlanificada)

    if (error) {
      console.error('[geo-sello] No se pudo aplicar el sello geo:', error.message)
    }
  } catch (err) {
    console.error('[geo-sello] Error inesperado al aplicar el sello geo:', err)
  }
}
