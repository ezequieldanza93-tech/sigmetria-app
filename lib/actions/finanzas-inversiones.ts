'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getFinanzasAccess, getFinConfig } from '@/lib/finanzas/access'
import type { ActionResult } from '@/lib/types'
import type { FinInversion, FinInversionInput } from '@/lib/finanzas/types'

const SELECT_INVERSION =
  'id, consultora_id, categoria_id, instrumento_id, descripcion, fecha_adquisicion, monto, moneda, vida_util_meses, valor_residual, comprobante_url, notas, created_by, created_at, updated_at'

function validar(input: FinInversionInput): { error: string } | null {
  if (!input.descripcion || !input.descripcion.trim()) {
    return { error: 'La descripción es obligatoria' }
  }
  if (!input.fecha_adquisicion) return { error: 'La fecha de adquisición es obligatoria' }
  if (typeof input.monto !== 'number' || !Number.isFinite(input.monto) || input.monto < 0) {
    return { error: 'El monto debe ser un número válido' }
  }
  return null
}

export async function crearInversion(
  input: FinInversionInput,
): Promise<ActionResult<FinInversion>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId || !access.userId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }

  const invalido = validar(input)
  if (invalido) return { success: false, error: invalido.error }

  const config = await getFinConfig(access.consultoraId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fin_inversiones')
    .insert({
      consultora_id: access.consultoraId,
      categoria_id: input.categoria_id ?? null,
      instrumento_id: input.instrumento_id ?? null,
      descripcion: input.descripcion.trim(),
      fecha_adquisicion: input.fecha_adquisicion,
      monto: input.monto,
      moneda: input.moneda ?? config.moneda,
      vida_util_meses: input.vida_util_meses ?? config.vida_util_meses_def,
      valor_residual: input.valor_residual ?? 0,
      comprobante_url: input.comprobante_url ?? null,
      notas: input.notas ?? null,
      created_by: access.userId,
    })
    .select(SELECT_INVERSION)
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'No se pudo crear la inversión' }
  }

  revalidatePath('/dashboard/finanzas')
  return { success: true, data: data as unknown as FinInversion }
}

export async function actualizarInversion(
  id: string,
  input: FinInversionInput,
): Promise<ActionResult<FinInversion>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  if (!id) return { success: false, error: 'ID requerido' }

  const invalido = validar(input)
  if (invalido) return { success: false, error: invalido.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fin_inversiones')
    .update({
      categoria_id: input.categoria_id ?? null,
      instrumento_id: input.instrumento_id ?? null,
      descripcion: input.descripcion.trim(),
      fecha_adquisicion: input.fecha_adquisicion,
      monto: input.monto,
      ...(input.moneda !== undefined ? { moneda: input.moneda } : {}),
      ...(input.vida_util_meses !== undefined ? { vida_util_meses: input.vida_util_meses } : {}),
      valor_residual: input.valor_residual ?? 0,
      comprobante_url: input.comprobante_url ?? null,
      notas: input.notas ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('consultora_id', access.consultoraId)
    .select(SELECT_INVERSION)
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'No se pudo actualizar la inversión' }
  }

  revalidatePath('/dashboard/finanzas')
  return { success: true, data: data as unknown as FinInversion }
}

export async function eliminarInversion(id: string): Promise<ActionResult<null>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  if (!id) return { success: false, error: 'ID requerido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('fin_inversiones')
    .delete()
    .eq('id', id)
    .eq('consultora_id', access.consultoraId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/finanzas')
  return { success: true, data: null }
}

/**
 * Crea una inversión precargando la descripción desde un instrumento de medición
 * (marca + modelo). El instrumento queda vinculado vía instrumento_id, lo que
 * habilita el cálculo de recupero (mediciones realizadas con ese equipo).
 */
export async function crearInversionDesdeInstrumento(
  instrumentoId: string,
  monto: number,
  fecha: string,
  vidaUtil?: number,
): Promise<ActionResult<FinInversion>> {
  const access = await getFinanzasAccess()
  if (!access.hasAccess || !access.consultoraId || !access.userId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  if (!instrumentoId) return { success: false, error: 'Falta el instrumento' }
  if (typeof monto !== 'number' || !Number.isFinite(monto) || monto < 0) {
    return { success: false, error: 'El monto debe ser un número válido' }
  }
  if (!fecha) return { success: false, error: 'La fecha de adquisición es obligatoria' }

  const supabase = await createClient()

  // Precarga la descripción desde el instrumento: marca (nombre) + modelo.
  const { data: instrumento, error: instError } = await supabase
    .from('mediciones_instrumentos')
    .select('id, modelo, numero_serie, organizaciones_externas(nombre)')
    .eq('id', instrumentoId)
    .maybeSingle()

  if (instError || !instrumento) {
    return { success: false, error: instError?.message ?? 'No se encontró el instrumento' }
  }

  // PostgREST devuelve el embed como objeto o array según la relación.
  const marca = instrumento.organizaciones_externas as
    | { nombre?: string }
    | { nombre?: string }[]
    | null
  const marcaRow = Array.isArray(marca) ? marca[0] : marca
  const marcaNombre = marcaRow?.nombre ?? null
  const modelo = (instrumento.modelo as string | null) ?? null
  const descripcion =
    [marcaNombre, modelo].filter(Boolean).join(' ').trim() || 'Instrumento de medición'

  return crearInversion({
    descripcion,
    fecha_adquisicion: fecha,
    monto,
    instrumento_id: instrumentoId,
    ...(vidaUtil !== undefined ? { vida_util_meses: vidaUtil } : {}),
  })
}
