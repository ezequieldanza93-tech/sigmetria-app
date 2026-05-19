'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProfesionalModal } from '@/components/profesional-modal'
import type { ConsultoraMember, PerfilProfesional, UserRole } from '@/lib/types'

const ROLE_LABELS: Record<UserRole, string> = {
  full_access_main: 'Principal',
  full_access_branch: 'Sede',
  colaborador: 'Colaborador',
  full_viewer: 'Lector',
  colaborador_viewer: 'Col. Lector',
}
const ROLE_COLORS: Record<UserRole, string> = {
  full_access_main: 'bg-sig-50 text-sig-700',
  full_access_branch: 'bg-blue-50 text-blue-700',
  colaborador: 'bg-purple-50 text-purple-700',
  full_viewer: 'bg-gray-100 text-gray-600',
  colaborador_viewer: 'bg-gray-100 text-gray-600',
}

type MemberRow = ConsultoraMember & {
  profiles: {
    id: string
    full_name: string
    email: string
    avatar_url: string | null
    perfiles_profesionales: PerfilProfesional | null
  }
}

export default function EquipoPage() {
  const [miembros, setMiembros] = useState<MemberRow[] | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selected, setSelected] = useState<MemberRow | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)

      supabase
        .from('consultoras_members')
        .select('consultora_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
        .then(({ data: membership }) => {
          if (!membership) return

          supabase
            .from('consultoras_members')
            .select('*, profiles(id, full_name, avatar_url, perfiles_profesionales(*))')
            .eq('consultora_id', membership.consultora_id)
            .eq('is_active', true)
            .order('created_at')
            .then(({ data }) => setMiembros((data as unknown as MemberRow[]) ?? []))
        })
    })
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Equipo Consultora</h1>
        <p className="text-sm text-gray-500 mt-1">Profesionales habilitados para operar en el sistema</p>
      </div>

      {miembros === null ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Cargando…</div>
      ) : miembros.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No hay miembros en esta consultora.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Nombre</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Rol</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Teléfono</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Localidad</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Matriculado en</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Perfil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {miembros.map(m => {
                const pp = m.profiles?.perfiles_profesionales ?? null
                const isComplete = !!pp?.telefono && !!pp?.localidad
                return (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelected(m)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{m.profiles?.full_name ?? '—'}</span>
                        {m.user_id === currentUserId && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Vos</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role as UserRole]}`}>
                        {ROLE_LABELS[m.role as UserRole] ?? m.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{pp?.telefono ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500">{pp?.localidad ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500">{pp?.provincia_matricula ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isComplete ? 'bg-sig-50 text-sig-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {isComplete ? 'Completo' : 'Incompleto'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ProfesionalModal
          userId={selected.profiles.id}
          fullName={selected.profiles.full_name}
          open={!!selected}
          onClose={() => setSelected(null)}
          canEdit={selected.user_id === currentUserId}
        />
      )}
    </div>
  )
}
