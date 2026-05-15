'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, DocumentoTipo } from '@/lib/types'

export async function createDocumento(
  empresaId: string,
  establecimientoId: string | null,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const document_type_id = formData.get('document_type_id') as string
  if (!document_type_id) return { success: false, error: 'El tipo de documento es obligatorio' }

  const { error } = await supabase
    .from('documentos')
    .insert({
      empresa_id: empresaId,
      establecimiento_id: establecimientoId,
      document_type_id,
      tipo: (formData.get('tipo') as DocumentoTipo) || 'otro',
      nombre: (formData.get('nombre') as string)?.trim() || '',
      fecha_vencimiento: (formData.get('fecha_vencimiento') as string) || null,
      include_in_legajo: formData.get('include_in_legajo') === '1',
      file_url: (formData.get('file_url') as string) || null,
      file_name: (formData.get('file_name') as string) || null,
      es_vigente: true,
      subido_por: user.id,
    })

  if (error) return { success: false, error: error.message }

  if (establecimientoId) {
    revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  } else {
    revalidatePath(`/dashboard/empresas/${empresaId}`)
  }

  return { success: true, data: null }
}
