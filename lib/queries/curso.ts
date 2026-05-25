import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Curso, CursoModulo, CursoAsignacion, CumplimientoStats, CumplimientoEmpresa, CumplimientoTrendPoint } from '@/lib/types'
import {
  crearCurso, actualizarCurso, publicarCurso,
  asignarCurso, asignarMasivo,
  marcarLeccionCompletada,
  enviarIntentoQuiz,
  emitirCertificado,
} from '@/lib/actions/curso'

// ---- Query keys ----
export const cursoKeys = {
  all: ['cursos'] as const,
  list: (filtros?: Record<string, unknown>) => [...cursoKeys.all, 'list', filtros] as const,
  detail: (id: string) => [...cursoKeys.all, 'detail', id] as const,
  contenido: (id: string) => [...cursoKeys.all, 'contenido', id] as const,
  misAsignaciones: () => [...cursoKeys.all, 'mis-asignaciones'] as const,
  asignaciones: (cursoId: string) => [...cursoKeys.all, 'asignaciones', cursoId] as const,
  progreso: (asignacionId: string) => [...cursoKeys.all, 'progreso', asignacionId] as const,
  cumplimiento: () => [...cursoKeys.all, 'cumplimiento'] as const,
  cumplimientoEmpresa: (empresaId: string) => [...cursoKeys.cumplimiento(), empresaId] as const,
}

// ---- Queries ----

export function useCursos(filtros?: { tipo?: 'mis' | 'publicos'; estado?: string }) {
  return useQuery({
    queryKey: cursoKeys.list(filtros as Record<string, unknown>),
    queryFn: async () => {
      const supabase = createClient()
      let query = supabase.from('cursos').select('*')

      if (filtros?.estado && filtros.estado !== 'todos') {
        query = query.eq('estado', filtros.estado)
      }

      if (filtros?.tipo === 'publicos') {
        query = query.is('consultora_id', null)
      }

      query = query.order('created_at', { ascending: false })
      const { data } = await query
      return (data ?? []) as Curso[]
    },
  })
}

export function useCurso(id: string) {
  return useQuery({
    queryKey: cursoKeys.detail(id),
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('cursos').select('*').eq('id', id).single()
      return data as Curso | null
    },
    enabled: !!id,
  })
}

export function useCursoContenido(id: string) {
  return useQuery({
    queryKey: cursoKeys.contenido(id),
    queryFn: async () => {
      const supabase = createClient()

      const { data: modulos } = await supabase
        .from('curso_modulos')
        .select('*')
        .eq('curso_id', id)
        .order('orden')

      const modulosWithLecciones = await Promise.all((modulos ?? []).map(async (m) => {
        const { data: lecciones } = await supabase
          .from('curso_lecciones')
          .select('*')
          .eq('modulo_id', m.id)
          .order('orden')

        const { data: quizzes } = await supabase
          .from('curso_quizzes')
          .select('*, curso_preguntas(*, curso_opciones(*))')
          .eq('modulo_id', m.id)

        return {
          ...m,
          lecciones: lecciones ?? [],
          quiz: (quizzes && quizzes.length > 0) ? {
            ...quizzes[0] as any,
            preguntas: (quizzes[0] as any)?.curso_preguntas?.map((p: any) => ({
              ...p,
              opciones: p.curso_opciones ?? [],
            })) ?? [],
          } : null,
        } as CursoModulo
      }))

      // Get final quiz
      const { data: finalQuizzes } = await supabase
        .from('curso_quizzes')
        .select('*, curso_preguntas(*, curso_opciones(*))')
        .is('modulo_id', null)
        .eq('curso_id', id)

      return {
        modulos: modulosWithLecciones,
        quizFinal: (finalQuizzes && finalQuizzes.length > 0) ? {
          ...finalQuizzes[0] as any,
          preguntas: (finalQuizzes[0] as any)?.curso_preguntas?.map((p: any) => ({
            ...p,
            opciones: p.curso_opciones ?? [],
          })) ?? [],
        } : null,
      }
    },
    enabled: !!id,
  })
}

export function useMisAsignaciones() {
  return useQuery({
    queryKey: cursoKeys.misAsignaciones(),
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data: personas } = await supabase
        .from('directorio_personas')
        .select('id')
        .eq('usuario_id', user.id)

      if (!personas || personas.length === 0) return []

      const { data } = await supabase
        .from('curso_asignaciones')
        .select('*, cursos(*)')
        .in('persona_id', personas.map(p => p.id))
        .in('estado', ['pendiente', 'en_curso', 'aprobado', 'vencido'])
        .order('created_at', { ascending: false })

      return (data ?? []) as (CursoAsignacion & { cursos: Curso })[]
    },
  })
}

export function useAsignacionesCurso(cursoId: string) {
  return useQuery({
    queryKey: cursoKeys.asignaciones(cursoId),
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('curso_asignaciones')
        .select('*, directorio_personas!persona_id(*)')
        .eq('curso_id', cursoId)
        .order('fecha_asignacion', { ascending: false })

      return data ?? []
    },
    enabled: !!cursoId,
  })
}

export function useProgresoCurso(asignacionId: string) {
  return useQuery({
    queryKey: cursoKeys.progreso(asignacionId),
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('curso_progreso_lecciones')
        .select('*')
        .eq('asignacion_id', asignacionId)

      return data ?? []
    },
    enabled: !!asignacionId,
  })
}

export function useCumplimientoConsultora() {
  return useQuery({
    queryKey: cursoKeys.cumplimiento(),
    queryFn: async () => {
      const { obtenerCumplimientoConsultora } = await import('@/lib/actions/curso')
      const res = await obtenerCumplimientoConsultora()
      if (!res.success) throw new Error(res.error)
      return res.data as CumplimientoStats
    },
  })
}

export function useCumplimientoEmpresa(empresaId: string) {
  return useQuery({
    queryKey: cursoKeys.cumplimientoEmpresa(empresaId),
    queryFn: async () => {
      const { obtenerCumplimientoEmpresa } = await import('@/lib/actions/curso')
      const res = await obtenerCumplimientoEmpresa(empresaId)
      if (!res.success) throw new Error(res.error)
      return res.data as CumplimientoEmpresa
    },
    enabled: !!empresaId,
  })
}

export function useCumplimientoTrend() {
  return useQuery({
    queryKey: [...cursoKeys.cumplimiento(), 'trend'],
    queryFn: async () => {
      const { obtenerTrendCumplimiento } = await import('@/lib/actions/curso')
      const res = await obtenerTrendCumplimiento()
      if (!res.success) throw new Error(res.error)
      return res.data as CumplimientoTrendPoint[]
    },
  })
}

// ---- Mutations ----

export function useCrearCurso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await crearCurso(null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cursoKeys.all }),
  })
}

export function useActualizarCurso(cursoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await actualizarCurso(cursoId, null, formData)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cursoKeys.detail(cursoId) })
      qc.invalidateQueries({ queryKey: cursoKeys.list() })
    },
  })
}

export function usePublicarCurso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cursoId: string) => {
      const res = await publicarCurso(cursoId)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cursoKeys.all }),
  })
}

export function useAsignarCurso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await asignarCurso(null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cursoKeys.asignaciones('') }),
  })
}

export function useAsignarMasivo(cursoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (criterios: { empresa_id?: string; establecimiento_id?: string; sector_id?: string; puesto_id?: string; fecha_limite?: string; obligatorio?: boolean }) => {
      const res = await asignarMasivo(cursoId, criterios)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cursoKeys.asignaciones(cursoId) }),
  })
}

export function useMarcarLeccionCompletada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ asignacionId, leccionId, minutosVistos }: { asignacionId: string; leccionId: string; minutosVistos?: number }) => {
      const res = await marcarLeccionCompletada(asignacionId, leccionId, minutosVistos)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cursoKeys.progreso('') }),
  })
}

export function useEnviarIntentoQuiz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await enviarIntentoQuiz(null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cursoKeys.misAsignaciones() }),
  })
}

export function useEmitirCertificado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (asignacionId: string) => {
      const res = await emitirCertificado(asignacionId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cursoKeys.misAsignaciones() }),
  })
}
