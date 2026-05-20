'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const DEVICES = [
  { id: 'iphone-se', name: 'iPhone SE', width: 375, height: 667 },
  { id: 'iphone-14', name: 'iPhone 14', width: 390, height: 844 },
  { id: 'samsung-s23', name: 'Samsung S23', width: 360, height: 780 },
  { id: 'pixel-7', name: 'Pixel 7', width: 412, height: 915 },
] as const

const BEZEL_PADDING = 16
const BEZEL_RADIUS = 44
const NOTCH_HEIGHT = 28

export function DevicePreviewPanel({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeDevice, setActiveDevice] = useState<(typeof DEVICES)[number]>(DEVICES[0])
  const [scale, setScale] = useState(1)
  const [screenHeight, setScreenHeight] = useState(667)
  const contentRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const isDev = process.env.NODE_ENV === 'development'

  // Toggle shortcut: Ctrl+Shift+M / Cmd+Shift+M
  useEffect(() => {
    if (!isDev) return

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDev])

  // Measure content width via ResizeObserver
  const measureContent = useCallback(() => {
    const el = measureRef.current
    if (!el) return

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        if (w > 0) {
          const s = activeDevice.width / w
          setScale(Math.min(s, 1))
          setScreenHeight(Math.round(activeDevice.height))
        }
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [activeDevice.width, activeDevice.height])

  useEffect(() => {
    if (isOpen) {
      const cleanup = measureContent()
      return cleanup
    }
  }, [isOpen, measureContent])

  if (!isDev) return <>{children}</>

  return (
    <>
      {/* Main content: hidden when preview is active, normal otherwise */}
      <div className={isOpen ? 'hidden' : ''}>{children}</div>

      {/* Measuring container: hidden but rendered to measure natural width */}
      {isOpen && (
        <div
          ref={measureRef}
          className="pointer-events-none absolute left-0 top-0 opacity-0"
          style={{ width: 'max-content', maxWidth: '1440px' }}
        >
          {children}
        </div>
      )}

      {/* Preview overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          {/* Toolbar */}
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
              Ctrl+Shift+M
            </span>
          </div>

          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Cerrar preview"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Device frame */}
          <div
            className="relative flex flex-col items-center"
            style={{ width: activeDevice.width + BEZEL_PADDING * 2 + 12 }}
          >
            {/* Phone bezel */}
            <div
              className="overflow-hidden border-[3px] border-[#2C2C2E] bg-black shadow-2xl"
              style={{
                width: activeDevice.width + BEZEL_PADDING * 2,
                height: screenHeight + BEZEL_PADDING * 2 + NOTCH_HEIGHT,
                borderRadius: BEZEL_RADIUS,
              }}
            >
              {/* Notch */}
              <div className="relative flex h-[28px] items-center justify-center">
                <div className="h-[6px] w-[60px] rounded-full bg-[#1C1C1E]" />
              </div>

              {/* Screen */}
              <div
                className="overflow-hidden bg-white"
                style={{
                  width: activeDevice.width,
                  height: screenHeight,
                  margin: '0 auto',
                  borderRadius: 2,
                }}
              >
                <div
                  ref={contentRef}
                  style={{
                    width: `${(1 / scale) * 100}%`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  {children}
                </div>
              </div>
            </div>

            {/* Device selector */}
            <div className="mt-4 flex gap-2">
              {DEVICES.map(d => (
                <button
                  key={d.id}
                  onClick={() => setActiveDevice(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeDevice.id === d.id
                      ? 'bg-white text-gray-900'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {d.name}
                  <span className="ml-1 opacity-50">{d.width}w</span>
                </button>
              ))}
            </div>
          </div>

          {/* Orientation hint */}
          <p className="absolute bottom-4 text-xs text-white/30">Seleccioná un dispositivo arriba para probar el layout</p>
        </div>
      )}

      {/* Floating toggle button (only when preview is hidden) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-lg transition-all hover:bg-gray-800 hover:shadow-xl active:scale-95"
          title="Mobile Preview (Ctrl+Shift+M)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          Preview
        </button>
      )}
    </>
  )
}
