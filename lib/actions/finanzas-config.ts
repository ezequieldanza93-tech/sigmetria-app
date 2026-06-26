'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getFinanzasAccess } from '@/lib/finanzas/access'
import type { ActionResult } from '@/lib/types'
import type { FinConfig, FinConfigInput } from '@/lib/finanzas/types'

/**
 * Crea o actualiza la fila fin_config de la consultora (params financieros:
 * costo_km, costo_hora, moneda, locale, iva_tasa, vida_util_meses_def, país).
 * Si la fila no existe, la crea (upsert por consultora_id).
 */
export async function upsertFinConfig(
  input: FinConfigInput,
): Promise<ActionResult<FinConfig>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }

  const patch: Record<string, unknown> = {
    consultora_id: access.consultoraId,
    updated_at: new Date().toISOString(),
  }
  if (input.pais !== undefined) patch.pais = input.pais
  if (input.locale !== undefined) patch.locale = input.locale
  if (input.moneda !== undefined) patch.moneda = input.moneda
  if (input.iva_tasa !== undefined) patch.iva_tasa = input.iva_tasa
  if (input.costo_km !== undefined) patch.costo_km = input.costo_km
  if (input.costo_hora !== undefined) patch.costo_hora = input.costo_hora
  if (input.vida_util_meses_def !== undefined) {
    patch.vida_util_meses_def = input.vida_util_meses_def
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fin_config')
    .upsert(patch, { onConflict: 'consultora_id' })
    .select(
      'consultora_id, pais, locale, moneda, iva_tasa, costo_km, costo_hora, vida_util_meses_def, updated_at',
    )
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'No se pudo guardar la configuración' }
  }

  revalidatePath('/dashboard/finanzas')
  return { success: true, data: data as unknown as FinConfig }
}
