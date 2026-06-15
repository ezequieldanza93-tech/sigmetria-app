'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult, FirmaEntidadTipo } from '@/lib/types'

// Tipos de entidad de protocolo que aceptan firma. Todos comparten el mismo
// shape relevante: una tabla cabecera homónima con columna consultora_id.
const PROTOCOLO_TIPOS = [
  'medicion_pat',
  'medicion_iluminacion',
  'medicion_ruido',
  'medicion_carga_termica',
  'calculo_carga_fuego',
] as const

const firmarProtocoloSchema = z.object({
  entidadTipo: z.enum(PROTOCOLO_TIPOS),
  entidadId: z.string().min(1, { error: 'Entidad requerida' }),
  firmaSvgData: z.string().min(1, { error: 'Firma requerida' }),
  nombre: z.string().min(1, { error: 'Nombre requerido' }),
  dni: z.string().min(1, { error: 'DNI requerido' }),
  rol: z.string().nullable().optional(),
})

export type FirmarProtocoloInput = z.infer<typeof firmarProtocoloSchema>

export async function firmarProtocolo(
  input: FirmarProtocoloInput
): Promise<ActionResult<{ firma_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = firmarProtocoloSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map(i => i.message).join('; ') }
  }

  const { entidadTipo, entidadId, firmaSvgData, nombre, dni, rol } = parsed.data

  // Resolver consultora_id desde la tabla cabecera del protocolo.
  // Las 5 tablas (medicion_pat, medicion_iluminacion, medicion_ruido,
  // medicion_carga_termica, calculo_carga_fuego) tienen consultora_id directo.
  let consultoraId: string | null = null
  const { data: protocolo } = await supabase
    .from(entidadTipo)
    .select('consultora_id')
    .eq('id', entidadId)
    .maybeSingle()
  if (protocolo) {
    consultoraId = (protocolo as { consultora_id: string | null }).consultora_id
  }

  // Fallback: consultora del usuario autenticado.
  if (!consultoraId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('consultora_id')
      .eq('id', user.id)
      .maybeSingle()
    if (profile) {
      consultoraId = (profile as { consultora_id: string | null }).consultora_id
    }
  }

  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora' }

  // Resolver trabajador del directorio por DNI (opcional).
  const { data: persona } = await supabase
    .from('personas_directorio')
    .select('id')
    .eq('dni', dni)
    .maybeSingle()
  const trabajadorId = persona ? persona.id : null

  // Re-firma idempotente: si ya existe una firma de este firmante (mismo DNI)
  // para esta entidad, la reemplazamos borrándola antes de insertar la nueva.
  // Así una persona deja una sola firma por protocolo; otras personas conviven.
  await supabase
    .from('firmas')
    .delete()
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .eq('dni', dni)

  const { data: firma, error: insertError } = await supabase
    .from('firmas')
    .insert({
      consultora_id: consultoraId,
      entidad_tipo: entidadTipo as FirmaEntidadTipo,
      entidad_id: entidadId,
      firmante_tipo: 'trabajador',
      nombre_completo: nombre,
      dni,
      rol: rol || null,
      firma_svg_data: firmaSvgData,
      trabajador_id: trabajadorId,
      asistente_id: user.id,
    })
    .select('id')
    .single()

  if (insertError) return { success: false, error: insertError.message }
  if (!firma) return { success: false, error: 'No se pudo registrar la firma' }

  return { success: true, data: { firma_id: firma.id } }
}
