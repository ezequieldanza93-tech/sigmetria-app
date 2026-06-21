'use server'

import { createAuditedClient } from '@/lib/audit/trace'
import type { ActionResult } from '@/lib/types'

export async function firmarGestion(
  gestionEstablecimientoId: string
): Promise<ActionResult<{ firma_id: string }>> {
  const { client: supabase } = await createAuditedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Obtener la gestión y su consultora.
  // Lookup robusto: maybeSingle() (no tira si el join devuelve 0 filas) + join NO-inner,
  // para distinguir "gestión inexistente" de "empresa/consultora no legible por RLS".
  // Antes, con .single() + empresas!inner, cualquiera de esos dos casos caía en el
  // genérico "Gestión no encontrada" (feedback b00a891a).
  const { data: ge, error: geError } = await supabase
    .from('gestiones_establecimientos')
    .select('id, establecimiento_id, empresas(consultora_id)')
    .eq('id', gestionEstablecimientoId)
    .maybeSingle()

  if (geError) return { success: false, error: `No se pudo leer la gestión: ${geError.message}` }
  if (!ge) return { success: false, error: 'Gestión no encontrada' }

  const geData = ge as unknown as {
    id: string
    establecimiento_id: string
    empresas: { consultora_id: string } | { consultora_id: string }[] | null
  }
  const empresaRel = Array.isArray(geData.empresas) ? geData.empresas[0] : geData.empresas
  let consultoraId = empresaRel?.consultora_id ?? null

  // Fallback: si el join no trajo la empresa (RLS), derivamos la consultora por el
  // camino canónico establecimiento → empresa → consultora.
  if (!consultoraId && geData.establecimiento_id) {
    const { data: est } = await supabase
      .from('establecimientos')
      .select('empresas!inner(consultora_id)')
      .eq('id', geData.establecimiento_id)
      .maybeSingle()
    const estRel = (est as unknown as { empresas: { consultora_id: string } | { consultora_id: string }[] } | null)?.empresas
    consultoraId = (Array.isArray(estRel) ? estRel[0] : estRel)?.consultora_id ?? null
  }

  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora de la gestión' }

  // Obtener perfil del usuario
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // Obtener membership para el rol
  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('consultora_id', consultoraId)
    .maybeSingle()

  const fullName = (profile as { full_name: string } | null)?.full_name ?? 'Usuario'
  const role = (membership as { role: string } | null)?.role ?? null

  const headers = await headersForServerAction()

  const { data: firma, error: insertError } = await supabase
    .from('firmas')
    .insert({
      consultora_id: consultoraId,
      entidad_tipo: 'gestion',
      entidad_id: gestionEstablecimientoId,
      firmante_tipo: 'usuario_interno',
      firmante_usuario_id: user.id,
      nombre_completo: fullName,
      dni: user.email ?? '',
      rol: role,
      ip_address: headers.ip,
      user_agent: headers.ua,
    })
    .select('id')
    .single()

  if (insertError) return { success: false, error: insertError.message }
  if (!firma) return { success: false, error: 'No se pudo registrar la firma' }

  // Marcar la gestión como firmada
  const { error: updateError } = await supabase
    .from('gestiones_establecimientos')
    .update({ firmada: true })
    .eq('id', gestionEstablecimientoId)

  if (updateError) return { success: false, error: updateError.message }

  return { success: true, data: { firma_id: firma.id } }
}

async function headersForServerAction(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const { headers } = await import('next/headers')
    const h = await headers()
    return {
      ip: h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? null,
      ua: h.get('user-agent') ?? null,
    }
  } catch {
    return { ip: null, ua: null }
  }
}
