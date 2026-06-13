'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAuditedClient } from '@/lib/audit/trace'
import type { ActionResult, GrupoGestion, CategoriaGestion } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'

const planificarGestionSchema = z.object({
  gestion_id: z.string().min(1, { error: 'Gestión requerida' }),
  establecimiento_id: z.string().optional(),
  fecha_planificada: z.string().min(1, { error: 'Fecha planificada requerida' }),
  responsable_id: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
})

const planificarGestionNuevaSchema = z.object({
  gestion_nombre: z.string().min(1, { error: 'Nombre de gestión requerido' }).transform(s => s.trim()),
  categoria_id: z.string().min(1, { error: 'Categoría requerida' }),
  establecimiento_id: z.string().min(1),
  fecha_planificada: z.string().min(1, { error: 'Fecha planificada requerida' }),
  notas: z.string().nullable().optional(),
})

export async function planificarGestion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const { client: supabase } = await createAuditedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(planificarGestionSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { gestion_id: gestionId, establecimiento_id: establecimientoId, fecha_planificada: fechaPlanificada, responsable_id: responsableId, notas } = parsed.data

  // Get or create gestion_establecimiento (single query)
  let geId: string
  const { data: existing } = await supabase
    .from('gestiones_establecimientos')
    .select('id')
    .eq('gestion_id', gestionId)
    .eq('establecimiento_id', establecimientoId)
    .maybeSingle()

  if (existing) {
    geId = existing.id
  } else {
    const { data: created, error: insertError } = await supabase
      .from('gestiones_establecimientos')
      .insert({ gestion_id: gestionId, establecimiento_id: establecimientoId })
      .select('id')
      .single()
    if (insertError) return { success: false, error: insertError.message }
    geId = created.id
  }

  // Create the registro
  const { error: registroError } = await supabase.from('gestiones_registros').insert({
    gestion_establecimiento_id: geId,
    fecha_planificada: fechaPlanificada,
    responsable_id: responsableId || null,
    notas: notas || null,
  })
  if (registroError) return { success: false, error: registroError.message }

  return { success: true, data: null }
}

export async function planificarGestionNueva(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const { client: supabase } = await createAuditedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(planificarGestionNuevaSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { gestion_nombre: nombre, categoria_id: categoriaId, establecimiento_id: establecimientoId, fecha_planificada: fechaPlanificada, notas } = parsed.data

  const { data: nuevaGestion, error: gestionError } = await supabase
    .from('gestiones')
    .insert({ nombre, categoria_id: categoriaId })
    .select('id')
    .single()

  if (gestionError) {
    if (gestionError.code === '23505') return { success: false, error: 'Ya existe una gestión con ese nombre en la librería' }
    return { success: false, error: gestionError.message }
  }

  const { data: ge, error: upsertError } = await supabase
    .from('gestiones_establecimientos')
    .upsert(
      { gestion_id: nuevaGestion.id, establecimiento_id: establecimientoId },
      { onConflict: 'gestion_id,establecimiento_id', ignoreDuplicates: true }
    )
    .select('id')
    .single()
  if (upsertError) return { success: false, error: upsertError.message }
  if (!ge) return { success: false, error: 'No se pudo vincular la gestión al establecimiento' }

  const { error: registroError } = await supabase.from('gestiones_registros').insert({
    gestion_establecimiento_id: ge.id,
    fecha_planificada: fechaPlanificada,
    notas: notas || null,
  })
  if (registroError) return { success: false, error: registroError.message }

  return { success: true, data: null }
}

export async function addGestionToEstablecimiento(
  gestionId: string,
  establecimientoId: string
): Promise<ActionResult<null>> {
  const { client: supabase } = await createAuditedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('gestiones_establecimientos')
    .upsert(
      { gestion_id: gestionId, establecimiento_id: establecimientoId },
      { onConflict: 'gestion_id,establecimiento_id', ignoreDuplicates: true }
    )

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function removeGestionFromEstablecimiento(
  gestionEstablecimientoId: string
): Promise<ActionResult<null>> {
  const { client: supabase } = await createAuditedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('gestiones_establecimientos')
    .delete()
    .eq('id', gestionEstablecimientoId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function createGrupoGestion(
  nombre: string
): Promise<ActionResult<GrupoGestion>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombreTrim = nombre.trim()
  if (!nombreTrim) return { success: false, error: 'Nombre requerido' }

  const { data, error } = await supabase
    .from('gestiones_grupos')
    .insert({ nombre: nombreTrim })
    .select('id, nombre, created_at')
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe un grupo con ese nombre' }
    return { success: false, error: error.message }
  }

  return { success: true, data: data as GrupoGestion }
}

export async function createCategoriaGestion(
  nombre: string,
  grupoId: string
): Promise<ActionResult<CategoriaGestion>> {
  const nombreTrim = nombre.trim()
  if (!nombreTrim) return { success: false, error: 'Nombre requerido' }
  if (!grupoId) return { success: false, error: 'Grupo requerido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: existing } = await supabase
    .from('gestiones_categorias')
    .select('id')
    .eq('grupo_id', grupoId)
    .ilike('nombre', nombreTrim)
    .maybeSingle()

  if (existing) return { success: false, error: 'Ya existe una categoría con ese nombre en este grupo' }

  const { data, error } = await supabase
    .from('gestiones_categorias')
    .insert({ nombre: nombreTrim, grupo_id: grupoId })
    .select('id, nombre, grupo_id, descripcion, created_at')
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una categoría con ese nombre' }
    return { success: false, error: error.message }
  }

  return { success: true, data: data as CategoriaGestion }
}

const MAX_FECHAS_LOTE = 366
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Planificación en lote: inserta N ocurrencias de una gestión existente, una por
 * cada fecha provista (ya generada y editada en el cliente). NO setea `secuencia`:
 * el trigger BEFORE INSERT la auto-numera por (gestion_establecimiento_id, fecha_planificada).
 */
export async function planificarGestionLote(
  gestionId: string,
  establecimientoId: string,
  fechas: string[],
  responsableId: string | null,
  notas: string | null,
): Promise<ActionResult<{ count: number }>> {
  const { client: supabase } = await createAuditedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!gestionId) return { success: false, error: 'Gestión requerida' }
  if (!establecimientoId) return { success: false, error: 'Establecimiento requerido' }

  if (!Array.isArray(fechas) || fechas.length === 0) {
    return { success: false, error: 'Seleccioná al menos una fecha' }
  }
  if (fechas.length > MAX_FECHAS_LOTE) {
    return { success: false, error: `Demasiadas ocurrencias (máximo ${MAX_FECHAS_LOTE})` }
  }
  if (!fechas.every(f => typeof f === 'string' && FECHA_RE.test(f))) {
    return { success: false, error: 'Hay fechas con formato inválido' }
  }

  // Get or create gestion_establecimiento (mismo patrón que planificarGestion)
  let geId: string
  const { data: existing } = await supabase
    .from('gestiones_establecimientos')
    .select('id')
    .eq('gestion_id', gestionId)
    .eq('establecimiento_id', establecimientoId)
    .maybeSingle()

  if (existing) {
    geId = existing.id
  } else {
    const { data: created, error: insertError } = await supabase
      .from('gestiones_establecimientos')
      .insert({ gestion_id: gestionId, establecimiento_id: establecimientoId })
      .select('id')
      .single()
    if (insertError) return { success: false, error: insertError.message }
    geId = created.id
  }

  const registros = fechas.map(fecha => ({
    gestion_establecimiento_id: geId,
    fecha_planificada: fecha,
    responsable_id: responsableId || null,
    notas: notas || null,
  }))

  const { error: insertError } = await supabase.from('gestiones_registros').insert(registros)
  if (insertError) return { success: false, error: insertError.message }

  revalidatePath(`/dashboard/empresas/[id]/establecimientos/${establecimientoId}`, 'page')

  return { success: true, data: { count: registros.length } }
}

/**
 * Planificación en lote de una gestión NUEVA: crea la gestión en la librería,
 * la vincula al establecimiento (get-or-create gestiones_establecimientos) e
 * inserta una fila por cada fecha provista (espejo de planificarGestionNueva,
 * pero N fechas en vez de una). NO setea `secuencia`: la auto-numera el trigger.
 */
export async function planificarGestionNuevaLote(
  gestionNombre: string,
  categoriaId: string,
  establecimientoId: string,
  fechas: string[],
  responsableId: string | null,
  notas: string | null,
): Promise<ActionResult<{ count: number }>> {
  const { client: supabase } = await createAuditedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = gestionNombre.trim()
  if (!nombre) return { success: false, error: 'Nombre de gestión requerido' }
  if (!categoriaId) return { success: false, error: 'Categoría requerida' }
  if (!establecimientoId) return { success: false, error: 'Establecimiento requerido' }

  if (!Array.isArray(fechas) || fechas.length === 0) {
    return { success: false, error: 'Seleccioná al menos una fecha' }
  }
  if (fechas.length > MAX_FECHAS_LOTE) {
    return { success: false, error: `Demasiadas ocurrencias (máximo ${MAX_FECHAS_LOTE})` }
  }
  if (!fechas.every(f => typeof f === 'string' && FECHA_RE.test(f))) {
    return { success: false, error: 'Hay fechas con formato inválido' }
  }

  // Crear la gestión en la librería global.
  const { data: nuevaGestion, error: gestionError } = await supabase
    .from('gestiones')
    .insert({ nombre, categoria_id: categoriaId })
    .select('id')
    .single()

  if (gestionError) {
    if (gestionError.code === '23505') return { success: false, error: 'Ya existe una gestión con ese nombre en la librería' }
    return { success: false, error: gestionError.message }
  }

  // Get or create gestion_establecimiento (mismo patrón que planificarGestionNueva).
  const { data: ge, error: upsertError } = await supabase
    .from('gestiones_establecimientos')
    .upsert(
      { gestion_id: nuevaGestion.id, establecimiento_id: establecimientoId },
      { onConflict: 'gestion_id,establecimiento_id', ignoreDuplicates: true }
    )
    .select('id')
    .single()
  if (upsertError) return { success: false, error: upsertError.message }
  if (!ge) return { success: false, error: 'No se pudo vincular la gestión al establecimiento' }

  const registros = fechas.map(fecha => ({
    gestion_establecimiento_id: ge.id,
    fecha_planificada: fecha,
    responsable_id: responsableId || null,
    notas: notas || null,
  }))

  const { error: insertError } = await supabase.from('gestiones_registros').insert(registros)
  if (insertError) return { success: false, error: insertError.message }

  revalidatePath(`/dashboard/empresas/[id]/establecimientos/${establecimientoId}`, 'page')

  return { success: true, data: { count: registros.length } }
}
