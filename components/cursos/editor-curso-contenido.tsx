'use client'

import React, { useState } from 'react'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, FileText, Video, File, Code, Edit, Save, X, Upload, Eye } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { crearModulo, eliminarModulo, crearLeccion, eliminarLeccion, actualizarLeccion, subirMaterialLeccion } from '@/lib/actions/curso'
import type { CursoModulo, CursoLeccion } from '@/lib/types'

interface EditorCursoContenidoProps {
  cursoId: string
  modulos: CursoModulo[]
  onRefresh: () => void
}

const tipoIcon = { video: Video, pdf: File, texto: FileText, embed: Code }
const tipoLabels: Record<string, string> = { video: 'Video', pdf: 'PDF', texto: 'Texto', embed: 'Embed' }

// ============================================================
// Panel de edición de contenido de una lección
// ============================================================

interface PanelEdicionLeccionProps {
  leccion: CursoLeccion
  onClose: () => void
  onSaved: () => void
}

function PanelEdicionLeccion({ leccion, onClose, onSaved }: PanelEdicionLeccionProps) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [embedText, setEmbedText] = useState(leccion.contenido_texto ?? '')
  const [showPreview, setShowPreview] = useState(false)
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>(leccion.contenido_url ? 'url' : 'file')

  async function handleGuardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    try {
      const form = e.currentTarget
      const fd = new FormData(form)

      // modulo_id es requerido por el schema de actualizarLeccion
      fd.set('modulo_id', leccion.modulo_id)
      fd.set('titulo', leccion.titulo)
      fd.set('tipo', leccion.tipo)

      // Para embed, el embedText viene del state (controlado)
      if (leccion.tipo === 'embed') {
        fd.set('contenido_texto', embedText)
      }

      const res = await actualizarLeccion(leccion.id, null, fd)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Contenido guardado')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  async function handleSubirPDF(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const res = await subirMaterialLeccion(leccion.id, fd)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('PDF subido correctamente')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 p-4 bg-surface-sunken border border-border-subtle rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
          Editar contenido — {tipoLabels[leccion.tipo]}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-text-tertiary hover:text-text-secondary transition-colors"
          title="Cerrar"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleGuardar} className="space-y-4">
        {/* ---- VIDEO ---- */}
        {leccion.tipo === 'video' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              URL del video (YouTube, Vimeo, etc.)
            </label>
            <input
              name="contenido_url"
              type="url"
              defaultValue={leccion.contenido_url ?? ''}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
        )}

        {/* ---- PDF ---- */}
        {leccion.tipo === 'pdf' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUploadMode('file')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${uploadMode === 'file' ? 'bg-brand-primary text-white' : 'bg-surface-base border border-border-subtle text-text-secondary hover:text-text-primary'}`}
              >
                <Upload size={12} className="inline mr-1" />
                Subir archivo
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('url')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${uploadMode === 'url' ? 'bg-brand-primary text-white' : 'bg-surface-base border border-border-subtle text-text-secondary hover:text-text-primary'}`}
              >
                URL externa
              </button>
            </div>

            {uploadMode === 'file' ? (
              <div className="space-y-2">
                {leccion.contenido_url && (
                  <p className="text-xs text-text-tertiary flex items-center gap-1">
                    <File size={12} />
                    Archivo guardado — podés reemplazarlo subiendo uno nuevo
                  </p>
                )}
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleSubirPDF}
                  disabled={saving}
                  className="block w-full text-sm text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20 cursor-pointer"
                />
                <p className="text-xs text-text-tertiary">El archivo se guarda automáticamente al seleccionarlo.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-secondary">URL del PDF externo</label>
                <input
                  name="contenido_url"
                  type="url"
                  defaultValue={leccion.contenido_url ?? ''}
                  placeholder="https://ejemplo.com/documento.pdf"
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            )}
          </div>
        )}

        {/* ---- EMBED ---- */}
        {leccion.tipo === 'embed' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Código embed (iframe, etc.)
              </label>
              <textarea
                value={embedText}
                onChange={(e) => { setEmbedText(e.target.value); setShowPreview(false) }}
                placeholder='<iframe src="..." width="560" height="315" ...></iframe>'
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
              />
            </div>
            {embedText.trim() && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowPreview(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-brand-primary hover:text-brand-primary/80 transition-colors"
                >
                  <Eye size={13} />
                  {showPreview ? 'Ocultar vista previa' : 'Ver vista previa'}
                </button>
                {showPreview && (
                  <div
                    className="rounded-lg overflow-hidden border border-border-subtle bg-surface-base"
                    dangerouslySetInnerHTML={{ __html: embedText }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ---- TEXTO ---- */}
        {leccion.tipo === 'texto' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Contenido de texto</label>
            <textarea
              name="contenido_texto"
              defaultValue={leccion.contenido_texto ?? ''}
              placeholder="Escribí el contenido de esta lección..."
              rows={8}
              className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-y"
            />
          </div>
        )}

        {/* ---- Campos comunes ---- */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-tertiary">Duración (minutos) — opcional</label>
            <input
              name="duracion_minutos"
              type="number"
              min={0}
              defaultValue={leccion.duracion_minutos ?? ''}
              placeholder="0"
              className="w-full px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
          <div className="flex flex-col gap-3 justify-center pt-4">
            {leccion.tipo === 'pdf' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  name="descargable"
                  type="checkbox"
                  value="true"
                  defaultChecked={leccion.descargable ?? false}
                  className="w-4 h-4 rounded border-border-subtle text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-sm text-text-secondary">Descargable</span>
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                name="anti_skip"
                type="checkbox"
                value="true"
                defaultChecked={leccion.anti_skip ?? false}
                className="w-4 h-4 rounded border-border-subtle text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-sm text-text-secondary">Anti-skip</span>
            </label>
          </div>
        </div>

        {/* Solo mostrar botón Guardar cuando NO es PDF en modo file (ese se guarda automáticamente) */}
        {!(leccion.tipo === 'pdf' && uploadMode === 'file') && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save size={14} />
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

// ============================================================
// Componente principal
// ============================================================

export function EditorCursoContenido({ cursoId, modulos, onRefresh }: EditorCursoContenidoProps) {
  const toast = useToast()
  const [expanded, setExpanded] = useState<Set<string>>(new Set(modulos.map(m => m.id)))
  const [selectedLeccion, setSelectedLeccion] = useState<string | null>(null)

  async function handleCrearModulo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('curso_id', cursoId)
    const res = await crearModulo(null, fd)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Módulo creado')
    onRefresh()
    form.reset()
  }

  async function handleEliminarModulo(moduloId: string) {
    if (!confirm('¿Eliminar este módulo y todo su contenido?')) return
    const res = await eliminarModulo(moduloId)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Módulo eliminado')
    onRefresh()
  }

  async function handleCrearLeccion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('modulo_id', form.dataset.moduloId!)
    const res = await crearLeccion(null, fd)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Lección creada')
    onRefresh()
    form.reset()
  }

  async function handleEliminarLeccion(leccionId: string) {
    if (!confirm('¿Eliminar esta lección?')) return
    const res = await eliminarLeccion(leccionId)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Lección eliminada')
    if (selectedLeccion === leccionId) setSelectedLeccion(null)
    onRefresh()
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const toggleLeccionEdit = (leccionId: string) => {
    setSelectedLeccion(prev => prev === leccionId ? null : leccionId)
  }

  return (
    <div className="space-y-6">
      {/* Crear módulo */}
      <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl">
        <h4 className="text-sm font-semibold text-text-primary mb-3">Nuevo módulo</h4>
        <form onSubmit={handleCrearModulo} className="flex gap-2">
          <input
            name="titulo"
            placeholder="Título del módulo"
            required
            className="flex-1 px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors"
          >
            <Plus size={16} /> Agregar
          </button>
        </form>
      </div>

      {/* Lista de módulos */}
      {modulos.length === 0 && (
        <p className="text-sm text-text-tertiary text-center py-8">No hay módulos. Creá el primero arriba.</p>
      )}

      <div className="space-y-4">
        {modulos.map((modulo) => (
          <div key={modulo.id} className="bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden">
            {/* Módulo header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle bg-surface-sunken/50">
              <button onClick={() => toggleExpand(modulo.id)} className="text-text-tertiary hover:text-text-secondary">
                {expanded.has(modulo.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <GripVertical size={16} className="text-text-tertiary/50 cursor-grab" />
              <span className="text-sm font-semibold text-text-primary flex-1">{modulo.titulo}</span>
              <button
                onClick={() => handleEliminarModulo(modulo.id)}
                className="p-1 text-text-tertiary hover:text-danger transition-colors"
                title="Eliminar módulo"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {expanded.has(modulo.id) && (
              <div className="p-4 space-y-3">
                {/* Lecciones existentes */}
                {modulo.lecciones?.map((leccion, idx) => (
                  <div key={leccion.id}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-surface-base rounded-lg border border-border-subtle">
                      <span className="text-text-tertiary">
                        {React.createElement(tipoIcon[leccion.tipo] || FileText, { size: 16 })}
                      </span>
                      <span className="flex-1 text-sm text-text-primary">{idx + 1}. {leccion.titulo}</span>
                      <span className="text-xs text-text-tertiary">{tipoLabels[leccion.tipo]}</span>
                      {/* Indicador de contenido cargado */}
                      {(leccion.contenido_url || leccion.contenido_texto) && (
                        <span className="w-2 h-2 rounded-full bg-brand-primary/60" title="Tiene contenido" />
                      )}
                      <button
                        onClick={() => toggleLeccionEdit(leccion.id)}
                        className={`p-1 transition-colors ${selectedLeccion === leccion.id ? 'text-brand-primary' : 'text-text-tertiary hover:text-brand-primary'}`}
                        title="Editar contenido"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleEliminarLeccion(leccion.id)}
                        className="p-1 text-text-tertiary hover:text-danger transition-colors"
                        title="Eliminar lección"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Panel de edición inline */}
                    {selectedLeccion === leccion.id && (
                      <PanelEdicionLeccion
                        leccion={leccion}
                        onClose={() => setSelectedLeccion(null)}
                        onSaved={() => { setSelectedLeccion(null); onRefresh() }}
                      />
                    )}
                  </div>
                ))}

                {/* Crear lección form */}
                <form onSubmit={handleCrearLeccion} data-modulo-id={modulo.id} className="flex gap-2 pt-2">
                  <input
                    name="titulo"
                    placeholder="Título de la lección"
                    required
                    className="flex-1 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  <select
                    name="tipo"
                    className="px-2 py-1.5 rounded-lg border border-border-subtle bg-surface-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value="video">Video</option>
                    <option value="pdf">PDF</option>
                    <option value="texto">Texto</option>
                    <option value="embed">Embed</option>
                  </select>
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3 py-1.5 bg-brand-primary text-white rounded-lg text-sm hover:bg-brand-primary/90 transition-colors"
                  >
                    <Plus size={14} /> Agregar
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
