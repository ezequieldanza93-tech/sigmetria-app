/**
 * anexo-observaciones.ts — Genera el ANEXO DE OBSERVACIONES DE SEGUIMIENTO como una
 * hoja PDF (A4 portrait, estilo Sigmetría) para los protocolos (helper compartido por
 * los protocolos del motor: ruido, PAT, carga térmica, carga de fuego, ergonomía — e
 * iluminación, el gold standard del que se extrajo).
 *
 * Las "observaciones de seguimiento" cargadas en el último paso del protocolo se
 * insertan en el pool común `gestiones_observaciones`:
 *   - descripcion                          → texto del finding
 *   - categoria_id  → observaciones_categorias (nombre, nivel, color)  → chip
 *   - clasificacion_id → observaciones_clasificaciones (nombre)        → tipo de riesgo
 *   - responsable_id → personas_directorio (nombre, apellido)         → responsable
 *   - fecha_planificada                     → fecha de subsanación comprometida (PLAZO)
 *   - foto_url                              → PATH en el bucket privado `documentos`
 * La FK al registro ejecutado es suelta: (registro_gestion_id + rg_fecha_planificada).
 *
 * Lee las observaciones por (registroId + rgFechaPlanificada), baja las fotos del bucket
 * privado `documentos` a base64, arma la hoja HTML y la renderiza con renderHtmlToPdf.
 * Devuelve null si no hay observaciones (no se agrega anexo). Best-effort: una foto que
 * no baja se omite; un query que falla devuelve null y no rompe la emisión.
 */

import { renderHtmlToPdf } from '@/lib/pdf/render-protocolo'
import { type BrandColor } from './brand-color'

// ─── TIPADO PARA LOS EMBEDS DE POSTGREST ─────────────────────────────────────

type EmbedOne<T> = T | T[] | null | undefined

function single<T>(v: EmbedOne<T>): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

type SupabaseServerClient = Awaited<
  ReturnType<(typeof import('@/lib/supabase/server'))['createClient']>
>

interface ObsAnexoRow {
  descripcion: string
  fecha_planificada: string | null
  foto_url: string | null
  observaciones_categorias: EmbedOne<{ nombre: string; nivel: number; color: string }>
  observaciones_clasificaciones: EmbedOne<{ nombre: string }>
  personas_directorio: EmbedOne<{ nombre: string; apellido: string }>
}

// ─── HELPERS DE FORMATEO / ESCAPE ────────────────────────────────────────────

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
 * Descarga una URL y la convierte en data URL base64.
 * Best-effort con timeout: una URL firmada que se cuelga puede trabar TODA la emisión
 * del PDF. Abortamos a los 8s; si aborta o falla, devolvemos undefined (la foto se omite).
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

/**
 * Genera una hoja PDF (estilo Sigmetría) con las observaciones de seguimiento del
 * registro ejecutado, incluyendo sus fotos embebidas. Devuelve null si no hay
 * observaciones (no se agrega anexo). Best-effort: una foto que no baja se omite.
 *
 * @param supabase - cliente server de Supabase (ya creado por el reporte)
 * @param registroId - registro_gestion_id del registro ejecutado
 * @param rgFechaPlanificada - rg_fecha_planificada (segunda mitad de la FK suelta); si es
 *   null no se filtra por fecha.
 * @param brand - color de marca de la consultora (opcional); recolorea el PDF del anexo.
 */
export async function generarAnexoObservaciones(
  supabase: SupabaseServerClient,
  registroId: string,
  rgFechaPlanificada: string | null,
  brand?: BrandColor,
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
  if (rgFechaPlanificada) query = query.eq('rg_fecha_planificada', rgFechaPlanificada)
  query = query.order('fecha_planificada', { ascending: true })

  const { data, error } = await query
  if (error) {
    console.warn('[ANEXO-OBS] query falló:', error.message)
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
          console.warn('[ANEXO-OBS] foto no disponible:', err instanceof Error ? err.message : String(err))
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
  return renderHtmlToPdf(html, brand)
}
