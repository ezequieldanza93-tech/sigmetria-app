'use client'

import { useNetworkStatus } from '@/lib/hooks/use-network-status'
import { usePathname } from 'next/navigation'
import { Wifi, WifiOff } from 'lucide-react'

export function NetworkStatusBanner() {
  const { isOnline } = useNetworkStatus()
  const pathname = usePathname()

  if (isOnline) return null
  if (pathname === '/offline') return null

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-amber-50 text-amber-900 border-b border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
    >
      <WifiOff size={16} className="shrink-0" aria-hidden="true" />
      <span>Sin conexión — algunos datos pueden no estar disponibles</span>
    </div>
  )
}

export function NetworkStatusIcon() {
  const { isOnline } = useNetworkStatus()

  return (
    <span
      className="inline-flex items-center justify-center"
      title={isOnline ? 'Conectado' : 'Sin conexión'}
      aria-label={isOnline ? 'Conectado' : 'Sin conexión'}
    >
      {isOnline ? (
        <Wifi size={16} className="text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
      ) : (
        <WifiOff size={16} className="text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
      )}
    </span>
  )
}
