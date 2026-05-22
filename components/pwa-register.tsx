'use client'

import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    navigator.serviceWorker.register('/service-worker', { scope: '/' }).then((reg) => {
      if (!reg) return

      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (!newSW) return
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            newSW.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })

      const interval = setInterval(() => { reg.update() }, 60_000)
      return () => clearInterval(interval)
    }).catch(() => {
      /* service-worker file not present — no PWA offline support */
    })
  }, [])

  return null
}
