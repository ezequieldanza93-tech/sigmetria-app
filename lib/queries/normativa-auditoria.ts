'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getMatrizLegal,
  getAuditorias,
  getAuditoriaDetalle,
  createAuditoria,
  updateAuditoriaItem,
  updateAuditoriaEstado,
  deleteAuditoria,
  subirEvidenciaItem,
  quitarEvidenciaItem,
  type AuditoriaItemEstado,
  type AuditoriaEstado,
} from '@/lib/actions/normativa-auditoria'

const keys = {
  all: ['normativa-auditoria'] as const,
  matriz: (estId: string) => [...keys.all, 'matriz', estId] as const,
  list: (estId: string) => [...keys.all, 'list', estId] as const,
  detalle: (audId: string) => [...keys.all, 'detalle', audId] as const,
}

export function useMatrizLegal(establecimientoId: string) {
  return useQuery({
    queryKey: keys.matriz(establecimientoId),
    queryFn: async () => {
      const res = await getMatrizLegal(establecimientoId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}

export function useAuditorias(establecimientoId: string) {
  return useQuery({
    queryKey: keys.list(establecimientoId),
    queryFn: async () => {
      const res = await getAuditorias(establecimientoId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
}

export function useAuditoriaDetalle(auditoriaId: string | null) {
  return useQuery({
    queryKey: keys.detalle(auditoriaId ?? 'none'),
    queryFn: async () => {
      const res = await getAuditoriaDetalle(auditoriaId as string)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!auditoriaId,
  })
}

export function useCreateAuditoria(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (notas?: string) => {
      const res = await createAuditoria(establecimientoId, notas)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list(establecimientoId) }),
  })
}

export function useUpdateAuditoriaItem(establecimientoId: string, auditoriaId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { itemId: string; estado?: AuditoriaItemEstado; observacion?: string | null; evidencia_url?: string | null }) => {
      const res = await updateAuditoriaItem(vars.itemId, { estado: vars.estado, observacion: vars.observacion, evidencia_url: vars.evidencia_url })
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detalle(auditoriaId) })
      qc.invalidateQueries({ queryKey: keys.list(establecimientoId) })
    },
  })
}

export function useUpdateAuditoriaEstado(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { auditoriaId: string; estado: AuditoriaEstado }) => {
      const res = await updateAuditoriaEstado(vars.auditoriaId, vars.estado)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.detalle(vars.auditoriaId) })
      qc.invalidateQueries({ queryKey: keys.list(establecimientoId) })
    },
  })
}

export function useDeleteAuditoria(establecimientoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (auditoriaId: string) => {
      const res = await deleteAuditoria(auditoriaId)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list(establecimientoId) }),
  })
}

export function useSubirEvidencia(auditoriaId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { itemId: string; file: File }) => {
      const fd = new FormData()
      fd.set('file', vars.file)
      const res = await subirEvidenciaItem(vars.itemId, fd)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.detalle(auditoriaId) }),
  })
}

export function useQuitarEvidencia(auditoriaId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await quitarEvidenciaItem(itemId)
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.detalle(auditoriaId) }),
  })
}
