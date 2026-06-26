'use server'

/**
 * finanzas-conversion.ts — Server actions de CONVERSIÓN comercial.
 *
 * Desde un presupuesto (fin_cotizaciones) aceptado, el usuario puede:
 *   a) facturarlo → necesita una empresa-cliente destino.
 *   b) generar un contrato → ídem.
 *
 * Cuando la cotización apunta a un LEAD o a un prospecto manual (sin empresa
 * cliente), primero hay que dar de alta la empresa-cliente. Acá vive esa lógica:
 *
 *   · getPrefillEmpresaDeCotizacion → resuelve si ya hay empresa destino o, si
 *     no, devuelve los datos para prellenar el mini-form de confirmación.
 *   · crearEmpresaDesdeCotizacion → crea la empresa-cliente (idempotente) y
 *     enlaza la cotización vía convertida_empresa_id.
 *
 * Todo gateado por getFinanzasAccess y scopeado a la consultora del contexto:
 * del cliente solo confiamos en el cotizacionId — la cotización se re-carga y
 * re-valida server-side; consultora_id JAMÁS viene del input.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getFinanzasAccess } from '@/lib/finanzas/access'
import type { ActionResult } from '@/lib/types'

// ── Tipos ─────────────────────────────────────────────────────

interface PrefillEmpresa {
  razonSocial: string
  cuit: string | null
  email: string | null
  telefono: string | null
}

interface CotizacionDestino {
  empresa_id: string | null
  convertida_empresa_id: string | null
  lead_id: string | null
  prospecto_nombre: string | null
  prospecto_email: string | null
  prospecto_telefono: string | null
}

/**
 * Carga la cotización (scopeada a la consultora) con los campos necesarios para
 * resolver el destino. Devuelve null si no existe / no pertenece a la consultora.
 */
async function cargarCotizacion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  consultoraId: string,
  cotizacionId: string,
): Promise<CotizacionDestino | null> {
  const { data } = await supabase
    .from('fin_cotizaciones')
    .select(
      'empresa_id, convertida_empresa_id, lead_id, prospecto_nombre, prospecto_email, prospecto_telefono',
    )
    .eq('id', cotizacionId)
    .eq('consultora_id', consultoraId)
    .maybeSingle()
  return (data as unknown as CotizacionDestino | null) ?? null
}

// ── Acciones ──────────────────────────────────────────────────

/**
 * Resuelve la empresa-cliente destino de una cotización:
 *   · Si ya tiene empresa_id o convertida_empresa_id → { empresaId, prefill: null }.
 *   · Si apunta a un lead → prefill con nombre/email/teléfono del lead.
 *   · Si es prospecto manual → prefill con los campos planos de la cotización.
 *
 * No crea nada: solo informa qué hace falta para continuar (facturar/contratar).
 */
export async function getPrefillEmpresaDeCotizacion(
  cotizacionId: string,
): Promise<
  ActionResult<{ empresaId: string | null; prefill: PrefillEmpresa | null }>
> {
  const acc = await getFinanzasAccess()
  if (!acc.hasAccess || !acc.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  if (!cotizacionId) return { success: false, error: 'cotizacionId requerido' }

  const supabase = await createClient()
  const cot = await cargarCotizacion(supabase, acc.consultoraId, cotizacionId)
  if (!cot) return { success: false, error: 'No se encontró el presupuesto' }

  // Ya hay empresa-cliente destino (original o creada por conversión).
  const empresaId = cot.empresa_id ?? cot.convertida_empresa_id ?? null
  if (empresaId) {
    return { success: true, data: { empresaId, prefill: null } }
  }

  // Destino lead → datos del lead (scopeado).
  if (cot.lead_id) {
    const { data: lead } = await supabase
      .from('leads')
      .select('nombre, email, telefono')
      .eq('id', cot.lead_id)
      .eq('consultora_id', acc.consultoraId)
      .maybeSingle()
    return {
      success: true,
      data: {
        empresaId: null,
        prefill: {
          razonSocial: (lead?.nombre as string | null) ?? cot.prospecto_nombre ?? '',
          cuit: null,
          email: (lead?.email as string | null) ?? cot.prospecto_email ?? null,
          telefono: (lead?.telefono as string | null) ?? cot.prospecto_telefono ?? null,
        },
      },
    }
  }

  // Prospecto manual → campos planos de la cotización.
  return {
    success: true,
    data: {
      empresaId: null,
      prefill: {
        razonSocial: cot.prospecto_nombre ?? '',
        cuit: null,
        email: cot.prospecto_email,
        telefono: cot.prospecto_telefono,
      },
    },
  }
}

/**
 * Da de alta la empresa-cliente destino de una cotización y la enlaza.
 *
 * Idempotente: si la cotización ya tiene empresa_id/convertida_empresa_id,
 * devuelve ese id sin crear nada. Si no, inserta en `empresas` (consultora del
 * contexto) y setea convertida_empresa_id en la cotización.
 *
 * `empresas` no tiene columnas email/teléfono → se pliegan en informacion_general.
 */
export async function crearEmpresaDesdeCotizacion(
  cotizacionId: string,
  datos: { razonSocial: string; cuit?: string | null; email?: string | null; telefono?: string | null },
): Promise<ActionResult<{ empresaId: string }>> {
  const acc = await getFinanzasAccess()
  if (!acc.hasAccess || !acc.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de finanzas' }
  }
  if (!cotizacionId) return { success: false, error: 'cotizacionId requerido' }

  const razonSocial = datos.razonSocial?.trim()
  if (!razonSocial) return { success: false, error: 'La razón social es obligatoria' }

  const consultoraId = acc.consultoraId
  const supabase = await createClient()

  const cot = await cargarCotizacion(supabase, consultoraId, cotizacionId)
  if (!cot) return { success: false, error: 'No se encontró el presupuesto' }

  // Idempotencia: ya hay empresa-cliente destino.
  const existente = cot.empresa_id ?? cot.convertida_empresa_id ?? null
  if (existente) {
    return { success: true, data: { empresaId: existente } }
  }

  // `empresas` no tiene email/teléfono → los plegamos en informacion_general.
  const email = datos.email?.trim() || null
  const telefono = datos.telefono?.trim() || null
  const contacto = [email, telefono].filter((p): p is string => !!p).join(' · ')
  const informacionGeneral = contacto ? `Contacto: ${contacto}` : null

  // Id generado en el server: insertamos SIN RETURNING a propósito (la policy de
  // SELECT reconsulta con el snapshot previo al INSERT → rechazaría con 42501).
  const empresaId = crypto.randomUUID()
  const { error: insErr } = await supabase.from('empresas').insert({
    id: empresaId,
    consultora_id: consultoraId,
    razon_social: razonSocial,
    cuit: datos.cuit?.trim() || null,
    informacion_general: informacionGeneral,
  })
  if (insErr) {
    return { success: false, error: 'No se pudo crear la empresa-cliente: ' + insErr.message }
  }

  // Enlazamos la cotización con la empresa recién creada (scopeado).
  const { error: updErr } = await supabase
    .from('fin_cotizaciones')
    .update({ convertida_empresa_id: empresaId, updated_at: new Date().toISOString() })
    .eq('id', cotizacionId)
    .eq('consultora_id', consultoraId)
  if (updErr) {
    return { success: false, error: 'Empresa creada, pero no se pudo enlazar: ' + updErr.message }
  }

  revalidatePath('/dashboard/finanzas/cotizaciones')
  revalidatePath('/dashboard/finanzas/facturacion')
  revalidatePath('/dashboard/finanzas/contratos')
  revalidatePath('/dashboard/empresas')

  return { success: true, data: { empresaId } }
}
