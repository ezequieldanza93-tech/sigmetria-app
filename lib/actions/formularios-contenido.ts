'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

const LIB_PATH = '/dashboard/libreria-gestiones'

// ─── tipos públicos ────────────────────────────────────────────────────────────

export interface FormularioItem {
  id: string
  section_id: string
  question: string
  order_index: number
  response_type: string
  required: boolean
  numero_item: number | null
  created_at: string
}

export interface FormularioSeccion {
  id: string
  gestion_id: string
  title: string
  order_index: number
  aplica_por_iso: boolean
  created_at: string
  formularios_items: FormularioItem[]
}

// ─── getChecklistContenido ────────────────────────────────────────────────────

export async function getChecklistContenido(
  gestionId: string,
): Promise<ActionResult<FormularioSeccion[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('formularios_secciones')
    .select('*, formularios_items(*)')
    .eq('gestion_id', gestionId)
    .order('order_index', { ascending: true })

  if (error) return { success: false, error: error.message }

  // ordenar items dentro de cada sección
  const secciones = (data ?? []).map(s => ({
    ...s,
    formularios_items: [...(s.formularios_items ?? [])].sort(
      (a: FormularioItem, b: FormularioItem) => a.order_index - b.order_index,
    ),
  })) as FormularioSeccion[]

  return { success: true, data: secciones }
}

// ─── helpers internos ─────────────────────────────────────────────────────────

async function nextSeccionOrderIndex(supabase: Awaited<ReturnType<typeof createClient>>, gestionId: string): Promise<number> {
  const { data } = await supabase
    .from('formularios_secciones')
    .select('order_index')
    .eq('gestion_id', gestionId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  return ((data as { order_index: number } | null)?.order_index ?? -1) + 1
}

async function nextItemOrderIndex(supabase: Awaited<ReturnType<typeof createClient>>, sectionId: string): Promise<number> {
  const { data } = await supabase
    .from('formularios_items')
    .select('order_index')
    .eq('section_id', sectionId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  return ((data as { order_index: number } | null)?.order_index ?? -1) + 1
}

async function nextNumeroItem(supabase: Awaited<ReturnType<typeof createClient>>, sectionId: string): Promise<number> {
  const { data } = await supabase
    .from('formularios_items')
    .select('numero_item')
    .eq('section_id', sectionId)
    .order('numero_item', { ascending: false })
    .limit(1)
    .maybeSingle()
  return ((data as { numero_item: number | null } | null)?.numero_item ?? 0) + 1
}

// ─── secciones ────────────────────────────────────────────────────────────────

export async function createSeccion(
  gestionId: string,
  title: string,
): Promise<ActionResult<FormularioSeccion>> {
  const supabase = await createClient()
  const t = title.trim()
  if (!t) return { success: false, error: 'El título es obligatorio' }
  if (!gestionId) return { success: false, error: 'gestion_id requerido' }

  const orderIndex = await nextSeccionOrderIndex(supabase, gestionId)

  const { data, error } = await supabase
    .from('formularios_secciones')
    .insert({ gestion_id: gestionId, title: t, order_index: orderIndex })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath(LIB_PATH)
  return { success: true, data: { ...(data as FormularioSeccion), formularios_items: [] } }
}

export async function updateSeccion(
  id: string,
  title: string,
): Promise<ActionResult<FormularioSeccion>> {
  const supabase = await createClient()
  const t = title.trim()
  if (!t) return { success: false, error: 'El título es obligatorio' }

  const { data, error } = await supabase
    .from('formularios_secciones')
    .update({ title: t })
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Sección no encontrada o sin permiso' }

  revalidatePath(LIB_PATH)
  return { success: true, data: { ...(data as FormularioSeccion), formularios_items: [] } }
}

export async function deleteSeccion(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('formularios_secciones')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIB_PATH)
  return { success: true, data: null }
}

// ─── ítems ────────────────────────────────────────────────────────────────────

export async function createItem(
  sectionId: string,
  question: string,
  opts?: { required?: boolean },
): Promise<ActionResult<FormularioItem>> {
  const supabase = await createClient()
  const q = question.trim()
  if (!q) return { success: false, error: 'La pregunta es obligatoria' }
  if (!sectionId) return { success: false, error: 'section_id requerido' }

  const [orderIndex, numeroItem] = await Promise.all([
    nextItemOrderIndex(supabase, sectionId),
    nextNumeroItem(supabase, sectionId),
  ])

  const { data, error } = await supabase
    .from('formularios_items')
    .insert({
      section_id: sectionId,
      question: q,
      order_index: orderIndex,
      response_type: 'compliance',
      required: opts?.required ?? false,
      numero_item: numeroItem,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath(LIB_PATH)
  return { success: true, data: data as FormularioItem }
}

export async function updateItem(
  id: string,
  question: string,
  required: boolean,
): Promise<ActionResult<FormularioItem>> {
  const supabase = await createClient()
  const q = question.trim()
  if (!q) return { success: false, error: 'La pregunta es obligatoria' }

  const { data, error } = await supabase
    .from('formularios_items')
    .update({ question: q, required })
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Ítem no encontrado o sin permiso' }

  revalidatePath(LIB_PATH)
  return { success: true, data: data as FormularioItem }
}

export async function deleteItem(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('formularios_items')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(LIB_PATH)
  return { success: true, data: null }
}
