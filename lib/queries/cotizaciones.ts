import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Queries del módulo de PRESUPUESTOS / cotizaciones (tabla fin_cotizaciones).
 *
 * - listarCotizaciones: lista el embudo comercial de la consultora con filtros.
 * - getDatosPrefillPresupuesto: arma los datos de cliente para prellenar el
 *   formulario / PDF, sea una empresa-cliente existente o un lead del CRM.
 *
 * Multi-tenant a nivel consultora. NO toca lib/queries/finanzas.ts.
 */

// ── Tipos ─────────────────────────────────────────────────────

export type CotizacionTipo = 'completo' | 'especifico'
export type CotizacionEstado = 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'vencida'

export interface CotizacionItem {
  descripcion: string
  monto: number
}

export interface Cotizacion {
  id: string
  consultora_id: string
  empresa_id: string | null
  lead_id: string | null
  prospecto_nombre: string | null
  prospecto_email: string | null
  prospecto_telefono: string | null
  tipo: CotizacionTipo
  concepto: string
  items: CotizacionItem[]
  monto_total: number
  moneda: string
  /** FK a fin_formas_pago (NULL si no se eligió forma de pago). */
  forma_pago_id: string | null
  estado: CotizacionEstado
  fecha_emision: string
  validez_dias: number | null
  fecha_decision: string | null
  convertida_empresa_id: string | null
  notas: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CotizacionesFiltros {
  estado?: CotizacionEstado
  tipo?: CotizacionTipo
  empresaId?: string
  leadId?: string
  desde?: string
  hasta?: string
}

/**
 * Datos del destinatario para prellenar el presupuesto. `clienteNombre` es lo
 * único garantizado; el resto puede venir null según el origen.
 */
export interface DatosPrefillPresupuesto {
  origen: 'empresa' | 'lead'
  empresaId?: string
  leadId?: string
  clienteNombre: string
  clienteCuit: string | null
  clienteEmail: string | null
  clienteTelefono: string | null
  clienteDomicilio: string | null
  /** Para leads: servicios que marcó de interés (sugerencia de concepto). */
  serviciosInteres: string[] | null
}

const SELECT_COTIZACION =
  'id, consultora_id, empresa_id, lead_id, prospecto_nombre, prospecto_email, prospecto_telefono, tipo, concepto, items, monto_total, moneda, forma_pago_id, estado, fecha_emision, validez_dias, fecha_decision, convertida_empresa_id, notas, created_by, created_at, updated_at'

/**
 * Lista las cotizaciones de la consultora, con filtros opcionales.
 * Ordenadas por fecha de emisión desc (luego created_at desc).
 */
export async function listarCotizaciones(
  consultoraId: string,
  filtros?: CotizacionesFiltros,
): Promise<Cotizacion[]> {
  const supabase = await createClient()
  let query = supabase
    .from('fin_cotizaciones')
    .select(SELECT_COTIZACION)
    .eq('consultora_id', consultoraId)

  if (filtros?.estado) query = query.eq('estado', filtros.estado)
  if (filtros?.tipo) query = query.eq('tipo', filtros.tipo)
  if (filtros?.empresaId) query = query.eq('empresa_id', filtros.empresaId)
  if (filtros?.leadId) query = query.eq('lead_id', filtros.leadId)
  if (filtros?.desde) query = query.gte('fecha_emision', filtros.desde)
  if (filtros?.hasta) query = query.lte('fecha_emision', filtros.hasta)

  const { data } = await query
    .order('fecha_emision', { ascending: false })
    .order('created_at', { ascending: false })

  return (data ?? []) as unknown as Cotizacion[]
}

/**
 * Arma los datos del cliente / prospecto para prellenar un presupuesto.
 * Resuelve por empresaId (cliente existente) o leadId (prospecto del CRM).
 * Ambos se validan contra consultoraId (scope multi-tenant).
 *
 * Devuelve null si no se encuentra el origen o no pertenece a la consultora.
 */
export async function getDatosPrefillPresupuesto(
  consultoraId: string,
  ref: { empresaId?: string; leadId?: string },
): Promise<DatosPrefillPresupuesto | null> {
  const supabase = await createClient()

  if (ref.empresaId) {
    const { data: empRaw } = await supabase
      .from('empresas')
      .select(
        'id, razon_social, cuit, domicilio, codigo_postal, localidad, provincia, ' +
          'localidad_ref:localidades(nombre, provincia)',
      )
      .eq('id', ref.empresaId)
      .eq('consultora_id', consultoraId)
      .maybeSingle()

    const emp = empRaw as unknown as {
      id: string
      razon_social: string | null
      cuit: string | null
      domicilio: string | null
      codigo_postal: string | null
      localidad: string | null
      provincia: string | null
      localidad_ref: { nombre: string | null; provincia: string | null } | null
    } | null
    if (!emp) return null

    // El domicilio puede armarse con la localidad normalizada (FK) o el texto libre.
    const loc = emp.localidad_ref
    const partesDom = [
      emp.domicilio,
      loc?.nombre ?? emp.localidad,
      loc?.provincia ?? emp.provincia,
      emp.codigo_postal ? `CP ${emp.codigo_postal}` : null,
    ].filter((p): p is string => !!p && String(p).trim().length > 0)

    return {
      origen: 'empresa',
      empresaId: emp.id,
      clienteNombre: emp.razon_social ?? '',
      clienteCuit: emp.cuit ?? null,
      clienteEmail: null, // empresas no tiene email directo en el esquema
      clienteTelefono: null, // ídem
      clienteDomicilio: partesDom.length > 0 ? partesDom.join(', ') : null,
      serviciosInteres: null,
    }
  }

  if (ref.leadId) {
    const { data: leadRaw } = await supabase
      .from('leads')
      .select('id, nombre, email, telefono, servicios_interes')
      .eq('id', ref.leadId)
      .eq('consultora_id', consultoraId)
      .maybeSingle()

    const lead = leadRaw as unknown as {
      id: string
      nombre: string | null
      email: string | null
      telefono: string | null
      servicios_interes: string[] | null
    } | null
    if (!lead) return null

    return {
      origen: 'lead',
      leadId: lead.id,
      clienteNombre: lead.nombre ?? '',
      clienteCuit: null,
      clienteEmail: lead.email ?? null,
      clienteTelefono: lead.telefono ?? null,
      clienteDomicilio: null,
      serviciosInteres: lead.servicios_interes ?? null,
    }
  }

  return null
}
