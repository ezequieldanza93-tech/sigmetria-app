'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult, Firma, FirmaEntidadTipo } from '@/lib/types'
import { FIRMA_ENTIDAD_LABELS } from '@/lib/types'

export async function generarPdfConFirmas(
  entidadTipo: FirmaEntidadTipo,
  entidadId: string
): Promise<ActionResult<{ pdfBase64: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Obtener firmas
  const { data: firmas } = await supabase
    .from('firmas')
    .select('*, profiles!firmante_usuario_id(full_name)')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('created_at', { ascending: true })

  if (!firmas || firmas.length === 0) {
    return { success: false, error: 'No hay firmas registradas' }
  }

  // Obtener nombre de la entidad
  let entidadNombre = ''
  if (entidadTipo === 'gestion') {
    const { data: ge } = await supabase
      .from('gestiones_establecimientos')
      .select('gestiones!inner(nombre)')
      .eq('id', entidadId)
      .single()
    if (ge) entidadNombre = (ge as unknown as { gestiones: { nombre: string } }).gestiones.nombre
  } else if (entidadTipo === 'capacitacion') {
    const { data: cap } = await supabase
      .from('capacitaciones')
      .select('titulo')
      .eq('id', entidadId)
      .single()
    if (cap) entidadNombre = (cap as { titulo: string }).titulo
  }

  // Obtener consultora
  const firmaList = firmas as unknown as (Firma & { profiles?: { full_name: string } | null })[]
  const consultoraId = firmaList[0].consultora_id
  const { data: consultora } = await supabase
    .from('consultoras')
    .select('nombre')
    .eq('id', consultoraId)
    .single()

  const consultoraNombre = (consultora as { nombre: string } | null)?.nombre ?? 'Sigmetría HyS'

  try {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ format: 'a4', unit: 'mm' })
    const pageW = 210
    const margin = 20
    let y = margin

    // Header
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Registro de Firmas', pageW / 2, y, { align: 'center' })
    y += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`${FIRMA_ENTIDAD_LABELS[entidadTipo]}: ${entidadNombre}`, margin, y)
    y += 6
    doc.text(`Consultora: ${consultoraNombre}`, margin, y)
    y += 6
    doc.text(`Total de firmas: ${firmaList.length}`, margin, y)
    y += 10

    // Línea separadora
    doc.setDrawColor(200)
    doc.line(margin, y, pageW - margin, y)
    y += 6

    // Cada firma
    for (let i = 0; i < firmaList.length; i++) {
      const f = firmaList[i]

      // Check if we need a new page
      if (y > 260) {
        doc.addPage()
        y = margin
      }

      // Número de firma
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`Firma #${i + 1}`, margin, y)
      y += 6

      // Datos
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')

      const fields: { label: string; value: string }[] = [
        { label: 'Nombre', value: f.nombre_completo },
        { label: 'DNI', value: f.dni },
        { label: 'Rol', value: f.rol ?? '—' },
        { label: 'Tipo', value: f.firmante_tipo === 'usuario_interno' ? 'Firma interna' : 'Firma de trabajador' },
        { label: 'Fecha y hora', value: new Date(f.created_at).toLocaleString('es-AR') },
      ]

      for (const field of fields) {
        doc.setFont('helvetica', 'bold')
        doc.text(`${field.label}:`, margin, y)
        const labelW = doc.getTextWidth(`${field.label}: `)
        doc.setFont('helvetica', 'normal')
        doc.text(field.value, margin + labelW + 1, y)
        y += 4.5
      }

      // Firma manuscrita
      if (f.firma_svg_data) {
        y += 2
        try {
          const imgData = f.firma_svg_data.replace(/^data:image\/\w+;base64,/, '')
          doc.addImage(imgData, 'PNG', margin, y, 50, 15)
          y += 20
        } catch {
          // Si falla la imagen, mostrar línea punteada
          y += 4
          doc.setDrawColor(150)
          doc.setLineDashPattern([2, 2], 0)
          doc.line(margin, y, margin + 60, y)
          doc.setLineDashPattern([], 0)
          y += 10
        }
      } else {
        y += 4
        doc.setDrawColor(150)
        doc.setLineDashPattern([2, 2], 0)
        doc.line(margin, y, margin + 60, y)
        doc.setLineDashPattern([], 0)
        y += 10
      }

      // Línea separadora entre firmas
      y += 2
      doc.setDrawColor(220)
      doc.setLineDashPattern([1, 3], 0)
      doc.line(margin, y, pageW - margin, y)
      doc.setLineDashPattern([], 0)
      y += 5
    }

    // Footer
    const now = new Date()
    const fechaGen = now.toLocaleString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(128)
    doc.text(`Documento generado por ${consultoraNombre} — ${fechaGen}`, pageW / 2, 290, { align: 'center' })

    // QR placeholder (Fase 2)
    // doc.addImage(qrData, 'PNG', pageW - margin - 20, 275, 15, 15)

    const pdfBase64 = doc.output('datauristring')
    return { success: true, data: { pdfBase64 } }
  } catch {
    return { success: false, error: 'Error al generar el PDF' }
  }
}
