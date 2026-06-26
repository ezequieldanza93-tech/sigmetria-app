'use client'

import { TextareaHTMLAttributes, useState } from 'react'
import { Mic, MicOff, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSpeechToText } from '@/lib/hooks/use-speech-to-text'
import { toast } from '@/lib/hooks/use-toast'

interface VoiceTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  /** Valor controlado del textarea. */
  value: string
  /** Setter del valor. Acepta el string nuevo (no el evento). */
  onValueChange: (next: string) => void
  /** Idioma de dictado (BCP-47). Default 'es-AR'. */
  lang?: string
  /** Label opcional (replica el `<Textarea>` de ui para ser drop-in también de ese). */
  label?: string
  /** Mensaje de error opcional (borde rojo + texto). */
  error?: string
  /**
   * Si se pasa, aparece un botón chico "Pulir con IA" (icono Sparkles) que envía
   * el valor actual a esta acción y, si vuelve `{ success, data }`, reemplaza el
   * contenido por el texto pulido. Si vuelve `{ error }`, NO toca el texto actual
   * (avisa con un toast suave). Sin la prop, el componente queda intacto.
   */
  pulirAction?: (texto: string) => Promise<{ success: true; data: string } | { error: string }>
}

/**
 * Textarea con DICTADO POR VOZ integrado (Web Speech API, on-device, gratis).
 *
 * Drop-in para cualquier `<textarea>` controlado (nativo o el `<Textarea>` de ui):
 *   `<textarea value={x} onChange={e => setX(e.target.value)} ... />`
 *   `<Textarea label="Notas" value={x} onChange={e => setX(e.target.value)} ... />`
 * pasan a:
 *   `<VoiceTextarea value={x} onValueChange={setX} ... />`
 *   `<VoiceTextarea label="Notas" value={x} onValueChange={setX} ... />`
 *
 * El botón de micrófono (abajo a la derecha) solo aparece si el navegador soporta
 * reconocimiento de voz. Mientras dicta, el texto reconocido se AGREGA al final del
 * valor actual (no lo reemplaza), así el usuario puede mezclar tipeo y dictado.
 *
 * Reusa el hook `useSpeechToText` y replica el patrón probado en
 * `components/feedback/report-problem-modal.tsx`.
 */
export function VoiceTextarea({
  value,
  onValueChange,
  lang = 'es-AR',
  label,
  error,
  className,
  disabled,
  id,
  pulirAction,
  ...props
}: VoiceTextareaProps) {
  const { isSupported, isListening, error: speechError, start, stop } = useSpeechToText({
    lang,
    onTranscript: (text) => {
      const sep = value && !/\s$/.test(value) ? ' ' : ''
      onValueChange(`${value}${sep}${text}`)
    },
  })

  const [puliendo, setPuliendo] = useState(false)

  async function handlePulir() {
    if (!pulirAction || puliendo) return
    const actual = value.trim()
    if (!actual) {
      toast.info('Escribí algo antes de pulir con IA.')
      return
    }
    setPuliendo(true)
    try {
      const res = await pulirAction(value)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      onValueChange(res.data)
    } catch {
      toast.error('No pudimos pulir el texto. Intentá de nuevo.')
    } finally {
      setPuliendo(false)
    }
  }

  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={label ? 'flex flex-col gap-1.5' : undefined}>
      {label && (
        <label htmlFor={textareaId} className="text-sm font-medium text-text-secondary">
          {label}
          {props.required && <span className="text-[var(--danger)] ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <textarea
          id={textareaId}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={disabled}
          className={cn(
            className,
            (isSupported || pulirAction) && 'pb-9',
            isListening && 'border-rose-400 ring-1 ring-rose-300/60',
            error && 'border-[var(--danger)] focus-visible:ring-[var(--danger)]',
          )}
          {...props}
        />

        {(isSupported || pulirAction) && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            {pulirAction && (
              <button
                type="button"
                onClick={handlePulir}
                disabled={disabled || puliendo || isListening}
                title="Reescribir como observación profesional con IA"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                  'border border-border-subtle bg-surface-base/90 text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
                )}
              >
                <Sparkles size={13} className={cn(puliendo && 'animate-pulse')} />
                {puliendo ? 'Puliendo…' : 'Pulir con IA'}
              </button>
            )}

            {isSupported && (
              <button
                type="button"
                onClick={isListening ? stop : start}
                disabled={disabled}
                title={isListening ? 'Detener dictado' : 'Dictar por voz (es-AR)'}
                aria-pressed={isListening}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                  isListening
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'border border-border-subtle bg-surface-base/90 text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
                )}
              >
                {isListening ? (
                  <>
                    <MicOff size={13} className="animate-pulse" />
                    Grabando…
                  </>
                ) : (
                  <>
                    <Mic size={13} />
                    Dictar
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      {isListening && (
        <p className="flex items-center gap-1.5 text-xs text-rose-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
          Escuchando… hablá y el texto se va agregando solo.
        </p>
      )}
      {speechError === 'no-permiso' && (
        <p className="text-xs text-rose-500">
          No pudimos acceder al micrófono. Revisá los permisos del navegador.
        </p>
      )}
      {speechError === 'generico' && (
        <p className="text-xs text-rose-500">
          Hubo un problema con el dictado. Podés escribir a mano.
        </p>
      )}
    </div>
  )
}
