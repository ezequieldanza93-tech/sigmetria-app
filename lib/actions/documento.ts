'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, DocumentoTipo } from '@/lib/types'

export async function createDocumento(
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = formData.get('nombre') as string
  const tipo = formData.get('tipo') as DocumentoTipo

  if (!nombre?.trim()) return { success: false, error: 'El nombre es obligatorio' }
  if (!tipo) return { success: false, error: 'El tipo es obligatorio' }

  const { error } = await supabase
    .from('documentos')
    .insert({
      empresa_id: empresaId,
      establecimiento_id: establecimientoId,
      tipo,
      nombre: nombre.trim(),
      archivo_url: (formData.get('archivo_url') as string) || null,
      fecha_emision: (formData.get('fecha_emision') as string) || null,
      fecha_vencimiento: (formData.get('fecha_vencimiento') as string) || null,
      es_vigente: true,
      subido_por: user.id,
    })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function updateDocumento(
  documentoId: string,
  establecimientoId: string,
  empresaId: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('documentos')
    .update({
      nombre: (formData.get('nombre') as string)?.trim(),
      tipo: formData.get('tipo') as DocumentoTipo,
      archivo_url: (formData.get('archivo_url') as string) || null,
      fecha_emision: (formData.get('fecha_emision') as string) || null,
      fecha_vencimiento: (formData.get('fecha_vencimiento') as string) || null,
      es_vigente: formData.get('es_vigente') !== 'false',
    })
    .eq('id', documentoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
