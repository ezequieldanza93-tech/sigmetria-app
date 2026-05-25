import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  enviarFeedbackNps,
  enviarFeedbackTicket,
  listarMisFeedbacks,
  listarFeedbackAdmin,
  obtenerNpsStats,
  obtenerNpsTrend,
  actualizarStatusFeedback,
} from '@/lib/actions/feedback'
import type { Feedback, NpsStats, NpsTrendPoint } from '@/lib/types'

// ---- Query keys ----
export const feedbackKeys = {
  all: ['feedback'] as const,
  mine: () => [...feedbackKeys.all, 'mine'] as const,
  admin: () => [...feedbackKeys.all, 'admin'] as const,
  adminList: (tipo?: string, status?: string) =>
    [...feedbackKeys.admin(), 'list', tipo, status] as const,
  npsStats: () => [...feedbackKeys.admin(), 'nps-stats'] as const,
  npsTrend: () => [...feedbackKeys.admin(), 'nps-trend'] as const,
}

// ---- Queries ----
export function useMisFeedbacks() {
  return useQuery({
    queryKey: feedbackKeys.mine(),
    queryFn: async () => {
      const res = await listarMisFeedbacks()
      if (!res.success) throw new Error(res.error)
      return res.data as Feedback[]
    },
  })
}

export function useFeedbackAdmin(tipo?: string, status?: string) {
  return useQuery({
    queryKey: feedbackKeys.adminList(tipo, status),
    queryFn: async () => {
      const res = await listarFeedbackAdmin(tipo, status)
      if (!res.success) throw new Error(res.error)
      return res.data as Feedback[]
    },
  })
}

export function useNpsStats() {
  return useQuery({
    queryKey: feedbackKeys.npsStats(),
    queryFn: async () => {
      const res = await obtenerNpsStats()
      if (!res.success) throw new Error(res.error)
      return res.data as NpsStats
    },
  })
}

export function useNpsTrend() {
  return useQuery({
    queryKey: feedbackKeys.npsTrend(),
    queryFn: async () => {
      const res = await obtenerNpsTrend()
      if (!res.success) throw new Error(res.error)
      return res.data as NpsTrendPoint[]
    },
  })
}

// ---- Mutations ----
export function useEnviarFeedbackNps() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await enviarFeedbackNps(null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.mine() })
    },
  })
}

export function useEnviarFeedbackTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await enviarFeedbackTicket(null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.mine() })
    },
  })
}

export function useActualizarStatusFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await actualizarStatusFeedback(null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.admin() })
    },
  })
}
