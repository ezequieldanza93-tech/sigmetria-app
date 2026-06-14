'use client'

import { useEffect, useRef, useState } from 'react'
import { Bug, Lightbulb } from 'lucide-react'
import { ReportProblemModal } from './report-problem-modal'

const POS_STORAGE_KEY = '__sig_report_pos__'
const DRAG_THRESHOLD = 5 // px — si se movió más de esto, fue drag (no click)

interface Pos {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function defaultPos(): Pos {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  // Bottom-right, con margen para no quedar pegado al borde
  return {
    x: window.innerWidth - 160,
    y: window.innerHeight - 80,
  }
}

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed
    return null
  } catch {
    return null
  }
}

function savePos(pos: Pos) {
  try {
    localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos))
  } catch {}
}

export function FloatingReportButtons() {
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 })
  const [modalOpen, setModalOpen] = useState(false)
  const [tipo, setTipo] = useState<'error' | 'idea'>('error')

  const containerRef = useRef<HTMLDivElement>(null)
  const errorBtnRef = useRef<HTMLButtonElement>(null)
  const ideaBtnRef = useRef<HTMLButtonElement>(null)

  // Estado de drag
  const dragging = useRef(false)
  const startPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const startPos = useRef<Pos>({ x: 0, y: 0 })
  const moved = useRef(false)

  useEffect(() => {
    const saved = loadPos()
    setPos(saved ?? defaultPos())
    setMounted(true)
  }, [])

  // Clampear al viewport en resize
  useEffect(() => {
    if (!mounted) return
    const onResize = () => {
      setPos((prev) => {
        const el = containerRef.current
        const w = el?.offsetWidth ?? 140
        const h = el?.offsetHeight ?? 40
        return {
          x: clamp(prev.x, 0, window.innerWidth - w),
          y: clamp(prev.y, 0, window.innerHeight - h),
        }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mounted])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Solo botón primario (izquierdo)
    if (e.button !== 0) return
    dragging.current = true
    moved.current = false
    startPointer.current = { x: e.clientX, y: e.clientY }
    startPos.current = pos
    containerRef.current?.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    const dx = e.clientX - startPointer.current.x
    const dy = e.clientY - startPointer.current.y
    if (!moved.current && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
      moved.current = true
    }
    if (moved.current) {
      const el = containerRef.current
      const w = el?.offsetWidth ?? 140
      const h = el?.offsetHeight ?? 40
      const newPos: Pos = {
        x: clamp(startPos.current.x + dx, 0, window.innerWidth - w),
        y: clamp(startPos.current.y + dy, 0, window.innerHeight - h),
      }
      setPos(newPos)
      savePos(newPos)
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    dragging.current = false

    if (!moved.current) {
      // Fue un click — determinar qué botón se clickeó por el target
      const target = e.target as Node
      if (errorBtnRef.current?.contains(target) || errorBtnRef.current === target) {
        setTipo('error')
        setModalOpen(true)
      } else if (ideaBtnRef.current?.contains(target) || ideaBtnRef.current === target) {
        setTipo('idea')
        setModalOpen(true)
      }
    }
  }

  if (!mounted) return null

  return (
    <>
      {/* Píldora flotante con dos botones */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          zIndex: 9999,
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex rounded-full shadow-lg overflow-hidden cursor-grab active:cursor-grabbing select-none"
      >
        {/* Botón Error */}
        <button
          ref={errorBtnRef}
          aria-label="Informar de un problema"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors select-none"
          tabIndex={0}
          // El click real lo maneja onPointerUp para distinguir de drag
          onClick={(e) => e.preventDefault()}
        >
          <Bug size={14} strokeWidth={2} />
          Error
        </button>

        {/* Divisor */}
        <div className="w-px bg-rose-800/40 self-stretch" />

        {/* Botón Idea */}
        <button
          ref={ideaBtnRef}
          aria-label="Compartir una idea"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors select-none"
          tabIndex={0}
          onClick={(e) => e.preventDefault()}
        >
          <Lightbulb size={14} strokeWidth={2} />
          Idea
        </button>
      </div>

      {/* Modal compartido */}
      <ReportProblemModal
        open={modalOpen}
        tipo={tipo}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
