'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createEmpleadoDocumento(
  empleadoId: string,
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const tipoId = formData.get('tipo_id') as string
  const fechaEmision = formData.get('fecha_emision') as string
  const fechaVencimiento = formData.get('fecha_vencimiento') as string
  const file = formData.get('archivo') as File | null

  if (!tipoId) return { success: false, error: 'Seleccioná un tipo de documento' }

  let archivoUrl: string | null = null

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop()
    const path = `empleados/${empleadoId}/${Date.now()}.${ext}`
    const { data: upload, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, file, { upsert: false })

    if (uploadError) return { success: false, error: 'Error al subir el archivo: ' + uploadError.message }

    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(upload.path)
    archivoUrl = publicUrl
  }

  const { error } = await supabase
    .from('empleado_documentos')
    .insert({
      persona_id: empleadoId,
      tipo_id: tipoId,
      archivo_url: archivoUrl,
      fecha_emision: fechaEmision || null,
      fecha_vencimiento: fechaVencimiento || null,
      subido_por: user.id,
    })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
