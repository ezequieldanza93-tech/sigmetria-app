'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getFinanzasAccess, getFinConfig } from '@/lib/finanzas/access'
import type { ActionResult } from '@/lib/types'
import type { FinGasto, FinGastoInput } from '@/lib/finanzas/types'

const SELECT_GASTO =
  'id, consultora_id, empresa_id, establecimiento_id, categoria_id, concepto, fecha, monto, moneda, es_recurrente, periodicidad, km_recorridos, comprobante_url, gestion_registro_id, estado, fecha_pago, notas, created_by, created_at, updated_at'

function validar(input: FinGastoInput): { error: string } | null {
  if (!input.concepto || !input.concepto.trim()) return { error: 'El concepto es obligatorio' }
  if (!input.fecha) return { error: 'La fecha es obligatoria' }
  if (typeof input.monto !== 'number' || !Number.isFinite(input.monto) || input.monto < 0) {
    return { error: 'El monto debe ser un número válido' }
  }
  return null
}

export async function crearGasto(input: FinGastoInput): Promise<ActionResult<FinGasto>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId || !access.userId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }

  const invalido = validar(input)
  if (invalido) return { success: false, error: invalido.error }

  const config = await getFinConfig(access.consultoraId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fin_gastos')
    .insert({
      consultora_id: access.consultoraId,
      empresa_id: input.empresa_id ?? null,
      establecimiento_id: input.establecimiento_id ?? null,
      categoria_id: input.categoria_id ?? null,
      concepto: input.concepto.trim(),
      fecha: input.fecha,
      monto: input.monto,
      moneda: input.moneda ?? config.moneda,
      es_recurrente: input.es_recurrente ?? false,
      periodicidad: input.periodicidad ?? null,
      km_recorridos: input.km_recorridos ?? null,
      comprobante_url: input.comprobante_url ?? null,
      gestion_registro_id: input.gestion_registro_id ?? null,
      estado: input.estado ?? 'pagado',
      fecha_pago: input.fecha_pago ?? null,
      notas: input.notas ?? null,
      created_by: access.userId,
    })
    .select(SELECT_GASTO)
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'No se pudo crear el gasto' }
  }

  revalidatePath('/dashboard/finanzas')
  return { success: true, data: data as unknown as FinGasto }
}

export async function actualizarGasto(
  id: string,
  input: FinGastoInput,
): Promise<ActionResult<FinGasto>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  if (!id) return { success: false, error: 'ID requerido' }

  const invalido = validar(input)
  if (invalido) return { success: false, error: invalido.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fin_gastos')
    .update({
      empresa_id: input.empresa_id ?? null,
      establecimiento_id: input.establecimiento_id ?? null,
      categoria_id: input.categoria_id ?? null,
      concepto: input.concepto.trim(),
      fecha: input.fecha,
      monto: input.monto,
      ...(input.moneda !== undefined ? { moneda: input.moneda } : {}),
      es_recurrente: input.es_recurrente ?? false,
      periodicidad: input.periodicidad ?? null,
      km_recorridos: input.km_recorridos ?? null,
      comprobante_url: input.comprobante_url ?? null,
      gestion_registro_id: input.gestion_registro_id ?? null,
      estado: input.estado ?? 'pagado',
      fecha_pago: input.fecha_pago ?? null,
      notas: input.notas ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('consultora_id', access.consultoraId)
    .select(SELECT_GASTO)
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'No se pudo actualizar el gasto' }
  }

  revalidatePath('/dashboard/finanzas')
  return { success: true, data: data as unknown as FinGasto }
}

export async function eliminarGasto(id: string): Promise<ActionResult<null>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  if (!id) return { success: false, error: 'ID requerido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('fin_gastos')
    .delete()
    .eq('id', id)
    .eq('consultora_id', access.consultoraId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/finanzas')
  return { success: true, data: null }
}
