'use server'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export async function createDenuncia(
  establecimientoId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const fecha = formData.get('fecha') as string
  const descripcion = formData.get('descripcion') as string

  if (!fecha) return { success: false, error: 'Fecha requerida' }
  if (!descripcion?.trim()) return { success: false, error: 'Descripción requerida' }

  const { error } = await supabase.from('establecimiento_denuncias').insert({
    establecimiento_id: establecimientoId,
    fecha,
    descripcion: descripcion.trim(),
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function createFeedbackCliente(
  establecimientoId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const fecha = formData.get('fecha') as string
  const cliente = formData.get('cliente') as string
  const tipo = formData.get('tipo') as FeedbackTipo
  const descripcion = formData.get('descripcion') as string

  if (!fecha) return { success: false, error: 'Fecha requerida' }
  if (!cliente?.trim()) return { success: false, error: 'Cliente requerido' }
  if (!tipo) return { success: false, error: 'Tipo requerido' }
  if (!descripcion?.trim()) return { success: false, error: 'Descripción requerida' }

  const { error } = await supabase.from('establecimiento_feedback_clientes').insert({
    establecimiento_id: establecimientoId,
    fecha,
    cliente: cliente.trim(),
    tipo,
    descripcion: descripcion.trim(),
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

type FeedbackTipo = 'positivo' | 'negativo' | 'sugerencia'
