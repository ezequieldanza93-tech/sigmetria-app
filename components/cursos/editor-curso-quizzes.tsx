'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { crearQuiz, eliminarQuiz, guardarPreguntasQuiz } from '@/lib/actions/curso'
import type { CursoModulo, CursoQuiz, CursoPregunta } from '@/lib/types'

interface EditorCursoQuizzesProps {
  cursoId: string
  modulos: CursoModulo[]
  quizFinal?: CursoQuiz | null
  onRefresh: () => void
}

export function EditorCursoQuizzes({ cursoId, modulos, quizFinal, onRefresh }: EditorCursoQuizzesProps) {
  const toast = useToast()
  const [editingQuiz, setEditingQuiz] = useState<string | null>(null)

  async function handleCrearQuiz(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('curso_id', cursoId)
    const res = await crearQuiz(null, fd)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Quiz creado')
    onRefresh()
  }

  async function handleEliminarQuiz(quizId: string) {
    if (!confirm('¿Eliminar este quiz? Se borrarán todas las preguntas asociadas.')) return
    const res = await eliminarQuiz(quizId)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Quiz eliminado')
    onRefresh()
  }

  const quizzes = [
    ...modulos.filter(m => m.quiz).map(m => ({ ...m.quiz!, modulo: m.titulo })),
    ...(quizFinal ? [{ ...quizFinal, modulo: 'Quiz final del curso' }] : []),
  ]

  return (
    <div className="space-y-6">
      {/* Crear quiz para módulo */}
      <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl">
        <h4 className="text-sm font-semibold text-text-primary mb-3">Nuevo quiz</h4>
        <form onSubmit={handleCrearQuiz} className="flex gap-2">
          <input
            name="titulo"
            placeholder="Título del quiz"
            required
            className="flex-1 px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
          <select
            name="modulo_id"
            className="px-3 py-2 rounded-lg border border-border-subtle bg-surface-base text-sm text-text-primary"
          >
            <option value="">Quiz final (sin módulo)</option>
            {modulos.map(m => (
              <option key={m.id} value={m.id}>Módulo: {m.titulo}</option>
            ))}
          </select>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors"
          >
            <Plus size={16} /> Crear
          </button>
        </form>
      </div>

      {/* Lista de quizzes */}
      {quizzes.length === 0 && (
        <p className="text-sm text-text-tertiary text-center py-8">No hay quizzes. Creá uno arriba.</p>
      )}

      <div className="space-y-4">
        {quizzes.map((quiz: any) => (
          <div key={quiz.id} className="bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
              <span className="text-sm font-semibold text-text-primary flex-1">{quiz.titulo}</span>
              <span className="text-xs text-text-tertiary">{quiz.modulo}</span>
              <button
                onClick={() => handleEliminarQuiz(quiz.id)}
                className="p-1 text-text-tertiary hover:text-danger transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="p-4">
              <p className="text-sm text-text-secondary mb-2">
                Aprobación: {quiz.porcentaje_aprobacion}% · Intentos: {quiz.max_intentos ?? 'Ilimitados'}
                · Preguntas: {quiz.preguntas?.length ?? 0}
              </p>
              <button
                onClick={() => setEditingQuiz(editingQuiz === quiz.id ? null : quiz.id)}
                className="text-sm text-brand-primary hover:underline"
              >
                {editingQuiz === quiz.id ? 'Cerrar editor' : 'Editar preguntas'}
              </button>

              {editingQuiz === quiz.id && (
                <EditorPreguntas quizId={quiz.id} preguntas={quiz.preguntas ?? []} onSave={onRefresh} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EditorPreguntas({ quizId, preguntas, onSave }: { quizId: string; preguntas: CursoPregunta[]; onSave: () => void }) {
  const toast = useToast()
  const [items, setItems] = useState<{
    enunciado: string
    tipo: 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_text'
    puntaje: number
    explicacion: string
    short_text_respuesta: string
    opciones: { texto: string; es_correcta: boolean }[]
  }[]>(
    preguntas.map(p => ({
      enunciado: p.enunciado,
      tipo: p.tipo,
      puntaje: Number(p.puntaje),
      explicacion: p.explicacion ?? '',
      short_text_respuesta: p.short_text_respuesta ?? '',
      opciones: p.opciones?.map(o => ({ texto: o.texto, es_correcta: o.es_correcta })) ?? [
        { texto: '', es_correcta: false },
      ],
    }))
  )

  function addPregunta() {
    setItems(prev => [...prev, {
      enunciado: '',
      tipo: 'multiple_choice',
      puntaje: 1,
      explicacion: '',
      short_text_respuesta: '',
      opciones: [{ texto: 'Opción 1', es_correcta: false }, { texto: 'Opción 2', es_correcta: true }, { texto: 'Opción 3', es_correcta: false }, { texto: 'Opción 4', es_correcta: false }],
    }])
  }

  function updatePregunta(idx: number, field: string, value: any) {
    setItems(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function updateOpcion(pIdx: number, oIdx: number, field: string, value: any) {
    setItems(prev => prev.map((p, i) => {
      if (i !== pIdx) return p
      const opciones = p.opciones.map((o, j) => j === oIdx ? { ...o, [field]: value } : o)
      // If multiple_choice and setting this as correct, unset others
      if (field === 'es_correcta' && value === true && p.tipo === 'multiple_choice') {
        opciones.forEach((o, j) => { if (j !== oIdx) o.es_correcta = false })
      }
      return { ...p, opciones }
    }))
  }

  function addOpcion(pIdx: number) {
    setItems(prev => prev.map((p, i) => i === pIdx ? { ...p, opciones: [...p.opciones, { texto: '', es_correcta: false }] } : p))
  }

  function removeOpcion(pIdx: number, oIdx: number) {
    setItems(prev => prev.map((p, i) => i === pIdx ? { ...p, opciones: p.opciones.filter((_, j) => j !== oIdx) } : p))
  }

  async function handleSave() {
    const res = await guardarPreguntasQuiz(quizId, items.map((p, _idx) => ({
      ...p,
      puntaje: Number(p.puntaje),
    })))
    if (!res.success) { toast.error(res.error); return }
    toast.success('Preguntas guardadas')
    onSave()
  }

  return (
    <div className="mt-4 space-y-4">
      {items.map((p, idx) => (
        <div key={idx} className="p-4 bg-surface-base border border-border-subtle rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-tertiary">#{idx + 1}</span>
            <input
              placeholder="Enunciado de la pregunta"
              value={p.enunciado}
              onChange={e => updatePregunta(idx, 'enunciado', e.target.value)}
              className="flex-1 px-2 py-1.5 text-sm rounded border border-border-subtle bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
            <select
              value={p.tipo}
              onChange={e => updatePregunta(idx, 'tipo', e.target.value)}
              className="px-2 py-1.5 text-sm rounded border border-border-subtle bg-surface-base"
            >
              <option value="multiple_choice">Multiple choice</option>
              <option value="multiple_select">Selección múltiple</option>
              <option value="true_false">Verdadero/Falso</option>
              <option value="short_text">Respuesta corta</option>
            </select>
            <input
              type="number"
              value={p.puntaje}
              onChange={e => updatePregunta(idx, 'puntaje', parseFloat(e.target.value))}
              className="w-16 px-2 py-1.5 text-sm rounded border border-border-subtle bg-surface-base text-center"
              placeholder="Pts"
            />
          </div>

          {/* Opciones */}
          {(p.tipo === 'multiple_choice' || p.tipo === 'multiple_select') && (
            <div className="ml-4 space-y-2">
              {p.opciones.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type={p.tipo === 'multiple_choice' ? 'radio' : 'checkbox'}
                    name={`correcta-${idx}`}
                    checked={o.es_correcta}
                    onChange={() => updateOpcion(idx, oi, 'es_correcta', !o.es_correcta)}
                    className="accent-brand-primary"
                  />
                  <input
                    placeholder={`Opción ${oi + 1}`}
                    value={o.texto}
                    onChange={e => updateOpcion(idx, oi, 'texto', e.target.value)}
                    className="flex-1 px-2 py-1 text-sm rounded border border-border-subtle bg-surface-base text-text-primary focus:outline-none"
                  />
                  <button onClick={() => removeOpcion(idx, oi)} className="p-1 text-text-tertiary hover:text-danger"><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={() => addOpcion(idx)} className="text-xs text-brand-primary hover:underline">+ Agregar opción</button>
            </div>
          )}

          {p.tipo === 'true_false' && (
            <div className="ml-4 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`tf-${idx}`}
                  checked={p.opciones?.[0]?.es_correcta === true}
                  onChange={() => { updateOpcion(idx, 0, 'es_correcta', true); updateOpcion(idx, 1, 'es_correcta', false) }}
                  className="accent-brand-primary"
                />
                Verdadero
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`tf-${idx}`}
                  checked={p.opciones?.[1]?.es_correcta === true}
                  onChange={() => { updateOpcion(idx, 0, 'es_correcta', false); updateOpcion(idx, 1, 'es_correcta', true) }}
                  className="accent-brand-primary"
                />
                Falso
              </label>
            </div>
          )}

          {p.tipo === 'short_text' && (
            <div className="ml-4">
              <label className="text-xs text-text-tertiary">Respuesta correcta (case-insensitive)</label>
              <input
                value={p.short_text_respuesta}
                onChange={e => updatePregunta(idx, 'short_text_respuesta', e.target.value)}
                className="w-full px-2 py-1 text-sm rounded border border-border-subtle bg-surface-base text-text-primary mt-1"
              />
            </div>
          )}

          <div className="ml-4">
            <label className="text-xs text-text-tertiary">Explicación (opcional)</label>
            <input
              value={p.explicacion}
              onChange={e => updatePregunta(idx, 'explicacion', e.target.value)}
              className="w-full px-2 py-1 text-sm rounded border border-border-subtle bg-surface-base text-text-primary mt-1"
            />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button onClick={addPregunta} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border-subtle rounded-lg hover:bg-surface-sunken transition-colors">
          <Plus size={16} /> Agregar pregunta
        </button>
        <button onClick={handleSave} className="px-6 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors">
          Guardar preguntas
        </button>
      </div>
    </div>
  )
}
