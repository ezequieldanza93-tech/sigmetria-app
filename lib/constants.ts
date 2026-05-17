import type {
  TipoEstablecimiento,
  SiniestroTipo,
  SiniestroEstado,
  InspeccionEstado,
  RiesgoNivel,
  MedicionTipo,
  DocumentoTipo,
  CapacitacionEstado,
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

export const SINIESTRO_TIPO_LABELS: Record<SiniestroTipo, string> = {
  accidente: 'Accidente',
  incidente: 'Incidente',
  casi_accidente: 'Casi Accidente',
  enfermedad_profesional: 'Enfermedad Profesional',
}

export const SINIESTRO_TIPO_OPTIONS: { value: SiniestroTipo; label: string }[] = [
  { value: 'accidente', label: 'Accidente' },
  { value: 'incidente', label: 'Incidente' },
  { value: 'casi_accidente', label: 'Casi Accidente' },
  { value: 'enfermedad_profesional', label: 'Enfermedad Profesional' },
]

export const SINIESTRO_ESTADO_LABELS: Record<SiniestroEstado, string> = {
  pendiente: 'Pendiente',
  en_investigacion: 'En Investigación',
  cerrado: 'Cerrado',
}

export const SINIESTRO_ESTADO_OPTIONS: { value: SiniestroEstado; label: string }[] = [
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
] as const

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
