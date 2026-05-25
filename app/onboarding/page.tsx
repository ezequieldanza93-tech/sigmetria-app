'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createConsultora, inviteConsultoraAdmin } from '@/lib/actions/consultora'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Step = 1 | 2

export default function OnboardingPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>(1)
  const [consultoraId, setConsultoraId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleConsultora(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createConsultora(formData)
      if (result.success) {
        setConsultoraId(result.data.id)
        setStep(2)
      } else {
        setError(result.error)
      }
    })
  }

  function handleAdmin(formData: FormData) {
    if (!consultoraId) return
    formData.append('consultora_id', consultoraId)
    setError(null)
    startTransition(async () => {
      const result = await inviteConsultoraAdmin(formData)
      if (result?.success) {
        router.push('/dashboard')
      } else {
        setError(result?.error ?? 'Error desconocido')
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-sig-500 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración Inicial</h1>
          <p className="text-gray-500 text-sm mt-1">Crear nueva consultora en la plataforma</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`flex items-center gap-2 flex-1`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-sig-500 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <span className={`text-sm font-medium ${step === 1 ? 'text-sig-500' : step > 1 ? 'text-gray-500' : 'text-gray-400'}`}>Datos de la Consultora</span>
          </div>
          <div className="w-6 h-px bg-gray-300 shrink-0" />
          <div className={`flex items-center gap-2 flex-1`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-sig-500 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            <span className={`text-sm font-medium ${step === 2 ? 'text-sig-500' : 'text-gray-400'}`}>Admin Principal</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {step === 1 && (
            <>
              <h2 className="font-semibold text-gray-900 mb-4">Datos de la Consultora</h2>
              <form action={handleConsultora} className="space-y-4">
                <Input label="Nombre de la Consultora" name="nombre" required placeholder="Sigmetría HyS" />
                <Input label="CUIT" name="cuit" placeholder="30-12345678-9" />
                <Input label="Email" name="email" type="email" placeholder="info@consultora.com" />
                <Input label="Teléfono" name="telefono" placeholder="+54 11 1234-5678" />
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? 'Creando...' : 'Crear Consultora →'}
                </Button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-semibold text-gray-900 mb-1">Admin Principal</h2>
              <p className="text-gray-500 text-sm mb-4">
                Invitar al usuario que va a gestionar esta consultora como Admin Principal.
                Recibirá un email para establecer su contraseña.
              </p>
              <form action={handleAdmin} className="space-y-4">
                <Input label="Nombre Completo" name="full_name" required placeholder="Juan Pérez" />
                <Input label="Email" name="email" type="email" required placeholder="admin@consultora.com" />
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? 'Enviando invitación...' : 'Enviar Invitación'}
                </Button>
              </form>
              <button
                onClick={() => router.push('/dashboard')}
                className="mt-3 w-full text-center text-sm text-gray-400 hover:text-gray-600"
              >
                Omitir por ahora →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
