'use client'

import { useActionState, useState } from 'react'
import { Check, Copy, CheckCircle2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  resolveUserRole,
  roleToFriendly,
  isFreeViewerRole,
  type FriendlyRoleKey,
  type ScopeKey,
} from '@/lib/types'
import type { ActionResult } from '@/lib/types'
import type { InviteResult } from '@/lib/actions/usuario'

type InviteAction = (
  prevState: ActionResult<InviteResult> | null,
  formData: FormData
) => Promise<ActionResult<InviteResult>>

export interface DirectorioPersona {
  id: string
  nombre: string
  apellido: string
  email: string | null
}

interface InviteUsuarioFormProps {
  action: InviteAction
  onSuccess?: () => void
  /** Colaboradores: solo pueden crear usuarios viewer (sin cargo). */
  viewerOnly?: boolean
  seatsUsed: number
  seatsMax: number
  /** Personas del directorio sin cuenta — para linkear al Viewer de Observaciones. */
  personas?: DirectorioPersona[]
}

const ROLE_CARDS: { key: FriendlyRoleKey; label: string; desc: string }[] = [
  { key: 'admin', label: 'Admin', desc: 'Gestiona usuarios, empresas y facturación. Acceso total.' },
  { key: 'colaborador', label: 'Colaborador', desc: 'Carga y edita gestiones, documentos y riesgos. Usa un seat del plan.' },
  { key: 'visualizador', label: 'Visualizador', desc: 'Ve y comenta, no modifica. Acceso por empresa/establecimiento.' },
  { key: 'viewer_obs', label: 'Viewer de Observaciones', desc: 'Ve y cierra solo SUS observaciones. Para trabajadores y capataces.' },
]

function InviteLinkView({ link, role }: { link: string; role: string }) {
  const [copiado, setCopiado] = useState(false)
  const friendly = roleToFriendly(role as never)

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
        Link de invitación generado · rol {friendly.label}{friendly.scope ? ` (${friendly.scope})` : ''}.
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

export function InviteUsuarioForm({ action, onSuccess, viewerOnly = false, seatsUsed, seatsMax, personas = [] }: InviteUsuarioFormProps) {
  const [friendly, setFriendly] = useState<FriendlyRoleKey>(viewerOnly ? 'visualizador' : 'colaborador')
  const [scope, setScope] = useState<ScopeKey>('especifico')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [personaId, setPersonaId] = useState('')

  const resolvedRole = resolveUserRole(friendly, scope)
  const esViewer = isFreeViewerRole(resolvedRole)
  const sinSeats = !esViewer && seatsUsed >= seatsMax
  const esViewerObs = friendly === 'viewer_obs'

  const cards = viewerOnly
    ? ROLE_CARDS.filter(c => c.key === 'visualizador' || c.key === 'viewer_obs')
    : ROLE_CARDS

  function selectFriendly(key: FriendlyRoleKey) {
    setFriendly(key)
    if (key !== 'viewer_obs') {
      setPersonaId('')
    }
  }

  function selectPersona(id: string) {
    setPersonaId(id)
    const p = personas.find(x => x.id === id)
    if (p) {
      setFullName(`${p.nombre} ${p.apellido}`.trim())
      setEmail(p.email ?? '')
    }
  }

  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult<InviteResult> | null, fd: FormData) => {
      fd.set('role', resolvedRole)
      if (esViewerObs && personaId) fd.set('persona_id', personaId)
      const result = await action(prev, fd)
      if (result.success && onSuccess) onSuccess()
      return result
    },
    null
  )

  if (state?.success) {
    return <InviteLinkView link={state.data.link} role={state.data.role} />
  }

  const personaSinEmail = esViewerObs && !!personaId && !email

  return (
    <form action={formAction} className="space-y-4 max-md:space-y-6">
      {state && !state.success && (
        <div role="alert" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      {/* Rol */}
      <div>
        <p className="text-sm font-medium text-text-secondary mb-2">Rol</p>
        <div className="space-y-2">
          {cards.map(card => {
            const selected = friendly === card.key
            const free = card.key === 'visualizador' || card.key === 'viewer_obs'
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => selectFriendly(card.key)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  selected
                    ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary'
                    : 'border-border-default hover:bg-surface-elevated'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">{card.label}</span>
                  {free && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-success bg-success-bg rounded-full px-2 py-0.5">Sin cargo</span>
                  )}
                </div>
                <p className="text-xs text-text-tertiary mt-0.5">{card.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Viewer de Observaciones → elegir persona del directorio */}
      {esViewerObs && (
        <div>
          <Select
            label="Persona del directorio (responsable)"
            name="persona_select"
            required
            value={personaId}
            options={personas.map(p => ({
              value: p.id,
              label: `${p.nombre} ${p.apellido}${p.email ? ` · ${p.email}` : ' · (sin email)'}`,
            }))}
            placeholder={personas.length ? 'Seleccioná la persona…' : 'No hay personas disponibles'}
            onChange={(e) => selectPersona(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-text-tertiary">
            El usuario se linkea a esta persona y verá solo las observaciones donde figura como responsable.
            La persona aporta el email de acceso.
          </p>
        </div>
      )}

      {/* Datos de la cuenta */}
      <Input
        label="Nombre Completo"
        name="full_name"
        required
        placeholder="María García"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        readOnly={esViewerObs && !!personaId}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        required
        placeholder="usuario@empresa.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        readOnly={esViewerObs && !!personaId && !!email}
      />
      {personaSinEmail && (
        <p className="text-xs text-orange-600">
          Esta persona no tiene email cargado. Escribilo arriba: se va a guardar en su ficha del directorio.
        </p>
      )}

      {/* Alcance — solo para Colaborador (Visualizador es siempre por empresa/estab.) */}
      {friendly === 'colaborador' && (
        <div>
          <p className="text-sm font-medium text-text-secondary mb-2">¿A qué puede acceder?</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScope('todo')}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                scope === 'todo'
                  ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary text-text-primary'
                  : 'border-border-default text-text-secondary hover:bg-surface-elevated'
              }`}
            >
              Toda la consultora
            </button>
            <button
              type="button"
              onClick={() => setScope('especifico')}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                scope === 'especifico'
                  ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary text-text-primary'
                  : 'border-border-default text-text-secondary hover:bg-surface-elevated'
              }`}
            >
              Empresas/estab. específicos
            </button>
          </div>
          {scope === 'especifico' && (
            <p className="mt-2 text-xs text-text-tertiary">
              Después de crear el usuario, definí a qué empresas o establecimientos accede desde <strong>Gestionar acceso</strong>.
            </p>
          )}
        </div>
      )}

      {friendly === 'visualizador' && (
        <p className="text-xs text-text-tertiary">
          Su alcance máximo es <strong>nivel empresa</strong> (nunca toda la consultora). Definí las empresas o
          establecimientos puntuales desde <strong>Gestionar acceso</strong> después de crearlo.
        </p>
      )}

      {sinSeats ? (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 text-sm rounded-lg px-4 py-3">
          <Lock size={15} className="shrink-0" />
          Alcanzaste el límite de {seatsMax} seats. Para sumar un Colaborador, ampliá tu plan. (Los Visualizadores son sin cargo.)
        </div>
      ) : (
        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending || (esViewerObs && !personaId)}>
            {isPending ? 'Generando link…' : 'Generar link de invitación'}
          </Button>
        </div>
      )}
    </form>
  )
}
