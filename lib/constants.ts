import type {
  TipoEstablecimiento,
  IncidenteTipo,
  IncidenteEstado,
  InspeccionEstado,
  RiesgoNivel,
  MedicionTipo,
  DocumentoTipo,
  CapacitacionEstado,
  TipoRelacionLaboral,
  TipoPersonaIncidente,
  InspeccionEstadoVisual,
} from './types'

export const SECTORES_PREDEFINIDOS = [
  'Administración',
  'Supply Chain (SCM)',
  'Project Management (PM)',
  'Jefatura de Proyectos',
  'Recepción',
  'Tesorería',
  'Higiene y Seguridad',
  'Dirección',
  'Producción 1',
  'Producción 2',
  'Producción 3',
] as const

export const TIPO_ESTABLECIMIENTO_LABELS: Record<TipoEstablecimiento, string> = {
  industria: 'Industria',
  agro: 'Agro',
  construccion: 'Construcción',
  comercio: 'Comercio',
  administrativo: 'Administrativo',
  logistica: 'Logística',
  centro_salud: 'Centro de Salud',
  otro: 'Otros tipos',
  obra_construccion: 'Obra de Construcción',
  local_comercial: 'Local Comercial',
  local_administrativo: 'Local Administrativo',
}

export const TIPO_ESTABLECIMIENTO_OPTIONS: { value: TipoEstablecimiento; label: string }[] = [
  { value: 'industria', label: 'Industria' },
  { value: 'agro', label: 'Agro' },
  { value: 'construccion', label: 'Construcción' },
  { value: 'comercio', label: 'Comercio' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'logistica', label: 'Logística' },
  { value: 'centro_salud', label: 'Centro de Salud' },
  { value: 'otro', label: 'Otros tipos' },
]

export const INCIDENTE_TIPO_LABELS: Record<IncidenteTipo, string> = {
  incidente: 'Incidente',
  accidente_leve: 'Accidente Leve',
  accidente_moderado: 'Accidente Moderado',
  accidente_grave: 'Accidente Grave',
}

export const INCIDENTE_TIPO_OPTIONS: { value: IncidenteTipo; label: string }[] = [
  { value: 'incidente', label: 'Incidente' },
  { value: 'accidente_leve', label: 'Accidente Leve' },
  { value: 'accidente_moderado', label: 'Accidente Moderado' },
  { value: 'accidente_grave', label: 'Accidente Grave' },
]

export const INCIDENTE_ESTADO_LABELS: Record<IncidenteEstado, string> = {
  pendiente: 'Pendiente',
  en_investigacion: 'En Investigación',
  cerrado: 'Cerrado',
}

export const INCIDENTE_ESTADO_OPTIONS: { value: IncidenteEstado; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_investigacion', label: 'En Investigación' },
  { value: 'cerrado', label: 'Cerrado' },
]

export const INSPECCION_ESTADO_LABELS: Record<InspeccionEstado, string> = {
  programada: 'Programada',
  realizada: 'Realizada',
  con_observaciones: 'Con Observaciones',
  cancelada: 'Cancelada',
}

export const INSPECCION_ESTADO_OPTIONS: { value: InspeccionEstado; label: string }[] = [
  { value: 'programada', label: 'Programada' },
  { value: 'realizada', label: 'Realizada' },
  { value: 'con_observaciones', label: 'Con Observaciones' },
  { value: 'cancelada', label: 'Cancelada' },
]

export const CAPACITACION_ESTADO_OPTIONS: { value: CapacitacionEstado; label: string }[] = [
  { value: 'programada', label: 'Programada' },
  { value: 'realizada', label: 'Realizada' },
  { value: 'cancelada', label: 'Cancelada' },
]

export const RIESGO_NIVEL_LABELS: Record<RiesgoNivel, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  critico: 'Crítico',
}

export const RIESGO_NIVEL_OPTIONS: { value: RiesgoNivel; label: string }[] = [
  { value: 'bajo', label: 'Bajo' },
  { value: 'medio', label: 'Medio' },
  { value: 'alto', label: 'Alto' },
  { value: 'critico', label: 'Crítico' },
]

export const MEDICION_TIPO_LABELS: Record<MedicionTipo, string> = {
  ruido: 'Ruido',
  iluminacion: 'Iluminación',
  temperatura: 'Temperatura',
  humedad: 'Humedad',
  vibraciones: 'Vibraciones',
  gases: 'Gases',
  polvo: 'Polvo',
  otro: 'Otro',
}

export const DOCUMENTO_TIPO_LABELS: Record<DocumentoTipo, string> = {
  habilitacion: 'Habilitación',
  seguro: 'Seguro',
  certificado: 'Certificado',
  procedimiento: 'Procedimiento',
  instructivo: 'Instructivo',
  otro: 'Otro',
}

export const DOCUMENTO_TIPO_OPTIONS: { value: DocumentoTipo; label: string }[] = [
  { value: 'habilitacion', label: 'Habilitación' },
  { value: 'seguro', label: 'Seguro' },
  { value: 'certificado', label: 'Certificado' },
  { value: 'procedimiento', label: 'Procedimiento' },
  { value: 'instructivo', label: 'Instructivo' },
  { value: 'otro', label: 'Otro' },
]

export const USER_ROLE_OPTIONS = [
  { value: 'full_access_main', label: 'Admin Principal' },
  { value: 'full_access_branch', label: 'Admin Branch' },
  { value: 'colaborador', label: 'Colaborador' },
  { value: 'full_viewer', label: 'Viewer Global' },
  { value: 'colaborador_viewer', label: 'Viewer Limitado' },
  { value: 'visualizador_comentarista', label: 'Visualizador Comentarista' },
  { value: 'responsable_estandares', label: 'Resp. de Estándares' },
] as const

export const ROLE_DESCRIPTIONS: Partial<Record<string, string>> = {
  responsable_estandares: 'Acceso de lectura total + módulo de reportes y cumplimiento normativo (Art. 5 SRT 48/2025)',
}

export type WidgetKey =
  | 'empresas_activas'
  | 'establecimientos'
  | 'trabajadores'
  | 'incidentes_mes'
  | 'incidentes_acumulados'
  | 'documentos_vencer_7d'
  | 'documentos_vencer_15d'
  | 'documentos_vencer_30d'
  | 'inspecciones_pendientes'
  | 'capacitaciones_vencidas'
  | 'capacitaciones_proximas'
  | 'mediciones_pendientes'
  | 'epp_vencidos'
  | 'tasa_incidentalidad'

export interface WidgetDefinition {
  key: WidgetKey
  label: string
  icon: string
  description: string
}

export const ALL_WIDGETS: Record<WidgetKey, WidgetDefinition> = {
  empresas_activas: { key: 'empresas_activas', label: 'Empresas Activas', icon: 'Building2', description: 'Empresas activas habilitadas' },
  establecimientos: { key: 'establecimientos', label: 'Establecimientos', icon: 'MapPin', description: 'Total de establecimientos' },
  trabajadores: { key: 'trabajadores', label: 'Trabajadores', icon: 'Users', description: 'Suma total de trabajadores registrados' },
  incidentes_mes: { key: 'incidentes_mes', label: 'Incidentes del Mes', icon: 'AlertTriangle', description: 'Incidentes ocurridos en el mes actual' },
  incidentes_acumulados: { key: 'incidentes_acumulados', label: 'Incidentes Acumulados', icon: 'AlertOctagon', description: 'Incidentes acumulados en el año' },
  documentos_vencer_7d: { key: 'documentos_vencer_7d', label: 'Docs por Vencer (7d)', icon: 'FileText', description: 'Documentos que vencen en los próximos 7 días' },
  documentos_vencer_15d: { key: 'documentos_vencer_15d', label: 'Docs por Vencer (15d)', icon: 'FileText', description: 'Documentos que vencen en los próximos 15 días' },
  documentos_vencer_30d: { key: 'documentos_vencer_30d', label: 'Docs por Vencer (30d)', icon: 'FileText', description: 'Documentos que vencen en los próximos 30 días' },
  inspecciones_pendientes: { key: 'inspecciones_pendientes', label: 'Inspecciones Pendientes', icon: 'ClipboardCheck', description: 'Inspecciones en estado programado' },
  capacitaciones_vencidas: { key: 'capacitaciones_vencidas', label: 'Capacitaciones Vencidas', icon: 'CalendarX', description: 'Capacitaciones vencidas y no realizadas' },
  capacitaciones_proximas: { key: 'capacitaciones_proximas', label: 'Capacitaciones Próximas', icon: 'CalendarCheck', description: 'Capacitaciones a vencer en 30 días' },
  mediciones_pendientes: { key: 'mediciones_pendientes', label: 'Mediciones Pendientes', icon: 'Activity', description: 'Mediciones ambientales registradas en el año' },
  epp_vencidos: { key: 'epp_vencidos', label: 'EPP por Puesto', icon: 'Shield', description: 'Elementos de protección personal por puesto' },
  tasa_incidentalidad: { key: 'tasa_incidentalidad', label: 'Tasa de Incidentalidad', icon: 'Percent', description: 'Porcentaje de incidentes sobre trabajadores' },
}

export const WIDGET_KEYS = Object.keys(ALL_WIDGETS) as WidgetKey[]

// ---- IPERC ----
export const IPERC_FACTORES = [
  'Ambiental', 'Biológico', 'Ergonómico', 'Físico',
  'Locativo', 'Mecánico', 'Psicosocial', 'Químico',
] as const

export const IPERC_RIESGO_TIPOS = [
  'Accidente', 'Enfermedad Profesional', 'Daños Materiales',
] as const

export const IPERC_PROBABILIDADES: { nivel: string; valor: number }[] = [
  { nivel: 'Muy Improbable', valor: 1 },
  { nivel: 'Improbable', valor: 2 },
  { nivel: 'Moderada', valor: 3 },
  { nivel: 'Probable', valor: 4 },
  { nivel: 'Muy Probable', valor: 5 },
]

export const IPERC_CONSECUENCIAS: { nivel: string; valor: number }[] = [
  { nivel: 'Daño Leve', valor: 1 },
  { nivel: 'Daño Moderado', valor: 2 },
  { nivel: 'Daño Grave', valor: 3 },
  { nivel: 'Daño Muy Grave', valor: 4 },
  { nivel: 'Daño Fatal', valor: 5 },
]

export const IPERC_NIVELES_RIESGO = [
  { nombre: 'Riesgo Trivial', min: 1, max: 4, valor_ref: 5, color: '#22c55e', acciones: 'Concientización. No requiere implementar métodos de prevención y control sin perjuicio de que se realicen monitoreos.' },
  { nombre: 'Riesgo Tolerable', min: 5, max: 9, valor_ref: 10, color: '#eab308', acciones: 'Monitoreo y control para mantener el riesgo o impacto por lo menos en este nivel, sin perjuicio de que se puedan implementar medidas para reducirlos al nivel inferior.' },
  { nombre: 'Riesgo Moderado', min: 10, max: 14, valor_ref: 15, color: '#f97316', acciones: 'Monitoreo y control reforzado para garantizar que el riesgo o impacto no aumente. Se pueden requerir medidas adicionales de prevención, capacitación específica y, en ciertos casos, permisos de trabajo.' },
  { nombre: 'Riesgo Importante', min: 15, max: 19, valor_ref: 20, color: '#ef4444', acciones: 'Restricción de Tareas. No se permite la operación en esta condición y se deben tomar en forma inmediata las medidas necesarias de prevención y control adicionales para reducir el riesgo o impacto a un Nivel de Riesgo por lo menos Moderado.' },
  { nombre: 'Riesgo Intolerable', min: 20, max: 25, valor_ref: 25, color: '#7f1d1d', acciones: 'Prohibición de Tareas. Se encuentra prohibida en su totalidad la operación en esta condición y se deben realizar en forma inmediata acciones para reducir el riesgo o impacto a un Nivel de Riesgo por lo menos Moderado.' },
]

export const PROVINCIAS_AR = [
  'Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Ciudad Autónoma de Buenos Aires',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
] as const

export const TIPO_RELACION_LABORAL_LABELS: Record<TipoRelacionLaboral, string> = {
  permanente: 'Permanente',
  temporal: 'Temporal',
  contratista: 'Contratista',
  pasante: 'Pasante',
}

export const TIPO_PERSONA_INCIDENTE_LABELS: Record<TipoPersonaIncidente, string> = {
  trabajador_interno: 'Trabajador interno',
  trabajador_externo: 'Trabajador externo',
}

export const INSPECCION_ESTADO_VISUAL_LABELS: Record<InspeccionEstadoVisual, string> = {
  verde: 'Sin observaciones',
  amarillo: 'Observaciones parcialmente resueltas',
  rojo: 'Observaciones abiertas',
}

export const INSPECCION_ESTADO_VISUAL_COLORS: Record<InspeccionEstadoVisual, string> = {
  verde: 'text-green-600 bg-green-50',
  amarillo: 'text-yellow-600 bg-yellow-50',
  rojo: 'text-red-600 bg-red-50',
}

export const ENTES_REGULADORES_SUGERIDOS = [
  'Ministerio de Trabajo',
  'Superintendencia de Riesgos del Trabajo (SRT)',
  'Gobierno de la Ciudad de Buenos Aires (GCBA)',
  'Municipalidad',
  'Instituto de Estadística y Registro de la Industria de la Construcción (IERIC)',
  'Unión Obrajera de la República Argentina (UOCRA)',
  'Administración Federal de Ingresos Públicos (AFIP)',
  'Secretaría de Ambiente',
  'RENATEA',
] as const
