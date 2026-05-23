import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ActionResult } from '@/lib/types'
import {
  getPeligrosLibrary,
  getRiesgosLibrary,
  getMedidasControl,
  getMedidasControlTop,
  getConsecuencias,
  getProbabilidades,
  getNivelesRiesgo,
  getIpercSectores,
  getIpercCompleto,
  getEstablecimientosParaMapa,
  createPeligro,
  updatePeligro,
  deletePeligro,
  createRiesgoLib,
  updateRiesgoLib,
  deleteRiesgoLib,
  createMedidaControl,
  deleteMedidaControl,
  createIpercSector,
  deleteIpercSector,
  createIpercProceso,
  deleteIpercProceso,
  createIpercTarea,
  deleteIpercTarea,
  addPeligroATarea,
  removePeligroDeTarea,
  addRiesgoAPeligro,
  removeRiesgoDePeligro,
  calcularNivelRiesgoAction,
  addMedidaARiesgo,
  removeMedidaDeRiesgo,
  subirPlanoEstablecimiento,
} from '@/lib/actions/iperc'

// ---- Query keys ----
export const ipercKeys = {
  all: ['iperc'] as const,
  peligros: () => [...ipercKeys.all, 'peligros'] as const,
  riesgos: () => [...ipercKeys.all, 'riesgos'] as const,
  medidas: (search?: string) => [...ipercKeys.all, 'medidas', search] as const,
  medidasTop: () => [...ipercKeys.all, 'medidas', 'top'] as const,
  consecuencias: () => [...ipercKeys.all, 'consecuencias'] as const,
  probabilidades: () => [...ipercKeys.all, 'probabilidades'] as const,
  niveles: () => [...ipercKeys.all, 'niveles'] as const,
  sectores: (estId: string) => [...ipercKeys.all, 'sectores', estId] as const,
  completo: (estId: string) => [...ipercKeys.all, 'completo', estId] as const,
  mapaEstablecimientos: () => [...ipercKeys.all, 'mapa'] as const,
}

// ---- Queries ----
export function usePeligrosLibrary() {
  return useQuery({
    queryKey: ipercKeys.peligros(),
    queryFn: async () => {
      const res = await getPeligrosLibrary()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}

export function useRiesgosLibrary() {
  return useQuery({
    queryKey: ipercKeys.riesgos(),
    queryFn: async () => {
      const res = await getRiesgosLibrary()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}

export function useMedidasControl(search?: string) {
  return useQuery({
    queryKey: ipercKeys.medidas(search),
    queryFn: async () => {
      const res = await getMedidasControl(search)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: search !== undefined,
  })
}

export function useMedidasControlTop() {
  return useQuery({
    queryKey: ipercKeys.medidasTop(),
    queryFn: async () => {
      const res = await getMedidasControlTop()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}

export function useConsecuencias() {
  return useQuery({
    queryKey: ipercKeys.consecuencias(),
    queryFn: async () => {
      const res = await getConsecuencias()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}

export function useProbabilidades() {
  return useQuery({
    queryKey: ipercKeys.probabilidades(),
    queryFn: async () => {
      const res = await getProbabilidades()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}

export function useNivelesRiesgo() {
  return useQuery({
    queryKey: ipercKeys.niveles(),
    queryFn: async () => {
      const res = await getNivelesRiesgo()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}

export function useIpercSectores(establecimientoId: string) {
  return useQuery({
    queryKey: ipercKeys.sectores(establecimientoId),
    queryFn: async () => {
      const res = await getIpercSectores(establecimientoId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!establecimientoId,
  })
}

export function useIpercCompleto(establecimientoId: string) {
  return useQuery({
    queryKey: ipercKeys.completo(establecimientoId),
    queryFn: async () => {
      const res = await getIpercCompleto(establecimientoId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!establecimientoId,
  })
}

export function useEstablecimientosParaMapa() {
  return useQuery({
    queryKey: ipercKeys.mapaEstablecimientos(),
    queryFn: async () => {
      const res = await getEstablecimientosParaMapa()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}

// ---- Mutations ----
export function useCreatePeligro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await createPeligro(null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.peligros() }),
  })
}

export function useUpdatePeligro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      const res = await updatePeligro(id, null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.peligros() }),
  })
}

export function useDeletePeligro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deletePeligro(id)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.peligros() }),
  })
}

export function useCreateRiesgoLib() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await createRiesgoLib(null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.riesgos() }),
  })
}

export function useUpdateRiesgoLib() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      const res = await updateRiesgoLib(id, null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.riesgos() }),
  })
}

export function useDeleteRiesgoLib() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteRiesgoLib(id)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.riesgos() }),
  })
}

export function useCreateMedidaControl() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (texto: string) => {
      const res = await createMedidaControl(texto)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ipercKeys.medidas() })
      qc.invalidateQueries({ queryKey: ipercKeys.medidasTop() })
    },
  })
}

export function useDeleteMedidaControl() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteMedidaControl(id)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ipercKeys.medidas() })
      qc.invalidateQueries({ queryKey: ipercKeys.medidasTop() })
    },
  })
}

export function useCreateIpercSector(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await createIpercSector(establecimientoId, null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ipercKeys.sectores(establecimientoId) })
      qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) })
    },
  })
}

export function useDeleteIpercSector(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteIpercSector(id)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ipercKeys.sectores(establecimientoId) })
      qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) })
    },
  })
}

export function useCreateIpercProceso(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sectorId, formData }: { sectorId: string; formData: FormData }) => {
      const res = await createIpercProceso(sectorId, null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) }),
  })
}

export function useDeleteIpercProceso(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteIpercProceso(id)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) }),
  })
}

export function useCreateIpercTarea(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ procesoId, formData }: { procesoId: string; formData: FormData }) => {
      const res = await createIpercTarea(procesoId, null, formData)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) }),
  })
}

export function useDeleteIpercTarea(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteIpercTarea(id)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) }),
  })
}

export function useAddPeligroATarea(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tareaId, peligroId }: { tareaId: string; peligroId: string }) => {
      const res = await addPeligroATarea(tareaId, peligroId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) }),
  })
}

export function useRemovePeligroDeTarea(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await removePeligroDeTarea(id)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) }),
  })
}

export function useAddRiesgoAPeligro(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      peligroMatrizId, riesgoId, probabilidadId, consecuenciaId
    }: {
      peligroMatrizId: string
      riesgoId: string
      probabilidadId?: string
      consecuenciaId?: string
    }) => {
      const res = await addRiesgoAPeligro(peligroMatrizId, riesgoId, probabilidadId, consecuenciaId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) }),
  })
}

export function useRemoveRiesgoDePeligro(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await removeRiesgoDePeligro(id)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) }),
  })
}

export function useCalcularNivelRiesgo(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      riesgoMatrizId, probabilidadId, consecuenciaId
    }: {
      riesgoMatrizId: string
      probabilidadId: string
      consecuenciaId: string
    }) => {
      const res = await calcularNivelRiesgoAction(riesgoMatrizId, probabilidadId, consecuenciaId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) }),
  })
}

export function useAddMedidaARiesgo(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ riesgoMatrizId, medidaId }: { riesgoMatrizId: string; medidaId: string }) => {
      const res = await addMedidaARiesgo(riesgoMatrizId, medidaId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) }),
  })
}

export function useRemoveMedidaDeRiesgo(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await removeMedidaDeRiesgo(id)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ipercKeys.completo(establecimientoId) }),
  })
}
