'use server'

/**
 * Server actions de SINCRONIZACIÓN del MODO OFFLINE.
 *
 * Las llama exclusivamente el runner de la cola (lib/offline/queue.ts) cuando
 * vuelve la conexión. Espejan a las actions "online" reales pero agregan el
 * `op_id` (UUID generado en el cliente al encolar) que garantiza idempotencia
 * del replay (ver migración 20260624000060):
 *
 *   - syncObservacionCreate  → INSERT en gestiones_observaciones. `op_id` tiene
 *     unique parcial → un reintento NO duplica la fila (dedup duro). Sube la foto
 *     de evidencia (ya comprimida en el cliente) al bucket privado `documentos`
 *     bajo el path prefijado por tenant, igual que el flujo online.
 *
 *   - syncGestionEjecutar    → UPDATE de gestiones_registros (tabla particionada).
 *     El UPDATE es idempotente por naturaleza (última escritura gana); `op_id`
 *     queda solo como traza de qué operación offline tocó la fila.
 *
 * Contrato de retorno idéntico al resto del proyecto: { success, data } | { error }.
 */

import { createAuditedClient } from '@/lib/audit/trace'
import { consultoraIdFromRegistroGestion, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'

/**
 * Crea una observación de campo encolada offline (prioridad #2).
 *
 * Dedup: si ya existe una fila con este `op_id` (replay), el INSERT choca con el
 * unique parcial. En vez de devolver error, lo tratamos como éxito idempotente
 * (la fila ya está) para que el runner saque la mutación de la cola.
 */
export async function syncObservacionCreate(
  formData: FormData,
): Promise<ActionResult<null>> {
  const { client: supabase } = await createAuditedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const opId = (formData.get('op_id') as string)?.trim()
  const registroGestionId = formData.get('registro_gestion_id') as string
  const descripcion = (formData.get('descripcion') as string)?.trim()
  const fechaPlanificada = formData.get('fecha_planificada') as string
  const categoriaId = (formData.get('categoria_id') as string)?.trim()
  const responsableCierreId = (formData.get('responsable_cierre_id') as string) || null
  const foto = formData.get('foto') as File | null

  if (!opId) return { success: false, error: 'op_id requerido' }
  if (!registroGestionId) return { success: false, error: 'Registro de gestión requerido' }
  if (!descripcion) return { success: false, error: 'Descripción requerida' }
  if (!fechaPlanificada) return { success: false, error: 'Fecha planificada requerida' }
  if (!categoriaId) return { success: false, error: 'Categoría requerida' }

  // Si ya se sincronizó esta misma operación (replay), salir como éxito.
  const { data: yaExiste } = await supabase
    .from('gestiones_observaciones')
    .select('id')
    .eq('op_id', opId)
    .maybeSingle()
  if (yaExiste) return { success: true, data: null }

  // Subida de la foto de evidencia (si vino). Mismo patrón/bucket que el flujo
  // online: path prefijado por la consultora DUEÑA del dato.
  let fotoPath: string | null = null
  if (foto && foto.size > 0) {
    const consultoraId = await consultoraIdFromRegistroGestion(supabase, registroGestionId)
    if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del registro' }
    const ext = foto.name.split('.').pop() ?? 'jpg'
    const path = tenantStoragePath(
      consultoraId,
      'observaciones-fotos',
      registroGestionId,
      `${Date.now()}_${opId}.${ext}`,
    )
    const { data: upload, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, foto, { upsert: false, contentType: foto.type || undefined })
    if (uploadError) return { success: false, error: 'Error al subir foto: ' + uploadError.message }
    fotoPath = upload.path
  }

  const { error } = await supabase.from('gestiones_observaciones').insert({
    op_id: opId,
    registro_gestion_id: registroGestionId,
    descripcion,
    fecha_planificada: fechaPlanificada,
    responsable_cierre_id: responsableCierreId,
    categoria_id: categoriaId,
    foto_url: fotoPath,
  })

  if (error) {
    // Carrera: si dos reintentos casi simultáneos chocaron en el unique parcial,
    // el segundo recibe violación de unicidad → la fila YA está, es éxito.
    if (error.code === '23505') return { success: true, data: null }
    return { success: false, error: error.message }
  }
  return { success: true, data: null }
}

/**
 * Ejecuta (finaliza) una gestión planificada encolada offline (prioridad #3).
 *
 * Es un UPDATE sobre una fila existente de gestiones_registros (tabla
 * particionada). Idempotente: reaplicarlo deja el mismo estado. `op_id` se
 * persiste como traza. No maneja evidencia (la foto de ejecución no entra en el
 * MVP offline; el cierre con evidencia se hace online).
 */
export async function syncGestionEjecutar(
  formData: FormData,
): Promise<ActionResult<null>> {
  const { client: supabase } = await createAuditedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const opId = (formData.get('op_id') as string)?.trim()
  const registroId = (formData.get('registro_id') as string)?.trim()
  const fechaEjecutada = formData.get('fecha_ejecutada') as string
  const notas = (formData.get('notas') as string) || null
  const responsableId = (formData.get('responsable_id') as string) || null
  // 'true' (default si ausente) = finaliza la gestión.
  const finalizar = (formData.get('finalizar') as string) !== 'false'

  if (!opId) return { success: false, error: 'op_id requerido' }
  if (!registroId) return { success: false, error: 'Registro requerido' }
  if (finalizar && !fechaEjecutada) return { success: false, error: 'Fecha de ejecución requerida' }

  const updates: Record<string, unknown> = {
    op_id: opId,
    notas,
    responsable_id: responsableId,
  }
  if (finalizar) {
    updates.fecha_ejecutada = fechaEjecutada
    updates.estado = null
  } else {
    updates.estado = 'borrador'
  }

  const { error } = await supabase
    .from('gestiones_registros')
    .update(updates)
    .eq('id', registroId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
