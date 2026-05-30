'use client'

// IMPORTANTE: este archivo SOLO debe ser importado vía `next/dynamic` con
// `ssr: false` desde photo-canvas-editor.tsx. No importarlo directamente —
// react-konva no soporta SSR. Si cada shape se importa con dynamic por
// separado, react-konva 19 monta el Stage antes de que sus hijos estén
// resueltos y el canvas queda en blanco.

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Stage, Layer, Image as KonvaImage, Line, Rect, Circle, Arrow, Text as KonvaText, Group, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'

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

const BRUSH_SIZES = [4, 8, 12, 16] as const
const TEXT_SIZES = [24, 36, 48, 60] as const
const DEFAULT_COLOR = '#000000'
const DEFAULT_BRUSH = 8
const DEFAULT_TEXT_SIZE = 48

type Tool = 'select' | 'pen' | 'text' | 'rect' | 'circle' | 'arrow' | 'observacion'

interface ObservacionCategoria {
  id: string
  nombre: string
  nivel: number
  color: string
}

type DrawObject =
  | { type: 'pen'; id: string; points: number[]; stroke: string; strokeWidth: number }
  | { type: 'rect'; id: string; x: number; y: number; width: number; height: number; stroke: string; strokeWidth: number; rotation?: number }
  | { type: 'circle'; id: string; x: number; y: number; radius: number; stroke: string; strokeWidth: number }
  | { type: 'arrow'; id: string; points: [number, number, number, number]; stroke: string; strokeWidth: number }
  | { type: 'text'; id: string; x: number; y: number; text: string; fontSize: number; fill: string; background: string | null; rotation?: number }

export interface PhotoCanvasEditorProps {
  imageUrl: string
  onImageChange?: (blob: Blob) => void
  /** Si está activo, expone el botón "Escribir observación" con picker de categoría. */
  enableObservacionTool?: boolean
  /** Lista de categorías para el picker (si no se pasa, el editor las carga vacías). */
  categorias?: ObservacionCategoria[]
  /** Callback cuando el usuario crea una observación desde el editor. */
  onObservacionAdded?: (descripcion: string, categoriaId: string) => void
}

function genId(): string {
  return `obj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export default function PhotoCanvasEditorInner({
  imageUrl,
  onImageChange,
  enableObservacionTool = false,
  categorias = [],
  onObservacionAdded,
}: PhotoCanvasEditorProps) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const transformerRef = useRef<Konva.Transformer | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const layerRef = useRef<Konva.Layer | null>(null)

  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })

  const [objects, setObjects] = useState<DrawObject[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [strokeWidth, setStrokeWidth] = useState<number>(DEFAULT_BRUSH)
  const [fontSize, setFontSize] = useState<number>(DEFAULT_TEXT_SIZE)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [isDrawing, setIsDrawing] = useState(false)
  const [placingText, setPlacingText] = useState<{ x: number; y: number } | null>(null)
  const [textInput, setTextInput] = useState('')

  // Picker de categoría (Escribir observación)
  const [pickingObsCat, setPickingObsCat] = useState(false)
  const [obsDescripcion, setObsDescripcion] = useState('')
  const [obsCatId, setObsCatId] = useState<string | null>(null)
  const [obsPos, setObsPos] = useState<{ x: number; y: number } | null>(null)

  const undoStack = useRef<DrawObject[][]>([])
  const redoStack = useRef<DrawObject[][]>([])

  const pushHistory = useCallback((next: DrawObject[]) => {
    undoStack.current.push(objects)
    redoStack.current = []
    if (undoStack.current.length > 50) undoStack.current.shift()
    setObjects(next)
  }, [objects])

  function undo() {
    if (undoStack.current.length === 0) return
    redoStack.current.push(objects)
    const prev = undoStack.current.pop()!
    setObjects(prev)
    setSelectedId(null)
  }

  function redo() {
    if (redoStack.current.length === 0) return
    undoStack.current.push(objects)
    const next = redoStack.current.pop()!
    setObjects(next)
    setSelectedId(null)
  }

  // Cargar imagen
  useEffect(() => {
    const img = new window.Image()
    // Solo activar CORS para URLs HTTP(S) externas; blob:/data: URLs no lo soportan
    if (/^https?:\/\//i.test(imageUrl)) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      setImage(img)
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.src = imageUrl
  }, [imageUrl])

  // Calcular tamaño del stage en función del contenedor (responsive).
  // Usamos ResizeObserver porque el editor vive dentro de un Modal: el div
  // contenedor puede tener clientWidth=0 en el primer paint (animación de
  // apertura, layout pendiente), y entonces el Stage nunca se monta porque
  // dependemos de stageSize.width > 0 para renderizarlo.
  useEffect(() => {
    if (!image) return
    const el = containerRef.current
    if (!el) return
    function update(width: number) {
      if (!image || width <= 0) return
      const aspect = image.naturalHeight / image.naturalWidth
      const maxHeight = Math.floor(window.innerHeight * 0.6)
      let w = width
      let h = w * aspect
      if (h > maxHeight) {
        h = maxHeight
        w = h / aspect
      }
      setStageSize({ width: Math.floor(w), height: Math.floor(h) })
    }
    update(el.clientWidth)
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        update(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [image])

  // Adjuntar/desadjuntar transformer al objeto seleccionado
  useEffect(() => {
    const transformer = transformerRef.current
    const stage = stageRef.current
    if (!transformer || !stage) return
    if (!selectedId) {
      transformer.nodes([])
      transformer.getLayer()?.batchDraw()
      return
    }
    const node = stage.findOne(`#${selectedId}`)
    if (node) {
      transformer.nodes([node])
      transformer.getLayer()?.batchDraw()
    } else {
      transformer.nodes([])
    }
  }, [selectedId, objects])

  // Export automático cada vez que cambian los objetos
  const exportRef = useRef<number | null>(null)
  useEffect(() => {
    if (!onImageChange || !image || stageSize.width === 0) return
    if (exportRef.current) window.clearTimeout(exportRef.current)
    exportRef.current = window.setTimeout(() => {
      exportBlob().then(blob => { if (blob) onImageChange(blob) })
    }, 500)
    return () => { if (exportRef.current) window.clearTimeout(exportRef.current) }
    // exportBlob es estable a nivel de identidad de cierre (no se referencia desde el array)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, image, stageSize, onImageChange])

  async function exportBlob(): Promise<Blob | null> {
    const stage = stageRef.current
    if (!stage || !image) return null
    // Deseleccionar antes de exportar para que no aparezca el transformer
    transformerRef.current?.nodes([])
    transformerRef.current?.getLayer()?.batchDraw()
    // Renderizar a tamaño natural de la imagen para máxima calidad
    const pixelRatio = naturalSize.width / stageSize.width
    return new Promise(resolve => {
      stage.toBlob({
        mimeType: 'image/png',
        pixelRatio,
        callback: (blob: Blob | null) => {
          // Restaurar selección
          if (selectedId) {
            const node = stage.findOne(`#${selectedId}`)
            if (node && transformerRef.current) {
              transformerRef.current.nodes([node])
              transformerRef.current.getLayer()?.batchDraw()
            }
          }
          resolve(blob)
        },
      })
    })
  }

  function getPointer() {
    const stage = stageRef.current
    return stage?.getPointerPosition() ?? null
  }

  function handleStageMouseDown(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    // Click en área vacía del stage o sobre la imagen → deseleccionar
    const target = e.target
    const isOnEmpty = target === e.target.getStage() || target.attrs.name === 'background-image'
    if (tool === 'select') {
      if (isOnEmpty) setSelectedId(null)
      return
    }
    const pos = getPointer()
    if (!pos) return

    if (tool === 'pen') {
      const id = genId()
      pushHistory([
        ...objects,
        { type: 'pen', id, points: [pos.x, pos.y], stroke: color, strokeWidth },
      ])
      setSelectedId(null)
      setIsDrawing(true)
    } else if (tool === 'rect') {
      const id = genId()
      pushHistory([
        ...objects,
        { type: 'rect', id, x: pos.x, y: pos.y, width: 1, height: 1, stroke: color, strokeWidth },
      ])
      setSelectedId(id)
      setIsDrawing(true)
    } else if (tool === 'circle') {
      const id = genId()
      pushHistory([
        ...objects,
        { type: 'circle', id, x: pos.x, y: pos.y, radius: 1, stroke: color, strokeWidth },
      ])
      setSelectedId(id)
      setIsDrawing(true)
    } else if (tool === 'arrow') {
      const id = genId()
      pushHistory([
        ...objects,
        { type: 'arrow', id, points: [pos.x, pos.y, pos.x, pos.y], stroke: color, strokeWidth },
      ])
      setSelectedId(id)
      setIsDrawing(true)
    } else if (tool === 'text') {
      setPlacingText({ x: pos.x, y: pos.y })
      setTextInput('')
    } else if (tool === 'observacion' && enableObservacionTool) {
      setObsPos({ x: pos.x, y: pos.y })
      setPickingObsCat(true)
    }
  }

  function handleStageMouseMove() {
    if (!isDrawing) return
    const pos = getPointer()
    if (!pos) return

    setObjects(prev => {
      const last = prev[prev.length - 1]
      if (!last) return prev
      const updated = [...prev]
      if (last.type === 'pen') {
        updated[updated.length - 1] = { ...last, points: [...last.points, pos.x, pos.y] }
      } else if (last.type === 'rect') {
        updated[updated.length - 1] = { ...last, width: pos.x - last.x, height: pos.y - last.y }
      } else if (last.type === 'circle') {
        const dx = pos.x - last.x
        const dy = pos.y - last.y
        updated[updated.length - 1] = { ...last, radius: Math.sqrt(dx * dx + dy * dy) }
      } else if (last.type === 'arrow') {
        updated[updated.length - 1] = { ...last, points: [last.points[0], last.points[1], pos.x, pos.y] }
      }
      return updated
    })
  }

  function handleStageMouseUp() {
    if (!isDrawing) return
    setIsDrawing(false)
    // Normalizar rect (width/height negativos) y descartar objetos demasiado chicos
    setObjects(prev => {
      const last = prev[prev.length - 1]
      if (!last) return prev
      const updated = [...prev]
      if (last.type === 'rect') {
        let { x, y, width, height } = last
        if (width < 0) { x = x + width; width = -width }
        if (height < 0) { y = y + height; height = -height }
        if (width < 4 || height < 4) return prev.slice(0, -1)
        updated[updated.length - 1] = { ...last, x, y, width, height }
      } else if (last.type === 'circle' && last.radius < 3) {
        return prev.slice(0, -1)
      } else if (last.type === 'arrow') {
        const [x1, y1, x2, y2] = last.points
        if (Math.abs(x2 - x1) < 3 && Math.abs(y2 - y1) < 3) return prev.slice(0, -1)
      }
      return updated
    })
    // Volver a select para permitir edición inmediata
    if (tool !== 'pen') setTool('select')
  }

  function confirmText() {
    if (!placingText) return
    const txt = textInput.trim()
    if (!txt) { setPlacingText(null); return }
    const id = genId()
    pushHistory([
      ...objects,
      { type: 'text', id, x: placingText.x, y: placingText.y, text: txt, fontSize, fill: color, background: null },
    ])
    setPlacingText(null)
    setTextInput('')
    setSelectedId(id)
    setTool('select')
  }

  function confirmObservacion() {
    const txt = obsDescripcion.trim()
    if (!txt || !obsCatId || !obsPos) { closeObsPicker(); return }
    const categoria = categorias.find(c => c.id === obsCatId)
    if (!categoria) { closeObsPicker(); return }
    const id = genId()
    pushHistory([
      ...objects,
      {
        type: 'text',
        id,
        x: obsPos.x,
        y: obsPos.y,
        text: txt,
        fontSize,
        fill: '#000000',
        background: categoria.color,
      },
    ])
    onObservacionAdded?.(txt, obsCatId)
    closeObsPicker()
    setTool('select')
    setSelectedId(id)
  }

  function closeObsPicker() {
    setPickingObsCat(false)
    setObsDescripcion('')
    setObsCatId(null)
    setObsPos(null)
  }

  function deleteSelected() {
    if (!selectedId) return
    pushHistory(objects.filter(o => o.id !== selectedId))
    setSelectedId(null)
  }

  function updateSelectedColor(newColor: string) {
    setColor(newColor)
    if (!selectedId) return
    const next = objects.map(o => {
      if (o.id !== selectedId) return o
      if (o.type === 'text') return { ...o, fill: newColor }
      return { ...o, stroke: newColor }
    })
    pushHistory(next)
  }

  function updateSelectedStrokeWidth(w: number) {
    setStrokeWidth(w)
    if (!selectedId) return
    const next = objects.map(o => {
      if (o.id !== selectedId) return o
      if (o.type === 'text') return o
      return { ...o, strokeWidth: w }
    })
    pushHistory(next)
  }

  function updateSelectedFontSize(fs: number) {
    setFontSize(fs)
    if (!selectedId) return
    const next = objects.map(o => o.id === selectedId && o.type === 'text' ? { ...o, fontSize: fs } : o)
    pushHistory(next)
  }

  function handleObjectTransform(id: string, attrs: Partial<DrawObject>) {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...attrs } as DrawObject : o))
  }

  const selectedObject = useMemo(() => objects.find(o => o.id === selectedId) ?? null, [objects, selectedId])
  const selectedIsText = selectedObject?.type === 'text'

  // UI helpers
  const toolBtn = (key: Tool, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => { setTool(key); setSelectedId(null) }}
      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
        tool === key ? 'bg-sig-500 text-white border-sig-500' : 'border-border-subtle text-text-secondary hover:bg-surface-base'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 mr-2">
          <span className="text-xs text-text-secondary mr-1">Herramienta:</span>
          {toolBtn('select', 'Seleccionar')}
          {toolBtn('pen', 'Lápiz')}
          {toolBtn('text', 'Texto')}
          {toolBtn('rect', '▢ Cuadrado')}
          {toolBtn('circle', '○ Círculo')}
          {toolBtn('arrow', '→ Flecha')}
          {enableObservacionTool && toolBtn('observacion', '📝 Escribir observación')}
        </div>

        <div className="flex items-center gap-1 mr-2">
          <span className="text-xs text-text-secondary mr-1">Color:</span>
          {COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => updateSelectedColor(c.value)}
              className={`w-5 h-5 rounded-full border-2 ${color === c.value ? 'border-gray-800 scale-125' : 'border-border-subtle'} transition-transform`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        {(tool === 'pen' || tool === 'rect' || tool === 'circle' || tool === 'arrow' || (selectedObject && !selectedIsText)) && (
          <div className="flex items-center gap-1 mr-2">
            <span className="text-xs text-text-secondary mr-1">Grosor:</span>
            {BRUSH_SIZES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => updateSelectedStrokeWidth(s)}
                className={`w-7 h-6 flex items-center justify-center rounded border text-[11px] ${strokeWidth === s ? 'bg-sig-500 text-white border-sig-500' : 'border-border-subtle text-text-secondary hover:bg-surface-base'}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {(tool === 'text' || tool === 'observacion' || selectedIsText) && (
          <div className="flex items-center gap-1 mr-2">
            <span className="text-xs text-text-secondary mr-1">Texto:</span>
            {TEXT_SIZES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => updateSelectedFontSize(s)}
                className={`px-2 h-6 flex items-center justify-center rounded border text-[11px] ${fontSize === s ? 'bg-sig-500 text-white border-sig-500' : 'border-border-subtle text-text-secondary hover:bg-surface-base'}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {selectedId && (
            <button
              type="button"
              onClick={deleteSelected}
              className="px-2 py-1 text-xs border border-red-200 rounded-lg text-danger hover:bg-danger-bg"
            >
              🗑 Eliminar
            </button>
          )}
          <button
            type="button"
            onClick={undo}
            disabled={undoStack.current.length === 0}
            className="px-2 py-1 text-xs border border-border-subtle rounded-lg text-text-secondary hover:bg-surface-base disabled:opacity-30"
          >
            ↩ Deshacer
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStack.current.length === 0}
            className="px-2 py-1 text-xs border border-border-subtle rounded-lg text-text-secondary hover:bg-surface-base disabled:opacity-30"
          >
            ↪ Rehacer
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative border border-border-default rounded-lg overflow-hidden bg-surface-base touch-none">
        {image && stageSize.width > 0 && (
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onTouchStart={handleStageMouseDown}
            onTouchMove={handleStageMouseMove}
            onTouchEnd={handleStageMouseUp}
          >
            <Layer ref={layerRef}>
              <KonvaImage
                image={image}
                width={stageSize.width}
                height={stageSize.height}
                name="background-image"
                listening={tool === 'select'}
              />
              {objects.map(obj => {
                if (obj.type === 'pen') {
                  return (
                    <Line
                      key={obj.id}
                      id={obj.id}
                      points={obj.points}
                      stroke={obj.stroke}
                      strokeWidth={obj.strokeWidth}
                      tension={0.3}
                      lineCap="round"
                      lineJoin="round"
                      draggable={tool === 'select'}
                      onClick={() => tool === 'select' && setSelectedId(obj.id)}
                      onTap={() => tool === 'select' && setSelectedId(obj.id)}
                      onDragEnd={e => {
                        const node = e.target
                        const dx = node.x()
                        const dy = node.y()
                        node.position({ x: 0, y: 0 })
                        const newPoints = obj.points.map((p, i) => i % 2 === 0 ? p + dx : p + dy)
                        handleObjectTransform(obj.id, { points: newPoints })
                      }}
                    />
                  )
                }
                if (obj.type === 'rect') {
                  return (
                    <Rect
                      key={obj.id}
                      id={obj.id}
                      x={obj.x}
                      y={obj.y}
                      width={obj.width}
                      height={obj.height}
                      stroke={obj.stroke}
                      strokeWidth={obj.strokeWidth}
                      rotation={obj.rotation ?? 0}
                      draggable={tool === 'select'}
                      onClick={() => tool === 'select' && setSelectedId(obj.id)}
                      onTap={() => tool === 'select' && setSelectedId(obj.id)}
                      onDragEnd={e => handleObjectTransform(obj.id, { x: e.target.x(), y: e.target.y() })}
                      onTransformEnd={e => {
                        const node = e.target as Konva.Rect
                        const scaleX = node.scaleX()
                        const scaleY = node.scaleY()
                        node.scaleX(1); node.scaleY(1)
                        handleObjectTransform(obj.id, {
                          x: node.x(),
                          y: node.y(),
                          width: Math.max(4, node.width() * scaleX),
                          height: Math.max(4, node.height() * scaleY),
                          rotation: node.rotation(),
                        })
                      }}
                    />
                  )
                }
                if (obj.type === 'circle') {
                  return (
                    <Circle
                      key={obj.id}
                      id={obj.id}
                      x={obj.x}
                      y={obj.y}
                      radius={obj.radius}
                      stroke={obj.stroke}
                      strokeWidth={obj.strokeWidth}
                      draggable={tool === 'select'}
                      onClick={() => tool === 'select' && setSelectedId(obj.id)}
                      onTap={() => tool === 'select' && setSelectedId(obj.id)}
                      onDragEnd={e => handleObjectTransform(obj.id, { x: e.target.x(), y: e.target.y() })}
                      onTransformEnd={e => {
                        const node = e.target as Konva.Circle
                        const scale = Math.max(node.scaleX(), node.scaleY())
                        node.scaleX(1); node.scaleY(1)
                        handleObjectTransform(obj.id, {
                          x: node.x(),
                          y: node.y(),
                          radius: Math.max(3, obj.radius * scale),
                        })
                      }}
                    />
                  )
                }
                if (obj.type === 'arrow') {
                  return (
                    <Arrow
                      key={obj.id}
                      id={obj.id}
                      points={obj.points as unknown as number[]}
                      stroke={obj.stroke}
                      fill={obj.stroke}
                      strokeWidth={obj.strokeWidth}
                      pointerLength={obj.strokeWidth * 2.5}
                      pointerWidth={obj.strokeWidth * 2.5}
                      draggable={tool === 'select'}
                      onClick={() => tool === 'select' && setSelectedId(obj.id)}
                      onTap={() => tool === 'select' && setSelectedId(obj.id)}
                      onDragEnd={e => {
                        const node = e.target
                        const dx = node.x()
                        const dy = node.y()
                        node.position({ x: 0, y: 0 })
                        const [x1, y1, x2, y2] = obj.points
                        handleObjectTransform(obj.id, { points: [x1 + dx, y1 + dy, x2 + dx, y2 + dy] })
                      }}
                    />
                  )
                }
                if (obj.type === 'text') {
                  const padding = Math.max(4, obj.fontSize * 0.2)
                  return (
                    <Group
                      key={obj.id}
                      id={obj.id}
                      x={obj.x}
                      y={obj.y}
                      rotation={obj.rotation ?? 0}
                      draggable={tool === 'select'}
                      onClick={() => tool === 'select' && setSelectedId(obj.id)}
                      onTap={() => tool === 'select' && setSelectedId(obj.id)}
                      onDragEnd={e => handleObjectTransform(obj.id, { x: e.target.x(), y: e.target.y() })}
                      onTransformEnd={e => {
                        const node = e.target as Konva.Group
                        const scale = Math.max(node.scaleX(), node.scaleY())
                        node.scaleX(1); node.scaleY(1)
                        handleObjectTransform(obj.id, {
                          x: node.x(),
                          y: node.y(),
                          fontSize: Math.max(12, obj.fontSize * scale),
                          rotation: node.rotation(),
                        })
                      }}
                    >
                      {obj.background && (
                        <Rect
                          x={-padding}
                          y={-padding}
                          width={obj.text.length * obj.fontSize * 0.55 + padding * 2}
                          height={obj.fontSize * 1.2 + padding * 2}
                          fill={obj.background}
                          cornerRadius={4}
                        />
                      )}
                      <KonvaText
                        text={obj.text}
                        fontSize={obj.fontSize}
                        fill={obj.fill}
                        fontFamily="sans-serif"
                      />
                    </Group>
                  )
                }
                return null
              })}
              <Transformer
                ref={transformerRef}
                rotateEnabled
                anchorSize={14}
                borderStroke="#3b82f6"
                anchorStroke="#3b82f6"
                anchorFill="#ffffff"
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 8 || newBox.height < 8) return oldBox
                  return newBox
                }}
              />
            </Layer>
          </Stage>
        )}

        {/* Modal de input de texto */}
        {placingText && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
            <div className="bg-surface-base rounded-lg shadow-lg p-4 w-[90%] max-w-md space-y-3">
              <h4 className="text-sm font-semibold text-text-secondary">Escribir texto</h4>
              <input
                autoFocus
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmText() } }}
                placeholder="Texto…"
                className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setPlacingText(null); setTextInput('') }} className="px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-elevated rounded-lg">
                  Cancelar
                </button>
                <button type="button" onClick={confirmText} className="px-3 py-1.5 text-xs bg-sig-500 text-white rounded-lg hover:bg-sig-600">
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Picker de categoría para Escribir observación */}
        {pickingObsCat && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <div className="bg-surface-base rounded-lg shadow-lg p-4 w-[90%] max-w-md space-y-3 max-h-[90%] overflow-y-auto">
              <h4 className="text-sm font-semibold text-text-secondary">Escribir observación</h4>

              <div>
                <label className="text-xs text-text-secondary block mb-1">Categoría</label>
                <div className="grid grid-cols-1 gap-1">
                  {categorias.length === 0 ? (
                    <p className="text-xs text-text-tertiary">No hay categorías cargadas.</p>
                  ) : categorias.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setObsCatId(cat.id)}
                      className={`flex items-center gap-2 text-left px-3 py-2 rounded-lg border text-sm ${
                        obsCatId === cat.id ? 'border-sig-500 bg-sig-50' : 'border-border-subtle hover:bg-surface-base'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded border border-border-default"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span>{cat.nombre}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-text-secondary block mb-1">Descripción</label>
                <textarea
                  value={obsDescripcion}
                  onChange={e => setObsDescripcion(e.target.value)}
                  rows={3}
                  placeholder="Describí la observación…"
                  className="w-full border border-border-default rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeObsPicker} className="px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-elevated rounded-lg">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmObservacion}
                  disabled={!obsDescripcion.trim() || !obsCatId}
                  className="px-3 py-1.5 text-xs bg-sig-500 text-white rounded-lg hover:bg-sig-600 disabled:opacity-40"
                >
                  Agregar observación
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-text-tertiary">
        {tool === 'select' && 'Tocá un objeto para seleccionarlo. Usá los handles para mover, redimensionar o rotar.'}
        {tool === 'pen' && 'Dibujá libremente con el mouse o el dedo.'}
        {tool === 'text' && 'Tocá la imagen para colocar texto.'}
        {tool === 'rect' && 'Arrastrá para dibujar un cuadrado (contorno).'}
        {tool === 'circle' && 'Arrastrá para dibujar un círculo (contorno).'}
        {tool === 'arrow' && 'Arrastrá desde el inicio hasta la punta de la flecha.'}
        {tool === 'observacion' && 'Tocá la imagen donde querés ubicar la observación.'}
      </p>
    </div>
  )
}
