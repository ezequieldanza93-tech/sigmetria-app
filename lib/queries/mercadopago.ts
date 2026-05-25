import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  iniciarSuscripcionMP,
  obtenerEstadoSuscripcion,
  obtenerDatosBilling,
  cambiarPlanMP,
  convertirAConsultora,
  cancelarSuscripcion,
  listarPagos,
  actualizarMetodoPago,
} from '@/lib/actions/mercadopago'


// ---- Query keys ----
export const mpKeys = {
  all: ['mercadopago'] as const,
  suscripcion: () => [...mpKeys.all, 'suscripcion'] as const,
  pagos: () => [...mpKeys.all, 'pagos'] as const,
  billing: () => [...mpKeys.all, 'billing'] as const,
}

// ---- Queries ----

export function useDatosBilling() {
  return useQuery({
    queryKey: mpKeys.billing(),
    queryFn: async () => {
      const res = await obtenerDatosBilling()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}

export function useEstadoSuscripcion() {
  return useQuery({
    queryKey: mpKeys.suscripcion(),
    queryFn: async () => {
      const res = await obtenerEstadoSuscripcion()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}

export function usePagos() {
  return useQuery({
    queryKey: mpKeys.pagos(),
    queryFn: async () => {
      const res = await listarPagos()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}

// ---- Mutations ----

export function useIniciarSuscripcion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await iniciarSuscripcionMP(null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mpKeys.all })
    },
  })
}

export function useCambiarPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nuevoPlanId: string) => {
      const res = await cambiarPlanMP(nuevoPlanId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mpKeys.all })
    },
  })
}

export function useConvertirAConsultora() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nuevoPlanId: string) => {
      const res = await convertirAConsultora(nuevoPlanId)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mpKeys.all })
    },
  })
}

export function useCancelarSuscripcion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (motivo?: string) => {
      const res = await cancelarSuscripcion(motivo)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mpKeys.all })
    },
  })
}

export function useActualizarMetodoPago() {
  return useMutation({
    mutationFn: async () => {
      const res = await actualizarMetodoPago()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}
