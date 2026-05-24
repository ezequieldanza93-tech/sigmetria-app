'use client'

import { useEffect, useState, useCallback } from 'react'
import { getPendingOperations, getOperationCount, type QueuedOperation } from '@/lib/offline-queue'
import { useNetworkStatus } from '@/lib/hooks/use-network-status'

export function useOfflineQueue() {
  const { isOnline } = useNetworkStatus()
  const [count, setCount] = useState(0)
  const [operations, setOperations] = useState<QueuedOperation[]>([])

  const refresh = useCallback(async () => {
    const [pendingCount, pendingOps] = await Promise.all([
      getOperationCount(),
      getPendingOperations(),
    ])
    setCount(pendingCount)
    setOperations(pendingOps)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, isOnline])

  return { count, operations, refresh, hasPending: count > 0 }
}
