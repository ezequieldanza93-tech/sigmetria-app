'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff } from 'lucide-react'

interface AudioInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

export function AudioInput({ onTranscript, disabled }: AudioInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    setIsSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'es-AR'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      onTranscript(transcript)
      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [onTranscript])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  if (!isSupported) return null

  return (
    <button
      type="button"
      onClick={isListening ? stopListening : startListening}
      disabled={disabled}
      className={`shrink-0 rounded-full p-2 transition-colors ${
        isListening
          ? 'bg-danger text-white animate-pulse'
          : 'text-text-tertiary hover:text-text-primary hover:bg-surface-elevated'
      }`}
      title={isListening ? 'Detener grabación' : 'Grabar audio'}
    >
      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
    </button>
  )
}
