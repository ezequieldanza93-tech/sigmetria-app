'use client'

import { useState, useEffect, useActionState, useRef, useTransition } from 'react'
import { CreditCard, Award, Loader2, Check, ExternalLink, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createMatricula } from '@/lib/actions/matricula'
import { updatePersona } from '@/lib/actions/persona'
import { subirImagenPersona } from '@/lib/actions/persona-imagenes'
import { FileUploadInput } from '@/components/ui/file-upload-input'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { formatDate } from '@/lib/utils'
import type { Matricula } from '@/lib/types'

// Datos de la persona del directorio vinculada al usuario logueado.
// Llegan desde el server (page.tsx). Si es null, el usuario no tiene persona.
// updatePersona reescribe TODO el registro: cualquier campo ausente del FormData
// lo persiste como null. Por eso reenviamos en hidden TODOS los campos editables
// con su valor actual, y dejamos que el usuario edite solo el DNI. Así el resto
// del legajo de la persona no se pisa.
export interface MiPersona {
  id: string
  nombre: string
  apellido: string
  tipo_id: string
  dni: string | null
  dni_frente_url: string | null
  dni_dorso_url: string | null
  legajo: string | null
  fecha_nacimiento: string | null
  fecha_ingreso: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  organizacion_id: string | null
  notas: string | null
  talle_calzado: string | null
  talle_pantalon: string | null
  talle_remera: string | null
  talle_camisa: string | null
  talle_buzo: string | null
  talle_campera: string | null
  beneficiario_seguro: string | null
  contacto_emergencia_nombre: string | null
  contacto_emergencia_telefono: string | null
}

// Campos que reenviamos sin que el usuario los toque (todo salvo dni).
const CAMPOS_HIDDEN = [
  'nombre', 'apellido', 'tipo_id', 'legajo', 'fecha_nacimiento', 'fecha_ingreso',
  'telefono', 'email', 'direccion', 'organizacion_id', 'notas',
  'talle_calzado', 'talle_pantalon', 'talle_remera', 'talle_camisa', 'talle_buzo',
  'talle_campera', 'beneficiario_seguro', 'contacto_emergencia_nombre', 'contacto_emergencia_telefono',
] as const

interface Props {
  persona: MiPersona | null
}

// ── Formulario de carga de matrícula (mismo patrón que trabajador-modal) ──────
function MatriculaForm({ personaId, onSuccess }: { personaId: string; onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState(createMatricula, null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

  return (
    <form action={formAction} className="space-y-3 bg-surface-base rounded-lg p-3 mt-3 border border-border-subtle">
      <input type="hidden" name="persona_id" value={personaId} />
      {state && !state.success && <p className="text-xs text-danger">{state.error}</p>}
      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1">Número de matrícula *</label>
        <input name="numero" required className="w-full border border-border-default rounded px-2 py-1.5 text-sm bg-surface-base text-text-primary" placeholder="Nº de matrícula" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Fecha emisión *</label>
          <input name="fecha_emision" type="date" required className="w-full border border-border-default rounded px-2 py-1.5 text-sm bg-surface-base text-text-primary" />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Fecha vencimiento *</label>
          <input name="fecha_vencimiento" type="date" required className="w-full border border-border-default rounded px-2 py-1.5 text-sm bg-surface-base text-text-primary" />
        </div>
      </div>
      <FileUploadInput
        name="certificado"
        label="Certificado / constancia"
        accept="application/pdf,image/png,image/jpeg"
        maxSizeMB={5}
        helpText="PDF, PNG o JPG. Máx 5 MB. Opcional."
        kind="document"
      />
      <div className="flex gap-2 justify-end">
        <Button pending={pending}>Guardar</Button>
      </div>
    </form>
  )
}

function Button({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

// ── Subida de una cara del DNI (frente o dorso) ───────────────────────────────
function DniCaraUpload({
  personaId,
  kind,
  label,
  currentUrl,
  onUploaded,
}: {
  personaId: string
  kind: 'dni_frente' | 'dni_dorso'
  label: string
  currentUrl: string | null
  onUploaded: (path: string) => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const fd = new FormData()
    fd.set('file', file)
    startTransition(async () => {
      const res = await subirImagenPersona(personaId, kind, fd)
      if (!res.success) { setError(res.error); return }
      onUploaded(res.data.path)
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  return (
    <div className="border border-border-subtle rounded-lg p-3 bg-surface-base">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        {currentUrl ? (
          <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline shrink-0">
            Ver <ExternalLink size={11} />
          </a>
        ) : (
          <span className="text-[11px] text-text-tertiary">Sin cargar</span>
        )}
      </div>
      <label className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium bg-surface-elevated border border-border-default rounded-lg text-text-primary hover:bg-surface-sunken cursor-pointer transition-colors">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        {currentUrl ? 'Reemplazar' : 'Subir imagen'}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={handleChange}
          disabled={pending}
          className="sr-only"
        />
      </label>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  )
}

export function MiMatriculaDni({ persona }: Props) {
  // Persona no vinculada: aviso amable y nada más.
  if (!persona) {
    return (
      <div className="flex items-start gap-3 p-3 bg-warning-bg/50 border border-warning/20 rounded-lg">
        <CreditCard size={16} className="text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-text-primary">Tu perfil no está vinculado a una persona del directorio</p>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            Vinculá tu cuenta en la sección de datos personales para poder cargar tu matrícula y tu DNI.
          </p>
        </div>
      </div>
    )
  }

  return <MiMatriculaDniInner persona={persona} />
}

function MiMatriculaDniInner({ persona }: { persona: MiPersona }) {
  // — Matrículas —
  const [matriculas, setMatriculas] = useState<Matricula[] | null>(null)
  const [showMatriculaForm, setShowMatriculaForm] = useState(false)

  // — DNI —
  const [dniFrenteUrl, setDniFrenteUrl] = useState<string | null>(persona.dni_frente_url)
  const [dniDorsoUrl, setDniDorsoUrl] = useState<string | null>(persona.dni_dorso_url)
  const [dniState, dniFormAction, dniPending] = useActionState(updatePersona.bind(null, persona.id), null)

  function loadMatriculas() {
    const supabase = createClient()
    supabase
      .from('matriculas')
      .select('*, organizaciones_externas(nombre)')
      .eq('persona_id', persona.id)
      .order('fecha_emision', { ascending: false })
      .then(({ data }) => setMatriculas((data as unknown as Matricula[]) ?? []))
  }

  useEffect(() => {
    loadMatriculas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona.id])

  // Buckets privados: firmamos en batch.
  const { getUrl: getCertUrl } = useSignedUrls('certificados', (matriculas ?? []).map(m => m.certificado_url))
  const { getUrl: getDocUrl } = useSignedUrls('documentos', [dniFrenteUrl, dniDorsoUrl])

  return (
    <div className="space-y-6">
      {/* ── DNI ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard size={15} className="text-sig-500" />
          <h4 className="text-sm font-semibold text-text-primary">Documento de identidad</h4>
        </div>

        <form action={dniFormAction} className="space-y-3 bg-surface-base rounded-lg p-3 border border-border-subtle">
          {/* Reenviamos en hidden todos los campos del legajo (con su valor actual)
              para que updatePersona no los pise con null. El único editable acá es el DNI. */}
          {CAMPOS_HIDDEN.map(campo => (
            <input key={campo} type="hidden" name={campo} value={(persona[campo] as string | null) ?? ''} />
          ))}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Número de DNI</label>
            <input
              name="dni"
              defaultValue={persona.dni ?? ''}
              className="w-full border border-border-default rounded px-2 py-1.5 text-sm bg-surface-base text-text-primary"
              placeholder="12345678"
            />
          </div>
          {dniState && !dniState.success && <p className="text-xs text-danger">{dniState.error}</p>}
          {dniState?.success && (
            <p className="text-xs text-success flex items-center gap-1.5"><Check size={13} /> DNI actualizado</p>
          )}
          <div className="flex justify-end">
            <Button pending={dniPending}>Guardar DNI</Button>
          </div>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DniCaraUpload
            personaId={persona.id}
            kind="dni_frente"
            label="DNI — Frente"
            currentUrl={getDocUrl(dniFrenteUrl)}
            onUploaded={setDniFrenteUrl}
          />
          <DniCaraUpload
            personaId={persona.id}
            kind="dni_dorso"
            label="DNI — Dorso"
            currentUrl={getDocUrl(dniDorsoUrl)}
            onUploaded={setDniDorsoUrl}
          />
        </div>
      </div>

      {/* ── Matrícula ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Award size={15} className="text-sig-500" />
          <h4 className="text-sm font-semibold text-text-primary">Matrícula profesional</h4>
        </div>

        {matriculas === null ? (
          <p className="text-sm text-text-tertiary py-2">Cargando…</p>
        ) : (
          <>
            {matriculas.length === 0 && !showMatriculaForm && (
              <p className="text-sm text-text-tertiary py-2">Todavía no cargaste ninguna matrícula.</p>
            )}
            <div className="space-y-2">
              {matriculas.map(m => {
                const days = Math.ceil((new Date(m.fecha_vencimiento).getTime() - Date.now()) / 86400000)
                const statusLabel = !m.activa ? 'Histórica' : days < 0 ? 'Vencida' : days <= 30 ? 'Próx. a vencer' : 'Vigente'
                const statusClass = !m.activa ? 'bg-surface-elevated text-text-secondary' : days < 0 ? 'bg-danger-bg text-danger' : days <= 30 ? 'bg-warning-bg text-warning' : 'bg-sig-50 text-sig-700'
                return (
                  <div key={m.id} className="flex items-start justify-between bg-surface-base rounded-lg px-3 py-2.5 text-sm border border-border-subtle">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-text-primary">Nº {m.numero}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusClass}`}>{statusLabel}</span>
                      </div>
                      {m.organizaciones_externas && (
                        <p className="text-xs text-text-tertiary mt-0.5">{m.organizaciones_externas.nombre}</p>
                      )}
                      <p className="text-xs text-text-tertiary">
                        {formatDate(m.fecha_emision)} → {formatDate(m.fecha_vencimiento)}
                      </p>
                    </div>
                    {m.certificado_url && getCertUrl(m.certificado_url) && (
                      <a href={getCertUrl(m.certificado_url) ?? '#'} target="_blank" rel="noopener noreferrer" className="text-xs text-sig-500 hover:underline ml-2 shrink-0">Ver</a>
                    )}
                  </div>
                )
              })}
            </div>

            {showMatriculaForm ? (
              <MatriculaForm
                personaId={persona.id}
                onSuccess={() => {
                  setShowMatriculaForm(false)
                  loadMatriculas()
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowMatriculaForm(true)}
                className="text-sm text-sig-500 hover:text-sig-700 font-medium"
              >
                + {matriculas.length > 0 ? 'Renovar matrícula' : 'Cargar matrícula'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
