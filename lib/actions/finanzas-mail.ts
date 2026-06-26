'use server'

/**
 * finanzas-mail.ts — Envío del PRESUPUESTO por email con redacción IA.
 *
 * Dos acciones, ambas gateadas por getFinanzasAccess y escopeadas a la consultora:
 *
 *   1. redactarMailPresupuesto — usa Claude (mismo patrón que sugerirObservacion:
 *      un único turno, tool_choice forzado) para redactar un email corto,
 *      profesional y cálido (rioplatense) presentando el presupuesto adjunto.
 *      Si la IA falla o no está disponible, NO rompe: degrada a un asunto/cuerpo
 *      por defecto razonable. El humano siempre puede editar y enviar.
 *
 *   2. enviarPresupuestoPorMail — arma el PDF (mismo helper que la descarga) y lo
 *      envía por Resend como ADJUNTO (decisión: adjunto, no link). El cuerpo lo
 *      provee el usuario (ya redactado/editado en el modal).
 *
 * El armado de los datos del presupuesto (carga + scope + cliente + consultora)
 * lo hace armarDatosPresupuesto — no se duplica acá.
 */

import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { EMAIL_FROM as FROM } from '@/lib/email/from'
import { getFinanzasAccess } from '@/lib/finanzas/access'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { sugerirObservacionRatelimit } from '@/lib/rate-limit'
import { armarDatosPresupuesto } from '@/lib/actions/finanzas-cotizaciones'
import { presupuestoHtml } from '@/lib/pdf/presupuesto-html'
import { renderHtmlToPdf } from '@/lib/pdf/render-protocolo'
import { formatMonto } from '@/lib/finanzas/format'
import type { ActionResult } from '@/lib/types'

// ── Constantes de IA (mismo patrón que sugerir/pulir observación) ─────────────
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024
const API_TIMEOUT_MS = 30_000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Tipos de salida ───────────────────────────────────────────────────────────

export interface MailPresupuestoBorrador {
  asunto: string
  cuerpo: string
  /** Email del cliente resuelto, si lo hay (puede ser null para empresa). */
  toSugerido: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Default sin IA: asunto + cuerpo prolijos para que el usuario igual pueda enviar. */
function borradorPorDefecto(
  concepto: string,
  consultoraNombre: string,
  clienteNombre: string,
  montoFmt: string,
  validezDias: number | null,
): { asunto: string; cuerpo: string } {
  const saludo = clienteNombre?.trim() ? `Hola, equipo de ${clienteNombre}:` : 'Hola:'
  const validezTxt =
    validezDias != null && validezDias > 0
      ? ` La oferta tiene una validez de ${validezDias} días.`
      : ''
  const cuerpo =
    `${saludo}\n\n` +
    `Te acercamos el presupuesto por "${concepto}", por un total de ${montoFmt}.${validezTxt}\n\n` +
    `Lo encontrás en el PDF adjunto. Cualquier duda, quedamos a disposición.\n\n` +
    `Saludos,\n${consultoraNombre}`
  return {
    asunto: `Presupuesto — ${concepto}`,
    cuerpo,
  }
}

/** Slug simple para el filename del adjunto. */
function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase()
}

/** Escapa HTML y convierte saltos de línea en <br> para el cuerpo del email. */
function cuerpoAHtml(cuerpo: string, consultoraNombre: string): string {
  const esc = (v: string) =>
    v
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  const parrafos = esc(cuerpo).replace(/\n/g, '<br>')
  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#374151;font-size:14px;line-height:1.6">
      <p style="margin:0">${parrafos}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        ${esc(consultoraNombre)} · Enviado con Sigmetría.
      </p>
    </div>
  `
}

// ── Acción 1: redactar el mail con IA ──────────────────────────────────────────

/**
 * Redacta (con IA) el asunto y cuerpo del email que presenta el presupuesto.
 * No persiste nada ni envía: solo devuelve un borrador editable. Si la IA falla,
 * degrada a un default razonable (success: true igualmente) para no bloquear.
 */
export async function redactarMailPresupuesto(
  cotizacionId: string,
): Promise<ActionResult<MailPresupuestoBorrador>> {
  const acc = await getFinanzasAccess()
  if (!acc.hasAccess || !acc.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de presupuestos' }
  }

  const armado = await armarDatosPresupuesto(cotizacionId)
  if (!armado.success) return armado

  const { datos, clienteNombre, clienteEmail, consultoraNombre, responsableNombre } =
    armado.data

  const montoFmt = formatMonto(datos.montoTotal, datos.moneda, datos.locale)
  const validezDias = datos.validezDias ?? null

  const fallback = borradorPorDefecto(
    datos.concepto,
    consultoraNombre,
    clienteNombre,
    montoFmt,
    validezDias,
  )

  // Sin API key: degradamos al default (no es un error para el usuario).
  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: true, data: { ...fallback, toSugerido: clienteEmail } }
  }

  // Cupo IA (mismo rate-limit que las observaciones; por consultora, fallback al usuario).
  const role = await getEffectiveRole()
  const cupoKey = role?.consultoraId ?? acc.userId ?? acc.consultoraId
  const { success: dentroDelCupo } = await sugerirObservacionRatelimit.limit(cupoKey)
  if (!dentroDelCupo) {
    // Cupo agotado: devolvemos el default para que igual pueda enviar.
    return { success: true, data: { ...fallback, toSugerido: clienteEmail } }
  }

  const system = `Sos un asistente comercial de una consultora de Higiene y Seguridad en el Trabajo en Argentina. Redactás el EMAIL con el que la consultora le presenta un PRESUPUESTO a un cliente o prospecto. El presupuesto va ADJUNTO en PDF.

Tono: profesional pero cálido y cercano, en español rioplatense (voseo). Breve: 3 a 5 oraciones en total.

El cuerpo debe:
- Saludar al destinatario de forma cordial.
- Presentar el presupuesto mencionando el concepto y el monto total${validezDias != null && validezDias > 0 ? ', y la validez de la oferta' : ''}.
- Indicar que el detalle está en el PDF adjunto.
- Cerrar quedando a disposición, y firmar con el nombre de la consultora (y el del responsable si está disponible).

NO inventes datos que no estén en el contexto (no agregues precios, plazos, descuentos ni condiciones que no se te dieron). El cuerpo va en texto plano: usá saltos de línea (\\n) para separar saludo, cuerpo y firma; no uses HTML, viñetas ni markdown.

Respondé EXCLUSIVAMENTE usando la herramienta "redactar_email".`

  const contexto: string[] = [
    `Consultora (remitente): ${consultoraNombre}`,
    responsableNombre ? `Responsable: ${responsableNombre}` : '',
    `Cliente (destinatario): ${clienteNombre || 'sin nombre'}`,
    `Concepto: ${datos.concepto}`,
    `Monto total: ${montoFmt}`,
    validezDias != null && validezDias > 0 ? `Validez: ${validezDias} días` : '',
  ].filter((l) => l.length > 0)

  const userPrompt = `Datos del presupuesto a presentar:\n${contexto.join('\n')}`

  const tool: Anthropic.Tool = {
    name: 'redactar_email',
    description: 'Devuelve el asunto y el cuerpo del email que presenta el presupuesto.',
    input_schema: {
      type: 'object',
      properties: {
        asunto: {
          type: 'string',
          description: 'Asunto del email, corto y claro (ej: "Presupuesto — Servicio integral de HyS").',
        },
        cuerpo: {
          type: 'string',
          description:
            'Cuerpo del email en texto plano, 3-5 oraciones, con saltos de línea (\\n) entre saludo, cuerpo y firma.',
        },
      },
      required: ['asunto', 'cuerpo'],
    },
  }

  const client = new Anthropic()
  try {
    const completion = await client.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'redactar_email' },
        messages: [{ role: 'user', content: userPrompt }],
      },
      { timeout: API_TIMEOUT_MS },
    )

    const toolUse = completion.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    if (!toolUse) {
      return { success: true, data: { ...fallback, toSugerido: clienteEmail } }
    }

    const out = toolUse.input as { asunto?: unknown; cuerpo?: unknown }
    const asunto = typeof out.asunto === 'string' ? out.asunto.trim() : ''
    const cuerpo = typeof out.cuerpo === 'string' ? out.cuerpo.trim() : ''

    return {
      success: true,
      data: {
        asunto: asunto || fallback.asunto,
        cuerpo: cuerpo || fallback.cuerpo,
        toSugerido: clienteEmail,
      },
    }
  } catch (err) {
    // Cualquier fallo de la API (timeout, 429, 5xx) degrada al default — nunca rompe.
    if (!(err instanceof Anthropic.APIError)) {
      console.error('[FINANZAS-MAIL] error inesperado redactando con IA:', err)
    }
    return { success: true, data: { ...fallback, toSugerido: clienteEmail } }
  }
}

// ── Acción 2: enviar el presupuesto por email ───────────────────────────────────

/**
 * Envía el presupuesto por email (Resend) con el PDF ADJUNTO. El cuerpo lo provee
 * el usuario (ya redactado/editado). Gateado y escopeado a la consultora.
 */
export async function enviarPresupuestoPorMail(
  cotizacionId: string,
  args: { to: string; asunto: string; cuerpo: string },
): Promise<ActionResult<null>> {
  const acc = await getFinanzasAccess()
  if (!acc.hasAccess || !acc.consultoraId) {
    return { success: false, error: 'No tenés acceso al módulo de presupuestos' }
  }

  const to = (args.to ?? '').trim()
  if (!to || !EMAIL_RE.test(to)) {
    return { success: false, error: 'Ingresá un email válido para el destinatario' }
  }
  const asunto = (args.asunto ?? '').trim()
  const cuerpo = (args.cuerpo ?? '').trim()
  if (!cuerpo) {
    return { success: false, error: 'El cuerpo del email no puede estar vacío' }
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'El envío de emails no está disponible en este momento' }
  }

  // Armado + scope (valida la cotización contra la consultora).
  const armado = await armarDatosPresupuesto(cotizacionId)
  if (!armado.success) return armado

  const { datos, consultoraNombre } = armado.data

  // Generar el PDF (mismo render que la descarga).
  let buffer: Buffer
  try {
    buffer = await renderHtmlToPdf(presupuestoHtml(datos))
  } catch (err) {
    console.error(
      '[FINANZAS-MAIL] error generando PDF:',
      err instanceof Error ? err.message : String(err),
    )
    return { success: false, error: 'No se pudo generar el PDF del presupuesto' }
  }

  const base = slugify(consultoraNombre) || slugify(datos.concepto) || 'sigmetria'
  const filename = `Presupuesto-${base}.pdf`
  const asuntoFinal = asunto || `Presupuesto — ${datos.concepto}`

  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: asuntoFinal,
      html: cuerpoAHtml(cuerpo, consultoraNombre),
      attachments: [{ filename, content: buffer.toString('base64') }],
    })
    if (error) {
      console.error('[FINANZAS-MAIL] Resend devolvió error:', error)
      return { success: false, error: 'No se pudo enviar el email. Probá de nuevo.' }
    }
  } catch (err) {
    console.error(
      '[FINANZAS-MAIL] error enviando email:',
      err instanceof Error ? err.message : String(err),
    )
    return { success: false, error: 'No se pudo enviar el email. Probá de nuevo.' }
  }

  return { success: true, data: null }
}
