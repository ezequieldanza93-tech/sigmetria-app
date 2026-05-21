'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

const COLORS = [
  { label: 'Negro', value: '#000000' },
  { label: 'Blanco', value: '#FFFFFF' },
  { label: 'Rojo', value: '#DC2626' },
  { label: 'Azul', value: '#2563EB' },
  { label: 'Amarillo', value: '#FACC15' },
  { label: 'Verde', value: '#16A34A' },
  { label: 'Naranja', value: '#EA580C' },
  { label: 'Violeta', value: '#9333EA' },
]

const BRUSH_SIZES = [2, 4, 6, 10]

type Tool = 'draw' | 'text'

interface TextElement {
  x: number
  y: number
  content: string
  color: string
  fontSize: number
}

interface PhotoCanvasEditorProps {
  imageUrl: string
  onImageChange?: (blob: Blob) => void
}

export function PhotoCanvasEditor({ imageUrl, onImageChange }: PhotoCanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<Tool>('draw')
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(4)
  const [fontSize, setFontSize] = useState(24)
  const [, setTextElements] = useState<TextElement[]>([])
  const [placingText, setPlacingText] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 })
  const textInputRef = useRef<HTMLInputElement>(null)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  const undoStack = useRef<ImageData[]>([])
  const redoStack = useRef<ImageData[]>([])

  const saveState = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const state = ctx.getImageData(0, 0, canvas.width, canvas.height)
    undoStack.current.push(state)
    redoStack.current = []
    if (undoStack.current.length > 50) undoStack.current.shift()
  }, [])

  function undo() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (undoStack.current.length === 0) return
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    redoStack.current.push(current)
    const prev = undoStack.current.pop()!
    ctx.putImageData(prev, 0, 0)
  }

  function redo() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (redoStack.current.length === 0) return
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    undoStack.current.push(current)
    const next = redoStack.current.pop()!
    ctx.putImageData(next, 0, 0)
  }

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageRef.current = img
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      saveState()
    }
    img.src = imageUrl
  }, [imageUrl])

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    let clientX: number, clientY: number
    if ('touches' in e) {
      const touch = e.touches[0] ?? (e as React.TouchEvent).changedTouches[0]
      clientX = touch.clientX
      clientY = touch.clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const pos = getCanvasPos(e)
    if (tool === 'draw') {
      setIsDrawing(true)
      lastPoint.current = pos
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    } else {
      setPlacingText(true)
      setTextInputPos(pos)
      setTextInput('')
      setTimeout(() => textInputRef.current?.focus(), 50)
    }
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing || tool !== 'draw') return
    e.preventDefault()
    const pos = getCanvasPos(e)
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function endDraw(_e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (isDrawing) {
      setIsDrawing(false)
      lastPoint.current = null
      saveState()
    }
  }

  function confirmText() {
    if (!textInput.trim()) { setPlacingText(false); return }
    setTextElements(prev => [...prev, { x: textInputPos.x, y: textInputPos.y, content: textInput, color, fontSize }])
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.font = `${fontSize}px sans-serif`
    ctx.fillStyle = color
    ctx.fillText(textInput, textInputPos.x, textInputPos.y)
    setPlacingText(false)
    saveState()
  }

  async function exportBlob(): Promise<Blob | null> {
    return new Promise(resolve => {
      const canvas = canvasRef.current
      if (!canvas) { resolve(null); return }
      canvas.toBlob(blob => resolve(blob), 'image/png')
    })
  }

  useEffect(() => {
    if (!onImageChange) return
    const timer = setInterval(async () => {
      const blob = await exportBlob()
      if (blob) onImageChange(blob)
    }, 2000)
    return () => clearInterval(timer)
  }, [onImageChange])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 mr-2">
          <span className="text-xs text-gray-500 mr-1">Herramienta:</span>
          <button
            type="button"
            onClick={() => setTool('draw')}
            className={`px-3 py-1 text-xs rounded-lg border ${tool === 'draw' ? 'bg-sig-500 text-white border-sig-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Lápiz
          </button>
          <button
            type="button"
            onClick={() => setTool('text')}
            className={`px-3 py-1 text-xs rounded-lg border ${tool === 'text' ? 'bg-sig-500 text-white border-sig-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Texto
          </button>
        </div>

        <div className="flex items-center gap-1 mr-2">
          <span className="text-xs text-gray-500 mr-1">Color:</span>
          {COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => setColor(c.value)}
              className={`w-5 h-5 rounded-full border-2 ${color === c.value ? 'border-gray-800 scale-125' : 'border-gray-200'} transition-transform`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Tamaño:</span>
          {BRUSH_SIZES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setBrushSize(s)}
              className={`w-6 h-6 flex items-center justify-center rounded border text-[10px] ${brushSize === s ? 'bg-sig-500 text-white border-sig-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {s}
            </button>
          ))}
        </div>

        {tool === 'text' && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-1">Texto:</span>
            <select
              value={fontSize}
              onChange={e => setFontSize(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded px-1 py-0.5"
            >
              <option value={16}>16</option>
              <option value={24}>24</option>
              <option value={32}>32</option>
              <option value={48}>48</option>
            </select>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={undoStack.current.length === 0}
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30"
          >
            ↩ Deshacer
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStack.current.length === 0}
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30"
          >
            ↪ Rehacer
          </button>
        </div>
      </div>

      <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="touch-none w-full h-auto"
          style={{ maxHeight: '60vh', objectFit: 'contain' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {placingText && (
          <input
            ref={textInputRef}
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmText() } }}
            onBlur={confirmText}
            placeholder="Escribí el texto y presioná Enter..."
            className="absolute border-2 border-sig-500 rounded px-1 py-0.5 text-sm bg-white/90 shadow-lg outline-none"
            style={{ left: textInputPos.x / (canvasRef.current?.width ?? 1) * 100 + '%', top: textInputPos.y / (canvasRef.current?.height ?? 1) * 100 + '%' }}
          />
        )}
      </div>

      <p className="text-xs text-gray-400">
        {tool === 'draw' ? 'Dibujá sobre la imagen con el mouse o el dedo.' : 'Hacé clic en la imagen para colocar texto.'}
      </p>
    </div>
  )
}
