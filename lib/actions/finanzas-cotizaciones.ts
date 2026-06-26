'use server'

/**
 * finanzas-cotizaciones.ts — Server actions del módulo PRESUPUESTOS / cotizaciones.
 *
 * CRUD sobre fin_cotizaciones + generación del PDF del presupuesto:
 *   1. Arma los datos (consultora emisora + responsable técnico + cliente/prospecto).
 *   2. presupuestoHtml(datos) → HTML A4 autocontenido.
 *   3. renderHtmlToPdf(html) → Buffer (Chromium serverless, respeta @page A4).
 *   4. Sube el Buffer al bucket privado `documentos` con path multi-tenant
 *      {consultora}/presupuestos/{cotizacionId}/{ts}.pdf (cliente admin → bypassea RLS).
 *   5. Devuelve un signed URL (TTL ~60 min) para descargar/visualizar.
 *
 * Todas las mutaciones validan rol full_access vía getFinanzasAccess y setean
 * consultora_id desde el contexto (jamás lo toma del input).
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFinanzasAccess, getFinConfig } from '@/lib/finanzas/access'
import { renderHtmlToPdf } from '@/lib/pdf/render-protocolo'
import { presupuestoHtml, type PresupuestoDatos, type PresupuestoItem } from '@/lib/pdf/presupuesto-html'
import type { CotizacionTipo, CotizacionEstado, CotizacionItem } from '@/lib/queries/cotizaciones'
import type { ActionResult } from '@/lib/types'

// ── Inputs ────────────────────────────────────────────────────

export interface CotizacionInput {
  tipo?: CotizacionTipo
  concepto: string
  /** Ítems del detalle (solo para tipo 'especifico'). */
  items?: CotizacionItem[]
  /** Total. Si se omite y tipo='especifico', se suma de los ítems. */
  montoTotal?: number
  moneda?: string
  /** FK a fin_formas_pago. null = sin forma de pago. */
  formaPagoId?: string | null
  validezDias?: number | null
  notas?: string | null
  // Destinatario: empresa-cliente existente, lead del CRM, o prospecto suelto.
  empresaId?: string | null
  leadId?: string | null
  prospectoNombre?: string | null
  prospectoEmail?: string | null
  prospectoTelefono?: string | null
  estado?: CotizacionEstado
}

// ── Helpers internos ──────────────────────────────────────────

function normalizarItems(items?: CotizacionItem[] | null): PresupuestoItem[] {
  if (!items) return []
  return items
    .filter((it) => it && typeof it.descripcion === 'string')
    .map((it) => ({ descripcion: it.descripcion, monto: Number(it.monto) || 0 }))
}

/** Total efectivo: el explícito si vino, si no la suma de ítems. */
function resolverTotal(input: CotizacionInput, items: PresupuestoItem[]): number {
  if (typeof input.montoTotal === 'number' && Number.isFinite(input.montoTotal)) {
    return input.montoTotal
  }
  return items.reduce((acc, it) => acc + (Number(it.monto) || 0), 0)
}

// ── CRUD ──────────────────────────────────────────────────────

/** Crea una cotización en estado 'borrador' (o el estado provisto). */
export async function crearCotizacion(
  input: CotizacionInput,
): Promise<ActionResult<{ id: string }>> {
  const acc = await getFinanzasAccess()
  if (!acc.hasAccess || !acc.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de presupuestos' }
  }
  if (!input.concepto || !input.concepto.trim()) {
    return { success: false, error: 'El concepto es obligatorio' }
  }

  const tipo: CotizacionTipo = input.tipo ?? 'completo'
  const items = tipo === 'especifico' ? normalizarItems(input.items) : []
  const montoTotal = resolverTotal(input, items)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fin_cotizaciones')
    .insert({
      consultora_id: acc.consultoraId,
      empresa_id: input.empresaId ?? null,
      lead_id: input.leadId ?? null,
      prospecto_nombre: input.prospectoNombre ?? null,
      prospecto_email: input.prospectoEmail ?? null,
      prospecto_telefono: input.prospectoTelefono ?? null,
      tipo,
      concepto: input.concepto.trim(),
      items,
      monto_total: montoTotal,
      moneda: input.moneda ?? undefined, // deja el default 'ARS' de la tabla si no viene
      forma_pago_id: input.formaPagoId ?? null,
      validez_dias: input.validezDias ?? undefined,
      notas: input.notas ?? null,
      estado: input.estado ?? 'borrador',
      created_by: acc.userId,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: 'No se pudo crear la cotización: ' + (error?.message ?? 'desconocido') }
  }
  return { success: true, data: { id: data.id as string } }
}

/** Actualiza una cotización existente (scope consultora). */
export async function actualizarCotizacion(
  id: string,
  input: CotizacionInput,
): Promise<ActionResult<{ id: string }>> {
  const acc = await getFinanzasAccess()
  if (!acc.hasAccess || !acc.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de presupuestos' }
  }
  if (!id) return { success: false, error: 'id requerido' }
  if (!input.concepto || !input.concepto.trim()) {
    return { success: false, error: 'El concepto es obligatorio' }
  }

  const tipo: CotizacionTipo = input.tipo ?? 'completo'
  const items = tipo === 'especifico' ? normalizarItems(input.items) : []
  const montoTotal = resolverTotal(input, items)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fin_cotizaciones')
    .update({
      empresa_id: input.empresaId ?? null,
      lead_id: input.leadId ?? null,
      prospecto_nombre: input.prospectoNombre ?? null,
      prospecto_email: input.prospectoEmail ?? null,
      prospecto_telefono: input.prospectoTelefono ?? null,
      tipo,
      concepto: input.concepto.trim(),
      items,
      monto_total: montoTotal,
      ...(input.moneda ? { moneda: input.moneda } : {}),
      forma_pago_id: input.formaPagoId ?? null,
      validez_dias: input.validezDias ?? null,
      notas: input.notas ?? null,
      ...(input.estado ? { estado: input.estado } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('consultora_id', acc.consultoraId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return { success: false, error: 'No se pudo actualizar la cotización: ' + (error?.message ?? 'no encontrada') }
  }
  return { success: true, data: { id: data.id as string } }
}

/** Elimina una cotización (scope consultora). */
export async function eliminarCotizacion(id: string): Promise<ActionResult<{ id: string }>> {
  const acc = await getFinanzasAccess()
  if (!acc.hasAccess || !acc.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de presupuestos' }
  }
  if (!id) return { success: false, error: 'id requerido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('fin_cotizaciones')
    .delete()
    .eq('id', id)
    .eq('consultora_id', acc.consultoraId)

  if (error) return { success: false, error: 'No se pudo eliminar: ' + error.message }
  return { success: true, data: { id } }
}

/**
 * Cambia el estado del embudo. Al pasar a 'aceptada'/'rechazada' setea
 * fecha_decision; al volver a un estado abierto la limpia.
 */
export async function cambiarEstadoCotizacion(
  id: string,
  estado: CotizacionEstado,
): Promise<ActionResult<{ id: string }>> {
  const acc = await getFinanzasAccess()
  if (!acc.hasAccess || !acc.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de presupuestos' }
  }
  if (!id) return { success: false, error: 'id requerido' }

  const decision = estado === 'aceptada' || estado === 'rechazada'
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fin_cotizaciones')
    .update({
      estado,
      fecha_decision: decision ? new Date().toISOString().slice(0, 10) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('consultora_id', acc.consultoraId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return { success: false, error: 'No se pudo cambiar el estado: ' + (error?.message ?? 'no encontrada') }
  }
  return { success: true, data: { id: data.id as string } }
}

// ── Armado de datos del presupuesto (compartido) ──────────────

/**
 * Resultado de armarDatosPresupuesto: los `datos` listos para renderizar el PDF
 * + algunos campos de cabecera ya resueltos (nombre/email del cliente, nombre
 * de la consultora y del responsable) que consume el flujo de envío por email.
 */
export interface DatosPresupuesto {
  datos: PresupuestoDatos
  clienteNombre: string
  clienteEmail: string | null
  consultoraNombre: string
  responsableNombre: string | null
}

/**
 * Carga y ESCOPEA la cotización contra la consultora del usuario, resuelve la
 * consultora emisora, el responsable técnico, el cliente/prospecto y la forma de
 * pago, y arma el objeto `datos: PresupuestoDatos` listo para `presupuestoHtml`.
 *
 * Helper compartido por generarPresupuestoPdf (descarga del PDF) y por el flujo
 * de envío por email — para no duplicar el gating, el scope ni el armado.
 */
export async function armarDatosPresupuesto(
  cotizacionId: string,
): Promise<ActionResult<DatosPresupuesto>> {
  const acc = await getFinanzasAccess()
  if (!acc.hasAccess || !acc.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de presupuestos' }
  }
  if (!cotizacionId) return { success: false, error: 'cotizacionId requerido' }

  const consultoraId = acc.consultoraId
  const supabase = await createClient()

  // ── 1. Cotización (validada contra la consultora) ──────────────
  const { data: cotRaw, error: cotErr } = await supabase
    .from('fin_cotizaciones')
    .select(
      'id, consultora_id, empresa_id, lead_id, prospecto_nombre, prospecto_email, prospecto_telefono, ' +
        'tipo, concepto, items, monto_total, moneda, forma_pago_id, fecha_emision, validez_dias, notas',
    )
    .eq('id', cotizacionId)
    .eq('consultora_id', consultoraId)
    .maybeSingle()

  const cot = cotRaw as unknown as {
    empresa_id: string | null
    lead_id: string | null
    prospecto_nombre: string | null
    prospecto_email: string | null
    prospecto_telefono: string | null
    tipo: CotizacionTipo | null
    concepto: string | null
    items: PresupuestoItem[] | null
    monto_total: number | string | null
    moneda: string | null
    forma_pago_id: string | null
    fecha_emision: string | null
    validez_dias: number | null
    notas: string | null
  } | null
  if (cotErr || !cot) {
    return { success: false, error: 'No se encontró la cotización' }
  }

  // ── 2. Consultora emisora ──────────────────────────────────────
  const { data: consultoraRaw } = await supabase
    .from('consultoras')
    .select('nombre, cuit, telefono, email, logo_url, domicilio_legal, domicilio_fiscal, color_marca_primario, color_marca_secundario')
    .eq('id', consultoraId)
    .maybeSingle()
  const consultora = consultoraRaw as unknown as {
    nombre: string | null
    cuit: string | null
    telefono: string | null
    email: string | null
    logo_url: string | null
    domicilio_legal: string | null
    domicilio_fiscal: string | null
    color_marca_primario: string | null
    color_marca_secundario: string | null
  } | null

  // ── 3. Responsable técnico = full_access_main de la consultora ─
  const responsable = await getResponsableTecnico(supabase, consultoraId)

  // ── 4. Cliente / prospecto ─────────────────────────────────────
  const cliente = await resolverCliente(supabase, consultoraId, {
    empresaId: cot.empresa_id ?? undefined,
    leadId: cot.lead_id ?? undefined,
    prospectoNombre: cot.prospecto_nombre ?? undefined,
    prospectoEmail: cot.prospecto_email ?? undefined,
    prospectoTelefono: cot.prospecto_telefono ?? undefined,
  })

  // ── 4b. Forma de pago (nombre, si la cotización tiene una asignada) ─
  let formaPagoNombre: string | null = null
  if (cot.forma_pago_id) {
    const { data: fp } = await supabase
      .from('fin_formas_pago')
      .select('nombre')
      .eq('id', cot.forma_pago_id)
      .maybeSingle()
    formaPagoNombre = (fp?.nombre as string | null) ?? null
  }

  // ── 5. Formato (locale/moneda de la consultora) ────────────────
  const finConfig = await getFinConfig(consultoraId)
  const moneda = cot.moneda || finConfig.moneda
  const locale = finConfig.locale

  const items = Array.isArray(cot.items) ? cot.items : []

  const consultoraNombre = consultora?.nombre ?? 'Consultora'

  const datos: PresupuestoDatos = {
    fechaEmision: cot.fecha_emision ?? new Date().toISOString().slice(0, 10),
    validezDias: cot.validez_dias ?? null,
    consultoraNombre,
    consultoraCuit: consultora?.cuit ?? null,
    consultoraTelefono: consultora?.telefono ?? null,
    consultoraEmail: consultora?.email ?? null,
    consultoraDomicilio: consultora?.domicilio_legal ?? consultora?.domicilio_fiscal ?? null,
    logoUrl: consultora?.logo_url ?? null,
    colorPrimario: consultora?.color_marca_primario ?? null,
    colorSecundario: consultora?.color_marca_secundario ?? null,
    responsableNombre: responsable.nombre,
    responsableTitulo: responsable.titulo,
    responsableMatricula: responsable.matricula,
    clienteNombre: cliente.nombre,
    clienteCuit: cliente.cuit,
    clienteEmail: cliente.email,
    clienteTelefono: cliente.telefono,
    clienteDomicilio: cliente.domicilio,
    concepto: cot.concepto ?? '',
    tipo: cot.tipo ?? 'completo',
    items,
    montoTotal: Number(cot.monto_total) || 0,
    formaPago: formaPagoNombre,
    notas: cot.notas ?? null,
    moneda,
    locale,
  }

  return {
    success: true,
    data: {
      datos,
      clienteNombre: cliente.nombre,
      clienteEmail: cliente.email,
      consultoraNombre,
      responsableNombre: responsable.nombre,
    },
  }
}

// ── Generación del PDF ────────────────────────────────────────

/**
 * Genera el PDF del presupuesto de una cotización, lo guarda en el bucket
 * privado `documentos` y devuelve un signed URL para descargarlo.
 *
 * La cotización debe pertenecer a la consultora del usuario (scope multi-tenant).
 */
export async function generarPresupuestoPdf(
  cotizacionId: string,
): Promise<ActionResult<{ pdfUrl: string }>> {
  // El gating, el scope multi-tenant y todo el armado de `datos` viven en el
  // helper compartido; acá solo renderizamos, subimos y firmamos.
  const armado = await armarDatosPresupuesto(cotizacionId)
  if (!armado.success) return armado

  const acc = await getFinanzasAccess()
  if (!acc.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de presupuestos' }
  }
  const consultoraId = acc.consultoraId
  const { datos } = armado.data

  // ── 6. Render HTML → PDF ───────────────────────────────────────
  let buffer: Buffer
  try {
    const html = presupuestoHtml(datos)
    buffer = await renderHtmlToPdf(html)
  } catch (err) {
    console.error('[PRESUPUESTO-PDF] error generando PDF:', err instanceof Error ? err.message : String(err))
    return { success: false, error: 'No se pudo generar el PDF del presupuesto' }
  }

  // ── 7. Subir al bucket privado `documentos` (admin → bypassea RLS) ─
  const admin = createAdminClient()
  const path = `${consultoraId}/presupuestos/${cotizacionId}/${Date.now()}.pdf`
  const { error: upErr } = await admin.storage
    .from('documentos')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: false })
  if (upErr) {
    console.error('[PRESUPUESTO-PDF] upload falló:', upErr.message)
    return { success: false, error: 'No se pudo guardar el PDF: ' + upErr.message }
  }

  // ── 8. Signed URL (60 min) ─────────────────────────────────────
  const { data: signed, error: signErr } = await admin.storage
    .from('documentos')
    .createSignedUrl(path, 60 * 60)
  if (signErr || !signed?.signedUrl) {
    return { success: false, error: 'No se pudo generar el enlace de descarga' }
  }

  return { success: true, data: { pdfUrl: signed.signedUrl } }
}

// ── Resolvers (privados) ──────────────────────────────────────

type SupabaseLike = Awaited<ReturnType<typeof createClient>>

interface ResponsableTecnico {
  nombre: string | null
  titulo: string | null
  matricula: string | null
}

/**
 * Resuelve el responsable técnico: el full_access_main de la consultora.
 * Toma su full_name (profiles), su título (perfiles_profesionales) y la
 * matrícula activa (matriculas_profesionales).
 */
async function getResponsableTecnico(
  supabase: SupabaseLike,
  consultoraId: string,
): Promise<ResponsableTecnico> {
  const vacio: ResponsableTecnico = { nombre: null, titulo: null, matricula: null }

  const { data: member } = await supabase
    .from('consultora_members')
    .select('user_id')
    .eq('consultora_id', consultoraId)
    .eq('role', 'full_access_main')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const userId = member?.user_id as string | undefined
  if (!userId) return vacio

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()

  const { data: perfil } = await supabase
    .from('perfiles_profesionales')
    .select('id, titulo')
    .eq('user_id', userId)
    .maybeSingle()

  let matricula: string | null = null
  if (perfil?.id) {
    const { data: mat } = await supabase
      .from('matriculas_profesionales')
      .select('emisor, numero')
      .eq('perfil_id', perfil.id)
      .eq('activa', true)
      .limit(1)
      .maybeSingle()
    if (mat?.emisor || mat?.numero) {
      matricula = [mat?.emisor, mat?.numero ? `N° ${mat.numero}` : null]
        .filter((p): p is string => !!p)
        .join(' ')
    }
  }

  return {
    nombre: (profile?.full_name as string | null) ?? null,
    titulo: (perfil?.titulo as string | null) ?? null,
    matricula,
  }
}

interface ClienteResuelto {
  nombre: string
  cuit: string | null
  email: string | null
  telefono: string | null
  domicilio: string | null
}

/**
 * Resuelve los datos del destinatario del presupuesto, en este orden:
 *   1. empresa-cliente (empresaId) → razón social, CUIT, domicilio armado.
 *   2. lead del CRM (leadId) → nombre, email, teléfono.
 *   3. prospecto suelto (campos planos guardados en la cotización).
 */
async function resolverCliente(
  supabase: SupabaseLike,
  consultoraId: string,
  ref: {
    empresaId?: string
    leadId?: string
    prospectoNombre?: string
    prospectoEmail?: string
    prospectoTelefono?: string
  },
): Promise<ClienteResuelto> {
  if (ref.empresaId) {
    const { data: emp } = await supabase
      .from('empresas')
      .select('razon_social, cuit, domicilio, codigo_postal, localidad, provincia')
      .eq('id', ref.empresaId)
      .eq('consultora_id', consultoraId)
      .maybeSingle()
    if (emp) {
      const partesDom = [
        emp.domicilio as string | null,
        emp.localidad as string | null,
        emp.provincia as string | null,
        emp.codigo_postal ? `CP ${emp.codigo_postal}` : null,
      ].filter((p): p is string => !!p && String(p).trim().length > 0)
      return {
        nombre: (emp.razon_social as string | null) ?? ref.prospectoNombre ?? '',
        cuit: (emp.cuit as string | null) ?? null,
        email: ref.prospectoEmail ?? null,
        telefono: ref.prospectoTelefono ?? null,
        domicilio: partesDom.length > 0 ? partesDom.join(', ') : null,
      }
    }
  }

  if (ref.leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('nombre, email, telefono')
      .eq('id', ref.leadId)
      .eq('consultora_id', consultoraId)
      .maybeSingle()
    if (lead) {
      return {
        nombre: (lead.nombre as string | null) ?? ref.prospectoNombre ?? '',
        cuit: null,
        email: (lead.email as string | null) ?? ref.prospectoEmail ?? null,
        telefono: (lead.telefono as string | null) ?? ref.prospectoTelefono ?? null,
        domicilio: null,
      }
    }
  }

  // Prospecto suelto.
  return {
    nombre: ref.prospectoNombre ?? '',
    cuit: null,
    email: ref.prospectoEmail ?? null,
    telefono: ref.prospectoTelefono ?? null,
    domicilio: null,
  }
}
