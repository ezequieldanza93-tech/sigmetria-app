'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/hooks/use-toast'
import {
  crearSesionDesdeGestion,
  agregarParticipantes,
  enviarLinksParticipantes,
  getPersonasDeEstablecimiento,
} from '@/lib/actions/capacitacion'
import type {
  CapacitacionModalidad,
  ParticipanteInput,
  ParticipanteToken,
  PersonaEstablecimiento,
} from '@/lib/actions/capacitacion'
import {
  GraduationCap,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Mail,
  MessageSquare,
} from 'lucide-react'

type CursoLite = { id: string; titulo: string }

interface EjecutarCapacitacionModalProps {
  establecimientoId: string
  empresaId?: string
  /** Nombre de la gestión, para prellenar el título de la sesión. */
  gestionNombre?: string
  /** Responsable de la gestión (preselecciona el instructor si es persona). */
  instructorPersonaIdDefault?: string
  /** Vínculo con la gestión planificada (gestiones_establecimientos). */
  gestionEstablecimientoId?: string
  /** Id del registro de gestión que dispara esta capacitación (suelto, sin FK). */
  registroGestionId?: string
  /** fecha_planificada del registro (parte de la PK compuesta particionada). */
  rgFechaPlanificada?: string
  onClose: () => void
  onSuccess?: () => void
}

const inputCls =
  'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-sig-500'

// ─── Participante editable (en memoria, previo a confirmar) ──────────────────
interface ParticipanteDraft {
  key: string
  personaId: string | null
  nombre: string
  email: string
  celular: string
}

function nombreCompleto(p: PersonaEstablecimiento): string {
  return `${p.apellido}, ${p.nombre}`.trim()
}

// Link de WhatsApp con el celular del participante + el enlace de su capacitación.
// Mejor esfuerzo: limpia no-dígitos; el número debería incluir código de país.
function waLink(celular: string, url: string): string {
  const digits = celular.replace(/\D/g, '')
  const text = encodeURIComponent(`Hola, te comparto el enlace para hacer tu capacitación: ${url}`)
  return `https://wa.me/${digits}?text=${text}`
}

// ─── Tarjeta de enlace + QR por participante (post-creación) ─────────────────
function ParticipanteEnlaceCard({ p }: { p: ParticipanteToken }) {
  const qrRef = useRef<HTMLDivElement>(null)
  const [copiado, setCopiado] = useState(false)
  const nombre = p.nombre ?? 'Participante'

  function copiarEnlace() {
    navigator.clipboard
      .writeText(p.url)
      .then(() => {
        setCopiado(true)
        toast.success('Enlace copiado')
        setTimeout(() => setCopiado(false), 1800)
      })
      .catch(() => toast.error('No se pudo copiar'))
  }

  function descargarQR() {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    const slug =
      nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'participante'
    a.download = `capacitacion-${slug}.png`
    a.click()
  }

  return (
    <div className="flex gap-3 border border-border-subtle rounded-lg p-3 bg-surface-base">
      <div
        ref={qrRef}
        className="shrink-0 p-2 bg-white rounded-lg border border-border-subtle h-fit"
      >
        <QRCodeCanvas value={p.url} size={96} level="M" includeMargin={false} />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <div className="text-sm font-medium text-text-primary truncate">{nombre}</div>
          {p.email && <div className="text-xs text-text-tertiary truncate">{p.email}</div>}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            readOnly
            value={p.url}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 text-xs border border-border-default rounded-lg px-2 py-1.5 bg-surface-elevated text-text-secondary focus:outline-none focus:ring-2 focus:ring-sig-500"
          />
          <button
            type="button"
            onClick={copiarEnlace}
            title="Copiar enlace"
            className={`shrink-0 inline-flex items-center justify-center rounded-lg border px-2 py-1.5 transition-colors ${
              copiado
                ? 'border-success/40 text-success bg-success-bg'
                : 'border-border-default text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            {copiado ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <button
            type="button"
            onClick={descargarQR}
            className="inline-flex items-center gap-1 text-sig-600 hover:text-sig-700 font-medium"
          >
            <Download size={13} /> Descargar QR
          </button>
          {p.celular && (
            <a
              href={waLink(p.celular, p.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 font-medium"
            >
              <MessageSquare size={13} /> WhatsApp
            </a>
          )}
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary"
          >
            <ExternalLink size={13} /> Abrir enlace
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Vista de enlaces generados (post-creación) ──────────────────────────────
function EnlacesView({
  participantes,
  sesionId,
  appUrl,
  onEnviarEmail,
  enviandoEmail,
}: {
  participantes: ParticipanteToken[]
  sesionId: string
  appUrl: string
  onEnviarEmail: () => void
  enviandoEmail: boolean
}) {
  const hayEmails = participantes.some((p) => p.email)

  return (
    <div className="space-y-4">
      <div className="bg-success-bg border border-success/30 text-success text-sm rounded-lg px-3 py-2 flex items-center gap-2">
        <CheckCircle2 size={16} />
        {participantes.length} enlace{participantes.length === 1 ? '' : 's'} generado
        {participantes.length === 1 ? '' : 's'}.
      </div>

      <p className="text-sm text-text-secondary">
        Compartí el enlace o el QR de cada participante como prefieras: WhatsApp, impreso, o
        escaneando el QR en el momento. Cada enlace es personal y no requiere usuario ni contraseña.{' '}
        <span className="text-text-tertiary">No se envió ningún email automáticamente.</span>
      </p>

      <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
        {participantes.map((p) => (
          <ParticipanteEnlaceCard key={p.id} p={p} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-border-subtle">
        {hayEmails && (
          <Button type="button" variant="secondary" onClick={onEnviarEmail} disabled={enviandoEmail}>
            <Mail size={14} />
            {enviandoEmail ? 'Enviando…' : 'Enviar por email (opcional)'}
          </Button>
        )}
        <a
          href={`${appUrl}/capacitacion/registro/${sesionId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors px-4 py-2 text-sm bg-surface-base border border-border-default text-text-primary hover:bg-surface-elevated"
        >
          <ExternalLink size={14} />
          Ver registro general
        </a>
      </div>
    </div>
  )
}

export function EjecutarCapacitacionModal({
  establecimientoId,
  empresaId,
  gestionNombre,
  instructorPersonaIdDefault,
  gestionEstablecimientoId,
  registroGestionId,
  rgFechaPlanificada,
  onClose,
  onSuccess,
}: EjecutarCapacitacionModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Datos de formulario
  const [cursos, setCursos] = useState<CursoLite[]>([])
  const [cursoId, setCursoId] = useState('')
  const [titulo, setTitulo] = useState(gestionNombre ?? '')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [modalidad, setModalidad] = useState<CapacitacionModalidad>('elearning')

  // Instructor + participantes: personas del directorio del establecimiento (con email + celular)
  const [directorio, setDirectorio] = useState<PersonaEstablecimiento[]>([])
  const [instructorPersonaId, setInstructorPersonaId] = useState(instructorPersonaIdDefault ?? '')
  const [instructorExterno, setInstructorExterno] = useState('')

  // Participantes (preseleccionados desde el establecimiento, editables)
  const [participantes, setParticipantes] = useState<ParticipanteDraft[]>([])
  const [cargandoPersonas, setCargandoPersonas] = useState(true)
  const [enviandoEmail, setEnviandoEmail] = useState(false)

  // Resultado: una vez creado, mostramos los enlaces + QR
  const [enlaces, setEnlaces] = useState<{
    sesionId: string
    participantes: ParticipanteToken[]
  } | null>(null)

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '')

  // Cargar cursos publicados (cliente, RLS)
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('cursos')
      .select('id, titulo')
      .eq('estado', 'publicado')
      .order('titulo', { ascending: true })
      .then(({ data }) => setCursos((data ?? []) as CursoLite[]))
  }, [establecimientoId])

  // Una sola fuente: el directorio del establecimiento (con email + celular) sirve
  // para el dropdown de participantes, el selector de instructor y la preselección.
  useEffect(() => {
    let cancelled = false
    setCargandoPersonas(true)
    getPersonasDeEstablecimiento(establecimientoId).then((res) => {
      if (cancelled) return
      if (res.success) {
        const ordenadas = [...res.data].sort((a, b) => a.apellido.localeCompare(b.apellido))
        setDirectorio(ordenadas)
        setParticipantes(
          ordenadas.map((p) => ({
            key: p.persona_id,
            personaId: p.persona_id,
            nombre: nombreCompleto(p),
            email: p.email ?? '',
            celular: p.celular ?? '',
          })),
        )
      }
      setCargandoPersonas(false)
    })
    return () => {
      cancelled = true
    }
  }, [establecimientoId])

  const personasDisponibles = useMemo(() => {
    const usados = new Set(participantes.map((p) => p.personaId).filter(Boolean))
    return directorio.filter((p) => !usados.has(p.persona_id))
  }, [directorio, participantes])

  function agregarPersona(personaId: string) {
    const p = directorio.find((x) => x.persona_id === personaId)
    if (!p) return
    setParticipantes((prev) => [
      ...prev,
      {
        key: p.persona_id,
        personaId: p.persona_id,
        nombre: nombreCompleto(p),
        email: p.email ?? '',
        celular: p.celular ?? '',
      },
    ])
  }

  function agregarExterno() {
    setParticipantes((prev) => [
      ...prev,
      { key: `ext-${crypto.randomUUID()}`, personaId: null, nombre: '', email: '', celular: '' },
    ])
  }

  function quitar(key: string) {
    setParticipantes((prev) => prev.filter((p) => p.key !== key))
  }

  function actualizar(key: string, campo: 'nombre' | 'email' | 'celular', valor: string) {
    setParticipantes((prev) => prev.map((p) => (p.key === key ? { ...p, [campo]: valor } : p)))
  }

  function handleConfirmar() {
    setError(null)
    if (!cursoId) {
      setError('Seleccioná un curso.')
      return
    }
    const validos = participantes.filter((p) => p.personaId || p.nombre.trim() || p.email.trim())
    if (validos.length === 0) {
      setError('Agregá al menos un participante.')
      return
    }

    startTransition(async () => {
      const crear = await crearSesionDesdeGestion({
        cursoId,
        establecimientoId,
        empresaId,
        gestionEstablecimientoId,
        registroGestionId,
        rgFechaPlanificada,
        instructorPersonaId: instructorPersonaId || undefined,
        instructorExterno: instructorExterno.trim() || undefined,
        fecha: fecha || undefined,
        titulo: titulo.trim() || undefined,
        modalidad,
      })
      if (!crear.success) {
        setError(crear.error)
        return
      }
      const sesionId = crear.data.sesionId

      const items: ParticipanteInput[] = validos.map((p) => ({
        personaId: p.personaId ?? undefined,
        nombre: p.personaId ? undefined : p.nombre.trim() || undefined,
        email: p.email.trim() || undefined,
        celular: p.celular.trim() || undefined,
      }))

      const agregar = await agregarParticipantes(sesionId, items)
      if (!agregar.success) {
        setError(agregar.error)
        return
      }

      // No se envían emails automáticamente: mostramos enlaces + QR para que el
      // profesional los distribuya como prefiera (copiar, descargar QR, etc.).
      setEnlaces({ sesionId, participantes: agregar.data })
      toast.success('Capacitación creada')
      onSuccess?.()
    })
  }

  function handleEnviarEmail() {
    if (!enlaces) return
    setEnviandoEmail(true)
    enviarLinksParticipantes(enlaces.sesionId)
      .then((res) => {
        if (!res.success) {
          toast.error(res.error)
          return
        }
        const enviados = res.data.filter((r) => r.enviado).length
        const sinEmail = res.data.filter((r) => !r.enviado && r.error === 'Sin email').length
        if (enviados > 0)
          toast.success(`${enviados} email${enviados === 1 ? '' : 's'} enviado${enviados === 1 ? '' : 's'}`)
        if (sinEmail > 0)
          toast.info(`${sinEmail} sin email: compartí el enlace o el QR`)
        if (enviados === 0 && sinEmail === 0) toast.info('No se envió ningún email')
      })
      .finally(() => setEnviandoEmail(false))
  }

  const tituloModal = enlaces ? 'Enlaces de la capacitación' : 'Ejecutar capacitación'

  return (
    <Modal open title={tituloModal} onClose={onClose} size="full">
      {enlaces ? (
        <EnlacesView
          participantes={enlaces.participantes}
          sesionId={enlaces.sesionId}
          appUrl={appUrl}
          onEnviarEmail={handleEnviarEmail}
          enviandoEmail={enviandoEmail}
        />
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Curso */}
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1 flex items-center gap-1.5">
              <GraduationCap size={14} /> Curso *
            </label>
            <select value={cursoId} onChange={(e) => setCursoId(e.target.value)} className={inputCls}>
              <option value="">Seleccionar curso…</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
            {cursos.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No hay cursos publicados. Publicá un curso en el Campus Virtual primero.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Título</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Opcional (usa el del curso si se deja vacío)"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Modalidad</label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as CapacitacionModalidad)}
                className={inputCls}
              >
                <option value="elearning">E-learning</option>
                <option value="presencial">Presencial</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Instructor</label>
              <select
                value={instructorPersonaId}
                onChange={(e) => setInstructorPersonaId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Sin asignar / externo —</option>
                {directorio.map((p) => (
                  <option key={p.persona_id} value={p.persona_id}>
                    {p.apellido}, {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!instructorPersonaId && (
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">
                Instructor externo
              </label>
              <input
                type="text"
                value={instructorExterno}
                onChange={(e) => setInstructorExterno(e.target.value)}
                placeholder="Nombre del instructor externo (opcional)"
                className={inputCls}
              />
            </div>
          )}

          {/* Participantes */}
          <div className="border-t border-border-subtle pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-secondary">
                Participantes
                {participantes.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-text-tertiary">
                    ({participantes.length})
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3">
                {personasDisponibles.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) agregarPersona(e.target.value)
                    }}
                    className="text-xs border border-border-default rounded-lg px-2 py-1.5 bg-surface-base text-text-secondary focus:outline-none focus:ring-2 focus:ring-sig-500"
                  >
                    <option value="">+ Agregar persona…</option>
                    {personasDisponibles.map((p) => (
                      <option key={p.persona_id} value={p.persona_id}>
                        {p.apellido}, {p.nombre}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={agregarExterno}
                  className="text-xs text-sig-600 hover:text-sig-700 font-medium flex items-center gap-1"
                >
                  <Plus size={13} /> Externo
                </button>
              </div>
            </div>

            {cargandoPersonas ? (
              <p className="text-xs text-text-tertiary text-center py-3">Cargando personas…</p>
            ) : participantes.length === 0 ? (
              <p className="text-xs text-text-tertiary text-center py-3 border border-dashed border-border-subtle rounded-lg">
                Sin participantes. Agregá personas del establecimiento o externos.
              </p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {participantes.map((p) => (
                  <div
                    key={p.key}
                    className="flex items-start gap-2 border border-border-subtle rounded-lg p-2 bg-gray-50/50"
                  >
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={p.nombre}
                        onChange={(e) => actualizar(p.key, 'nombre', e.target.value)}
                        readOnly={!!p.personaId}
                        placeholder="Nombre"
                        className={`border border-border-default rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sig-500 ${
                          p.personaId ? 'bg-surface-base text-text-secondary' : 'bg-white'
                        }`}
                      />
                      <input
                        type="email"
                        value={p.email}
                        onChange={(e) => actualizar(p.key, 'email', e.target.value)}
                        placeholder="email@ejemplo.com (opcional)"
                        className="border border-border-default rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
                      />
                      <input
                        type="tel"
                        value={p.celular}
                        onChange={(e) => actualizar(p.key, 'celular', e.target.value)}
                        placeholder="Celular (opcional)"
                        className="border border-border-default rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => quitar(p.key)}
                      title="Quitar participante"
                      className="text-text-tertiary hover:text-red-500 mt-1.5 shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-text-tertiary mt-2">
              Al elegir una persona del directorio se traen su email y celular. Al crear la
              capacitación se genera un enlace personal + QR por participante para compartir como
              prefieras (WhatsApp, impreso, QR en el momento). No se envían emails automáticamente.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="button" onClick={handleConfirmar} disabled={isPending || cursos.length === 0}>
              {isPending ? 'Creando…' : 'Crear y generar enlaces'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
