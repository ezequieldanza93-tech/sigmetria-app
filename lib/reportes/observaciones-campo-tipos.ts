/**
 * Tipos compartidos del Reporte de Observaciones + helper de resumen.
 *
 * Vive en un módulo NEUTRO (sin 'use server' / 'use client') para que lo importen
 * tanto la server action como el componente cliente. Un archivo 'use server' solo
 * puede exportar funciones async (Next lo obliga), así que el helper síncrono
 * `construirResumenObservaciones` —que el cliente necesita para recalcular el
 * resumen al filtrar— vive acá.
 */

export type EstadoObservacion = 'Planificado' | 'Vencido' | 'Cerrado'

export interface ReporteObsCampoItem {
  id: string
  descripcion: string
  /** Severidad: "Acción inmediata crítica/alta/media" | "Oportunidades de mejora". */
  categoriaNombre: string | null
  /** 1 (oportunidad) … 4 (crítica). Para ordenar y colorear. */
  categoriaNivel: number | null
  /** Color hex de la categoría (de observaciones_categorias.color). */
  categoriaColor: string | null
  /** Tipo de riesgo (observaciones_clasificaciones), opcional. */
  clasificacionNombre: string | null
  /** Responsable de subsanar ("Apellido, Nombre"). */
  responsable: string | null
  /** Plazo de corrección (gestiones_observaciones.fecha_planificada). */
  fechaPlazo: string
  /** Fecha real de la recorrida (gestiones_registros.fecha_ejecutada). */
  fechaEjecutada: string | null
  estado: EstadoObservacion
  fechaCierre: string | null
  responsableCierre: string | null
  sectorNombre: string | null
  puestoNombre: string | null
  gestionNombre: string | null
  /** Nombre del establecimiento (clave en reportes a nivel empresa). */
  establecimientoNombre: string | null
  /** Quién relevó/ejecutó la recorrida ("Apellido, Nombre"). */
  relevadoPor: string | null
  /** PATH (no URL) de la foto con marcas en bucket `documentos`. El cliente lo firma. */
  fotoPath: string | null
  /** PATH (no URL) de la evidencia de cierre en bucket `documentos`. El cliente lo firma. */
  evidenciaCierrePath: string | null
}

export interface ReporteObsCampoResumen {
  total: number
  /** Conteo por tipo/severidad, ordenado crítica → oportunidad. */
  porTipo: { nombre: string; nivel: number; count: number }[]
  /** Conteo por estado. */
  porEstado: Record<EstadoObservacion, number>
  /** Conteo por responsable, ordenado descendente. */
  porResponsable: { nombre: string; count: number }[]
}

export interface ReporteObsCampoEncabezado {
  cliente: string
  establecimiento: string
  profesional: string
  /** DD/MM/YYYY. */
  fechaEmision: string
}

export interface ReporteObsCampoData {
  encabezado: ReporteObsCampoEncabezado
  items: ReporteObsCampoItem[]
  resumen: ReporteObsCampoResumen
}

/** Resumen agregado por tipo / estado / responsable (sobre los items ya filtrados). */
export function construirResumenObservaciones(items: ReporteObsCampoItem[]): ReporteObsCampoResumen {
  const porTipoMap = new Map<number, { nombre: string; nivel: number; count: number }>()
  const porEstado: Record<EstadoObservacion, number> = { Planificado: 0, Vencido: 0, Cerrado: 0 }
  const porResponsableMap = new Map<string, number>()

  for (const it of items) {
    if (it.categoriaNivel != null) {
      const prev = porTipoMap.get(it.categoriaNivel)
      if (prev) prev.count++
      else porTipoMap.set(it.categoriaNivel, { nombre: it.categoriaNombre ?? `Nivel ${it.categoriaNivel}`, nivel: it.categoriaNivel, count: 1 })
    }
    porEstado[it.estado]++
    const resp = it.responsable ?? 'Sin asignar'
    porResponsableMap.set(resp, (porResponsableMap.get(resp) ?? 0) + 1)
  }

  return {
    total: items.length,
    porTipo: Array.from(porTipoMap.values()).sort((a, b) => b.nivel - a.nivel),
    porEstado,
    porResponsable: Array.from(porResponsableMap.entries())
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre)),
  }
}
