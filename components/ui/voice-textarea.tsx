'use client'

import { TextareaHTMLAttributes } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSpeechToText } from '@/lib/hooks/use-speech-to-text'

interface VoiceTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  /** Valor controlado del textarea. */
  value: string
  /** Setter del valor. Acepta el string nuevo (no el evento). */
  onValueChange: (next: string) => void
  /** Idioma de dictado (BCP-47). Default 'es-AR'. */
  lang?: string
}

/**
 * Textarea con DICTADO POR VOZ integrado (Web Speech API, on-device, gratis).
 *
 * Drop-in para cualquier `<textarea>` controlado: en vez de
 *   `<textarea value={x} onChange={e => setX(e.target.value)} ... />`
 * usá
 *   `<VoiceTextarea value={x} onValueChange={setX} ... />`
 *
 * El botón de micrófono (abajo a la derecha) solo aparece si el navegador soporta
 * reconocimiento de voz. Mientras dicta, el texto reconocido se AGREGA al final del
 * valor actual (no lo reemplaza), así el usuario puede mezclar tipeo y dictado.
 *
 * Reusa el hook `useSpeechToText` y replica el patrón ya probado en
 * `components/feedback/report-problem-modal.tsx`.
 */
export function VoiceTextarea({
  value,
  onValueChange,
  lang = 'es-AR',
  className,
  disabled,
  ...props
}: VoiceTextareaProps) {
  const { isSupported, isListening, error, start, stop } = useSpeechToText({
    lang,
    onTranscript: (text) => {
      // Agregar al final, separando con espacio si ya había contenido.
      const sep = value && !/\s$/.test(value) ? ' ' : ''
      onValueChange(`${value}${sep}${text}`)
    },
  })

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={disabled}
        className={cn(
          className,
          // Reservar espacio abajo-derecha para el botón de micrófono.
          isSupported && 'pb-9',
          isListening && 'border-rose-400 ring-1 ring-rose-300/60',
        )}
        {...props}
      />

      {isSupported && (
        <button
          type="button"
          onClick={isListening ? stop : start}
          disabled={disabled}
          title={isListening ? 'Detener dictado' : 'Dictar por voz (es-AR)'}
          aria-pressed={isListening}
          className={cn(
            'absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
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

      {isListening && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-rose-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
          Escuchando… hablá y el texto se va agregando solo.
        </p>
      )}
      {error === 'no-permiso' && (
        <p className="mt-1 text-xs text-rose-500">
          No pudimos acceder al micrófono. Revisá los permisos del navegador.
        </p>
      )}
      {error === 'generico' && (
        <p className="mt-1 text-xs text-rose-500">
          Hubo un problema con el dictado. Podés escribir a mano.
        </p>
      )}
    </div>
  )
}
