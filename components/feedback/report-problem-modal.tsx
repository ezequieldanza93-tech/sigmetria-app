'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, ImagePlus, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { enviarReporteProblema } from '@/lib/actions/reporte-problema'

interface ReportProblemModalProps {
  open: boolean
  tipo: 'error' | 'idea'
  onClose: () => void
}

type Status = 'idle' | 'capturando' | 'enviando' | 'exito' | 'error'

export function ReportProblemModal({ open, tipo, onClose }: ReportProblemModalProps) {
  const [resumen, setResumen] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Controlar showModal()/close() via prop `open`
  // Al ser showModal() este dialog se vuelve el modal activo del top layer,
  // por encima de cualquier otro <dialog> (formulario) que esté abierto.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) {
        dialog.showModal()
      }
    } else {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [open])

  // Auto-captura de screenshot al abrir
  useEffect(() => {
    if (!open) return

    setStatus('capturando')
    setScreenshotDataUrl(null)

    import('html2canvas')
      .then((mod) => {
        const html2canvas = mod.default
        return html2canvas(document.body, {
          useCORS: true,
          scale: 0.5,
          imageTimeout: 2000,
          ignoreElements: (el) => {
            // Excluir el dialog del reporte y su contenido para que la captura
            // muestre la pantalla de atrás, no el formulario de reporte en sí.
            // El atributo data-sig-report-ui cubre el <dialog> raíz y todo su árbol.
            const htmlEl = el as HTMLElement
            if (
              htmlEl.hasAttribute('data-sig-report-ui') ||
              !!htmlEl.closest('[data-sig-report-ui]')
            )
              return true

            // Saltear mapas Leaflet — los tiles OSM son cross-origin sin CORS
            // y contaminan (taint) el canvas → toDataURL() lanza SecurityError
            const cl = htmlEl.classList
            if (
              cl &&
              (cl.contains('leaflet-container') ||
                cl.contains('leaflet-tile') ||
                cl.contains('leaflet-tile-container') ||
                cl.contains('leaflet-pane'))
            )
              return true
            return false
          },
          onclone: (clonedDoc) => {
            clonedDoc.body.style.zoom = '1'
            clonedDoc.documentElement.style.zoom = '1'
          },
        })
      })
      .then((canvas) => {
        setScreenshotDataUrl(canvas.toDataURL('image/png'))
        setStatus('idle')
      })
      .catch((err: unknown) => {
        // Logueamos para diagnóstico — la captura falla silenciosamente en
        // producción sin esto, lo que hace imposible rastrear la causa raíz
        console.warn('[ReportModal] screenshot capture failed:', err)

        // Registramos en el mismo array que captura errores JS globales
        try {
          const raw = localStorage.getItem('__sig_errors__')
          const existentes: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : []
          const entrada = {
            type: 'screenshot_capture_error',
            message: err instanceof Error ? err.message : String(err),
            timestamp: new Date().toISOString(),
          }
          // Máximo 50 entradas — rotamos desde el frente
          const actualizados = [...existentes, entrada].slice(-50)
          localStorage.setItem('__sig_errors__', JSON.stringify(actualizados))
        } catch {
          // localStorage puede fallar en modo privado u origin bloqueado — lo ignoramos
        }

        // Fallback graceful: el reporte se puede enviar sin screenshot
        setStatus('idle')
      })
  }, [open])

  // Pegar imagen con Ctrl/Cmd+V
  useEffect(() => {
    if (!open) return
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          const reader = new FileReader()
          reader.onload = (ev) => {
            setScreenshotDataUrl(ev.target?.result as string)
          }
          reader.readAsDataURL(file)
          break
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [open])

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setResumen('')
      setDescripcion('')
      setScreenshotDataUrl(null)
      setStatus('idle')
      setErrorMsg('')
    }
  }, [open])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setScreenshotDataUrl(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resumen.trim() || !descripcion.trim()) return

    setStatus('enviando')
    setErrorMsg('')

    // Auto-contexto — siempre incluimos __sig_errors__ (tipo 'error' o 'idea')
    // para que los errores de captura de screenshot queden visibles en cualquier reporte
    const erroresJs = (() => {
      try {
        const raw = localStorage.getItem('__sig_errors__')
        return raw ? JSON.parse(raw) : []
      } catch {
        return []
      }
    })()

    try {
      await enviarReporteProblema({
        tipo,
        resumen: resumen.trim(),
        descripcion: descripcion.trim(),
        screenshotDataUrl,
        contexto: {
          url: window.location.href,
          ruta: window.location.pathname,
          userAgent: navigator.userAgent,
          viewport: { w: window.innerWidth, h: window.innerHeight },
          consultoraId: null,
          consultoraNombre: null,
          erroresJs,
        },
      })

      setStatus('exito')
      toast.success('¡Gracias! Reporte enviado correctamente.')
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch {
      setStatus('error')
      setErrorMsg('Hubo un error al enviar el reporte. Tu texto está guardado — intentá de nuevo.')
    }
  }

  // Sincronizar cierre nativo del dialog (tecla Esc / dialog.close()) con la prop
  function handleDialogClose() {
    onClose()
  }

  const titulo = tipo === 'error' ? 'Informar de un problema' : 'Compartir una idea'
  const estaEnviando = status === 'enviando'
  const estaCapturando = status === 'capturando'

  return (
    /*
     * <dialog> nativo con showModal() — se convierte en el modal activo del
     * top layer y es interactivo por encima de cualquier otro <dialog> abierto.
     * data-sig-report-ui: html2canvas lo excluye para capturar la pantalla de atrás.
     * backdrop:bg-black/60: estiliza el ::backdrop nativo del showModal().
     */
    <dialog
      ref={dialogRef}
      data-sig-report-ui=""
      onClose={handleDialogClose}
      className="fixed inset-0 m-auto w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface-base border border-border-subtle rounded-2xl shadow-2xl p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      aria-label={titulo}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
        <h2 className="text-base font-semibold text-text-primary">
          {titulo}
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-subtle transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">

        {/* Resumen */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary" htmlFor="report-resumen">
            Resumen <span className="text-rose-500">*</span>
          </label>
          <input
            id="report-resumen"
            type="text"
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            maxLength={100}
            placeholder="Breve resumen"
            required
            disabled={estaEnviando || status === 'exito'}
            className="w-full rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 disabled:opacity-50"
          />
        </div>

        {/* Descripción */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary" htmlFor="report-descripcion">
            Descripción <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="report-descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Describí lo que esperabas frente a lo que viste, dónde estabas, qué deberíamos cambiar..."
            rows={6}
            required
            disabled={estaEnviando || status === 'exito'}
            className="w-full rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 resize-y disabled:opacity-50"
          />
        </div>

        {/* Screenshot */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text-secondary">Captura de pantalla</span>

          {estaCapturando && (
            <div className="flex items-center gap-2 text-sm text-text-tertiary">
              <Loader2 size={14} className="animate-spin" />
              Capturando pantalla...
            </div>
          )}

          {screenshotDataUrl && !estaCapturando && (
            <div className="relative w-fit">
              <img
                src={screenshotDataUrl}
                alt="Captura de pantalla"
                className="max-h-32 rounded-lg border border-border-subtle object-contain"
              />
              <button
                type="button"
                onClick={() => setScreenshotDataUrl(null)}
                className="absolute -top-2 -right-2 p-0.5 rounded-full bg-surface-base border border-border-subtle text-text-tertiary hover:text-text-primary transition-colors"
                aria-label="Quitar captura"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {!screenshotDataUrl && !estaCapturando && (
            <p className="text-xs text-text-tertiary">
              No se pudo capturar la pantalla automáticamente (puede haber mapas u otras imágenes que lo impiden).
              Pegá una captura con Ctrl/Cmd+V, adjuntala, o describí el problema en el texto.
            </p>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={estaEnviando || status === 'exito'}
            className="self-start flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary border border-border-subtle rounded-lg px-3 py-1.5 transition-colors hover:bg-surface-subtle disabled:opacity-50"
          >
            <ImagePlus size={13} />
            {screenshotDataUrl ? 'Reemplazar imagen' : 'Adjuntar imagen'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Error inline */}
        {status === 'error' && errorMsg && (
          <p className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-950/30 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}

        {/* Éxito inline */}
        {status === 'exito' && (
          <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2">
            ¡Gracias! Reporte enviado.
          </p>
        )}

        {/* Botones */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={estaEnviando}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={estaEnviando || estaCapturando || status === 'exito' || !resumen.trim() || !descripcion.trim()}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              tipo === 'error'
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {estaCapturando ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Capturando pantalla...
              </>
            ) : estaEnviando ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send size={15} />
                Enviar informe
              </>
            )}
          </button>
        </div>
      </form>
    </dialog>
  )
}
