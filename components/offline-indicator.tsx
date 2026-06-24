'use client'

/**
 * Indicador flotante del MODO OFFLINE (esquina inferior). Único lugar donde el
 * usuario ve, sin ruido:
 *   - que está SIN señal (modo offline activo), y/o
 *   - cuántos cambios quedaron ENCOLADOS para sincronizar al volver la conexión,
 *   - y cuándo se están sincronizando / cuántos se sincronizaron.
 *
 * Si hay conexión y la cola está vacía, NO se muestra nada (cero ruido en el uso
 * normal online). El runner de sync lo dispara el hook al volver la señal; acá
 * solo ofrecemos un "Reintentar" manual.
 */

import { useOfflineSync } from '@/lib/hooks/use-offline-sync'
import { WifiOff, UploadCloud, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react'

export function OfflineIndicator() {
  const { isOnline, supported, pending, syncing, lastResult, syncNow } = useOfflineSync()

  if (!supported) return null

  const hayPendientes = pending > 0
  const recienSincronizado = lastResult !== null && lastResult.synced > 0 && pending === 0

  // Online, sin cola y sin "recién sincronizado" → no molestar.
  if (isOnline && !hayPendientes && !recienSincronizado && !syncing) return null

  // Paleta según el estado dominante.
  const tono = !isOnline
    ? 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800'
    : hayPendientes
      ? 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800'
      : 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-[90] max-w-[90vw] sm:max-w-sm flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-lg ${tono}`}
    >
      {syncing ? (
        <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" />
      ) : !isOnline ? (
        <WifiOff size={18} className="shrink-0" aria-hidden="true" />
      ) : hayPendientes ? (
        <UploadCloud size={18} className="shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
      )}

      <div className="min-w-0 text-xs leading-snug">
        {!isOnline ? (
          <>
            <p className="font-semibold">Sin conexión</p>
            <p className="opacity-90">
              {hayPendientes
                ? `${pending} ${pending === 1 ? 'cambio' : 'cambios'} en cola, se ${pending === 1 ? 'sincroniza' : 'sincronizan'} al volver la señal.`
                : 'Podés seguir trabajando; lo que cargues se guardará y se sincronizará al reconectar.'}
            </p>
          </>
        ) : syncing ? (
          <p className="font-semibold">Sincronizando cambios…</p>
        ) : hayPendientes ? (
          <>
            <p className="font-semibold">
              {pending} {pending === 1 ? 'cambio pendiente' : 'cambios pendientes'}
            </p>
            <p className="opacity-90">
              {lastResult && lastResult.failed > 0
                ? 'Algunos no se pudieron sincronizar. Reintentá.'
                : 'Listos para sincronizar.'}
            </p>
          </>
        ) : (
          <p className="font-semibold">
            {lastResult?.synced ?? 0}{' '}
            {(lastResult?.synced ?? 0) === 1 ? 'cambio sincronizado' : 'cambios sincronizados'}
          </p>
        )}
      </div>

      {isOnline && hayPendientes && !syncing && (
        <button
          type="button"
          onClick={() => void syncNow()}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white/70 dark:bg-black/20 px-2 py-1 text-xs font-medium hover:bg-white dark:hover:bg-black/40 transition-colors"
        >
          <RefreshCw size={13} aria-hidden="true" />
          Reintentar
        </button>
      )}
    </div>
  )
}
