'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Regenera el token del QR del legajo (invalida el anterior y limpia
 * revocación/caducidad). El código pegado en obra deja de funcionar.
 */
export async function regenerarTokenEstablecimiento(
  establecimientoId: string,
  empresaId: string,
): Promise<{ success: boolean; error?: string; token?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase.rpc('regenerar_token', {
    p_establecimiento_id: establecimientoId,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, token: data as string }
}

/**
 * Revoca (o reactiva) el QR sin cambiar el token. Revocado → la vista pública
 * deja de resolver (404). Reactivado → vuelve a servir con el MISMO código
 * (útil para el QR pegado físico en obra). 2C.3.
 */
export async function setRevocacionToken(
  establecimientoId: string,
  empresaId: string,
  revocado: boolean,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase.rpc('set_token_revocado', {
    p_establecimiento_id: establecimientoId,
    p_revocado: revocado,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true }
}

/**
 * Setea (o limpia) la caducidad OPCIONAL del QR. `expiresAt` = ISO date-time,
 * o null para dejarlo permanente. 2C.3.
 */
export async function setCaducidadToken(
  establecimientoId: string,
  empresaId: string,
  expiresAt: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase.rpc('set_token_caducidad', {
    p_establecimiento_id: establecimientoId,
    p_expires_at: expiresAt,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true }
}

/**
 * Cambia la visibilidad de un documento del establecimiento en la vista pública
 * del QR (inspector). `visible=false` lo oculta del legajo público. 2C.1/2C.2.
 * El filtro de vencidos es automático y NO depende de este flag.
 */
export async function setDocumentoVisiblePublico(
  documentoId: string,
  establecimientoId: string,
  empresaId: string,
  visible: boolean,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // La RLS de establecimientos_documentos ya scopea el UPDATE a la consultora
  // dueña del establecimiento; acá filtramos por establecimiento por las dudas.
  const { error } = await supabase
    .from('establecimientos_documentos')
    .update({ legajo_publico_visible: visible })
    .eq('id', documentoId)
    .eq('establecimiento_id', establecimientoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true }
}
