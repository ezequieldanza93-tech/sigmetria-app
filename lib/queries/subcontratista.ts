import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type {
  Subcontratista,
  SubcontratistaDocumento,
  DocumentType,
} from '@/lib/types'

// ──────────────────────────────────────────────
// Subcontratista completo (con org + documentos)
// ──────────────────────────────────────────────

export function useSubcontratista(id: string | undefined) {
  return useQuery({
    queryKey: ['subcontratista', id],
    queryFn: async () => {
      if (!id) return null
      const supabase = createClient()

      const { data: sub } = await supabase
        .from('subcontratistas')
        .select(`
          *,
          subcontratistas_rubros!rubro_id(nombre),
          establecimientos_tipos!tipo_establecimiento_id(nombre),
          organizaciones_externas!organizacion_id(
            nombre,
            cuit,
            domicilio,
            email,
            telefono,
            tipo_identidad_impositiva,
            localidades!localidad_id(nombre, provincia)
          )
        `)
        .eq('id', id)
        .single()

      return sub as unknown as Subcontratista | null
    },
    enabled: !!id,
  })
}

// ──────────────────────────────────────────────
// Documentos del subcontratista
// ──────────────────────────────────────────────

export function useSubcontratistaDocumentos(subcontratistaId: string | undefined) {
  return useQuery({
    queryKey: ['subcontratista-documentos', subcontratistaId],
    queryFn: async () => {
      if (!subcontratistaId) return []
      const supabase = createClient()

      const { data } = await supabase
        .from('subcontratistas_documentos')
        .select('*, documentos_tipos!tipo_id(nombre)')
        .eq('subcontratista_id', subcontratistaId)
        .order('created_at', { ascending: false })

      return (data ?? []) as unknown as SubcontratistaDocumento[]
    },
    enabled: !!subcontratistaId,
  })
}

// ──────────────────────────────────────────────
// Establecimientos vinculados
// ──────────────────────────────────────────────

export function useSubcontratistaEstablecimientos(subcontratistaId: string | undefined) {
  return useQuery({
    queryKey: ['subcontratista-establecimientos', subcontratistaId],
    queryFn: async () => {
      if (!subcontratistaId) return []
      const supabase = createClient()

      // Get the subcontratista's organizacion_id first
      const { data: sub } = await supabase
        .from('subcontratistas')
        .select('organizacion_id')
        .eq('id', subcontratistaId)
        .single()

      if (!sub) return []

      const { data } = await supabase
        .from('organizaciones_establecimientos')
        .select(`
          establecimiento_id,
          establecimientos!establecimiento_id(
            id, nombre, actividad_principal,
            empresas!empresa_id(razon_social),
            establecimientos_tipos!tipo_id(nombre)
          )
        `)
        .eq('organizacion_id', sub.organizacion_id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []).map((d: any) => d.establecimientos).filter(Boolean)) as Array<{
        id: string
        nombre: string
        actividad_principal: string | null
        empresas?: { razon_social: string } | null
        establecimientos_tipos?: { nombre: string } | null
      }>
    },
    enabled: !!subcontratistaId,
  })
}

// ──────────────────────────────────────────────
// Todos los establecimientos de la consultora
// (para el selector de vínculo)
// ──────────────────────────────────────────────

export function useConsultoraEstablecimientos(enabled = true) {
  return useQuery({
    queryKey: ['consultora-establecimientos'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data: member } = await supabase
        .from('consultoras_members')
        .select('consultora_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!member) return []

      const { data } = await supabase
        .from('establecimientos')
        .select('id, nombre, empresas!empresa_id(razon_social)')
        .eq('empresas.consultora_id', member.consultora_id)
        .eq('status', 'active')
        .order('nombre')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((item: any) => ({
        id: item.id,
        nombre: item.nombre,
        empresas: Array.isArray(item.empresas) ? item.empresas[0] : item.empresas ?? null,
      })) as Array<{
        id: string
        nombre: string
        empresas?: { razon_social: string } | null
      }>
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  })
}

// ──────────────────────────────────────────────
// Lista de subcontratistas
// ──────────────────────────────────────────────

export interface SubcontratistaListItem {
  id: string
  organizacion_id: string
  rubro_id: string | null
  created_at: string
  organizaciones_externas: {
    nombre: string
    cuit: string | null
    is_active: boolean
  } | null
  subcontratistas_rubros: { nombre: string } | null
}

export function useSubcontratistasList(filters?: { rubro_id?: string }) {
  return useQuery({
    queryKey: ['subcontratistas-list', filters],
    queryFn: async () => {
      const supabase = createClient()

      let query = supabase
        .from('subcontratistas')
        .select(`
          id, organizacion_id, rubro_id, created_at,
          organizaciones_externas!organizacion_id(nombre, cuit, is_active),
          subcontratistas_rubros!rubro_id(nombre)
        `)

      if (filters?.rubro_id) {
        query = query.eq('rubro_id', filters.rubro_id)
      }

      const { data } = await query.order('created_at', { ascending: false })

      return (data ?? []) as unknown as SubcontratistaListItem[]
    },
    staleTime: 1000 * 60 * 2,
  })
}

// ──────────────────────────────────────────────
// Subcontratistas con documentos por vencer
// ──────────────────────────────────────────────

export interface VencimientoItem {
  documento_id: string
  subcontratista_id: string
  subcontratista_nombre: string
  tipo_nombre: string
  fecha_vencimiento: string
  dias_restantes: number
}

export function useSubcontratistasConVencimientos(fechaDesde: string, fechaHasta: string) {
  return useQuery({
    queryKey: ['subcontratistas-vencimientos', fechaDesde, fechaHasta],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data } = await supabase
        .from('subcontratistas_documentos')
        .select(`
          id,
          fecha_vencimiento,
          subcontratista_id,
          subcontratistas!subcontratista_id(
            organizaciones_externas!organizacion_id(nombre)
          ),
          documentos_tipos!tipo_id(nombre)
        `)
        .gte('fecha_vencimiento', fechaDesde)
        .lte('fecha_vencimiento', fechaHasta)
        .order('fecha_vencimiento', { ascending: true })

      if (!data) return []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as any[]).map(d => {
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        const venc = new Date(d.fecha_vencimiento)
        venc.setHours(0, 0, 0, 0)
        const dias = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000)

        return {
          documento_id: d.id,
          subcontratista_id: d.subcontratista_id,
          subcontratista_nombre: d.subcontratistas?.organizaciones_externas?.nombre ?? '—',
          tipo_nombre: d.documentos_tipos?.nombre ?? '—',
          fecha_vencimiento: d.fecha_vencimiento,
          dias_restantes: dias,
        } as VencimientoItem
      })
    },
    enabled: !!fechaDesde && !!fechaHasta,
    staleTime: 1000 * 60 * 1,
  })
}

// ──────────────────────────────────────────────
// Tipos documentales que aplican a subcontratistas
// ──────────────────────────────────────────────

export function useDocumentosTiposSubcontratista(enabled = true) {
  return useQuery({
    queryKey: ['documentos-tipos-subcontratista'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('documentos_tipos')
        .select('id, nombre, aplica_subcontratista, is_active')
        .eq('is_active', true)
        .eq('aplica_subcontratista', true)
        .order('nombre')
      return (data ?? []) as DocumentType[]
    },
    staleTime: 1000 * 60 * 30,
    enabled,
  })
}

// ──────────────────────────────────────────────
// Respuestas de riesgo para edición
// ──────────────────────────────────────────────

export interface RiesgoRespuestaItem {
  id: string
  codigo: string
  texto: string
  orden: number
  respuesta: boolean | null
}

export function useSubcontratistaRespuestas(subcontratistaId: string | undefined) {
  return useQuery({
    queryKey: ['subcontratista-respuestas', subcontratistaId],
    queryFn: async () => {
      if (!subcontratistaId) return []
      const supabase = createClient()

      // Get tipo_establecimiento_id
      const { data: sub } = await supabase
        .from('subcontratistas')
        .select('tipo_establecimiento_id')
        .eq('id', subcontratistaId)
        .single()

      if (!sub?.tipo_establecimiento_id) return []

      // Get preguntas for this tipo
      const { data: preguntasData } = await supabase
        .from('preguntas_tipos')
        .select(`
          pregunta_id,
          orden,
          riesgos_preguntas!pregunta_id(id, codigo, texto, orden, is_active)
        `)
        .eq('tipo_id', sub.tipo_establecimiento_id)
        .order('orden')

      if (!preguntasData) return []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const preguntas = (preguntasData as any[]).map(r => r.riesgos_preguntas).filter(Boolean)

      // Get existing respuestas
      const { data: respuestas } = await supabase
        .from('subcontratistas_respuestas')
        .select('pregunta_id, respuesta')
        .eq('subcontratista_id', subcontratistaId)

      const respMap = new Map(
        (respuestas ?? []).map(r => [r.pregunta_id, r.respuesta])
      )

      return preguntas
        .sort((a: { orden: number }, b: { orden: number }) => a.orden - b.orden)
        .map((p: { id: string; codigo: string; texto: string; orden: number }) => ({
          id: p.id,
          codigo: p.codigo,
          texto: p.texto,
          orden: p.orden,
          respuesta: respMap.get(p.id) ?? null,
        })) as RiesgoRespuestaItem[]
    },
    enabled: !!subcontratistaId,
  })
}
