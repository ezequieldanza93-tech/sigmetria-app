'use client'

import { useErrorCapture } from '@/components/feedback/use-error-capture'

/**
 * Componente headless — monta los listeners globales de captura de errores JS.
 * No renderiza ningún elemento visible. Montado en app/layout.tsx.
 */
export function ErrorCapture() {
  useErrorCapture()
  return null
}
