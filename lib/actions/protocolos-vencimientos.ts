'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

// ============================================================
// Vencimientos de los protocolos de medición de un establecimiento
// ============================================================
// Junta los protocolos finalizados (no borrador) de las 5 tablas de medición y
// expone su fecha de medición + fecha de vencimiento (columna generada = anual).
// Se muestra en el Legajo Técnico (feedback 70e2d23e parte 2).

export interface ProtocoloVencimiento {
  id: string
  tipo: string
  fecha_medicion: string | null
  fecha_vencimiento: string | null
}

const FUENTES: { tabla: string; tipo: string; fechaCol: string }[] = [
  { tabla: 'medicion_ruido', tipo: 'Ruido', fechaCol: 'fecha_medicion' },
  { tabla: 'medicion_iluminacion', tipo: 'Iluminación', fechaCol: 'fecha_medicion' },
  { tabla: 'medicion_pat', tipo: 'Puesta a tierra', fechaCol: 'fecha_medicion' },
  { tabla: 'medicion_carga_termica', tipo: 'Carga térmica', fechaCol: 'fecha_medicion' },
  { tabla: 'ergonomia_evaluaciones', tipo: 'Ergonomía', fechaCol: 'fecha_evaluacion' },
]

export async function getProtocolosVencimientos(
  establecimientoId: string,
): Promise<ActionResult<ProtocoloVencimiento[]>> {
  const supabase = await createClient()

  const results = await Promise.all(
    FUENTES.map(async (f) => {
      const { data, error } = await supabase
        .from(f.tabla)
        .select(`id, ${f.fechaCol}, fecha_vencimiento, estado`)
        .eq('establecimiento_id', establecimientoId)
        .is('deleted_at', null)
        .neq('estado', 'borrador')
      if (error || !data) return [] as ProtocoloVencimiento[]
      return (data as unknown as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        tipo: f.tipo,
        fecha_medicion: (r[f.fechaCol] as string | null) ?? null,
        fecha_vencimiento: (r.fecha_vencimiento as string | null) ?? null,
      }))
    }),
  )

  const flat = results.flat()
  flat.sort((a, b) => (a.fecha_vencimiento ?? '').localeCompare(b.fecha_vencimiento ?? ''))
  return { success: true, data: flat }
}
