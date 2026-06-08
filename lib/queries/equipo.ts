import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ConsultoraMember } from '@/lib/types'

export { useProvincias } from './profesional'

export type MemberRow = ConsultoraMember & {
  profiles: {
    id: string
    full_name: string
    avatar_url: string | null
    perfiles_profesionales: {
      id: string
      user_id: string
      telefono: string | null
      provincia_residencia_id: string | null
      provincia_matricula_id: string | null
    } | null
  }
}

export function useEquipoMembers() {
  return useQuery({
    queryKey: ['equipo-members'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { miembros: [] as MemberRow[], currentUserId: null, currentUserName: '' }

      // Nombre propio desde profiles (policy permite id = auth.uid()): sirve
      // para el botón "Completar mi perfil" aunque la lista de equipo esté vacía.
      const { data: ownProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
      const currentUserName = ownProfile?.full_name ?? user.email ?? 'Mi perfil'

      const { data: membership } = await supabase
        .from('consultoras_members')
        .select('consultora_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!membership) return { miembros: [] as MemberRow[], currentUserId: user.id, currentUserName }

      const { data: miembrosData } = await supabase
        .from('consultoras_members')
        .select('*, profiles(id, full_name, avatar_url, perfiles_profesionales(id, user_id, telefono, provincia_residencia_id, provincia_matricula_id))')
        .eq('consultora_id', membership.consultora_id)
        .eq('is_active', true)
        .order('created_at')

      return {
        miembros: (miembrosData as unknown as MemberRow[]) ?? [],
        currentUserId: user.id,
        currentUserName,
      }
    },
    staleTime: 1000 * 30,
  })
}
