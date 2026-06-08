'use client'

import { useActionState, useState } from 'react'
import { Check, Copy, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { USER_ROLE_OPTIONS, ROLE_DESCRIPTIONS } from '@/lib/constants'
import type { ActionResult } from '@/lib/types'
import type { InviteResult } from '@/lib/actions/usuario'

type InviteAction = (
  prevState: ActionResult<InviteResult> | null,
  formData: FormData
) => Promise<ActionResult<InviteResult>>

interface InviteUsuarioFormProps {
  action: InviteAction
  onSuccess?: () => void
}

function roleLabel(role: string): string {
  return USER_ROLE_OPTIONS.find(o => o.value === role)?.label ?? role
}

function InviteLinkView({ link, role }: { link: string; role: string }) {
  const [copiado, setCopiado] = useState(false)

  function copiar() {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1800)
      })
      .catch(() => { /* el usuario puede copiar manualmente desde el input */ })
  }

  return (
    <div className="space-y-4">
      <div role="status" aria-live="polite" className="flex items-center gap-2 bg-success-bg border border-green-200 text-success text-sm rounded-lg px-4 py-3">
        <CheckCircle2 size={16} className="shrink-0" />
        Link de invitación generado{role ? ` · rol ${roleLabel(role)}` : ''}.
      </div>

      <p className="text-sm text-text-secondary">
        Compartí este link con la persona como prefieras (WhatsApp, email, etc.). Al abrirlo
        va a poder definir su contraseña y quedará unida con el rol asignado.{' '}
        <span className="text-text-tertiary">No se envió ningún email automáticamente.</span>
      </p>

      <div className="flex items-center gap-1.5">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 text-xs border border-border-default rounded-lg px-3 py-2 bg-surface-elevated text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
        <button
          type="button"
          onClick={copiar}
          title="Copiar link"
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
            copiado
              ? 'border-success/40 text-success bg-success-bg'
              : 'border-border-default text-text-secondary hover:bg-surface-elevated'
          }`}
        >
          {copiado ? <Check size={14} /> : <Copy size={14} />}
          {copiado ? 'Copiado' : 'Copiar link'}
        </button>
      </div>
    </div>
  )
}

export function InviteUsuarioForm({ action, onSuccess }: InviteUsuarioFormProps) {
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult<InviteResult> | null, fd: FormData) => {
      const result = await action(prev, fd)
      if (result.success && onSuccess) onSuccess()
      return result
    },
    null
  )

  if (state?.success) {
    return <InviteLinkView link={state.data.link} role={state.data.role} />
  }

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div role="alert" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
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
          {isPending ? 'Generando link...' : 'Generar link de invitación'}
        </Button>
      </div>
    </form>
  )
}
