'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Versión actual del aviso de geo-sello. Incrementar si el texto del modal cambia. */
const GEO_CONSENT_VERSION = 'v1'

/**
 * Registra que el usuario autenticado aceptó el aviso de geolocalización.
 * Guarda el timestamp y la versión del texto mostrado en profiles.
 *
 * Llamado desde GeoConsentModal tras el clic en "Entendido y continuar".
 */
export async function aceptarConsentimientoGeo(): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('profiles')
    .update({
      accepted_geo_consent_at: new Date().toISOString(),
      geo_consent_version: GEO_CONSENT_VERSION,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  // Revalida el layout para que el servidor no vuelva a renderizar el modal
  // en la próxima navegación (accepted_geo_consent_at ya no será NULL).
  revalidatePath('/', 'layout')

  return { success: true }
}
