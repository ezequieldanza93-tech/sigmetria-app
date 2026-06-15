'use client'

import { useEffect, useRef, useState } from 'react'

interface UseSpeechToTextOptions {
  /**
   * Idioma de reconocimiento (BCP-47). Default: 'es-AR' (español rioplatense).
   */
  lang?: string
  /**
   * Callback que recibe cada fragmento de texto final transcripto.
   * El consumidor decide si lo agrega/inserta en su estado.
   */
  onTranscript: (text: string) => void
}

type SpeechError = 'no-permiso' | 'sin-habla' | 'generico' | null

interface UseSpeechToTextResult {
  /** Si el navegador soporta Web Speech API. Si es false, ocultar el botón. */
  isSupported: boolean
  /** Si está escuchando activamente (mostrar indicador visual). */
  isListening: boolean
  /** Error legible para el usuario, o null si no hay error. */
  error: SpeechError
  /** Arranca el dictado. */
  start: () => void
  /** Detiene el dictado. */
  stop: () => void
}

/**
 * Hook reutilizable de dictado por voz usando Web Speech API.
 *
 * On-device, gratis, sin servidor. Reconocimiento continuo: va emitiendo
 * fragmentos finales por `onTranscript` mientras el usuario habla, ideal para
 * dictar texto largo en un textarea que el usuario revisa antes de enviar.
 *
 * El consumidor es responsable de acumular el texto (típicamente agregándolo
 * al valor actual del campo).
 */
export function useSpeechToText({
  lang = 'es-AR',
  onTranscript,
}: UseSpeechToTextOptions): UseSpeechToTextResult {
  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<SpeechError>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  // Guardamos la última referencia al callback para no recrear el reconocimiento
  // ni cerrar sobre un valor obsoleto (React Compiler: sin useCallback).
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  useEffect(() => {
    setIsSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  // Limpieza: si el componente se desmonta mientras graba, detenemos el reconocimiento.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  function start() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    setError(null)

    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.interimResults = false
    recognition.continuous = true

    recognition.onresult = (event) => {
      // En modo continuo pueden llegar varios resultados; tomamos solo los
      // finales nuevos a partir de event.resultIndex.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const transcript = result[0].transcript.trim()
          if (transcript) onTranscriptRef.current(transcript)
        }
      }
    }

    recognition.onerror = (event) => {
      const code = (event as SpeechRecognitionErrorEvent).error
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('no-permiso')
      } else if (code === 'no-speech') {
        setError('sin-habla')
      } else if (code !== 'aborted') {
        setError('generico')
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsListening(true)
    } catch {
      // start() lanza si ya está corriendo — lo ignoramos.
      setIsListening(false)
    }
  }

  function stop() {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  return { isSupported, isListening, error, start, stop }
}
