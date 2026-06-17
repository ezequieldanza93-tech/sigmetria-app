'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export interface PersonaVinculada {
  id: string
  nombre: string
  apellido: string
  dni: string | null
}

/**
 * Vincula una persona ya existente en `personas_directorio` al establecimiento
 * mediante `personas_establecimientos` (upsert seguro). Si se provee `puestoId`,
 * también la vincula en `puestos_personas`.
 *
 * Usado por el alta inline de CantidadTrabajadoresInput para enlazar la persona
 * recién creada al scope del protocolo sin recargar la página.
 */
export async function vincularPersonaAlEstablecimiento(
  personaId: string,
  establecimientoId: string,
  puestoId?: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('personas_establecimientos')
    .upsert(
      { persona_id: personaId, establecimiento_id: establecimientoId },
      { onConflict: 'persona_id,establecimiento_id', ignoreDuplicates: true }
    )

  if (error) return { success: false, error: error.message }

  if (puestoId) {
    await supabase
      .from('puestos_personas')
      .upsert(
        { persona_id: personaId, puesto_id: puestoId },
        { onConflict: 'persona_id,puesto_id', ignoreDuplicates: true }
      )
  }

  return { success: true, data: null }
}
