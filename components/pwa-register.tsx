'use client'

import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        const existingUrl = reg.active?.scriptURL ?? ''
        if (existingUrl.includes('/service-worker')) {
          return
        }
        reg.unregister().catch(() => {})
      }
      navigator.serviceWorker.register('/service-worker').catch(() => {})
    }).catch(() => {})
  }, [])

  return null
}
