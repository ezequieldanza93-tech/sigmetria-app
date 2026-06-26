'use server'

/**
 * finanzas-formas-pago.ts — Server actions del catálogo de FORMAS DE PAGO.
 *
 * Las genéricas de Sigmetría (consultora_id NULL) no se tocan desde acá; estas
 * actions solo crean/eliminan las formas de pago PROPIAS de la consultora.
 * Toda mutación valida rol full_access vía getFinanzasAccess y setea
 * consultora_id desde el contexto (jamás lo toma del input).
 */

import { createClient } from '@/lib/supabase/server'
import { getFinanzasAccess } from '@/lib/finanzas/access'
import type { FinFormaPago } from '@/lib/queries/finanzas-formas-pago'
import type { ActionResult } from '@/lib/types'

/** Crea una forma de pago propia de la consultora. */
export async function crearFormaPago(nombre: string): Promise<ActionResult<FinFormaPago>> {
  const acc = await getFinanzasAccess()
  if (!acc.hasAccess || !acc.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  const limpio = nombre?.trim()
  if (!limpio) {
    return { success: false, error: 'El nombre es obligatorio' }
  }

  const supabase = await createClient()

  // Orden: empuja la nueva forma después de las que ya tiene la consultora
  // (las genéricas semilladas van 10-60; las propias arrancan en 100).
  const { data: ultima } = await supabase
    .from('fin_formas_pago')
    .select('orden')
    .eq('consultora_id', acc.consultoraId)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()

  const orden = ultima?.orden != null ? Number(ultima.orden) + 10 : 100

  const { data, error } = await supabase
    .from('fin_formas_pago')
    .insert({
      consultora_id: acc.consultoraId,
      nombre: limpio,
      orden,
      is_active: true,
    })
    .select('id, consultora_id, nombre, orden, is_active')
    .single()

  if (error || !data) {
    return {
      success: false,
      error: 'No se pudo crear la forma de pago: ' + (error?.message ?? 'desconocido'),
    }
  }
  return { success: true, data: data as unknown as FinFormaPago }
}

/** Elimina una forma de pago propia de la consultora (las genéricas no se tocan). */
export async function eliminarFormaPago(id: string): Promise<ActionResult<null>> {
  const acc = await getFinanzasAccess()
  if (!acc.hasAccess || !acc.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  if (!id) return { success: false, error: 'id requerido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('fin_formas_pago')
    .delete()
    .eq('id', id)
    .eq('consultora_id', acc.consultoraId) // solo propias: las genéricas tienen consultora_id NULL

  if (error) return { success: false, error: 'No se pudo eliminar: ' + error.message }
  return { success: true, data: null }
}
