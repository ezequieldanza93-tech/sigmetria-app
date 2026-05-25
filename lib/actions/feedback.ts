'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, Feedback, NpsStats, NpsTrendPoint } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'

// ---- Schemas ----

const feedbackNpsSchema = z.object({
  score: z.coerce.number().int().min(0).max(10),
  comentario: z.string().max(2000).default(''),
  metadata: z.string().optional(), // JSON stringified from client
})

const feedbackTicketSchema = z.object({
  tipo: z.enum(['bug', 'sugerencia', 'general']),
  titulo: z.string().min(1, 'El título es obligatorio').max(120),
  descripcion: z.string().min(1, 'La descripción es obligatoria').max(4000),
  metadata: z.string().optional(),
})

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['nuevo', 'revisado', 'descartado', 'implementado']),
})

// ---- Helpers ----

interface UserSession {
  id: string
  email: string
  consultora_id: string | null
}

async function getUser(): Promise<ActionResult<UserSession>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  return {
    success: true,
    data: {
      id: user.id,
      email: user.email ?? '',
      consultora_id: membership?.consultora_id ?? null,
    },
  }
}

async function checkSuperAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userId)
    .single()

  return profile?.is_super_admin === true
}

function parseMetadata(formData: FormData): Record<string, unknown> {
  try {
    const raw = formData.get('metadata') as string
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {}
}

// ---- Actions ----

export async function enviarFeedbackNps(
  prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const session = await getUser()
  if (!session.success) return session

  const parsed = validateFormData(feedbackNpsSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }

  const { score, comentario } = parsed.data
  const metadata = parseMetadata(formData)

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: session.data.id,
      consultora_id: session.data.consultora_id,
      tipo: 'nps',
      nps_score: score,
      comentario,
      metadata,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/configuracion/feedback')
  return { success: true, data: { id: data.id } }
}

export async function enviarFeedbackTicket(
  prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const session = await getUser()
  if (!session.success) return session

  const parsed = validateFormData(feedbackTicketSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }

  const { tipo, titulo, descripcion } = parsed.data
  const metadata = parseMetadata(formData)

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: session.data.id,
      consultora_id: session.data.consultora_id,
      tipo,
      titulo,
      comentario: descripcion,
      metadata,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/configuracion/feedback')
  return { success: true, data: { id: data.id } }
}

export async function listarMisFeedbacks(): Promise<ActionResult<Feedback[]>> {
  const supabase = await createClient()
  const session = await getUser()
  if (!session.success) return session

  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('user_id', session.data.id)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Feedback[] }
}

export async function listarFeedbackAdmin(
  tipo?: string,
  status?: string,
): Promise<ActionResult<Feedback[]>> {
  const supabase = await createClient()
  const session = await getUser()
  if (!session.success) return session

  const isSuper = await checkSuperAdmin(session.data.id)
  if (!isSuper) return { success: false, error: 'Acceso denegado' }

  let query = supabase
    .from('feedback')
    .select(`
      *,
      profiles:user_id (id, full_name, email),
      consultoras:consultora_id (id, nombre)
    `)
    .order('created_at', { ascending: false })

  if (tipo && ['nps', 'bug', 'sugerencia', 'general'].includes(tipo)) {
    query = query.eq('tipo', tipo)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) return { success: false, error: error.message }

    const mapped = (data ?? []).map((item: Record<string, unknown>) => {
    const profiles = item.profiles as { full_name: string; email: string } | null
    const consultoras = item.consultoras as { nombre: string } | null
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { profiles: _p, consultoras: _c, ...rest } = item
    return {
      ...rest,
      user_email: profiles?.email,
      user_nombre: profiles?.full_name,
      consultora_nombre: consultoras?.nombre,
    } as unknown as Feedback
  })

  return { success: true, data: mapped }
}

export async function obtenerNpsStats(): Promise<ActionResult<NpsStats>> {
  const supabase = await createClient()
  const session = await getUser()
  if (!session.success) return session

  const isSuper = await checkSuperAdmin(session.data.id)
  if (!isSuper) return { success: false, error: 'Acceso denegado' }

  const { data, error } = await supabase.rpc('calcular_nps_score')

  if (error) return { success: false, error: error.message }
  return { success: true, data: data as unknown as NpsStats }
}

export async function obtenerNpsTrend(): Promise<ActionResult<NpsTrendPoint[]>> {
  const supabase = await createClient()
  const session = await getUser()
  if (!session.success) return session

  const isSuper = await checkSuperAdmin(session.data.id)
  if (!isSuper) return { success: false, error: 'Acceso denegado' }

  const { data, error } = await supabase.rpc('nps_trend_mensual', { p_meses: 12 })

  if (error) return { success: false, error: error.message }
  return { success: true, data: data as unknown as NpsTrendPoint[] }
}

export async function actualizarStatusFeedback(
  prev: unknown,
  formData: FormData,
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const session = await getUser()
  if (!session.success) return session

  const isSuper = await checkSuperAdmin(session.data.id)
  if (!isSuper) return { success: false, error: 'Acceso denegado' }

  const parsed = validateFormData(updateStatusSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }

  const { id, status } = parsed.data

  const { error } = await supabase
    .from('feedback')
    .update({ status })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/admin/feedback')
  return { success: true, data: undefined }
}
