'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult, FirmaEntidadTipo } from '@/lib/types'

const firmarTrabajadorSchema = z.object({
  entidad_tipo: z.enum(['gestion', 'capacitacion', 'permiso_trabajo', 'entrega_epp']),
  entidad_id: z.string().min(1),
  /** FK al directorio cuando la persona ya existe. El snapshot de nombre/dni/rol se guarda igual. */
  persona_id: z.string().uuid().nullable().optional(),
  nombre_completo: z.string().min(1, { error: 'Nombre requerido' }),
  dni: z.string().min(1, { error: 'DNI requerido' }),
  rol: z.string().nullable().optional(),
  firma_svg_data: z.string().min(1, { error: 'Firma requerida' }),
})

export type FirmarTrabajadorInput = z.infer<typeof firmarTrabajadorSchema>

export async function firmarRegistroTrabajador(
  input: FirmarTrabajadorInput
): Promise<ActionResult<{ firma_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = firmarTrabajadorSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map(i => i.message).join('; ') }
  }

  const { entidad_tipo, entidad_id, persona_id, nombre_completo, dni, rol, firma_svg_data } = parsed.data

  // Determinar consultora según el tipo de entidad
  let consultoraId: string | null = null

  if (entidad_tipo === 'capacitacion') {
    const { data: cap } = await supabase
      .from('capacitaciones')
      .select('empresas!inner(consultora_id)')
      .eq('id', entidad_id)
      .single()
    if (cap) consultoraId = (cap as unknown as { empresas: { consultora_id: string } }).empresas.consultora_id
  } else if (entidad_tipo === 'gestion') {
    const { data: ge } = await supabase
      .from('gestiones_establecimientos')
      .select('empresas!inner(consultora_id)')
      .eq('id', entidad_id)
      .single()
    if (ge) consultoraId = (ge as unknown as { empresas: { consultora_id: string } }).empresas.consultora_id
  }

  if (!consultoraId) return { success: false, error: 'Entidad no encontrada' }

  // Vincular al directorio: si el selector ya entregó la persona, usamos ese FK
  // directamente; si no, caemos al lookup por DNI (compatibilidad con flujos viejos).
  let trabajadorId: string | null = persona_id ?? null
  if (!trabajadorId) {
    const { data: existingPersona } = await supabase
      .from('personas_directorio')
      .select('id')
      .eq('dni', dni)
      .maybeSingle()
    if (existingPersona) trabajadorId = existingPersona.id
  }

  const { data: firma, error: insertError } = await supabase
    .from('firmas')
    .insert({
      consultora_id: consultoraId,
      entidad_tipo: entidad_tipo as FirmaEntidadTipo,
      entidad_id,
      firmante_tipo: 'trabajador',
      nombre_completo,
      dni,
      rol: rol || null,
      firma_svg_data,
      trabajador_id: trabajadorId,
      asistente_id: user.id,
    })
    .select('id')
    .single()

  if (insertError) return { success: false, error: insertError.message }
  if (!firma) return { success: false, error: 'No se pudo registrar la firma' }

  // Marcar entidad como firmada si aplica
  if (entidad_tipo === 'capacitacion') {
    await supabase.from('capacitaciones').update({ firmada: true }).eq('id', entidad_id)
  } else if (entidad_tipo === 'gestion') {
    await supabase.from('gestiones_establecimientos').update({ firmada: true }).eq('id', entidad_id)
  }

  return { success: true, data: { firma_id: firma.id } }
}
