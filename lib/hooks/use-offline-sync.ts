'use client'

/**
 * Hook único del MODO OFFLINE para la UI: expone el estado de conexión, la
 * cantidad de cambios encolados y el resultado de la última sincronización; y
 * dispara el runner de la cola automáticamente cuando vuelve la señal.
 *
 * Por qué acá: el runner vive en lib/offline/queue.ts (lógica pura, sin React).
 * Este hook es el PUENTE a React — se suscribe a la cola (sin polling) y al
 * evento `online` del browser. Cualquier componente que lo use (indicador,
 * formularios) comparte el mismo estado reactivo.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  subscribeQueue,
  getPendingMutationCount,
  syncQueue,
  type SyncResult,
} from '@/lib/offline/queue'
import { isOfflineSupported } from '@/lib/offline/db'

export interface OfflineSyncState {
  /** ¿Hay conexión ahora? (navigator.onLine + eventos online/offline). */
  isOnline: boolean
  /** ¿El entorno soporta el modo offline (browser + IndexedDB)? */
  supported: boolean
  /** Cuántas mutaciones quedan en la cola local. */
  pending: number
  /** ¿Está corriendo el runner ahora mismo? */
  syncing: boolean
  /** Resultado de la última corrida del runner (o null si no corrió aún). */
  lastResult: SyncResult | null
  /** Dispara el runner manualmente (botón "Reintentar"). */
  syncNow: () => Promise<void>
}

export function useOfflineSync(): OfflineSyncState {
  const supported = typeof window !== 'undefined' && isOfflineSupported()
  const [isOnline, setIsOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)

  const refreshCount = useCallback(() => {
    if (!supported) return
    getPendingMutationCount().then(setPending).catch(() => {})
  }, [supported])

  const syncNow = useCallback(async () => {
    if (!supported) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    setSyncing(true)
    try {
      const result = await syncQueue()
      setLastResult(result)
      setPending(result.remaining)
    } finally {
      setSyncing(false)
    }
  }, [supported])

  // Estado de conexión + drenado al recuperar señal.
  useEffect(() => {
    if (typeof navigator !== 'undefined') setIsOnline(navigator.onLine)
    if (!supported) return

    function handleOnline() {
      setIsOnline(true)
      // Al volver la señal, drenar la cola. El runner es reentrante-seguro.
      void syncNow()
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [supported, syncNow])

  // Suscripción a la cola (la cola notifica al encolar/borrar) + intento inicial.
  useEffect(() => {
    if (!supported) return
    refreshCount()
    const unsub = subscribeQueue(refreshCount)
    // Si arrancamos online y hay cosas pendientes de una sesión anterior, drenar.
    if (typeof navigator === 'undefined' || navigator.onLine) {
      void syncNow()
    }
    return unsub
  }, [supported, refreshCount, syncNow])

  return { isOnline, supported, pending, syncing, lastResult, syncNow }
}
