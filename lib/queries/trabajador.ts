import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useMatriculasPersona(personaId: string | undefined) {
  return useQuery({
    queryKey: ['matriculas-persona', personaId],
    queryFn: async () => {
      if (!personaId) return []
      const supabase = createClient()
      const { data } = await supabase
        .from('matriculas')
        .select('id, persona_id, emisor, numero, fecha_emision, fecha_vencimiento, activa, organizaciones_externas(nombre)')
        .eq('persona_id', personaId)
        .order('fecha_emision', { ascending: false })
      return (data ?? []) as {
        id: string
        persona_id: string
        emisor: string
        numero: string
        fecha_emision: string | null
        fecha_vencimiento: string | null
        activa: boolean
        organizaciones_externas: { nombre: string } | null
      }[]
    },
    enabled: !!personaId,
    staleTime: 1000 * 60 * 5,
  })
}
