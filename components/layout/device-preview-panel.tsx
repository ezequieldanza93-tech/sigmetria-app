'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePreview } from '@/lib/contexts/preview-context'

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
  const { isOpen, setIsOpen } = usePreview()
  const [activeDevice, setActiveDevice] = useState<(typeof DEVICES)[number]>(DEVICES[0])
  const [scale, setScale] = useState(1)
  const [screenHeight, setScreenHeight] = useState(667)
  const contentRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        setIsOpen(!isOpen)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setIsOpen])

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

  return (
    <>
      <div className={isOpen ? 'hidden' : undefined}>{children}</div>

      {isOpen && (
        <div
          ref={measureRef}
          className="pointer-events-none absolute left-0 top-0 opacity-0"
          style={{ width: 'max-content', maxWidth: '1440px' }}
        >
          {children}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
              Ctrl+Shift+M
            </span>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Cerrar preview"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <div
            className="relative flex flex-col items-center"
            style={{ width: activeDevice.width + BEZEL_PADDING * 2 + 12 }}
          >
            <div
              className="overflow-hidden border-[3px] border-[#2C2C2E] bg-black shadow-2xl"
              style={{
                width: activeDevice.width + BEZEL_PADDING * 2,
                height: screenHeight + BEZEL_PADDING * 2 + NOTCH_HEIGHT,
                borderRadius: BEZEL_RADIUS,
              }}
            >
              <div className="relative flex h-[28px] items-center justify-center">
                <div className="h-[6px] w-[60px] rounded-full bg-[#1C1C1E]" />
              </div>

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

          <p className="absolute bottom-4 text-xs text-white/30">Seleccioná un dispositivo arriba para probar el layout</p>
        </div>
      )}

      
    </>
  )
}
