'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Briefcase, MapPin, Sparkles, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  createMyConsultora,
  createOnboardingEmpresa,
  createOnboardingEstablecimiento,
} from '@/lib/actions/onboarding'

type Step = 1 | 2 | 3 | 4

const STEPS = [
  { n: 1 as const, label: 'Tu consultora', icon: Building2 },
  { n: 2 as const, label: 'Primera empresa', icon: Briefcase },
  { n: 3 as const, label: 'Primer establecimiento', icon: MapPin },
]

export function OnboardingWizard({
  userEmail,
  fullName,
}: {
  userEmail: string
  fullName: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empresaNombre, setEmpresaNombre] = useState<string>('')

  const primerNombre = fullName?.trim().split(/\s+/)[0] ?? null

  function handleConsultora(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createMyConsultora(formData)
      if (result.success) setStep(2)
      else setError(result.error)
    })
  }

  function handleEmpresa(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createOnboardingEmpresa(formData)
      if (result.success) {
        setEmpresaId(result.data.id)
        setEmpresaNombre((formData.get('razon_social') as string)?.trim() ?? '')
        setStep(3)
      } else {
        setError(result.error)
      }
    })
  }

  function handleEstablecimiento(formData: FormData) {
    if (!empresaId) {
      setStep(4)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createOnboardingEstablecimiento(empresaId, formData)
      if (result.success) setStep(4)
      else setError(result.error)
    })
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Bienvenida */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-primary rounded-2xl mb-4">
            <Sparkles className="h-7 w-7 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            {step === 4
              ? `¡Todo listo${primerNombre ? `, ${primerNombre}` : ''}!`
              : `¡Bienvenido${primerNombre ? `, ${primerNombre}` : ''}!`}
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            {step === 4
              ? 'Tu espacio de trabajo ya está armado.'
              : 'En 3 pasos cortos dejamos tu plataforma lista para usar.'}
          </p>
        </div>

        {/* Stepper */}
        {step < 4 && (
          <nav aria-label="Pasos de configuración" className="mb-8">
            <ol className="flex items-center justify-center gap-2 list-none">
              {STEPS.map((s, i) => {
                const Icon = s.icon
                const done = step > s.n
                const active = step === s.n
                return (
                  <li key={s.n} className="flex items-center gap-2">
                    <div
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-brand-primary text-white'
                          : done
                            ? 'bg-success-bg text-success'
                            : 'bg-surface-sunken text-text-tertiary'
                      }`}
                      aria-current={active ? 'step' : undefined}
                    >
                      {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && <span className="w-4 h-px bg-border-default" aria-hidden="true" />}
                  </li>
                )
              })}
            </ol>
          </nav>
        )}

        <div className="bg-surface-base rounded-2xl border border-border-subtle p-6 shadow-sm">
          {error && (
            <div role="alert" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {/* Paso 1 — Consultora */}
          {step === 1 && (
            <>
              <h2 className="font-semibold text-text-primary mb-1">Creá tu consultora</h2>
              <p className="text-text-secondary text-sm mb-4">
                Es tu espacio de trabajo. Al crearla se activa tu <strong className="text-text-primary">mes de prueba gratis</strong> automáticamente.
              </p>
              <form action={handleConsultora} className="space-y-4">
                <Input label="Nombre de la consultora" name="nombre" required placeholder="Sigmetría HyS" autoFocus />
                <Input label="CUIT" name="cuit" placeholder="30-12345678-9" />
                <Input label="Email de contacto" name="email" type="email" defaultValue={userEmail} placeholder="info@consultora.com" />
                <Input label="Teléfono" name="telefono" placeholder="+54 11 1234-5678" />
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? 'Creando…' : 'Crear mi consultora →'}
                </Button>
              </form>
            </>
          )}

          {/* Paso 2 — Primera empresa */}
          {step === 2 && (
            <>
              <h2 className="font-semibold text-text-primary mb-1">Sumá tu primera empresa cliente</h2>
              <p className="text-text-secondary text-sm mb-4">
                Es la empresa a la que le vas a gestionar la Higiene y Seguridad. Podés sumar más después.
              </p>
              <form action={handleEmpresa} className="space-y-4">
                <Input label="Razón social" name="razon_social" required placeholder="Acme S.A." autoFocus />
                <Input label="CUIT" name="cuit" placeholder="30-12345678-9" />
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? 'Guardando…' : 'Agregar empresa →'}
                </Button>
              </form>
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={isPending}
                className="mt-3 w-full text-center text-sm text-text-tertiary hover:text-text-secondary transition-colors"
              >
                Lo hago después →
              </button>
            </>
          )}

          {/* Paso 3 — Primer establecimiento */}
          {step === 3 && (
            <>
              <h2 className="font-semibold text-text-primary mb-1">
                Primer establecimiento{empresaNombre ? ` de ${empresaNombre}` : ''}
              </h2>
              <p className="text-text-secondary text-sm mb-4">
                Una planta, oficina u obra de esta empresa. Es donde vas a cargar gestiones, documentos y riesgos.
              </p>
              <form action={handleEstablecimiento} className="space-y-4">
                <Input label="Nombre del establecimiento" name="nombre" required placeholder="Planta Norte" autoFocus />
                <Input label="Domicilio" name="domicilio" placeholder="Av. Siempre Viva 742" />
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? 'Guardando…' : 'Agregar establecimiento →'}
                </Button>
              </form>
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={isPending}
                className="mt-3 w-full text-center text-sm text-text-tertiary hover:text-text-secondary transition-colors"
              >
                Lo hago después →
              </button>
            </>
          )}

          {/* Paso 4 — Listo */}
          {step === 4 && (
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-success-bg rounded-full">
                <Check className="h-7 w-7 text-success" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-semibold text-text-primary">Tu prueba gratis de 1 mes ya está activa</h2>
                <p className="text-text-secondary text-sm mt-1">
                  Entrá a tu panel y empezá a cargar lo que necesites. Cuando quieras, invitás a tu equipo desde Usuarios.
                </p>
              </div>
              <Button onClick={() => router.push('/dashboard/empresas')} className="w-full">
                Ir a mi panel →
              </Button>
            </div>
          )}
        </div>

        {step < 4 && (
          <p className="text-center text-xs text-text-tertiary mt-6">
            Paso {step} de 3 · Podés saltar los pasos opcionales y completarlos más tarde
          </p>
        )}
      </div>
    </div>
  )
}
