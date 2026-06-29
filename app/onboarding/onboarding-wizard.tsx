'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Sparkles, Check, Briefcase, Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/forms/phone-input'
import { Button } from '@/components/ui/button'
import { createMyConsultora } from '@/lib/actions/onboarding'
import { InviteUsuarioForm } from '@/components/forms/invite-usuario-form'
import { inviteUsuario } from '@/lib/actions/usuario'
import type { DeepLink } from './page'

interface Plan {
  id: string
  nombre: string
  slug: string
  tipo: string
  precio_mensual_neto: number | string | null
  max_colaboradores: number | null
  max_empresas: number | null
  max_establecimientos: number | null
  descripcion_corta: string | null
}

type Step = 'plan' | 'datos' | 'equipo' | 'listo'

const FREE_PLAN: Plan = {
  id: 'free', nombre: 'Gratis (Trial)', slug: 'trial', tipo: 'trial',
  precio_mensual_neto: null, max_colaboradores: 0, max_empresas: 2, max_establecimientos: 5,
  descripcion_corta: '1 mes de prueba',
}

function precioLabel(p: Plan): string {
  if (p.slug === 'trial') return 'Gratis'
  if (p.precio_mensual_neto == null) return 'A consultar'
  return `$${Number(p.precio_mensual_neto).toLocaleString('es-AR')} /mes + IVA`
}

function colaboradoresLabel(p: Plan): string {
  if (p.max_colaboradores == null) return 'Colaboradores ilimitados'
  if (p.max_colaboradores === 0) return 'Sin colaboradores'
  return `Hasta ${p.max_colaboradores} colaboradores`
}

const fmt = (n: number | null) => (n == null ? 'Ilimitados' : String(n))
const fmtARS = (n: number) => `$${n.toLocaleString('es-AR')}`

export function OnboardingWizard({
  userEmail,
  fullName,
  planes,
  deepLink,
}: {
  userEmail: string
  fullName: string | null
  planes: Plan[]
  deepLink?: DeepLink | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>('plan')
  const [error, setError] = useState<string | null>(null)
  const [invitedCount, setInvitedCount] = useState(0)
  const [inviteKey, setInviteKey] = useState(0)
  const [forzarGrilla, setForzarGrilla] = useState(false)

  const primerNombre = fullName?.trim().split(/\s+/)[0] ?? null
  const allPlanes = planes.some(p => p.slug === 'trial') ? planes : [FREE_PLAN, ...planes]

  // Inicializar plan desde deep-link si existe
  const planInicial: Plan | null = deepLink
    ? allPlanes.find(p => p.slug === deepLink.planSlug) ?? null
    : null

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(planInicial)

  const seats = selectedPlan
    ? selectedPlan.max_colaboradores == null ? 999 : selectedPlan.max_colaboradores + 1
    : 1
  const allowsColaboradores = !!selectedPlan && (selectedPlan.max_colaboradores == null || selectedPlan.max_colaboradores > 0)

  function pickPlan(p: Plan) {
    setSelectedPlan(p)
    setError(null)
    setStep('datos')
  }

  function handleDatos(formData: FormData) {
    if (!selectedPlan) return
    formData.set('plan_slug', selectedPlan.slug)
    // Propagar ciclo e intento Fundador si vienen del deep-link
    if (deepLink) {
      formData.set('ciclo', deepLink.ciclo)
      formData.set('intento_founder', deepLink.esFounderIntentado ? '1' : '0')
    }
    setError(null)
    startTransition(async () => {
      const result = await createMyConsultora(formData)
      if (result.success) {
        setStep(allowsColaboradores ? 'equipo' : 'listo')
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Bienvenida */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-primary rounded-2xl mb-4">
            <Sparkles className="h-7 w-7 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            {step === 'listo'
              ? `¡Todo listo${primerNombre ? `, ${primerNombre}` : ''}!`
              : `¡Bienvenido${primerNombre ? `, ${primerNombre}` : ''}!`}
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            {step === 'plan' && 'Elegí tu plan para empezar.'}
            {step === 'datos' && 'Cargá los datos de tu consultora o estudio profesional.'}
            {step === 'equipo' && 'Sumá a tu equipo (opcional).'}
            {step === 'listo' && 'Tu plataforma está lista para usar.'}
          </p>
        </div>

        {/* Stepper */}
        {step !== 'listo' && (
          <nav aria-label="Pasos" className="mb-8">
            <ol className="flex items-center justify-center gap-2 list-none text-xs">
              {([['plan', 'Plan'], ['datos', 'Datos'], ['equipo', 'Equipo']] as const).map(([id, label], i) => {
                const order = { plan: 0, datos: 1, equipo: 2, listo: 3 }
                const done = order[step] > i
                const active = step === id
                return (
                  <li key={id} className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                      active ? 'bg-brand-primary text-white' : done ? 'bg-success-bg text-success' : 'bg-surface-sunken text-text-tertiary'
                    }`}>
                      {done ? '✓ ' : ''}{label}
                    </span>
                    {i < 2 && <span className="w-4 h-px bg-border-default" aria-hidden="true" />}
                  </li>
                )
              })}
            </ol>
          </nav>
        )}

        {error && (
          <div role="alert" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Paso 1 — Plan */}
        {step === 'plan' && (
          <>
            {/* Deep-link: plan preseleccionado — mostrar resumen en lugar de grilla */}
            {deepLink && !forzarGrilla ? (
              <div className="rounded-2xl border border-brand-primary ring-1 ring-brand-primary bg-surface-base p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-text-tertiary uppercase tracking-wide font-semibold mb-1">Plan seleccionado</p>
                    <h2 className="text-lg font-bold text-text-primary">{deepLink.planNombre}</h2>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Ciclo {deepLink.ciclo === 'annual' ? 'anual' : 'mensual'}
                    </p>
                  </div>
                  <Building2 className="h-5 w-5 text-text-tertiary flex-shrink-0 mt-1" aria-hidden="true" />
                </div>

                {/* Precio calculado */}
                {deepLink.precioCalculado && (
                  <div className="bg-surface-sunken rounded-xl p-4 space-y-1">
                    {deepLink.precioCalculado.descuentoAnualPct > 0 && (
                      <p className="text-xs text-text-tertiary line-through">
                        Precio base: {fmtARS(deepLink.precioCalculado.precioBase)}
                      </p>
                    )}
                    <p className="text-2xl font-extrabold text-brand-primary">
                      {fmtARS(deepLink.precioCalculado.precioFinal)}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {deepLink.ciclo === 'annual' ? 'pago anual' : 'por mes'} + IVA
                    </p>
                    {deepLink.precioCalculado.ahorroTotal > 0 && (
                      <p className="text-xs text-success font-semibold">
                        Ahorrás {fmtARS(deepLink.precioCalculado.ahorroTotal)} ({deepLink.precioCalculado.ahorroTotalPct}% off)
                      </p>
                    )}
                  </div>
                )}

                {/* Estado Fundador */}
                {deepLink.esFounderIntentado && deepLink.hayFounder && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <Star className="h-4 w-4 text-amber-600 flex-shrink-0" aria-hidden="true" />
                    <p className="text-xs text-amber-800 font-semibold">
                      ¡Cupo Fundador disponible! Tu precio incluye −20% extra de por vida.
                    </p>
                  </div>
                )}
                {deepLink.esFounderIntentado && !deepLink.hayFounder && (
                  <div className="bg-warning-bg border border-yellow-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-warning font-medium">
                      Los cupos Fundadores para este plan se agotaron — tu precio es el anual estándar.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <Button
                    type="button"
                    onClick={() => {
                      const plan = allPlanes.find(p => p.slug === deepLink.planSlug)
                      if (plan) pickPlan(plan)
                    }}
                    className="flex-1"
                  >
                    Continuar con este plan →
                  </Button>
                  <button
                    type="button"
                    onClick={() => setForzarGrilla(true)}
                    className="text-sm text-text-secondary hover:text-brand-primary hover:underline whitespace-nowrap"
                  >
                    Cambiar plan
                  </button>
                </div>
              </div>
            ) : (
              /* Grilla normal de planes */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allPlanes.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickPlan(p)}
                    className="text-left rounded-2xl border border-border-default bg-surface-base p-5 hover:border-brand-primary hover:ring-1 hover:ring-brand-primary transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-text-primary">{p.nombre}</span>
                      <Building2 className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                    </div>
                    <p className="text-brand-primary font-bold text-sm">{precioLabel(p)}</p>
                    <ul className="mt-3 space-y-1 text-xs text-text-secondary">
                      <li>• {fmt(p.max_empresas)} empresas</li>
                      <li>• {fmt(p.max_establecimientos)} establecimientos</li>
                      <li>• {colaboradoresLabel(p)}</li>
                    </ul>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Paso 2 — Datos */}
        {step === 'datos' && selectedPlan && (
          <div className="bg-surface-base rounded-2xl border border-border-subtle p-6 shadow-sm">
            <p className="text-xs text-text-tertiary mb-4">
              Plan elegido: <strong className="text-text-primary">{selectedPlan.nombre}</strong> · {precioLabel(selectedPlan)}{' '}
              <button type="button" onClick={() => setStep('plan')} className="text-brand-primary hover:underline ml-1">cambiar</button>
            </p>
            <form action={handleDatos} className="space-y-4">
              <Input label="Nombre de tu consultora o estudio" name="nombre" required placeholder="Sigmetría HyS" autoFocus />
              <Input label="CUIT" name="cuit" placeholder="30-12345678-9" />
              <Input label="Email de contacto" name="email" type="email" defaultValue={userEmail} placeholder="info@consultora.com" />
              <PhoneInput label="Teléfono" name="telefono" placeholder="11 1234-5678" />
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Activando tu plan…' : `Activar ${selectedPlan.nombre} →`}
              </Button>
            </form>
            {selectedPlan.slug !== 'trial' && (
              <p className="mt-3 text-xs text-text-tertiary text-center">
                En la versión final acá iría el pago. Por ahora, elegir el plan lo activa directamente.
              </p>
            )}
          </div>
        )}

        {/* Paso 3 — Equipo */}
        {step === 'equipo' && (
          <div className="bg-surface-base rounded-2xl border border-border-subtle p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="h-5 w-5 text-brand-primary" aria-hidden="true" />
              <h2 className="font-semibold text-text-primary">Sumá a tu equipo</h2>
            </div>
            <p className="text-text-secondary text-sm mb-4">
              Creá las cuentas de tus colaboradores y asignales permisos. Cada uno recibe un link para
              entrar, definir su contraseña y completar su perfil profesional.
            </p>

            <InviteUsuarioForm
              key={inviteKey}
              action={inviteUsuario}
              seatsUsed={1 + invitedCount}
              seatsMax={seats}
              personas={[]}
              onSuccess={() => setInvitedCount(c => c + 1)}
            />

            <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-border-subtle">
              {invitedCount > 0 ? (
                <button type="button" onClick={() => setInviteKey(k => k + 1)} className="text-sm text-brand-primary hover:underline">
                  + Invitar otro colaborador
                </button>
              ) : <span />}
              <Button onClick={() => setStep('listo')} variant="ghost">
                {invitedCount > 0 ? 'Terminar →' : 'Lo hago después →'}
              </Button>
            </div>
            {invitedCount > 0 && (
              <p className="mt-2 text-xs text-success">{invitedCount} invitación{invitedCount !== 1 ? 'es' : ''} generada{invitedCount !== 1 ? 's' : ''}.</p>
            )}
          </div>
        )}

        {/* Paso 4 — Listo */}
        {step === 'listo' && (
          <div className="bg-surface-base rounded-2xl border border-border-subtle p-6 shadow-sm text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-success-bg rounded-full">
              <Check className="h-7 w-7 text-success" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-text-primary">
                {selectedPlan && selectedPlan.slug !== 'trial'
                  ? `Plan ${selectedPlan.nombre} activo`
                  : 'Tu prueba gratis está activa'}
              </h2>
              <p className="text-text-secondary text-sm mt-1">
                Sos el Admin de tu consultora. Entrá a tu panel para cargar empresas, establecimientos y
                empezar a gestionar. {invitedCount > 0 && 'Tus colaboradores ya pueden entrar con su link.'}
              </p>
            </div>
            <Button onClick={() => router.push('/dashboard/empresas')} className="w-full">
              Ir a mi panel →
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
