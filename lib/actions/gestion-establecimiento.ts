'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
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
  const supabase = await createClient()
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
  const supabase = await createClient()
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
  const supabase = await createClient()
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

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month + 1, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function planificarGestionMulti(
  gestionId: string,
  establecimientoId: string,
  months: number[],
  year: number,
  responsableId: string | null,
  notas: string | null,
  cantidad: number = 1,
): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!gestionId) return { success: false, error: 'Gestión requerida' }
  if (!months.length) return { success: false, error: 'Seleccioná al menos un mes' }

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

  const registros = months.flatMap(m =>
    Array.from({ length: cantidad }, () => ({
      gestion_establecimiento_id: geId,
      fecha_planificada: lastDayOfMonth(year, m),
      responsable_id: responsableId,
      notas: notas,
    }))
  )

  const { error: insertError } = await supabase.from('gestiones_registros').insert(registros)
  if (insertError) return { success: false, error: insertError.message }

  return { success: true, data: { count: registros.length } }
}
