'use server'

/**
 * generar-contrato.ts — Generación del CONTRATO de prestación de servicios de HyS
 * en PDF (módulo Finanzas → documentos).
 *
 * FLUJO:
 *   getDatosContrato(empresaId)
 *     → arma el PREFILL (consultora + responsable técnico/matrícula + empresa +
 *       establecimientos) y reporta los campos que conviene completar a mano
 *       (honorarios, vigencia, frecuencia de visitas, etc.).
 *   generarContratoPdf(empresaId, form)
 *     → merge prefill + form → contratoHtml() → renderHtmlToPdf() (Chromium) →
 *       sube el Buffer al bucket privado `documentos` con path multi-tenant
 *       {consultora_id}/contratos/{empresaId}/{ts}.pdf → devuelve signed URL.
 *
 * El contrato es STANDALONE: no se persiste fila en DB (a diferencia del
 * presupuesto, que vive en fin_cotizaciones).
 *
 * ACCESO: gate del módulo Finanzas (full_access_main o developer) vía
 * getFinanzasAccess(). Además se verifica que la empresa pertenezca a la
 * consultora del usuario (scope multi-tenant).
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFinanzasAccess } from '@/lib/finanzas/access'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import { tenantStoragePath } from '@/lib/storage/tenant-path'
import { renderHtmlToPdf } from '@/lib/pdf/render-protocolo'
import { contratoHtml, type ContratoDatos, type ContratoEstablecimiento } from '@/lib/pdf/contrato-html'
import type { ActionResult } from '@/lib/types'

/** TTL de la signed URL de descarga del contrato: 60 minutos. */
const CONTRATO_SIGNED_TTL_SECONDS = 60 * 60

/**
 * Campos del contrato que el usuario completa en el formulario (lo que NO se
 * deriva de la base). Todos opcionales: lo que se omite queda en blanco en el PDF
 * para completar a mano.
 */
export interface ContratoFormInput {
  // Comparecencia
  ciudad?: string
  provincia?: string
  dia?: string
  mes?: string
  anio?: string
  // Cliente — datos que no están en la base
  clienteRepresentante?: string
  clienteRepresentanteDni?: string
  clienteRepresentanteCaracter?: string
  clienteReferenteNombre?: string
  clienteReferenteCargo?: string
  clienteCodigoSrt?: string
  // Consultor / responsable — datos que no están en la base
  responsableDni?: string
  responsableCaracter?: string
  responsableMatriculaEmisor?: string
  // Alcance (cláusula 3)
  frecuenciaVisitas?: string
  plazoRespuesta?: string
  // Honorarios y vigencia (cláusula 6)
  honorarios?: string
  honorariosEnLetras?: string
  honorariosModalidad?: string
  honorariosPlazoPagoDias?: string
  honorariosMedioPago?: string
  actualizacionPeriodicidad?: string
  actualizacionIndice?: string
  fechaInicioVigencia?: string
  diasNoRenovacion?: string
  // Seguros (cláusula 8)
  sumaAseguradaRC?: string
  sumaAseguradaRCEnLetras?: string
  // Jurisdicción (cláusula 9)
  jurisdiccion?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Normaliza un valor de string: trim y convierte vacío en undefined. */
function clean(v: string | null | undefined): string | undefined {
  const s = (v ?? '').trim()
  return s ? s : undefined
}

/** Compone "<localidad>, <provincia>" descartando vacíos. */
function joinLocalidad(localidad?: string | null, provincia?: string | null): string | undefined {
  const parts = [clean(localidad), clean(provincia)].filter(Boolean)
  return parts.length ? parts.join(', ') : undefined
}

/** Fecha de hoy en DD/MM/YYYY (locale AR) para el header del documento. */
function hoyDDMMYYYY(): string {
  const n = new Date()
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}/${n.getFullYear()}`
}

// ─────────────────────────────────────────────────────────────────────────────
// PREFILL — getDatosContrato
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arma el prefill del contrato a partir de la empresa-cliente: consultora
 * (parte contratante) + responsable técnico (full_access_main) + matrícula +
 * datos de la empresa + establecimientos activos (Anexo).
 *
 * @returns { datos, faltantes } donde `faltantes` son las etiquetas de los
 *          campos que conviene completar en el formulario antes de generar.
 */
export async function getDatosContrato(
  empresaId: string,
): Promise<ActionResult<{ datos: Partial<ContratoDatos>; faltantes: string[] }>> {
  if (!empresaId) return { success: false, error: 'empresaId requerido' }

  // ── Acceso: gate del módulo Finanzas (full_access_main o developer) ──
  const acc = await getFinanzasAccess()
  if (!acc.consultoraId) return { success: false, error: 'No autenticado' }
  if (!acc.hasAccess) return { success: false, error: 'No tenés acceso al módulo Finanzas' }

  const supabase = await createClient()

  // ── 1. Empresa + actividad + ART + localidad/provincia, scoped a la consultora ──
  const { data: empRow, error: empErr } = await supabase
    .from('empresas')
    .select(`
      id,
      consultora_id,
      razon_social,
      cuit,
      domicilio,
      art_numero_contrato,
      actividades_economicas ( codigo, nombre ),
      localidades ( nombre, provincia ),
      organizaciones_externas!empresas_art_id_fkey ( nombre )
    `)
    .eq('id', empresaId)
    .eq('consultora_id', acc.consultoraId)
    .maybeSingle()

  if (empErr) return { success: false, error: `Error al leer la empresa: ${empErr.message}` }
  if (!empRow) return { success: false, error: 'Empresa no encontrada o fuera de tu consultora' }

  const actividad = (Array.isArray(empRow.actividades_economicas)
    ? empRow.actividades_economicas[0]
    : empRow.actividades_economicas) as { codigo: string; nombre: string } | null | undefined
  const localidadEmp = (Array.isArray(empRow.localidades)
    ? empRow.localidades[0]
    : empRow.localidades) as { nombre: string; provincia: string } | null | undefined
  const art = (Array.isArray(empRow.organizaciones_externas)
    ? empRow.organizaciones_externas[0]
    : empRow.organizaciones_externas) as { nombre: string } | null | undefined

  // ── 2. Consultora (parte contratante: EL CONSULTOR) ──
  const { data: consRow } = await supabase
    .from('consultoras')
    .select(`
      nombre, cuit, telefono, email, logo_url,
      domicilio_legal, domicilio_fiscal,
      color_marca_primario, color_marca_secundario,
      contrato_plazo_respuesta_default,
      contrato_honorarios_plazo_pago_dias_default,
      contrato_honorarios_medio_pago_default,
      contrato_actualizacion_periodicidad_default,
      contrato_actualizacion_indice_default,
      contrato_dias_no_renovacion_default,
      contrato_responsable_caracter_default,
      contrato_responsable_matricula_emisor_default,
      contrato_suma_asegurada_rc_default,
      contrato_jurisdiccion_default,
      contrato_responsable_dni_default
    `)
    .eq('id', acc.consultoraId)
    .maybeSingle()

  // Logo: bucket `consultora` es PÚBLICO → URL estable (la usa el render directo en el <img>).
  const consultorLogoUrl = consRow?.logo_url
    ? await resolveAssetUrl('consultora', consRow.logo_url)
    : null

  // ── 3. Responsable técnico = full_access_main de la consultora ──
  let responsableNombre: string | undefined
  let responsableTitulo: string | undefined
  let responsableCuit: string | undefined
  let responsableMatricula: string | undefined
  let responsableProvinciaMatricula: string | undefined

  const { data: member } = await supabase
    .from('consultoras_members')
    .select('user_id')
    .eq('consultora_id', acc.consultoraId)
    .eq('role', 'full_access_main')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const responsableUserId = (member?.user_id as string | null) ?? null
  if (responsableUserId) {
    const [{ data: prof }, { data: perfil }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', responsableUserId).maybeSingle(),
      supabase
        .from('perfiles_profesionales')
        .select('id, cuit, titulo, provincia_matricula_id')
        .eq('user_id', responsableUserId)
        .maybeSingle(),
    ])

    responsableNombre = clean(prof?.full_name as string | null)
    responsableTitulo = clean(perfil?.titulo as string | null)
    responsableCuit = clean(perfil?.cuit as string | null)

    if (perfil?.id) {
      const { data: matRow } = await supabase
        .from('matriculas_profesionales')
        .select('emisor, numero')
        .eq('perfil_id', perfil.id)
        .eq('activa', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (matRow) {
        responsableMatricula = `${matRow.emisor ?? ''} ${matRow.numero ?? ''}`.trim() || undefined
      }

      const provMatId = perfil?.provincia_matricula_id as string | null
      if (provMatId) {
        const { data: prov } = await supabase
          .from('provincias')
          .select('nombre')
          .eq('id', provMatId)
          .maybeSingle()
        responsableProvinciaMatricula = clean(prov?.nombre as string | null)
      }
    }
  }

  // ── 4. Establecimientos activos (Anexo) ──
  const { data: estRows } = await supabase
    .from('establecimientos')
    .select(`
      nombre,
      domicilio,
      actividad_principal,
      cantidad_trabajadores,
      actividades_economicas ( codigo, nombre ),
      localidades ( nombre, provincia )
    `)
    .eq('empresa_id', empresaId)
    .eq('status', 'active')
    .order('nombre', { ascending: true })

  const establecimientos: ContratoEstablecimiento[] = (estRows ?? []).map((e) => {
    const estAct = (Array.isArray(e.actividades_economicas)
      ? e.actividades_economicas[0]
      : e.actividades_economicas) as { codigo: string; nombre: string } | null | undefined
    const estLoc = (Array.isArray(e.localidades)
      ? e.localidades[0]
      : e.localidades) as { nombre: string; provincia: string } | null | undefined
    const actividadEst =
      clean(e.actividad_principal as string | null) ??
      (estAct ? `${estAct.codigo ? estAct.codigo + ' — ' : ''}${estAct.nombre}`.trim() : undefined)
    return {
      nombre: clean(e.nombre as string | null) ?? null,
      domicilio: clean(e.domicilio as string | null) ?? null,
      localidad: joinLocalidad(estLoc?.nombre, estLoc?.provincia) ?? null,
      actividad: actividadEst ?? null,
      cantidadTrabajadores: (e.cantidad_trabajadores as number | null) ?? null,
    }
  })

  // ── 5. Fecha actual en Argentina (se precarga dia/mes/año + inicio vigencia) ──
  const ahoraAr = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
  const partesFecha = ahoraAr.split(',')[0].split('/') // DD/MM/YYYY
  const hoyDia = String(Number(partesFecha[0]))          // sin leading zero
  const hoyMes = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ][Number(partesFecha[1]) - 1]
  const hoyAnio = partesFecha[2]

  // ── 6. Ensamblar el prefill ──
  const datos: Partial<ContratoDatos> = {
    // Comparecencia — fecha actual de Argentina
    dia: hoyDia,
    mes: hoyMes,
    anio: hoyAnio,
    // Consultor / consultora
    consultorRazonSocial: clean(consRow?.nombre as string | null),
    consultorCuit: clean(consRow?.cuit as string | null),
    consultorDomicilio:
      clean(consRow?.domicilio_legal as string | null) ??
      clean(consRow?.domicilio_fiscal as string | null),
    consultorTelefono: clean(consRow?.telefono as string | null),
    consultorEmail: clean(consRow?.email as string | null),
    consultorLogoUrl: consultorLogoUrl ?? null,
    // Color de marca (white-label PDF) — NULL = verde Sigmetría.
    colorPrimario: clean(consRow?.color_marca_primario as string | null) ?? null,
    colorSecundario: clean(consRow?.color_marca_secundario as string | null) ?? null,
    // Responsable técnico
    responsableNombre,
    responsableTitulo,
    responsableCuit,
    responsableMatricula,
    responsableProvinciaMatricula,
    // Cliente
    clienteRazonSocial: clean(empRow.razon_social as string | null),
    clienteCuit: clean(empRow.cuit as string | null),
    clienteDomicilioFiscal: clean(empRow.domicilio as string | null),
    clienteActividad: actividad ? clean(actividad.nombre) : undefined,
    clienteCiiu: actividad ? clean(actividad.codigo) : undefined,
    clienteArtNombre: art ? clean(art.nombre) : undefined,
    clienteArtNumeroContrato: clean(empRow.art_numero_contrato as string | null),
    // Provincia de la comparecencia: sugerimos la de la empresa.
    provincia: clean(localidadEmp?.provincia),
    ciudad: clean(localidadEmp?.nombre),
    // Establecimientos
    establecimientos,
    // Metadatos
    fechaEmision: hoyDDMMYYYY(),
    // Defaults de contrato desde config consultora (precargados, editables)
    responsableDni: clean(consRow?.contrato_responsable_dni_default as string | null),
    responsableCaracter: clean(consRow?.contrato_responsable_caracter_default as string | null),
    responsableMatriculaEmisor: clean(consRow?.contrato_responsable_matricula_emisor_default as string | null),
    plazoRespuesta: clean(consRow?.contrato_plazo_respuesta_default as string | null),
    honorariosPlazoPagoDias: clean(consRow?.contrato_honorarios_plazo_pago_dias_default as string | null),
    honorariosMedioPago: clean(consRow?.contrato_honorarios_medio_pago_default as string | null),
    actualizacionPeriodicidad: clean(consRow?.contrato_actualizacion_periodicidad_default as string | null),
    actualizacionIndice: clean(consRow?.contrato_actualizacion_indice_default as string | null),
    diasNoRenovacion: clean(consRow?.contrato_dias_no_renovacion_default as string | null),
    sumaAseguradaRC: clean(consRow?.contrato_suma_asegurada_rc_default as string | null),
    jurisdiccion: clean(consRow?.contrato_jurisdiccion_default as string | null),
    // Fecha de inicio de vigencia: precargamos hoy (editable)
    fechaInicioVigencia: `${hoyDia}/${hoyMes}/${hoyAnio}`,
  }

  // ── 6. Faltantes: campos a completar en el formulario ──
  const faltantes: string[] = []
  if (!datos.honorarios) faltantes.push('Honorarios')
  if (!datos.fechaInicioVigencia) faltantes.push('Fecha de inicio de vigencia')
  if (!datos.frecuenciaVisitas) faltantes.push('Frecuencia de visitas')
  if (!datos.clienteRepresentante) faltantes.push('Representante legal del cliente (firmante)')
  if (!datos.clienteReferenteNombre) faltantes.push('Referente interno del cliente')
  if (!datos.jurisdiccion) faltantes.push('Jurisdicción de los tribunales')
  if (!datos.sumaAseguradaRC) faltantes.push('Suma asegurada del seguro de RC profesional')
  if (!responsableNombre) faltantes.push('Responsable técnico (cargar en el perfil profesional)')
  if (!responsableMatricula) faltantes.push('Matrícula del responsable técnico')

  return { success: true, data: { datos, faltantes } }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERACIÓN — generarContratoPdf
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el PDF del contrato: merge prefill + form → HTML → Chromium → Storage.
 *
 * @param empresaId  empresa-cliente del contrato
 * @param form       campos que completa el usuario (honorarios, vigencia, etc.)
 * @returns { pdfUrl } signed URL (TTL 60 min) para descargar/visualizar.
 */
export async function generarContratoPdf(
  empresaId: string,
  form: ContratoFormInput,
): Promise<ActionResult<{ pdfUrl: string }>> {
  if (!empresaId) return { success: false, error: 'empresaId requerido' }

  // ── Acceso: gate del módulo Finanzas (full_access_main o developer) ──
  const acc = await getFinanzasAccess()
  if (!acc.consultoraId) return { success: false, error: 'No autenticado' }
  if (!acc.hasAccess) return { success: false, error: 'No tenés acceso al módulo Finanzas' }

  // ── 1. Prefill (reutiliza getDatosContrato; también revalida el scope) ──
  const prefill = await getDatosContrato(empresaId)
  if (!prefill.success) return { success: false, error: prefill.error }

  // ── 2. Merge prefill + form (el form tiene prioridad, descartando vacíos) ──
  const datos: ContratoDatos = {
    ...prefill.data.datos,
    // Comparecencia
    ciudad: clean(form.ciudad) ?? prefill.data.datos.ciudad,
    provincia: clean(form.provincia) ?? prefill.data.datos.provincia,
    dia: clean(form.dia) ?? prefill.data.datos.dia,
    mes: clean(form.mes) ?? prefill.data.datos.mes,
    anio: clean(form.anio) ?? prefill.data.datos.anio,
    // Cliente (firmante / referente / SRT) — sólo del form
    clienteRepresentante: clean(form.clienteRepresentante) ?? prefill.data.datos.clienteRepresentante,
    clienteRepresentanteDni: clean(form.clienteRepresentanteDni) ?? prefill.data.datos.clienteRepresentanteDni,
    clienteRepresentanteCaracter:
      clean(form.clienteRepresentanteCaracter) ?? prefill.data.datos.clienteRepresentanteCaracter,
    clienteReferenteNombre: clean(form.clienteReferenteNombre) ?? prefill.data.datos.clienteReferenteNombre,
    clienteReferenteCargo: clean(form.clienteReferenteCargo) ?? prefill.data.datos.clienteReferenteCargo,
    clienteCodigoSrt: clean(form.clienteCodigoSrt) ?? prefill.data.datos.clienteCodigoSrt,
    // Consultor / responsable — sólo del form
    responsableDni: clean(form.responsableDni) ?? prefill.data.datos.responsableDni,
    responsableCaracter: clean(form.responsableCaracter) ?? prefill.data.datos.responsableCaracter,
    responsableMatriculaEmisor:
      clean(form.responsableMatriculaEmisor) ?? prefill.data.datos.responsableMatriculaEmisor,
    // Alcance
    frecuenciaVisitas: clean(form.frecuenciaVisitas) ?? prefill.data.datos.frecuenciaVisitas,
    plazoRespuesta: clean(form.plazoRespuesta) ?? prefill.data.datos.plazoRespuesta,
    // Honorarios y vigencia
    honorarios: clean(form.honorarios) ?? prefill.data.datos.honorarios,
    honorariosEnLetras: clean(form.honorariosEnLetras) ?? prefill.data.datos.honorariosEnLetras,
    honorariosModalidad: clean(form.honorariosModalidad) ?? prefill.data.datos.honorariosModalidad,
    honorariosPlazoPagoDias: clean(form.honorariosPlazoPagoDias) ?? prefill.data.datos.honorariosPlazoPagoDias,
    honorariosMedioPago: clean(form.honorariosMedioPago) ?? prefill.data.datos.honorariosMedioPago,
    actualizacionPeriodicidad:
      clean(form.actualizacionPeriodicidad) ?? prefill.data.datos.actualizacionPeriodicidad,
    actualizacionIndice: clean(form.actualizacionIndice) ?? prefill.data.datos.actualizacionIndice,
    fechaInicioVigencia: clean(form.fechaInicioVigencia) ?? prefill.data.datos.fechaInicioVigencia,
    diasNoRenovacion: clean(form.diasNoRenovacion) ?? prefill.data.datos.diasNoRenovacion,
    // Seguros
    sumaAseguradaRC: clean(form.sumaAseguradaRC) ?? prefill.data.datos.sumaAseguradaRC,
    sumaAseguradaRCEnLetras: clean(form.sumaAseguradaRCEnLetras) ?? prefill.data.datos.sumaAseguradaRCEnLetras,
    // Jurisdicción
    jurisdiccion: clean(form.jurisdiccion) ?? prefill.data.datos.jurisdiccion,
  }

  // ── 3. HTML → PDF (Chromium serverless, respeta @page A4) ──
  let buffer: Buffer
  try {
    buffer = await renderHtmlToPdf(contratoHtml(datos))
  } catch (err) {
    console.error('[CONTRATO-PDF] error renderizando PDF:', err instanceof Error ? err.message : String(err))
    return { success: false, error: 'No se pudo generar el PDF del contrato' }
  }

  // ── 4. Subir al bucket privado `documentos` con path multi-tenant ──
  // {consultora_id}/contratos/{empresaId}/{timestamp}.pdf
  // Usamos el cliente admin (service role) para escribir sin fricción de RLS en
  // SSR; el acceso ya fue verificado arriba (full_access + scope de consultora).
  const admin = createAdminClient()
  const path = tenantStoragePath(acc.consultoraId, 'contratos', empresaId, `${Date.now()}.pdf`)

  const { error: uploadError } = await admin.storage
    .from('documentos')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: false })
  if (uploadError) {
    console.error('[CONTRATO-PDF] error subiendo PDF:', uploadError.message)
    return { success: false, error: 'Error al guardar el contrato: ' + uploadError.message }
  }

  // ── 5. Signed URL para descargar/visualizar ──
  const { data: signed, error: signErr } = await admin.storage
    .from('documentos')
    .createSignedUrl(path, CONTRATO_SIGNED_TTL_SECONDS)
  if (signErr || !signed?.signedUrl) {
    return { success: false, error: 'Contrato generado pero no se pudo crear el enlace de descarga' }
  }

  return { success: true, data: { pdfUrl: signed.signedUrl } }
}
