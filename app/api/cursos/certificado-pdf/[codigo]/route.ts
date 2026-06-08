import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// GET /api/cursos/certificado-pdf/[codigo]
// Genera el PDF del certificado server-side con jsPDF (sin DOM/html2canvas).
// emitirCertificado() ya apunta pdf_url acá, así que esto cierra ese gap.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params
  if (!codigo) {
    return NextResponse.json({ error: 'Código requerido' }, { status: 400 })
  }

  // Service-role: el certificado es accesible vía código de validación público.
  const admin = createAdminClient()

  const { data: cert } = await admin
    .from('cursos_certificados')
    .select(`
      codigo_validacion,
      fecha_emision,
      fecha_vencimiento,
      invalidado,
      curso_asignaciones!asignacion_id (
        cursos!curso_id (titulo),
        directorio_personas!persona_id (nombre, apellido)
      )
    `)
    .eq('codigo_validacion', codigo)
    .maybeSingle()

  if (!cert) {
    return NextResponse.json({ error: 'Certificado no encontrado' }, { status: 404 })
  }

  const asig = (cert as unknown as {
    curso_asignaciones: {
      cursos: { titulo: string } | null
      directorio_personas: { nombre: string; apellido: string } | null
    } | null
  }).curso_asignaciones

  const cursoTitulo = asig?.cursos?.titulo ?? 'Curso'
  const personaNombre = asig?.directorio_personas
    ? `${asig.directorio_personas.nombre} ${asig.directorio_personas.apellido}`
    : 'Participante'

  const fechaEmision = cert.fecha_emision
    ? new Date(cert.fecha_emision).toLocaleDateString('es-AR')
    : '—'
  const fechaVencimiento = cert.fecha_vencimiento
    ? new Date(cert.fecha_vencimiento).toLocaleDateString('es-AR')
    : null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hys-app-sig.vercel.app'
  const verifyUrl = `${appUrl}/verificar-certificado/${cert.codigo_validacion}`

  // --- Construcción del PDF (A4 landscape) ---
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth() // 297
  const pageH = doc.internal.pageSize.getHeight() // 210
  const cx = pageW / 2

  const navy = { r: 30, g: 37, b: 44 } // #1E252C (color de marca del logo)
  const gray = { r: 120, g: 120, b: 120 }

  // Marco doble
  doc.setDrawColor(navy.r, navy.g, navy.b)
  doc.setLineWidth(1.2)
  doc.rect(10, 10, pageW - 20, pageH - 20)
  doc.setLineWidth(0.3)
  doc.rect(14, 14, pageW - 28, pageH - 28)

  // Marca de agua invalidada
  if (cert.invalidado) {
    doc.setTextColor(220, 38, 38)
    doc.setFontSize(60)
    doc.setFont('helvetica', 'bold')
    doc.text('INVALIDADO', cx, pageH / 2, { align: 'center', angle: 20 })
    doc.setTextColor(0, 0, 0)
  }

  // Encabezado de marca
  doc.setTextColor(gray.r, gray.g, gray.b)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('SIGMETRIA HyS', cx, 34, { align: 'center' })

  // Título
  doc.setTextColor(navy.r, navy.g, navy.b)
  doc.setFontSize(30)
  doc.text('CERTIFICADO', cx, 52, { align: 'center' })

  // Subtítulo
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(80, 80, 80)
  doc.text('Se otorga el presente certificado a', cx, 70, { align: 'center' })

  // Nombre de la persona
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(37, 99, 235) // brand-primary aprox (#2563eb)
  doc.text(personaNombre, cx, 88, { align: 'center' })

  // Línea decorativa
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.4)
  doc.line(cx - 60, 94, cx + 60, 94)

  // Detalle del curso
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(80, 80, 80)
  doc.text('por haber completado satisfactoriamente el curso', cx, 106, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(navy.r, navy.g, navy.b)
  // Envolver el título por si es largo
  const tituloLines = doc.splitTextToSize(cursoTitulo, pageW - 80) as string[]
  doc.text(tituloLines, cx, 120, { align: 'center' })

  // Fechas
  const yFechas = 120 + tituloLines.length * 8 + 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(100, 100, 100)
  const fechaTexto = fechaVencimiento
    ? `Fecha de emisión: ${fechaEmision}      |      Válido hasta: ${fechaVencimiento}`
    : `Fecha de emisión: ${fechaEmision}`
  doc.text(fechaTexto, cx, Math.min(yFechas, pageH - 40), { align: 'center' })

  // Pie: código + URL de verificación
  doc.setFontSize(9)
  doc.setTextColor(130, 130, 130)
  doc.text(`Código de validación: ${cert.codigo_validacion}`, cx, pageH - 28, { align: 'center' })
  doc.text(`Verificá la autenticidad en: ${verifyUrl}`, cx, pageH - 22, { align: 'center' })

  const arrayBuffer = doc.output('arraybuffer') as ArrayBuffer
  const bytes = new Uint8Array(arrayBuffer)

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="certificado-${cert.codigo_validacion}.pdf"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
