'use client'

import { useState } from 'react'
import { useEquipoMembers, useProvincias, type MemberRow } from '@/lib/queries/equipo'
import { ProfesionalModal } from '@/components/profesional-modal'
import type { UserRole } from '@/lib/types'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/types'

export function EquipoSection() {
  const { data, isLoading } = useEquipoMembers()
  const { data: provincias = [] } = useProvincias()
  const [selected, setSelected] = useState<MemberRow | null>(null)
  const [selfOpen, setSelfOpen] = useState(false)

  if (isLoading || !data) return null

  const { miembros, currentUserId, currentUserName } = data

  return (
    <>
      <div className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Perfiles profesionales</h2>
            <p className="text-xs text-text-tertiary mt-0.5">Hacé click en un miembro para ver o editar su perfil</p>
          </div>
          {currentUserId && (
            <button
              onClick={() => setSelfOpen(true)}
              className="shrink-0 text-xs font-medium bg-sig-500 text-white px-3 py-1.5 rounded-lg hover:bg-sig-700 transition-colors"
            >
              Completar mi perfil
            </button>
          )}
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
                <th className="px-5 py-3 text-text-tertiary font-medium">Provincia</th>
                <th className="px-5 py-3 text-text-tertiary font-medium">Perfil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {miembros.map(m => {
                const pp = m.profiles?.perfiles_profesionales ?? null
                const provinciaNombre = pp?.provincia_residencia_id
                  ? provincias.find(p => p.id === pp.provincia_residencia_id)?.nombre ?? '—'
                  : '—'
                const isComplete = !!pp?.telefono && !!pp?.provincia_residencia_id
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
                    <td className="px-5 py-3.5 text-text-tertiary">{provinciaNombre}</td>
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

      {selfOpen && currentUserId && (
        <ProfesionalModal
          userId={currentUserId}
          fullName={currentUserName || 'Mi perfil'}
          open={selfOpen}
          onClose={() => setSelfOpen(false)}
          canEdit
        />
      )}
    </>
  )
}
