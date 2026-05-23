'use server'

import { createClient } from '@/lib/supabase/server'
import type { Firma, FirmaEntidadTipo } from '@/lib/types'

export async function getFirmasEntidad(
  entidadTipo: FirmaEntidadTipo,
  entidadId: string
): Promise<Firma[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('firmas')
    .select('*, profiles!firmante_usuario_id(full_name), asistentes:profiles!asistente_id(full_name)')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('created_at', { ascending: true })

  return (data ?? []) as unknown as Firma[]
}
