import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

// UTF-8 BOM para compatibilidad con Excel
const BOM = '﻿'

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return BOM + '\n'
  const headers = Object.keys(rows[0])
  const escape = (v: unknown): string => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ]
  return BOM + lines.join('\r\n')
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ empresa_id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { empresa_id } = await params

  // Verificación de acceso (doble capa: RLS + función explícita)
  const { data: hasAccess } = await supabase.rpc('has_empresa_read_access', {
    p_empresa_id: empresa_id,
  })
  if (!hasAccess) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  // Establecimientos de la empresa (necesario para filtrar tablas child)
  const { data: establecimientos } = await supabase
    .from('establecimientos')
    .select('id')
    .eq('empresa_id', empresa_id)

  const establecimientoIds = (establecimientos ?? []).map(e => e.id)

  // ── Fetches en paralelo ──────────────────────────────────────────────────
  const [
    empresaRes,
    incidentesRes,
    inspeccionesRes,
    capacitacionesRes,
    asistentesRes,
    riesgosRes,
    medicionesRes,
    personasRes,
    empresaDocsRes,
    establecimientoDocsRes,
  ] = await Promise.all([
    supabase
      .from('empresas')
      .select('nombre, cuit, actividad_principal, localidad_id, provincia_id, direccion, telefono, email, created_at')
      .eq('id', empresa_id)
      .single(),

    establecimientoIds.length
      ? supabase
          .from('incidentes')
          .select('id, establecimiento_id, fecha_ocurrencia, tipo, estado, descripcion, dias_perdidos, created_at')
          .in('establecimiento_id', establecimientoIds)
      : Promise.resolve({ data: [] }),

    establecimientoIds.length
      ? supabase
          .from('inspecciones')
          .select('id, establecimiento_id, fecha, tipo, resultado, observaciones, inspector, created_at')
          .in('establecimiento_id', establecimientoIds)
      : Promise.resolve({ data: [] }),

    supabase
      .from('capacitaciones')
      .select('id, empresa_id, establecimiento_id, fecha, tema, modalidad, duracion_horas, instructor_nombre, created_at')
      .eq('empresa_id', empresa_id),

    supabase
      .from('capacitaciones_asistentes')
      .select('id, capacitacion_id, persona_id, asistio, created_at')
      .in(
        'capacitacion_id',
        // placeholder — se filtra en post si hay resultados
        ['00000000-0000-0000-0000-000000000000']
      ),

    establecimientoIds.length
      ? supabase
          .from('riesgos')
          .select('id, establecimiento_id, descripcion, probabilidad, severidad, nivel_riesgo, responsable, created_at')
          .in('establecimiento_id', establecimientoIds)
      : Promise.resolve({ data: [] }),

    establecimientoIds.length
      ? supabase
          .from('mediciones')
          .select('id, establecimiento_id, tipo, valor, unidad, fecha, resultado, observaciones, created_at')
          .in('establecimiento_id', establecimientoIds)
      : Promise.resolve({ data: [] }),

    supabase
      .from('personas_directorio')
      .select('id, nombre, apellido, dni, email, telefono, tipo_persona, created_at')
      .eq('empresa_id', empresa_id),

    supabase
      .from('empresas_documentos')
      .select('id, nombre, tipo, fecha_vencimiento, url, created_at')
      .eq('empresa_id', empresa_id),

    establecimientoIds.length
      ? supabase
          .from('establecimientos_documentos')
          .select('id, establecimiento_id, nombre, tipo, fecha_vencimiento, url, created_at')
          .in('establecimiento_id', establecimientoIds)
      : Promise.resolve({ data: [] }),
  ])

  // Fetch de asistentes usando capacitaciones reales
  const capacitacionIds = (capacitacionesRes.data ?? []).map(c => c.id)
  let asistentesData: Record<string, unknown>[] = []
  if (capacitacionIds.length) {
    const { data } = await supabase
      .from('capacitaciones_asistentes')
      .select('id, capacitacion_id, persona_id, asistio, created_at')
      .in('capacitacion_id', capacitacionIds)
    asistentesData = (data ?? []) as Record<string, unknown>[]
  }

  void asistentesRes // usado para tipado, resultado real viene del fetch secuencial

  // ── ZIP ──────────────────────────────────────────────────────────────────
  const zip = new JSZip()
  const empresa = empresaRes.data

  if (empresa) {
    zip.file('empresa.csv', toCSV([empresa as Record<string, unknown>]))
  }

  zip.file('incidentes.csv', toCSV((incidentesRes.data ?? []) as Record<string, unknown>[]))
  zip.file('inspecciones.csv', toCSV((inspeccionesRes.data ?? []) as Record<string, unknown>[]))
  zip.file('capacitaciones.csv', toCSV((capacitacionesRes.data ?? []) as Record<string, unknown>[]))
  zip.file('capacitaciones_asistentes.csv', toCSV(asistentesData))
  zip.file('riesgos.csv', toCSV((riesgosRes.data ?? []) as Record<string, unknown>[]))
  zip.file('mediciones.csv', toCSV((medicionesRes.data ?? []) as Record<string, unknown>[]))
  zip.file('personas.csv', toCSV((personasRes.data ?? []) as Record<string, unknown>[]))
  zip.file('documentos_empresa.csv', toCSV((empresaDocsRes.data ?? []) as Record<string, unknown>[]))
  zip.file('documentos_establecimientos.csv', toCSV((establecimientoDocsRes.data ?? []) as Record<string, unknown>[]))

  const zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })

  const nombreEmpresa = empresa
    ? (empresa as { nombre?: string }).nombre?.replace(/[^a-zA-Z0-9_-]/g, '_') ?? 'empresa'
    : 'empresa'
  const fecha = new Date().toISOString().slice(0, 10)
  const filename = `sigmetria_export_${nombreEmpresa}_${fecha}.zip`

  return new Response(zipBuffer.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
