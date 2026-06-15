'use server'

/**
 * report-context.ts — Provider server-side de ReportContext
 *
 * Dado un `establecimientoId` y el usuario logueado (obtenido internamente),
 * resuelve TODA la información de branding que el report-kit necesita para
 * renderizar cabecera, pie y firma.
 *
 * RESOLUCIÓN DE IMÁGENES (crítico para react-pdf):
 * - consultoras.logo_url → bucket `consultora` (PÚBLICO) → getPublicUrl: URL estable.
 * - empresas.logo_destacado_url → bucket `logos` (PÚBLICO) → getPublicUrl: URL estable.
 * - perfiles_profesionales.firma_url → bucket `firmas` (PRIVADO) → signed URL TTL 1h.
 *
 * React-pdf hace fetch de las URLs al generar el blob en el browser. Las URLs
 * públicas funcionan sin configuración extra. La firma (privada) necesita una
 * signed URL fresca; se genera server-side y se pasa al componente como string.
 *
 * CUÁNDO NO HAY DATOS OPCIONALES:
 * - Sin logo consultora → logoUrl = '' (el kit renderiza el nombre en texto).
 * - Sin logo empresa → logoUrl ausente (el kit no renderiza nada en su lugar).
 * - Sin perfil profesional / firma / matrícula → profesional parcial (el kit omite
 *   la imagen de firma y la matrícula con gracia; el cierre formal queda sin ellos).
 */

import { createClient } from '@/lib/supabase/server'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import type { ReportContext } from '@/lib/pdf/report-kit'
import type { ActionResult } from '@/lib/types'

/** TTL de la signed URL de firma del profesional: 1 hora (tiempo holgado para generación + descarga). */
const FIRMA_TTL_SECONDS = 60 * 60

/**
 * Formatea una fecha ISO (YYYY-MM-DD o ISO 8601) a DD/MM/YYYY para el footer del reporte.
 * Si el string no es parseable, devuelve la fecha de hoy.
 */
function formatFecha(isoOrDate?: string | null): string {
  const d = isoOrDate ? new Date(isoOrDate) : new Date()
  if (isNaN(d.getTime())) {
    const n = new Date()
    return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}/${n.getFullYear()}`
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export interface BuildReportContextParams {
  establecimientoId: string
  /** Título del documento (aparece en la banda del header). */
  titulo: string
  /** Norma legal, ej. "Res. SRT 48/2025". Opcional. */
  norma?: string
  /**
   * Fecha de emisión en formato ISO o DD/MM/YYYY.
   * Si se omite, se usa la fecha actual del servidor.
   */
  fechaEmision?: string
}

/**
 * Construye un `ReportContext` completo para el report-kit.
 *
 * Ejecuta en el servidor (server action). NO llames esto desde código browser
 * directo; en componentes 'use client', invocarlo a través de un server action
 * que envuelva esta función o llamarlo antes de la hidratación.
 *
 * @returns `{ success: true, data: ReportContext }` o `{ success: false, error: string }`
 */
export async function buildReportContext(
  params: BuildReportContextParams
): Promise<ActionResult<ReportContext>> {
  const { establecimientoId, titulo, norma, fechaEmision } = params

  if (!establecimientoId) {
    return { success: false, error: 'establecimientoId es requerido' }
  }

  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // ── 1. Establecimiento + empresa + consultora (un solo join) ──────────────────
  // La cadena: establecimientos → empresas → consultoras
  // También resolvemos la localidad del establecimiento (FK a localidades).
  const { data: estRow, error: estErr } = await supabase
    .from('establecimientos')
    .select(`
      nombre,
      domicilio,
      codigo_postal,
      localidad_id,
      localidades ( nombre ),
      empresas!inner (
        razon_social,
        cuit,
        logo_destacado_url,
        localidad_id,
        consultoras!inner (
          nombre,
          cuit,
          logo_url
        )
      )
    `)
    .eq('id', establecimientoId)
    .maybeSingle()

  if (estErr) return { success: false, error: `Error al leer establecimiento: ${estErr.message}` }
  if (!estRow) return { success: false, error: 'Establecimiento no encontrado' }

  // Los embeds !inner devuelven objeto (relación a-uno), no array.
  const empresa = (Array.isArray(estRow.empresas) ? estRow.empresas[0] : estRow.empresas) as {
    razon_social: string
    cuit: string | null
    logo_destacado_url: string | null
    localidad_id: string | null
    consultoras: {
      nombre: string
      cuit: string | null
      logo_url: string | null
    } | {
      nombre: string
      cuit: string | null
      logo_url: string | null
    }[]
  }
  const consultora = (Array.isArray(empresa.consultoras) ? empresa.consultoras[0] : empresa.consultoras) as {
    nombre: string
    cuit: string | null
    logo_url: string | null
  }

  // Localidad del establecimiento
  const localidadRow = (Array.isArray(estRow.localidades) ? estRow.localidades[0] : estRow.localidades) as
    | { nombre: string }
    | null
    | undefined

  const localidadStr = localidadRow?.nombre ?? undefined

  // ── 2. Resolver URLs de logos (públicos → getPublicUrl, sin red extra) ────────
  // Bucket `consultora` y `logos` son PÚBLICOS → URL estable sin token.
  // resolveAssetUrl maneja los legacy (URLs absolutas ya almacenadas) y los paths relativos.
  const [logoConsuloraUrl, logoEmpresaUrl] = await Promise.all([
    resolveAssetUrl('consultora', consultora.logo_url),
    resolveAssetUrl('logos', empresa.logo_destacado_url),
  ])

  // ── 3. Profesional firmante = usuario logueado ────────────────────────────────
  // Nombre: profiles.full_name (tabla base de auth).
  // El perfil profesional puede NO existir (usuario nuevo o sin datos HyS cargados).
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const nombreProfesional = profileRow?.full_name || user.email || '—'

  // Perfil profesional (firma_url, id para buscar matrículas).
  const { data: perfil } = await supabase
    .from('perfiles_profesionales')
    .select('id, firma_url')
    .eq('user_id', user.id)
    .maybeSingle()

  // Firma: bucket `firmas` es PRIVADO → signed URL TTL 1h.
  const firmaUrlSigned = perfil?.firma_url
    ? await resolveAssetUrl('firmas', perfil.firma_url, FIRMA_TTL_SECONDS)
    : null

  // Matrícula activa (la más reciente si hay varias activas).
  let matriculaStr: string | undefined
  if (perfil?.id) {
    const { data: matriculas } = await supabase
      .from('matriculas_profesionales')
      .select('emisor, numero')
      .eq('perfil_id', perfil.id)
      .eq('activa', true)
      .order('created_at', { ascending: false })
      .limit(1)

    const mat = matriculas?.[0]
    if (mat) {
      matriculaStr = `${mat.emisor} ${mat.numero}`.trim()
    }
  }

  // `titulo` del profesional (ej. "Ing.", "Lic. en HyS") NO existe en la DB todavía.
  // Ver deuda en el entregable. Por ahora queda undefined → el kit lo omite.

  // ── 4. Ensamblar el ReportContext ─────────────────────────────────────────────
  const ctx: ReportContext = {
    consultora: {
      // Si no hay logo, logoUrl queda '' → el kit renderiza el nombre en texto.
      logoUrl: logoConsuloraUrl ?? '',
      nombre: consultora.nombre,
      cuit: consultora.cuit ?? undefined,
    },
    empresa: {
      razonSocial: empresa.razon_social,
      cuit: empresa.cuit ?? '',
      logoUrl: logoEmpresaUrl ?? undefined,
    },
    establecimiento: {
      nombre: estRow.nombre,
      domicilio: estRow.domicilio ?? undefined,
      codigoPostal: estRow.codigo_postal ?? undefined,
      localidad: localidadStr,
    },
    profesional: {
      nombre: nombreProfesional,
      // titulo: no existe en DB aún — ver deuda.
      matricula: matriculaStr,
      firmaUrl: firmaUrlSigned ?? undefined,
    },
    documento: {
      titulo,
      norma,
      fechaEmision: formatFecha(fechaEmision),
    },
  }

  return { success: true, data: ctx }
}
