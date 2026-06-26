'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getFinanzasAccess, getFinConfig } from '@/lib/finanzas/access'
import type { ActionResult } from '@/lib/types'
import type { FinComprobante, FinComprobanteInput } from '@/lib/finanzas/types'

const SELECT_COMPROBANTE =
  'id, consultora_id, empresa_id, establecimiento_id, categoria_id, numero, concepto, tipo, fecha_emision, fecha_vencimiento, fecha_cobro, monto_neto, monto_iva, monto_total, moneda, estado, es_recurrente, recurrencia_dia, forma_pago_id, gestion_registro_id, notas, created_by, created_at, updated_at'

/** Redondea a 2 decimales evitando errores de coma flotante. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function validar(input: FinComprobanteInput): { error: string } | null {
  if (!input.empresa_id) return { error: 'La empresa-cliente es obligatoria' }
  if (!input.concepto || !input.concepto.trim()) return { error: 'El concepto es obligatorio' }
  if (!input.fecha_emision) return { error: 'La fecha de emisión es obligatoria' }
  if (
    typeof input.monto_neto !== 'number' ||
    !Number.isFinite(input.monto_neto) ||
    input.monto_neto < 0
  ) {
    return { error: 'El monto neto debe ser un número válido' }
  }
  if (
    input.monto_iva !== undefined &&
    (!Number.isFinite(input.monto_iva) || input.monto_iva < 0)
  ) {
    return { error: 'El IVA debe ser un número válido' }
  }
  if (
    input.recurrencia_dia != null &&
    (!Number.isInteger(input.recurrencia_dia) ||
      input.recurrencia_dia < 1 ||
      input.recurrencia_dia > 28)
  ) {
    return { error: 'El día de recurrencia debe estar entre 1 y 28' }
  }
  return null
}

/**
 * Resuelve neto/iva/total. Si no se pasa monto_iva, lo calcula con la tasa de
 * fin_config (iva_tasa es porcentaje, ej. 21). monto_total = neto + iva.
 */
function calcularMontos(
  input: FinComprobanteInput,
  ivaTasa: number,
): { monto_neto: number; monto_iva: number; monto_total: number } {
  const neto = round2(input.monto_neto)
  const iva =
    input.monto_iva !== undefined
      ? round2(input.monto_iva)
      : round2(neto * (ivaTasa / 100))
  return { monto_neto: neto, monto_iva: iva, monto_total: round2(neto + iva) }
}

export async function crearComprobante(
  input: FinComprobanteInput,
): Promise<ActionResult<FinComprobante>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId || !access.userId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }

  const invalido = validar(input)
  if (invalido) return { success: false, error: invalido.error }

  const config = await getFinConfig(access.consultoraId)
  const { monto_neto, monto_iva, monto_total } = calcularMontos(input, config.iva_tasa)
  const tipo = input.tipo ?? 'puntual'
  const esRecurrente = input.es_recurrente ?? tipo === 'abono'

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fin_comprobantes')
    .insert({
      consultora_id: access.consultoraId,
      empresa_id: input.empresa_id,
      establecimiento_id: input.establecimiento_id ?? null,
      categoria_id: input.categoria_id ?? null,
      numero: input.numero ?? null,
      concepto: input.concepto.trim(),
      tipo,
      fecha_emision: input.fecha_emision,
      fecha_vencimiento: input.fecha_vencimiento ?? null,
      fecha_cobro: input.fecha_cobro ?? null,
      monto_neto,
      monto_iva,
      monto_total,
      moneda: input.moneda ?? config.moneda,
      estado: input.estado ?? 'pendiente',
      es_recurrente: esRecurrente,
      recurrencia_dia: tipo === 'abono' ? input.recurrencia_dia ?? null : null,
      forma_pago_id: input.forma_pago_id ?? null,
      gestion_registro_id: input.gestion_registro_id ?? null,
      notas: input.notas ?? null,
      created_by: access.userId,
    })
    .select(SELECT_COMPROBANTE)
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'No se pudo crear el comprobante' }
  }

  revalidatePath('/dashboard/finanzas')
  return { success: true, data: data as unknown as FinComprobante }
}

export async function actualizarComprobante(
  id: string,
  input: FinComprobanteInput,
): Promise<ActionResult<FinComprobante>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  if (!id) return { success: false, error: 'ID requerido' }

  const invalido = validar(input)
  if (invalido) return { success: false, error: invalido.error }

  const config = await getFinConfig(access.consultoraId)
  const { monto_neto, monto_iva, monto_total } = calcularMontos(input, config.iva_tasa)
  const tipo = input.tipo ?? 'puntual'
  const esRecurrente = input.es_recurrente ?? tipo === 'abono'

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fin_comprobantes')
    .update({
      empresa_id: input.empresa_id,
      establecimiento_id: input.establecimiento_id ?? null,
      categoria_id: input.categoria_id ?? null,
      numero: input.numero ?? null,
      concepto: input.concepto.trim(),
      tipo,
      fecha_emision: input.fecha_emision,
      fecha_vencimiento: input.fecha_vencimiento ?? null,
      fecha_cobro: input.fecha_cobro ?? null,
      monto_neto,
      monto_iva,
      monto_total,
      ...(input.moneda !== undefined ? { moneda: input.moneda } : {}),
      ...(input.estado !== undefined ? { estado: input.estado } : {}),
      es_recurrente: esRecurrente,
      recurrencia_dia: tipo === 'abono' ? input.recurrencia_dia ?? null : null,
      forma_pago_id: input.forma_pago_id ?? null,
      gestion_registro_id: input.gestion_registro_id ?? null,
      notas: input.notas ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('consultora_id', access.consultoraId)
    .select(SELECT_COMPROBANTE)
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'No se pudo actualizar el comprobante' }
  }

  revalidatePath('/dashboard/finanzas')
  return { success: true, data: data as unknown as FinComprobante }
}

export async function eliminarComprobante(id: string): Promise<ActionResult<null>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  if (!id) return { success: false, error: 'ID requerido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('fin_comprobantes')
    .delete()
    .eq('id', id)
    .eq('consultora_id', access.consultoraId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/finanzas')
  return { success: true, data: null }
}

/**
 * Marca un comprobante como cobrado: estado 'cobrada' + fecha_cobro
 * (default hoy). Si no se pasa fechaCobro, usa la fecha actual (YYYY-MM-DD).
 */
export async function marcarCobrada(
  id: string,
  fechaCobro?: string,
): Promise<ActionResult<FinComprobante>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  if (!id) return { success: false, error: 'ID requerido' }

  const hoy = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fin_comprobantes')
    .update({
      estado: 'cobrada',
      fecha_cobro: fechaCobro ?? hoy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('consultora_id', access.consultoraId)
    .select(SELECT_COMPROBANTE)
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'No se pudo marcar como cobrada' }
  }

  revalidatePath('/dashboard/finanzas')
  return { success: true, data: data as unknown as FinComprobante }
}

/** Marca un comprobante como emitido (estado 'emitida'), sin tocar fecha_cobro. */
export async function marcarEmitida(id: string): Promise<ActionResult<FinComprobante>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  if (!id) return { success: false, error: 'ID requerido' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fin_comprobantes')
    .update({ estado: 'emitida', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('consultora_id', access.consultoraId)
    .select(SELECT_COMPROBANTE)
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'No se pudo marcar como emitida' }
  }

  revalidatePath('/dashboard/finanzas')
  return { success: true, data: data as unknown as FinComprobante }
}
