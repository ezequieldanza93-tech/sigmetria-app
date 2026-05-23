import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
} from '@/lib/actions/notificacion'
import {
  getConfiguracionVencimientos,
  updateConfiguracionVencimiento,
  initConfiguracionVencimientos,
} from '@/lib/actions/configuracion-vencimiento'

// ─── NOTIFICACIONES ───

export function useNotificaciones() {
  return useQuery({
    queryKey: ['notificaciones'],
    queryFn: getNotificaciones,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  })
}

export function useNotificacionesNoLeidas() {
  const { data: notificaciones } = useNotificaciones()
  const count = (notificaciones ?? []).filter(n => !n.leida).length
  return { count, notificaciones: notificaciones ?? [] }
}

export function useMarcarNotificacionLeida() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (notificacionId: string) => {
      const result = await marcarNotificacionLeida(notificacionId)
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] })
    },
  })
}

export function useMarcarTodasLeidas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const result = await marcarTodasLeidas()
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] })
    },
  })
}

// ─── CONFIGURACIÓN ───

export function useConfiguracionVencimientos() {
  return useQuery({
    queryKey: ['configuracion-vencimientos'],
    queryFn: async () => {
      const result = await getConfiguracionVencimientos()
      if (result.length === 0) {
        await initConfiguracionVencimientos()
        return getConfiguracionVencimientos()
      }
      return result
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useUpdateConfiguracionVencimiento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: { tiene_vencimiento?: boolean; dias_aviso?: number; activo?: boolean }
    }) => {
      const result = await updateConfiguracionVencimiento(id, updates)
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion-vencimientos'] })
    },
  })
}
