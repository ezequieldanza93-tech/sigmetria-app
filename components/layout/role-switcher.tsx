'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type UserRole, type SystemRole } from '@/lib/types'
import { switchRole, type SwitchableRole } from '@/lib/actions/change-role'

interface RoleEntry {
  value: SwitchableRole
  label: string
  description: string
  color: string
}

const ROLES: RoleEntry[] = [
  { value: 'developer',             label: 'Developer',            description: 'Acceso total + herramientas dev',   color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
  { value: 'full_access_main',      label: 'Admin Principal',      description: 'Gestión completa + usuarios',        color: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  { value: 'full_access_branch',    label: 'Admin Branch',         description: 'Escribe y borra, sin usuarios',     color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' },
  { value: 'colaborador',           label: 'Colaborador',          description: 'Escribe, sin borrar',               color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  { value: 'full_viewer',           label: 'Viewer Global',        description: 'Solo lectura, vista completa',      color: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
  { value: 'colaborador_viewer',    label: 'Viewer Limitado',      description: 'Solo lectura, vista reducida',      color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { value: 'responsable_estandares',label: 'Resp. Estándares',     description: 'Reportes y estándares',             color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' },
]

interface RoleSwitcherProps {
  currentRole: UserRole | null
  systemRole: SystemRole
  isSuperAdmin: boolean
}

export function RoleSwitcher({ currentRole, systemRole, isSuperAdmin }: RoleSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [switchError, setSwitchError] = useState<string | null>(null)

  const canSwitch = isSuperAdmin || systemRole === 'developer'
  const effectiveRole: SwitchableRole = systemRole === 'developer' ? 'developer' : (currentRole ?? 'full_viewer')
  const current = ROLES.find(r => r.value === effectiveRole)

  function handleSwitch(role: SwitchableRole) {
    if (role === effectiveRole) return
    setSwitchError(null)
    startTransition(async () => {
      const result = await switchRole(role)
      if (result?.error) setSwitchError(result.error)
    })
  }

  return (
    <div className="border-b border-border-subtle">
      <button
        type="button"
        onClick={() => canSwitch && setOpen(o => !o)}
        disabled={isPending}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2.5 transition-colors',
          canSwitch ? 'hover:bg-surface-sunken cursor-pointer' : 'cursor-default',
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">
            Rol activo
          </span>
          {isPending && <Loader2 size={10} className="animate-spin text-text-tertiary" aria-label="Cambiando rol…" />}
        </div>
        <div className="flex items-center gap-1.5">
          {current && (
            <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', current.color)}>
              {current.label}
            </span>
          )}
          {canSwitch && (
            <ChevronDown
              size={13}
              className={cn('text-text-tertiary transition-transform duration-150', open && 'rotate-180')}
              aria-hidden="true"
            />
          )}
        </div>
      </button>

      {switchError && (
        <p className="px-4 pb-2 text-[11px] text-danger leading-snug">{switchError}</p>
      )}

      {open && canSwitch && (
        <div className="bg-surface-sunken pb-1">
          {ROLES.map(role => {
            const isActive = role.value === effectiveRole
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => handleSwitch(role.value)}
                disabled={isPending || isActive}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2 text-left transition-colors',
                  isActive
                    ? 'opacity-60 cursor-default'
                    : 'hover:bg-surface-elevated cursor-pointer',
                )}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded-full w-fit', role.color)}>
                    {role.label}
                  </span>
                  <span className="text-[10px] text-text-tertiary">{role.description}</span>
                </div>
                {isActive && (
                  <Check size={13} className="text-brand-primary shrink-0 ml-2" aria-label="Activo" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
