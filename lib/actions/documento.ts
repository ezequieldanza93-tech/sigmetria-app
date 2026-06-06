'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createDocumento(
  empresaId: string,
  establecimientoId: string | null,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const tipo_id = formData.get('document_type_id') as string
  if (!tipo_id) return { success: false, error: 'El tipo de documento es obligatorio' }

  const commonFields = {
    // archivo_url almacena el PATH relativo del objeto (bucket `documentos`).
    // El form envía `file_path` (path) y `file_url` (= path, por compat).
    tipo_id,
    archivo_url: (formData.get('file_path') as string) || (formData.get('file_url') as string) || null,
    fecha_vencimiento: (formData.get('fecha_vencimiento') as string) || null,
    subido_por: user.id,
  }

  let error: { message: string } | null = null

  if (establecimientoId) {
    const result = await supabase
      .from('establecimientos_documentos')
      .insert({ ...commonFields, establecimiento_id: establecimientoId })
    error = result.error
  } else {
    const result = await supabase
      .from('empresas_documentos')
      .insert({ ...commonFields, empresa_id: empresaId })
    error = result.error
  }

  if (error) return { success: false, error: error.message }

  if (establecimientoId) {
    revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  } else {
    revalidatePath(`/dashboard/empresas/${empresaId}`)
  }

  return { success: true, data: null }
}
