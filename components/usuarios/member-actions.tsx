'use client'

import { useState, useTransition } from 'react'
import { Check, Copy } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { requestEmailChange, confirmEmailChange } from '@/lib/actions/email-change'
import { replaceMember } from '@/lib/actions/usuario'

type Modo = null | 'email' | 'replace'

export function MemberActions({ memberId, userId, fullName }: { memberId: string; userId: string; fullName: string }) {
  const [modo, setModo] = useState<Modo>(null)

  return (
    <>
      <div className="flex items-center gap-3">
        <button onClick={() => setModo('email')} className="text-xs text-brand-primary hover:underline">Cambiar email</button>
        <button onClick={() => setModo('replace')} className="text-xs text-text-tertiary hover:text-text-secondary hover:underline">Reemplazar</button>
      </div>

      <Modal open={modo === 'email'} onClose={() => setModo(null)} title={`Cambiar email · ${fullName}`}>
        <EmailChangeFlow targetUserId={userId} onDone={() => setModo(null)} />
      </Modal>

      <Modal open={modo === 'replace'} onClose={() => setModo(null)} title={`Reemplazar a ${fullName}`}>
        <ReplaceFlow memberId={memberId} />
      </Modal>
    </>
  )
}

function EmailChangeFlow({ targetUserId, onDone }: { targetUserId: string; onDone: () => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [newEmail, setNewEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function enviar() {
    setError(null)
    start(async () => {
      const r = await requestEmailChange(targetUserId, newEmail)
      if (r.success) { setStep('code'); setOk(`Código enviado a ${r.data.sentTo}`) }
      else setError(r.error)
    })
  }
  function confirmar() {
    setError(null); setOk(null)
    start(async () => {
      const r = await confirmEmailChange(targetUserId, code)
      if (r.success) { setOk(`Email cambiado a ${r.data.email}`); setTimeout(onDone, 1200) }
      else setError(r.error)
    })
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">{error}</div>}
      {ok && <div className="bg-success-bg border border-green-200 text-success text-sm rounded-lg px-4 py-3">{ok}</div>}
      {step === 'email' ? (
        <>
          <Input label="Nuevo email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="nuevo@empresa.com" />
          <p className="text-xs text-text-tertiary">Enviamos un código de 6 dígitos a ese correo para confirmar que la persona lo controla.</p>
          <Button onClick={enviar} disabled={pending || !newEmail}>{pending ? 'Enviando…' : 'Enviar código'}</Button>
        </>
      ) : (
        <>
          <Input label="Código (6 dígitos)" value={code} onChange={e => setCode(e.target.value)} placeholder="123456" maxLength={6} inputMode="numeric" />
          <Button onClick={confirmar} disabled={pending || code.length !== 6}>{pending ? 'Confirmando…' : 'Confirmar cambio'}</Button>
        </>
      )}
    </div>
  )
}

function ReplaceFlow({ memberId }: { memberId: string }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [pending, start] = useTransition()

  function reemplazar() {
    setError(null)
    start(async () => {
      const r = await replaceMember(memberId, nombre, email)
      if (r.success) setLink(r.data.link)
      else setError(r.error)
    })
  }

  if (link) {
    return (
      <div className="space-y-3">
        <div className="bg-success-bg border border-green-200 text-success text-sm rounded-lg px-4 py-3">
          Listo. La persona anterior quedó dada de baja. Compartí este link con el reemplazo:
        </div>
        <div className="flex gap-1.5">
          <input readOnly value={link} onFocus={e => e.currentTarget.select()} className="flex-1 min-w-0 text-xs border border-border-default rounded-lg px-3 py-2 bg-surface-elevated text-text-secondary" />
          <button
            onClick={() => navigator.clipboard.writeText(link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500) }).catch(() => {})}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-surface-elevated"
          >
            {copiado ? <Check size={14} /> : <Copy size={14} />}{copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">{error}</div>}
      <p className="text-xs text-text-tertiary">
        Se da de baja a la persona actual (su historial queda intacto y trazable) y se invita al reemplazo con el mismo rol.
      </p>
      <Input label="Nombre del reemplazo" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan Pérez" />
      <Input label="Email del reemplazo" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="reemplazo@empresa.com" />
      <Button onClick={reemplazar} disabled={pending || !nombre || !email}>{pending ? 'Reemplazando…' : 'Dar de baja e invitar'}</Button>
    </div>
  )
}
