'use server'

/**
 * reporte-protocolo-iluminacion.ts — Server Action: genera el PDF del Protocolo SRT 84/2012
 *
 * FASE B: mapeo de datos REALES de una medición de iluminación al motor de PDF.
 *
 * ARQUITECTURA:
 *   1. Lee la medición completa (getMedicionIluminacion) — join cabecera + puntos + celdas.
 *   2. Lee firmas de la entidad (getFirmasEntidad) → firma del profesional.
 *   3. Resuelve logos (consultora + empresa) → data URLs base64 para Chromium serverless.
 *   4. Mapea todos los campos al tipo DatosProtocoloIluminacion.
 *   5. Llama renderProtocoloPdf() → Buffer.
 *
 * DECISIONES DE DISEÑO:
 *   - Folio determinístico: `SIG-{AÑO}-{primeros 6 hex del medicionId}`.
 *     Simple, reproducible, sin colisiones para volúmenes de uso esperado.
 *     Si a futuro se requiere folio numérico secuencial, agregar una columna
 *     `numero_protocolo` con una sequence de Postgres (Fase D).
 *   - Vencimiento: fecha_medicion + 1 año (iluminación es anual per SRT 84/2012).
 *   - El firmante NO es el usuario logueado, sino el campo `medicion_iluminacion.firmante`
 *     (texto libre ingresado en el ejecutor). La firma dibujada viene de tabla `firmas`
 *     (rol 'Profesional' o la primera disponible) como `firma_svg_data` (data URL directa).
 *   - Logos: se resuelven a URL pública/firmada con resolveAssetUrl y luego se convierten
 *     a base64 data URL via fetch + Buffer. Esto evita que Chromium serverless haga
 *     requests de red al renderizar el HTML. Fallo silencioso: si el fetch del logo
 *     falla, se omite (el motor tiene fallback).
 *   - La lógica de cálculo (eMedia, eMinima, cumpleUniformidad, cumpleNivel) viene de
 *     lib/medicion-iluminacion/calculos.ts — módulo compartido con la UI. NO se duplica.
 *
 * FASE C (pendiente): subir el PDF a Supabase y conectar el modal ejecutor.
 * FASE D (pendiente): folio secuencial, encomienda real.
 */

import { getMedicionIluminacion } from '@/lib/actions/medicion-iluminacion'
import { getFirmasEntidad } from '@/lib/actions/firmas'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import {
  renderProtocoloPdf,
  renderHtmlToPdf,
  type DatosProtocoloIluminacion,
  type MedicionRow,
} from '@/lib/pdf/render-protocolo'
import { mergePdfConAnexos, type AnexoInput } from '@/lib/pdf/merge-anexos'
import {
  eMedia,
  eMinima,
  cumpleUniformidad,
  cumpleNivel,
} from '@/lib/medicion-iluminacion/calculos'
import type { ActionResult } from '@/lib/types'

// ─── Labels de enums → texto legible (mismo mapa que el modal ejecutor) ──────

const TIPO_ILUMINACION_LABEL: Record<string, string> = {
  natural: 'Natural',
  artificial: 'Artificial',
  mixta: 'Mixta',
}

const TIPO_FUENTE_LABEL: Record<string, string> = {
  incandescente: 'Incandescente',
  descarga: 'Descarga',
  mixta: 'Mixta',
}

const TIPO_SISTEMA_LABEL: Record<string, string> = {
  general: 'General',
  localizada: 'Localizada',
  mixta: 'Mixta',
}

// ─── Helpers de formateo ──────────────────────────────────────────────────────

/** Formatea una fecha ISO (YYYY-MM-DD) a DD/MM/YYYY. */
function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  // iso puede venir como "2026-02-28" o "2026-02-28T..."
  const [datePart] = iso.split('T')
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

/** Formatea hora HH:MM:SS → HH:MM. */
function formatHora(time: string | null | undefined): string {
  if (!time) return '—'
  return time.slice(0, 5)
}

/** Suma 1 año a una fecha ISO (YYYY-MM-DD). */
function sumarUnAnio(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [datePart] = iso.split('T')
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${Number(y) + 1}`
}

/** Genera el folio determinístico del protocolo. */
function generarFolio(medicionId: string, fechaMedicion: string | null | undefined): string {
  const anio = fechaMedicion ? fechaMedicion.slice(0, 4) : new Date().getFullYear().toString()
  const hex = medicionId.replace(/-/g, '').slice(0, 6).toUpperCase()
  return `SIG-${anio}-${hex}`
}

/**
 * Descarga una URL y la convierte en data URL base64.
 * Best-effort con timeout: el mapa estático de OSM (staticmap.openstreetmap.de)
 * puede colgarse y trabar TODA la emisión del PDF. Abortamos a los 8s; si aborta
 * o falla, devolvemos undefined (el motor del PDF ya tiene fallback sin imagen).
 */
async function urlToDataUrl(url: string | null | undefined): Promise<string | undefined> {
  if (!url) return undefined
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return undefined
    const contentType = res.headers.get('content-type') ?? 'image/png'
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:${contentType};base64,${buf.toString('base64')}`
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

// ─── HELPERS DE TIPADO PARA LOS EMBEDS DE POSTGREST ──────────────────────────

type EmbedOne<T> = T | T[] | null | undefined

function single<T>(v: EmbedOne<T>): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

// ─── ANEXO: OBSERVACIONES DE SEGUIMIENTO ─────────────────────────────────────
//
// Las "observaciones de seguimiento" cargadas en el último paso del protocolo se
// insertan en el pool común `gestiones_observaciones` (ver lib/actions/medicion-iluminacion.ts):
//   - descripcion                          → texto del finding
//   - categoria_id  → observaciones_categorias (nombre, nivel, color)  → chip
//   - clasificacion_id → observaciones_clasificaciones (nombre)        → tipo de riesgo
//   - responsable_id → personas_directorio (nombre, apellido)         → responsable
//   - fecha_planificada                     → fecha de subsanación comprometida (PLAZO)
//   - foto_url                              → PATH en el bucket privado `documentos`
// La FK al registro ejecutado es suelta: (registro_gestion_id + rg_fecha_planificada).

type SupabaseServerClient = Awaited<
  ReturnType<typeof import('@/lib/supabase/server')['createClient']>
>

interface ObsAnexoRow {
  descripcion: string
  fecha_planificada: string | null
  foto_url: string | null
  observaciones_categorias: EmbedOne<{ nombre: string; nivel: number; color: string }>
  observaciones_clasificaciones: EmbedOne<{ nombre: string }>
  personas_directorio: EmbedOne<{ nombre: string; apellido: string }>
}

/** Escapa texto para inyectarlo seguro en el HTML del anexo. */
function escHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Formatea una fecha ISO (YYYY-MM-DD) a dd/mm/yyyy (best-effort). */
function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/** Nombre legible de la persona responsable. */
function nombrePersona(p: { nombre: string; apellido: string } | null): string {
  if (!p) return '—'
  const full = `${p.nombre ?? ''} ${p.apellido ?? ''}`.trim()
  return full || '—'
}

/**
 * Genera una hoja PDF (estilo Sigmetría) con las observaciones de seguimiento del
 * registro ejecutado, incluyendo sus fotos embebidas. Devuelve null si no hay
 * observaciones (no se agrega anexo). Best-effort: una foto que no baja se omite.
 */
async function generarAnexoObservaciones(
  supabase: SupabaseServerClient,
  registroId: string,
  rgFecha: string | null,
): Promise<Buffer | null> {
  let query = supabase
    .from('gestiones_observaciones')
    .select(`
      descripcion, fecha_planificada, foto_url,
      observaciones_categorias(nombre, nivel, color),
      observaciones_clasificaciones(nombre),
      personas_directorio!responsable_id(nombre, apellido)
    `)
    .eq('registro_gestion_id', registroId)
  if (rgFecha) query = query.eq('rg_fecha_planificada', rgFecha)
  query = query.order('fecha_planificada', { ascending: true })

  const { data, error } = await query
  if (error) {
    console.warn('[PDF-REPORTE] anexo observaciones: query falló:', error.message)
    return null
  }
  const rows = (data ?? []) as unknown as ObsAnexoRow[]
  if (rows.length === 0) return null

  // Bajamos cada foto (bucket privado `documentos`) a data URL base64 — best-effort.
  const items = await Promise.all(
    rows.map(async (o) => {
      const cat = single(o.observaciones_categorias)
      const clas = single(o.observaciones_clasificaciones)
      const resp = single(o.personas_directorio)
      let fotoDataUrl: string | undefined
      if (o.foto_url) {
        try {
          const { data: signed } = await supabase.storage
            .from('documentos')
            .createSignedUrl(o.foto_url, 600)
          if (signed?.signedUrl) fotoDataUrl = await urlToDataUrl(signed.signedUrl)
        } catch (err) {
          console.warn('[PDF-REPORTE] anexo observaciones: foto no disponible:', err instanceof Error ? err.message : String(err))
        }
      }
      return {
        descripcion: o.descripcion,
        categoriaNombre: cat?.nombre ?? null,
        categoriaColor: cat?.color ?? '#2E7D33',
        clasificacionNombre: clas?.nombre ?? null,
        responsable: nombrePersona(resp),
        fechaSubsanacion: o.fecha_planificada,
        fotoDataUrl,
      }
    }),
  )

  const html = construirHtmlAnexoObservaciones(items)
  return renderHtmlToPdf(html)
}

interface ObsAnexoItem {
  descripcion: string
  categoriaNombre: string | null
  categoriaColor: string
  clasificacionNombre: string | null
  responsable: string
  fechaSubsanacion: string | null
  fotoDataUrl: string | undefined
}

/** Arma el HTML autónomo (A4 portrait, estilo Sigmetría) de la hoja de observaciones. */
function construirHtmlAnexoObservaciones(items: ObsAnexoItem[]): string {
  const tarjetas = items
    .map((o, i) => {
      const chipCat = o.categoriaNombre
        ? `<span class="chip" style="--c:${escHtml(o.categoriaColor)}">${escHtml(o.categoriaNombre)}</span>`
        : ''
      const chipClas = o.clasificacionNombre
        ? `<span class="chip chip-clas">${escHtml(o.clasificacionNombre)}</span>`
        : ''
      const foto = o.fotoDataUrl
        ? `<div class="foto"><img src="${o.fotoDataUrl}" alt="Foto observación ${i + 1}"></div>`
        : ''
      return `
      <article class="obs">
        <div class="obs-head">
          <span class="num">${i + 1}</span>
          <div class="chips">${chipCat}${chipClas}</div>
        </div>
        <p class="desc">${escHtml(o.descripcion)}</p>
        <div class="meta">
          <div><span class="k">Responsable</span><span class="v">${escHtml(o.responsable)}</span></div>
          <div><span class="k">Fecha de subsanación</span><span class="v">${escHtml(fmtFecha(o.fechaSubsanacion))}</span></div>
        </div>
        ${foto}
      </article>`
    })
    .join('')

  return `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800&family=Poppins:wght@400;600&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Poppins','Segoe UI',sans-serif; color: #333; }
  .anx-head { display:flex; align-items:baseline; justify-content:space-between; border-bottom:2px solid #2E7D33; padding-bottom:6px; margin-bottom:10px; }
  .anx-head h1 { font-family:'Montserrat',sans-serif; font-size:15pt; font-weight:800; color:#2E7D33; margin:0; letter-spacing:.3px; }
  .anx-head .kick { font-size:8pt; letter-spacing:2px; text-transform:uppercase; color:#888; }
  .anx-head .count { font-size:8.5pt; color:#888; }
  .obs { border:1px solid #E4E8E4; border-radius:10px; padding:10px 12px; margin-bottom:8px; break-inside:avoid; page-break-inside:avoid; }
  .obs-head { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
  .num { display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; background:#2E7D33; color:#fff; font-size:8.5pt; font-weight:700; font-family:'Montserrat',sans-serif; flex:0 0 auto; }
  .chips { display:flex; flex-wrap:wrap; gap:5px; }
  .chip { display:inline-block; font-size:7.5pt; font-weight:600; padding:2px 9px; border-radius:100px; background:var(--c,#2E7D33); color:#fff; border:1px solid rgba(0,0,0,.08); }
  .chip-clas { background:#EEF3EE; color:#2E7D33; border:1px solid #CFE0CF; }
  .desc { font-size:10pt; line-height:1.45; margin:4px 0 7px; color:#1f2d1f; }
  .meta { display:flex; gap:18px; flex-wrap:wrap; margin-bottom:6px; }
  .meta .k { display:block; font-size:7pt; letter-spacing:.4px; text-transform:uppercase; color:#888; }
  .meta .v { display:block; font-size:9pt; font-weight:600; color:#333; }
  .foto { margin-top:4px; text-align:center; }
  .foto img { max-width:100%; max-height:70mm; object-fit:contain; border:1px solid #E4E8E4; border-radius:8px; }
</style></head>
<body>
  <div class="anx-head">
    <div><div class="kick">Anexo</div><h1>ANEXO — Observaciones de Seguimiento</h1></div>
    <div class="count">${items.length} ${items.length === 1 ? 'observación' : 'observaciones'}</div>
  </div>
  ${tarjetas}
</body></html>`
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────

/**
 * Genera el PDF del Protocolo de Medición de Iluminación (Res. SRT 84/2012)
 * para una medición real guardada en la base de datos.
 *
 * @param medicionId - UUID de la medición en tabla `medicion_iluminacion`
 * @returns { success: true, data: Buffer } con el PDF, o { success: false, error }
 */
export async function generarReporteProtocoloIluminacion(
  medicionId: string,
): Promise<ActionResult<Buffer>> {
  if (!medicionId) return { success: false, error: 'medicionId requerido' }

  // ── 1. Leer medición completa (join cabecera + establecimiento + empresa + puntos + celdas)
  const medicionResult = await getMedicionIluminacion(medicionId)
  if (!medicionResult.success) {
    console.error('[PDF-REPORTE] getMedicionIluminacion falló', { medicionId, error: medicionResult.error })
    return { success: false, error: medicionResult.error }
  }

  const m = medicionResult.data as Record<string, unknown>

  // ── 2. Extraer subestructuras tipadas ─────────────────────────────────────

  // Establecimiento
  const estRaw = single<Record<string, unknown>>(m.establecimientos as EmbedOne<Record<string, unknown>>)
  if (!estRaw) return { success: false, error: 'Establecimiento no encontrado en el join' }

  // Empresa (dentro del establecimiento)
  const empRaw = single<Record<string, unknown>>(estRaw.empresas as EmbedOne<Record<string, unknown>>)
  if (!empRaw) return { success: false, error: 'Empresa no encontrada en el join' }

  // Instrumento (puede ser null si no se cargó)
  const instrRaw = single<Record<string, unknown>>(m.mediciones_instrumentos as EmbedOne<Record<string, unknown>>)

  // Certificado de calibración
  const certRaw = single<Record<string, unknown>>(m.certificados_calibracion as EmbedOne<Record<string, unknown>>)

  // Perfil profesional (puede ser null — la medición puede no tener perfil_profesional_id)
  const perfilRaw = single<Record<string, unknown>>(m.perfiles_profesionales as EmbedOne<Record<string, unknown>>)

  // Puntos de medición
  const puntosRaw = (m.medicion_iluminacion_puntos as Record<string, unknown>[] | null) ?? []

  // ── 3. Firma del profesional ──────────────────────────────────────────────
  // La firma la busca en la tabla `firmas` (no en el perfil profesional).
  // Toma la de rol 'Profesional', o la primera disponible.
  let firmaDataUrl: string | undefined
  const firmas = await getFirmasEntidad('medicion_iluminacion', medicionId)
  const firmaRow = firmas.find(f => f.rol === 'Profesional') ?? firmas[0] ?? null
  if (firmaRow?.firma_svg_data) {
    // firma_svg_data ya viene como data URL (data:image/png;base64,... o data:image/svg+xml,...)
    firmaDataUrl = firmaRow.firma_svg_data
  }

  // ── 4. Matrícula del profesional ──────────────────────────────────────────
  // Fuente preferida: el RESPONSABLE que EJECUTA la gestión (usuario autenticado),
  // NO el perfil_profesional de la medición (perfilRaw), que suele venir vacío.
  // Resolvemos: auth.getUser() → perfiles_profesionales (user_id = profile id) →
  // matriculas_profesionales activa → "emisor numero". Best-effort: si no hay,
  // caemos al valor de perfilRaw (sección original), y si tampoco, queda vacío
  // (el motor del PDF ya tiene fallback).
  let matriculaStr: string | undefined

  // 4a. Fallback histórico: matrícula del perfil_profesional de la medición.
  if (perfilRaw) {
    const matriculasRaw = perfilRaw.matriculas_profesionales as Record<string, unknown>[] | null ?? []
    const matriculaActiva = matriculasRaw.find(mp => mp.activa === true)
    if (matriculaActiva) {
      const emisor = (matriculaActiva.emisor as string) ?? ''
      const numero = (matriculaActiva.numero as string) ?? ''
      matriculaStr = `${emisor} ${numero}`.trim() || undefined
    }
  }

  // 4b. Override con la matrícula del responsable que ejecuta (usuario autenticado).
  // Si la encontramos, prevalece SOLO cuando 4a quedó vacío (no pisamos un dato
  // explícito del perfil de la medición si existe). Best-effort: errores → se omite.
  if (!matriculaStr) {
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // perfiles_profesionales.user_id → profiles.id (= auth user id).
        const { data: perfilUser } = await supabase
          .from('perfiles_profesionales')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()
        const perfilId = (perfilUser?.id as string | null) ?? null
        if (perfilId) {
          // Matrícula activa del perfil → "emisor numero".
          const { data: matRow } = await supabase
            .from('matriculas_profesionales')
            .select('emisor, numero')
            .eq('perfil_id', perfilId)
            .eq('activa', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (matRow) {
            const emisor = (matRow.emisor as string | null) ?? ''
            const numero = (matRow.numero as string | null) ?? ''
            const compuesta = `${emisor} ${numero}`.trim()
            if (compuesta) matriculaStr = compuesta
          }
        }
      }
    } catch (err) {
      console.error('[PDF-REPORTE] no se pudo resolver la matrícula del responsable que ejecuta:', err instanceof Error ? err.message : String(err))
    }
  }

  // ── 5. Instrumento ────────────────────────────────────────────────────────
  let instrumentoStr: string | undefined
  if (instrRaw) {
    const tipoRaw = single<Record<string, unknown>>(instrRaw.mediciones_instrumentos_tipos as EmbedOne<Record<string, unknown>>)
    const marcaRaw = single<Record<string, unknown>>(instrRaw.organizaciones_externas as EmbedOne<Record<string, unknown>>)
    const tipo = tipoRaw?.nombre ?? ''
    const marca = marcaRaw?.nombre ?? ''
    const modelo = (instrRaw.modelo as string) ?? ''
    const serie = instrRaw.numero_serie ? `· N° ${instrRaw.numero_serie}` : ''
    // Formato: "Luxómetro XLineal · N° 5555678 (Marca)"
    instrumentoStr = [tipo, marca, modelo].filter(Boolean).join(' ') + (serie ? ` ${serie}` : '') || undefined
  }

  // ── 6. Logos → data URLs base64 ───────────────────────────────────────────
  // Buckets 'consultora' y 'logos' son PÚBLICOS → resolveAssetUrl devuelve URL estable.
  // Convertimos a base64 para que Chromium serverless no dependa de red al renderizar.
  // Si falla el fetch, se omite el logo (motor tiene fallback).

  // Para obtener el logo de consultora, necesitamos un query adicional porque el
  // join de getMedicionIluminacion llega hasta empresa, no sube a consultora.
  // Reutilizamos la consultora_id que sí viene en la cabecera de la medición.
  const consultoraId = m.consultora_id as string | null
  let logoConsuloraDataUrl: string | undefined
  let logoEmpresaDataUrl: string | undefined

  // Logo de empresa: empresa.logo_destacado_url (bucket 'logos', público)
  const logoEmpresaPath = empRaw.logo_destacado_url as string | null
  if (logoEmpresaPath) {
    const logoEmpresaUrl = await resolveAssetUrl('logos', logoEmpresaPath)
    logoEmpresaDataUrl = await urlToDataUrl(logoEmpresaUrl)
  }

  // Logo de consultora: necesitamos leerlo — getMedicionIluminacion no trae el join de consultora.
  // Lo obtenemos directamente desde Supabase.
  if (consultoraId) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: consultoraRow } = await supabase
      .from('consultoras')
      .select('logo_url')
      .eq('id', consultoraId)
      .maybeSingle()

    if (consultoraRow?.logo_url) {
      const logoConsuloraUrl = await resolveAssetUrl('consultora', consultoraRow.logo_url as string)
      logoConsuloraDataUrl = await urlToDataUrl(logoConsuloraUrl)
    }
  }

  // ── 7. Localidad y provincia ──────────────────────────────────────────────
  // getMedicionIluminacion NO incluye el join a localidades.
  // El establecimiento tiene localidad_id → necesitamos la localidad del establecimiento.
  // Hacemos un query adicional mínimo.
  let localidadNombre: string | undefined
  let provinciaNombre: string | undefined

  const establecimientoId = m.establecimiento_id as string | null
  if (establecimientoId) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: estLocRow } = await supabase
      .from('establecimientos')
      .select('localidad_id, localidades ( nombre, provincia )')
      .eq('id', establecimientoId)
      .maybeSingle()

    if (estLocRow) {
      const locRow = single<Record<string, unknown>>(estLocRow.localidades as EmbedOne<Record<string, unknown>>)
      localidadNombre = (locRow?.nombre as string) ?? undefined
      provinciaNombre = (locRow?.provincia as string) ?? undefined
    }
  }

  // ── 8. Grilla de mediciones ───────────────────────────────────────────────
  // Por cada punto: calcula E media y E mínima con las funciones de calculos.ts.
  // Uniformidad: cumple si E mín >= E media / 2.
  // Nivel: cumple si E media >= valor_requerido_lux.
  const mediciones: MedicionRow[] = puntosRaw.map((punto, idx) => {
    // Celdas del punto
    const celdasRaw = (punto.medicion_iluminacion_celdas as Record<string, unknown>[] | null) ?? []
    const luxValues: number[] = celdasRaw
      .map(c => Number(c.valor_lux))
      .filter(v => Number.isFinite(v) && v >= 0)

    // Cálculos (funciones puras de lib/medicion-iluminacion/calculos.ts)
    const eMed = eMedia(luxValues)
    const eMin = eMinima(luxValues)
    const valorRequerido = punto.valor_requerido_lux != null ? Number(punto.valor_requerido_lux) : null

    const uniformidadOk = luxValues.length > 0 ? cumpleUniformidad(eMin, eMed) : null
    const nivelOk = luxValues.length > 0 && valorRequerido != null ? cumpleNivel(eMed, valorRequerido) : null

    // Sector y puesto desde el join
    const sectorRaw = single<Record<string, unknown>>(punto.establecimientos_sectores as EmbedOne<Record<string, unknown>>)
    const puestoRaw = single<Record<string, unknown>>(punto.puestos_de_trabajo as EmbedOne<Record<string, unknown>>)

    const sectorNombre = (sectorRaw?.nombre as string) ?? '—'
    const puestoNombre = (puestoRaw?.nombre as string) ?? ((punto.turno as string) ?? '—')

    // Enums → labels legibles
    const tipoIluminacion = TIPO_ILUMINACION_LABEL[punto.tipo_iluminacion as string] ?? (punto.tipo_iluminacion as string) ?? '—'
    const tipoFuente = TIPO_FUENTE_LABEL[punto.tipo_fuente as string] ?? (punto.tipo_fuente as string) ?? '—'
    const tipoSistema = TIPO_SISTEMA_LABEL[punto.tipo_sistema as string] ?? (punto.tipo_sistema as string) ?? '—'

    const row: MedicionRow = {
      n: idx + 1,
      hora: (punto.turno as string) ?? '—',
      sector: sectorNombre,
      seccionPuesto: puestoNombre,
      tipoIluminacion,
      tipofuente: tipoFuente,
      iluminacion: tipoSistema,
      uniformidad: uniformidadOk === null ? '—' : uniformidadOk ? 'Cumple' : 'No cumple',
      valorMedido: luxValues.length > 0 ? Math.round(eMed).toString() : '—',
      valorLegal: valorRequerido != null ? valorRequerido.toString() : '—',
    }

    // Anotación interna de cumplimiento (no va al PDF pero útil para debug)
    void nivelOk

    return row
  })

  // ── 9. Armar DatosProtocoloIluminacion ───────────────────────────────────
  const fechaMedicion = m.fecha_medicion as string | null
  const folio = generarFolio(medicionId, fechaMedicion)
  const hoy = formatFecha(new Date().toISOString().slice(0, 10))

  // Calibración: fecha de emisión del certificado (MM/YYYY o DD/MM/YYYY)
  const certFecha = certRaw?.fecha_emision as string | null
  let calibracionStr: string | undefined
  if (certFecha) {
    // Mostrar solo MM/YYYY (estilo de los protocolos SRT)
    const [cy, cm] = certFecha.split('T')[0].split('-')
    calibracionStr = cm && cy ? `${cm}/${cy}` : undefined
  }

  const datos: DatosProtocoloIluminacion = {
    // Empresa / Establecimiento
    razonSocial: (empRaw.razon_social as string) ?? undefined,
    cuit: (empRaw.cuit as string) ?? undefined,
    establecimiento: (estRaw.nombre as string) ?? undefined,
    direccion: (estRaw.domicilio as string) ?? undefined,
    localidad: localidadNombre,
    provincia: provinciaNombre,
    cp: (estRaw.codigo_postal as string) ?? undefined,

    // Medición
    instrumento: instrumentoStr,
    calibracion: calibracionStr,
    fechaMedicion: formatFecha(fechaMedicion),
    horaInicio: formatHora(m.hora_inicio as string | null),
    horaFin: formatHora(m.hora_fin as string | null),

    // Profesional firmante
    // El firmante es el campo de texto libre `medicion_iluminacion.firmante`,
    // NO el usuario logueado. La firma viene de la tabla `firmas`.
    profesional: (m.firmante as string) ?? undefined,
    matricula: matriculaStr,
    firma: firmaDataUrl,

    // Carátula
    numeroProtocolo: folio,
    fechaEmision: hoy,
    fechaVencimiento: sumarUnAnio(fechaMedicion),
    encomienda: '', // Fase D: encomienda real del colegio profesional

    // Logos (data URLs para Chromium serverless)
    logoConsultora: logoConsuloraDataUrl,
    logoEmpresa: logoEmpresaDataUrl,

    // Grilla
    mediciones: mediciones.length > 0 ? mediciones : undefined,

    // Cabecera (hoja 1) y análisis (hoja 3)
    conclusiones: (m.conclusiones as string) ?? undefined,
    recomendaciones: (m.recomendaciones as string) ?? undefined,
    condicionesAtmosfericas: (() => {
      const c = (m.condiciones_atmosfericas as Record<string, unknown> | null) ?? null
      if (!c) return undefined
      const partes = [
        c.cielo as string | undefined,
        c.temperatura ? `${c.temperatura} °C` : undefined,
        c.humedad ? `${c.humedad} % HR` : undefined,
        c.observaciones as string | undefined,
      ].filter(Boolean)
      return partes.length ? partes.join(' · ') : undefined
    })(),
    // horariosTurnos se resuelve más abajo (query a establecimientos_horarios).
  }

  // ── 9b. Foto + mapa del establecimiento para la carátula (best-effort) ──────
  try {
    if (establecimientoId) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: estMedia } = await supabase
        .from('establecimientos')
        .select('photo_site, latitud, longitud')
        .eq('id', establecimientoId)
        .maybeSingle()
      const photoPath = (estMedia?.photo_site as string | null) ?? null
      if (photoPath) {
        const { data: signed } = await supabase.storage.from('establecimientos').createSignedUrl(photoPath, 600)
        if (signed?.signedUrl) datos.fotoEstablecimiento = await urlToDataUrl(signed.signedUrl)
      }
      const lat = estMedia?.latitud as number | null
      const lon = estMedia?.longitud as number | null
      if (lat != null && lon != null) {
        // Mapa estático de OpenStreetMap (sin API key). Fetch server-side → data URL.
        datos.mapaEstablecimiento = await urlToDataUrl(
          `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=16&size=520x300&markers=${lat},${lon},red-pushpin`
        )
      }
      // Horarios/turnos habituales del establecimiento (tabla establecimientos_horarios).
      const { data: horarios } = await supabase
        .from('establecimientos_horarios')
        .select('dia_semana, hora_inicio, hora_fin')
        .eq('establecimiento_id', establecimientoId)
      if (horarios && horarios.length > 0) {
        const txt = (horarios as Record<string, unknown>[])
          .filter(h => h.hora_inicio)
          .map(h => `${h.dia_semana} ${String(h.hora_inicio).slice(0, 5)}–${h.hora_fin ? String(h.hora_fin).slice(0, 5) : ''}`.trim())
          .join(' · ')
        if (txt) datos.horariosTurnos = txt
      }
    }
  } catch (err) {
    console.error('[PDF-REPORTE] no se pudo resolver foto/mapa del establecimiento:', err instanceof Error ? err.message : String(err))
  }

  // ── 9c. QR de verificación: snapshot público + QR real en la carátula (best-effort) ──
  try {
    const { registrarVerificacion } = await import('@/lib/actions/registrar-verificacion')
    datos.qrVerificacion = await registrarVerificacion({
      folio,
      tipo: 'medicion_iluminacion',
      medicionId,
      consultoraId,
      empresa: datos.razonSocial,
      establecimiento: datos.establecimiento,
      profesional: datos.profesional,
      fechaEjecucion: datos.fechaMedicion,
      fechaEmision: datos.fechaEmision,
      fechaVencimiento: datos.fechaVencimiento,
    })
  } catch (err) {
    console.error('[PDF-REPORTE] no se pudo registrar la verificación:', err instanceof Error ? err.message : String(err))
  }

  // ── 10. Generar PDF ───────────────────────────────────────────────────────
  console.warn('[PDF-REPORTE] datos mapeados, llamando renderProtocoloPdf', { folio, establecimiento: datos.establecimiento, filas: mediciones.length })
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderProtocoloPdf(datos)
  } catch (err) {
    const detalle = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error('[PDF-REPORTE] renderProtocoloPdf lanzó:', detalle)
    return { success: false, error: `Error al renderizar el PDF: ${err instanceof Error ? err.message : String(err)}` }
  }

  // ── 11. Anexar CERTIFICADO DE CALIBRACIÓN + PLANO/CROQUIS reales (fusión pdf-lib, best-effort) ──
  // El cert sale del instrumento (mismo query que getCertificadoVigente del modal); el plano,
  // del campo medicion_iluminacion.plano_url. Si falta alguno o falla, el PDF sale igual sin él.
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const anexos: AnexoInput[] = []

    // Traemos el instrumento + el plano directo de la cabecera (fuente de verdad).
    const { data: medRow } = await supabase
      .from('medicion_iluminacion')
      .select('instrumento_id, certificado_id, plano_url')
      .eq('id', medicionId)
      .maybeSingle()
    const instrumentoId = (medRow?.instrumento_id as string | null) ?? (instrRaw?.id as string | undefined) ?? null
    const certificadoId = (medRow?.certificado_id as string | null) ?? null
    const planoPath = (medRow?.plano_url as string | null) ?? null

    // Certificado de calibración (bucket privado 'certificados').
    // Prioridad: el cert EXACTO referenciado por la medición (certificado_id); si no, el vigente del instrumento.
    {
      let certPath: string | null = null
      if (certificadoId) {
        const { data: c } = await supabase.from('certificados_calibracion').select('certificado_url').eq('id', certificadoId).maybeSingle()
        certPath = (c?.certificado_url as string | null) ?? null
      }
      if (!certPath && instrumentoId) {
        const { data: certRow } = await supabase
          .from('certificados_calibracion')
          .select('certificado_url')
          .eq('instrumento_id', instrumentoId)
          .eq('activo', true)
          .order('fecha_emision', { ascending: false })
          .limit(1)
          .maybeSingle()
        certPath = (certRow?.certificado_url as string | null) ?? null
      }
      console.warn('[PDF-REPORTE] anexo cert', { instrumentoId, certificadoId, certPath })
      if (certPath) {
        const { data: signed } = await supabase.storage.from('certificados').createSignedUrl(certPath, 600)
        if (signed?.signedUrl) {
          const r = await fetch(signed.signedUrl)
          if (r.ok) anexos.push({ titulo: 'Certificado de Calibración del Equipo', buffer: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type') ?? undefined })
        }
      }
    }

    // Plano / croquis de mediciones (bucket privado 'documentos').
    console.warn('[PDF-REPORTE] anexo plano', { planoPath })
    if (planoPath) {
      const { data: signedP } = await supabase.storage.from('documentos').createSignedUrl(planoPath, 600)
      if (signedP?.signedUrl) {
        const rp = await fetch(signedP.signedUrl)
        if (rp.ok) anexos.push({ titulo: 'Plano o Croquis de Mediciones', buffer: Buffer.from(await rp.arrayBuffer()), mime: rp.headers.get('content-type') ?? undefined })
      }
    }

    // ── Observaciones de seguimiento cargadas en el último paso del protocolo ──
    // Viven en el pool común `gestiones_observaciones`, ligadas al registro ejecutado
    // por (registro_gestion_id + rg_fecha_planificada). Las renderizamos como UNA hoja
    // HTML estilo Sigmetría (con sus fotos del bucket privado `documentos`) y la anexamos
    // como PDF — DESPUÉS de certificado + plano. Best-effort: si algo falla, el PDF sale
    // igual con cert+plano; no rompemos la emisión.
    try {
      const registroId = m.registro_gestion_id as string | null
      const rgFecha = m.rg_fecha_planificada as string | null
      if (registroId) {
        const obsBuffer = await generarAnexoObservaciones(supabase, registroId, rgFecha)
        if (obsBuffer) {
          anexos.push({ titulo: 'Observaciones de Seguimiento', buffer: obsBuffer, mime: 'application/pdf' })
        }
      }
    } catch (err) {
      console.error('[PDF-REPORTE] anexo observaciones falló:', err instanceof Error ? err.message : String(err))
    }

    if (anexos.length) pdfBuffer = await mergePdfConAnexos(pdfBuffer, anexos)
  } catch (err) {
    console.error('[PDF-REPORTE] no se pudo anexar cert/plano:', err instanceof Error ? err.message : String(err))
  }

  return { success: true, data: pdfBuffer }
}
