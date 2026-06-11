import { createAdminClient } from '@/lib/supabase/admin'
import { sendAlertasCriticalEmail } from '@/lib/email/alertas'
import { diasHastaVencimiento, umbralQueDispara, type UmbralConfig } from '@/lib/alertas/umbrales'

/**
 * Emisión de alertas SRT por consultora (Res. SRT 48/2025 Art. 4.9).
 *
 * Para CADA consultora activa:
 *   1. Regenera las alertas (RPC generar_alertas_consultora) — in-app, siempre.
 *   2. Junta las CRÍTICAS sin resolver y, si hay, manda UN solo email agrupado
 *      a los admins (D6: in-app siempre + email para críticas). Anti-spam:
 *      un email por consultora por corrida, no uno por alerta.
 *   3. Registra la emisión en alertas_emitidas_log (qué/a quién/cuándo).
 *
 * Pensado para correr desde un cron (service_role). NO lanza: acumula errores
 * por consultora y devuelve totales para la bitácora de cron.
 */

export interface EmitAlertasResult {
  consultoras: number
  alertasGeneradas: number
  emailsEnviados: number
  errores: string[]
}

interface AlertaCriticaRow {
  tipo: string
  mensaje: string
  empresas: { razon_social: string | null } | null
}

export async function emitAlertasTodasLasConsultoras(): Promise<EmitAlertasResult> {
  const admin = createAdminClient()
  const result: EmitAlertasResult = {
    consultoras: 0,
    alertasGeneradas: 0,
    emailsEnviados: 0,
    errores: [],
  }

  const { data: consultoras } = await admin
    .from('consultoras')
    .select('id, nombre')
    .eq('is_active', true)

  if (!consultoras?.length) return result

  for (const c of consultoras as { id: string; nombre: string }[]) {
    result.consultoras++

    // 1. Regenerar alertas in-app
    const { data: generadas, error: genErr } = await admin.rpc('generar_alertas_consultora', {
      p_consultora_id: c.id,
    })
    if (genErr) {
      result.errores.push(`${c.nombre}: generar_alertas → ${genErr.message}`)
      continue
    }
    const nGeneradas = (generadas as number) ?? 0
    result.alertasGeneradas += nGeneradas

    // Registro de la emisión in-app (agrupado: 1 fila por consultora por corrida).
    if (nGeneradas > 0) {
      await admin.from('alertas_emitidas_log').insert({
        consultora_id: c.id,
        canal: 'in_app',
        tipo: 'alerta_srt',
        cantidad: nGeneradas,
        meta: { fuente: 'cron', accion: 'generar_alertas_consultora' },
      })
    }

    // Avisos tempranos por umbral configurable (30/15/7…). Agrupado por umbral
    // para NO spamear: una fila de log por (consultora, umbral) cruzado hoy.
    await registrarAvisosTempranos(admin, c.id)

    // 2. Críticas sin resolver → email agrupado a admins
    const { data: criticas } = await admin
      .from('alertas')
      .select('tipo, mensaje, empresas(razon_social)')
      .eq('consultora_id', c.id)
      .eq('severidad', 'critical')
      .eq('resuelta', false)
      .limit(50)

    const criticasList = (criticas ?? []) as unknown as AlertaCriticaRow[]
    if (criticasList.length === 0) continue

    const emails = await getAdminEmails(admin, c.id)
    if (emails.length === 0) {
      result.errores.push(`${c.nombre}: ${criticasList.length} críticas pero sin admins con email`)
      continue
    }

    try {
      await sendAlertasCriticalEmail({
        consultoraNombre: c.nombre,
        emails,
        alertas: criticasList.map(a => ({
          tipo: a.tipo,
          mensaje: a.mensaje,
          empresa_nombre: a.empresas?.razon_social ?? '—',
        })),
      })
      result.emailsEnviados++

      await admin.from('alertas_emitidas_log').insert({
        consultora_id: c.id,
        canal: 'email',
        tipo: 'alerta_srt',
        severidad: 'critical',
        destinatarios: emails,
        cantidad: criticasList.length,
        meta: { fuente: 'cron' },
      })
    } catch (e) {
      result.errores.push(`${c.nombre}: email → ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  return result
}

/**
 * Emails de los admins (full_access_main / full_access_branch) de una consultora.
 * El email vive en auth.users (no en profiles) → se resuelve vía admin API.
 */
async function getAdminEmails(
  admin: ReturnType<typeof createAdminClient>,
  consultoraId: string,
): Promise<string[]> {
  const { data: members } = await admin
    .from('consultoras_members')
    .select('user_id, role')
    .eq('consultora_id', consultoraId)
    .eq('is_active', true)
    .in('role', ['full_access_main', 'full_access_branch'])

  if (!members?.length) return []

  const emails: string[] = []
  for (const m of members as { user_id: string }[]) {
    const { data } = await admin.auth.admin.getUserById(m.user_id)
    const email = data?.user?.email
    if (email) emails.push(email)
  }
  return [...new Set(emails)]
}

/**
 * Registra avisos tempranos in-app por umbral configurable de una consultora.
 *
 * Toma los documentos de empresa/establecimiento con vencimiento futuro y, para
 * cada uno, decide si HOY cruza un umbral configurado (umbralQueDispara). Agrupa
 * por umbral cruzado → una fila en alertas_emitidas_log por (consultora, umbral)
 * con la cantidad de documentos que lo cruzaron (anti-spam). No genera emails
 * acá (los emails son solo para críticas vía sendAlertasCriticalEmail).
 */
async function registrarAvisosTempranos(
  admin: ReturnType<typeof createAdminClient>,
  consultoraId: string,
): Promise<void> {
  const { data: umbralesRaw } = await admin
    .from('alertas_umbrales')
    .select('dias_antes, severidad, activo')
    .eq('consultora_id', consultoraId)
    .eq('activo', true)
  const umbrales = (umbralesRaw ?? []) as UmbralConfig[]
  if (umbrales.length === 0) return

  // Documentos con vencimiento futuro (empresa + establecimiento) de la consultora.
  const [{ data: empDocs }, { data: estDocs }] = await Promise.all([
    admin
      .from('empresas_documentos')
      .select('fecha_vencimiento, empresas!inner(consultora_id)')
      .eq('empresas.consultora_id', consultoraId)
      .not('fecha_vencimiento', 'is', null)
      .gte('fecha_vencimiento', new Date().toISOString().slice(0, 10)),
    admin
      .from('establecimientos_documentos')
      .select('fecha_vencimiento, establecimientos!inner(empresas!inner(consultora_id))')
      .eq('establecimientos.empresas.consultora_id', consultoraId)
      .not('fecha_vencimiento', 'is', null)
      .gte('fecha_vencimiento', new Date().toISOString().slice(0, 10)),
  ])

  const vencimientos: string[] = [
    ...((empDocs ?? []) as { fecha_vencimiento: string }[]).map(d => d.fecha_vencimiento),
    ...((estDocs ?? []) as { fecha_vencimiento: string }[]).map(d => d.fecha_vencimiento),
  ]
  if (vencimientos.length === 0) return

  const hoy = new Date()
  // Agrupar por umbral cruzado hoy.
  const porUmbral = new Map<number, { severidad: string; cantidad: number }>()
  for (const venc of vencimientos) {
    const dias = diasHastaVencimiento(venc, hoy)
    const disparo = umbralQueDispara(dias, umbrales)
    if (!disparo) continue
    const prev = porUmbral.get(disparo.dias_antes)
    porUmbral.set(disparo.dias_antes, {
      severidad: disparo.severidad,
      cantidad: (prev?.cantidad ?? 0) + 1,
    })
  }

  for (const [diasAntes, info] of porUmbral) {
    await admin.from('alertas_emitidas_log').insert({
      consultora_id: consultoraId,
      canal: 'in_app',
      tipo: 'vencimiento',
      severidad: info.severidad,
      cantidad: info.cantidad,
      meta: { fuente: 'cron', umbral_dias: diasAntes, accion: 'aviso_temprano' },
    })
  }
}
