import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CertificadoCalibracion } from '@/lib/types'

export function useCertificados(instrumentoId: string | undefined) {
  return useQuery({
    queryKey: ['certificados', instrumentoId],
    queryFn: async () => {
      if (!instrumentoId) return []
      const supabase = createClient()
      const { data } = await supabase
        .from('certificados_calibracion')
        .select('id, instrumento_id, fecha_emision, fecha_vencimiento, certificado_url, activo, created_at')
        .eq('instrumento_id', instrumentoId)
        .order('fecha_emision', { ascending: false })
      return (data ?? []) as unknown as CertificadoCalibracion[]
    },
    enabled: !!instrumentoId,
    staleTime: 1000 * 60 * 5,
  })
}
