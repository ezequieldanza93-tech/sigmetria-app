'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { USER_ROLE_OPTIONS, ROLE_DESCRIPTIONS } from '@/lib/constants'
import type { ActionResult } from '@/lib/types'

type InviteAction = (
  prevState: ActionResult<null> | null,
  formData: FormData
) => Promise<ActionResult<null>>

interface InviteUsuarioFormProps {
  action: InviteAction
  onSuccess?: () => void
}

export function InviteUsuarioForm({ action, onSuccess }: InviteUsuarioFormProps) {
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult<null> | null, fd: FormData) => {
      const result = await action(prev, fd)
      if (result.success && onSuccess) onSuccess()
      return result
    },
    null
  )

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div role="alert" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div role="status" aria-live="polite" className="bg-success-bg border border-green-200 text-success text-sm rounded-lg px-4 py-3">
          Invitacion enviada correctamente
        </div>
      )}

      <Input
        label="Nombre Completo"
        name="full_name"
        required
        placeholder="María García"
      />

      <Input
        label="Email"
        name="email"
        type="email"
        required
        placeholder="usuario@empresa.com"
      />

      <div>
        <Select
          label="Rol"
          name="role"
          required
          options={USER_ROLE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          placeholder="Seleccionar rol..."
          onChange={(e) => setSelectedRole(e.target.value)}
        />
        {selectedRole && ROLE_DESCRIPTIONS[selectedRole] && (
          <p className="mt-1.5 text-xs text-text-tertiary">{ROLE_DESCRIPTIONS[selectedRole]}</p>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Invitando...' : 'Enviar Invitación'}
        </Button>
      </div>
    </form>
  )
}
