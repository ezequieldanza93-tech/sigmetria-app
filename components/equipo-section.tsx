'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProfesionalModal } from '@/components/profesional-modal'
import type { ConsultoraMember, PerfilProfesional, UserRole } from '@/lib/types'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/types'

type MemberRow = ConsultoraMember & {
  profiles: {
    id: string
    full_name: string
    avatar_url: string | null
    perfiles_profesionales: PerfilProfesional | null
  }
}

export function EquipoSection() {
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

  if (miembros === null) return null

  return (
    <>
      <div className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-text-primary">Perfiles profesionales</h2>
          <p className="text-xs text-text-tertiary mt-0.5">Hacé click en un miembro para ver o editar su perfil</p>
        </div>

        {miembros.length === 0 ? (
          <div className="px-5 py-8 text-center text-text-tertiary text-sm">
            No hay miembros activos.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-text-tertiary font-medium">Nombre</th>
                <th className="px-5 py-3 text-text-tertiary font-medium">Rol</th>
                <th className="px-5 py-3 text-text-tertiary font-medium">Teléfono</th>
                <th className="px-5 py-3 text-text-tertiary font-medium">Localidad</th>
                <th className="px-5 py-3 text-text-tertiary font-medium">Matriculado en</th>
                <th className="px-5 py-3 text-text-tertiary font-medium">Perfil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {miembros.map(m => {
                const pp = m.profiles?.perfiles_profesionales ?? null
                const isComplete = !!pp?.telefono && !!pp?.localidad
                return (
                  <tr
                    key={m.id}
                    className="hover:bg-surface-base transition-colors cursor-pointer"
                    onClick={() => setSelected(m)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">{m.profiles?.full_name ?? '—'}</span>
                        {m.user_id === currentUserId && (
                          <span className="text-xs bg-surface-sunken text-text-tertiary px-1.5 py-0.5 rounded">Vos</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role as UserRole] ?? ''}`}>
                        {ROLE_LABELS[m.role as UserRole] ?? m.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-text-tertiary">{pp?.telefono ?? '—'}</td>
                    <td className="px-5 py-3.5 text-text-tertiary">{pp?.localidad ?? '—'}</td>
                    <td className="px-5 py-3.5 text-text-tertiary">{pp?.provincia_matricula ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isComplete ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--warning-bg)] text-[var(--warning)]'}`}>
                        {isComplete ? 'Completo' : 'Incompleto'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <ProfesionalModal
          userId={selected.profiles.id}
          fullName={selected.profiles.full_name}
          open={!!selected}
          onClose={() => setSelected(null)}
          canEdit={selected.user_id === currentUserId}
        />
      )}
    </>
  )
}
