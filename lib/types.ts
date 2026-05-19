export type SystemRole = 'developer' | 'user'
export type UserRole =
  | 'full_access_main'
  | 'full_access_branch'
  | 'colaborador'
  | 'full_viewer'
  | 'colaborador_viewer'

export type TipoEstablecimiento =
  | 'industria'
  | 'agro'
  | 'construccion'
  | 'comercio'
  | 'administrativo'
  | 'logistica'
  | 'centro_salud'
  | 'otro'
  | 'obra_construccion'
  | 'local_comercial'
  | 'local_administrativo'

export type SiniestroTipo =
  | 'accidente'
  | 'incidente'
  | 'casi_accidente'
  | 'enfermedad_profesional'

export type SiniestroEstado =
  | 'pendiente'
  | 'en_investigacion'
  | 'cerrado'

export type InspeccionEstado =
  | 'programada'
  | 'realizada'
  | 'con_observaciones'
  | 'cancelada'

export type CapacitacionEstado =
  | 'programada'
  | 'realizada'
  | 'cancelada'

export type RiesgoNivel =
  | 'bajo'
  | 'medio'
  | 'alto'
  | 'critico'

export type MedicionTipo =
  | 'ruido'
  | 'iluminacion'
  | 'temperatura'
  | 'humedad'
  | 'vibraciones'
  | 'gases'
  | 'polvo'
  | 'otro'

export type DocumentoTipo =
  | 'habilitacion'
  | 'seguro'
  | 'certificado'
  | 'procedimiento'
  | 'instructivo'
  | 'otro'

export type UnidadMedida =
  | 'g' | 'kg' | 'ml' | 'l' | 'unidad' | 'par' | 'caja' | 'rollo' | 'metro'

export interface Unidad {
  id: string
  nombre: string
  simbolo: string
  categoria: string
  descripcion: string | null
  is_active: boolean
  created_at: string
}

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  system_role: SystemRole
  created_at: string
  updated_at: string
}

export interface Consultora {
  id: string
  nombre: string
  cuit: string | null
  telefono: string | null
  email: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PerfilProfesional {
  id: string
  user_id: string
  telefono: string | null
  fecha_nacimiento: string | null
  provincia_residencia: string | null
  localidad: string | null
  provincia_matricula: string | null
  canal_captacion: string | null
  tipo_identidad_impositiva: string | null
  cuit: string | null
  firma_url: string | null
  logo_small_url: string | null
  logo_destacado_url: string | null
  created_at: string
  updated_at: string
}

export interface MatriculaProfesional {
  id: string
  perfil_id: string
  emisor: string
  numero: string
  fecha_emision: string | null
  fecha_vencimiento: string | null
  foto_frente_url: string | null
  foto_dorso_url: string | null
  activa: boolean
  created_at: string
}

export interface ConsultoraMember {
  id: string
  consultora_id: string
  user_id: string
  role: UserRole
  is_active: boolean
  invited_by: string | null
  created_at: string
  updated_at: string
  profile?: Profile
  profiles?: Profile & { perfiles_profesionales?: PerfilProfesional | null }
}

export interface Localidad {
  id: string
  nombre: string
  provincia: string
  is_active: boolean
  created_at: string
}

export interface Empresa {
  id: string
  consultora_id: string
  razon_social: string
  tipo_identidad_impositiva: string | null
  cuit: string | null
  rubro: string | null
  domicilio: string | null
  codigo_postal: string | null
  localidad_id: string | null
  art_id: string | null
  art_numero_contrato: string | null
  logo_small_url: string | null
  logo_destacado_url: string | null
  informacion_general: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  localidades?: { nombre: string; provincia: string } | null
  organizaciones_externas?: { nombre: string } | null
}

export type EstablecimientoStatus =
  | 'active'
  | 'finished'
  | 'proposal'
  | 'lead'
  | 'on_hold'
  | 'not_awarded'
  | 'cancelled'

export interface Establecimiento {
  id: string
  empresa_id: string
  nombre: string
  tipo: TipoEstablecimiento | null
  domicilio: string | null
  codigo_postal: string | null
  localidad_id: string | null
  actividad_principal: string | null
  cantidad_trabajadores: number | null
  horario_trabajo: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
  // Construcción
  tiene_demolicion: boolean
  tiene_excavacion: boolean
  tiene_submuración: boolean
  tiene_alturas_mayores_6m: boolean
  tiene_equipamiento_izaje: boolean
  tipo_contratista: '35/98' | '51/97' | '319/99' | null
  // Industria
  tiene_agentes_cancerigenos: boolean
  tiene_sustancias_quimicas: boolean
  tiene_exposicion_vibraciones: boolean
  tiene_exposicion_radiaciones: boolean
  descripcion_productos: string | null
  photo_site: string | null
  code: string | null
  ref: string | null
  floor_plan_pdf_url: string | null
  floor_plan_cad_url: string | null
  google_maps_url: string | null
  ac_area: number | null
  gross_area: number | null
  status: EstablecimientoStatus
  created_at: string
  updated_at: string
  localidades?: { nombre: string; provincia: string } | null
  horarios_establecimiento?: HorarioEstablecimiento[]
}

export interface HorarioEstablecimiento {
  id: string
  establecimiento_id: string
  dia_semana: 0 | 1 | 2 | 3 | 4 | 5 | 6
  hora_inicio: string | null
  hora_fin: string | null
  activo: boolean
}

export interface SectorEstablecimiento {
  id: string
  establecimiento_id: string
  nombre: string
  es_custom: boolean
  cantidad_trabajadores: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserAccess {
  id: string
  consultora_id: string
  user_id: string
  empresa_id: string
  establecimiento_id: string | null
  granted_by: string
  is_active: boolean
  created_at: string
}

export interface TipoPersona {
  id: string
  nombre: string
  descripcion: string | null
  created_at: string
}

export interface TipoOrganizacion {
  id: string
  nombre: string
  descripcion: string | null
  created_at: string
}

export interface Organizacion {
  id: string
  nombre: string
  tipo_id: string
  email: string | null
  telefono: string | null
  notas: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  tipo_organizaciones?: { nombre: string } | null
}

export interface DirectorioPersona {
  id: string
  tipo_id: string
  nombre: string
  apellido: string
  dni: string | null
  fecha_nacimiento: string | null
  fecha_ingreso: string | null
  legajo: string | null
  telefono: string | null
  email: string | null
  organizacion_id: string | null
  notas: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  tipo_personas?: { nombre: string } | null
  organizaciones_externas?: { nombre: string } | null
}

export interface CategoriaProducto {
  id: string
  nombre: string
  descripcion: string | null
  created_at: string
}

export interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  marca_id: string | null
  categoria_id: string
  tamano: number | null
  unidad_id: string | null
  unidades?: { nombre: string; simbolo: string } | null
  is_active: boolean
  created_at: string
  updated_at: string
  categoria_productos?: { nombre: string } | null
  organizaciones_externas?: { nombre: string } | null
}

export interface EppPorPuesto {
  id: string
  puesto_id: string
  producto_id: string
  horas_vida_util: number | null
  created_at: string
  productos?: Producto | null
}

export interface AsistenciaDiaria {
  id: string
  persona_id: string
  establecimiento_id: string
  fecha: string
  hora_entrada: string
  hora_salida: string | null
  observaciones: string | null
  registrado_por: string | null
  created_at: string
  directorio_personas?: { nombre: string; apellido: string } | null
}

export interface PuestoDeTrabajo {
  id: string
  sector_id: string
  nombre: string
  tipo: 'operativo' | 'administrativo' | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TrabajadorPuesto {
  id: string
  persona_id: string
  puesto_id: string
  fecha_desde: string | null
  created_at: string
  directorio_personas?: DirectorioPersona
}

export interface Siniestro {
  id: string
  establecimiento_id: string
  persona_id: string | null
  tipo: SiniestroTipo
  estado: SiniestroEstado
  fecha_ocurrencia: string
  descripcion: string | null
  dias_perdidos: number | null
  requiere_derivacion: boolean
  acciones_correctivas: string | null
  reportado_por: string | null
  created_at: string
  updated_at: string
  persona?: DirectorioPersona
}

export interface Inspeccion {
  id: string
  establecimiento_id: string
  estado: InspeccionEstado
  fecha_programada: string
  fecha_realizada: string | null
  inspector_id: string | null
  observaciones: string | null
  puntaje: number | null
  created_at: string
  updated_at: string
  inspector?: Profile
}

export interface Capacitacion {
  id: string
  empresa_id: string
  establecimiento_id: string | null
  titulo: string
  descripcion: string | null
  estado: CapacitacionEstado
  fecha_programada: string
  fecha_realizada: string | null
  instructor_persona_id: string | null
  instructor_externo: string | null
  duracion_horas: number | null
  created_at: string
  updated_at: string
  directorio_personas?: { nombre: string; apellido: string } | null
  capacitacion_asistentes?: { count: number }[]
}

export interface Riesgo {
  id: string
  establecimiento_id: string
  descripcion: string
  nivel: RiesgoNivel
  medida_correctiva: string | null
  responsable_id: string | null
  fecha_identificacion: string
  fecha_resolucion: string | null
  resuelto: boolean
  created_at: string
  updated_at: string
  responsable?: Profile
}

export interface Medicion {
  id: string
  establecimiento_id: string
  tipo: MedicionTipo
  fecha: string
  valor: number
  unidad_id: string | null
  unidades?: { nombre: string; simbolo: string } | null
  sector_id: string | null
  sectores_establecimiento?: { nombre: string } | null
  cumple_normativa: boolean
  observaciones: string | null
  realizado_por: string | null
  created_at: string
}

export interface DocumentType {
  id: string
  nombre: string
  aplica_empresa: boolean
  aplica_establecimiento: boolean
  aplica_empleado: boolean
  is_active: boolean
}

export interface Documento {
  id: string
  empresa_id: string | null
  establecimiento_id: string | null
  tipo_id: string | null
  documento_tipos: { nombre: string } | null
  archivo_url: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  legajo_tecnico: boolean
  subido_por: string | null
  created_at: string
}

// ---- Labels & Colors ----

export const ROLE_LABELS: Record<UserRole | SystemRole, string> = {
  developer: 'Developer',
  user: 'Usuario',
  full_access_main: 'Admin Principal',
  full_access_branch: 'Admin Branch',
  colaborador: 'Colaborador',
  full_viewer: 'Viewer Global',
  colaborador_viewer: 'Viewer Limitado',
}

export const ROLE_COLORS: Record<UserRole | 'developer', string> = {
  developer: 'bg-purple-100 text-purple-800',
  full_access_main: 'bg-red-100 text-red-800',
  full_access_branch: 'bg-orange-100 text-orange-800',
  colaborador: 'bg-blue-100 text-blue-800',
  full_viewer: 'bg-green-100 text-green-800',
  colaborador_viewer: 'bg-gray-100 text-gray-800',
}

export const RIESGO_NIVEL_COLORS: Record<RiesgoNivel, string> = {
  bajo: 'bg-green-100 text-green-800',
  medio: 'bg-yellow-100 text-yellow-800',
  alto: 'bg-orange-100 text-orange-800',
  critico: 'bg-red-100 text-red-800',
}

export const SINIESTRO_ESTADO_COLORS: Record<SiniestroEstado, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  en_investigacion: 'bg-blue-100 text-blue-800',
  cerrado: 'bg-gray-100 text-gray-700',
}

export const INSPECCION_ESTADO_COLORS: Record<InspeccionEstado, string> = {
  programada: 'bg-blue-100 text-blue-800',
  realizada: 'bg-green-100 text-green-800',
  con_observaciones: 'bg-yellow-100 text-yellow-800',
  cancelada: 'bg-gray-100 text-gray-700',
}

// ---- Permission helpers ----

export function canWrite(role: UserRole | null, systemRole: SystemRole): boolean {
  if (systemRole === 'developer') return true
  return role === 'full_access_main' || role === 'full_access_branch' || role === 'colaborador'
}

export function canDelete(role: UserRole | null, systemRole: SystemRole): boolean {
  if (systemRole === 'developer') return true
  return role === 'full_access_main' || role === 'full_access_branch'
}

export function canManageUsers(role: UserRole | null, systemRole: SystemRole): boolean {
  if (systemRole === 'developer') return true
  return role === 'full_access_main'
}

export function canViewAll(role: UserRole | null, systemRole: SystemRole): boolean {
  if (systemRole === 'developer') return true
  return role === 'full_access_main' || role === 'full_access_branch' || role === 'full_viewer'
}

export interface TipoInstrumentoMedicion {
  id: string
  nombre: string
  descripcion: string | null
  created_at: string
}

export interface InstrumentoMedicion {
  id: string
  tipo_id: string
  marca_id: string | null
  modelo: string
  numero_serie: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  tipo_instrumento_medicion?: { nombre: string } | null
  organizaciones_externas?: { nombre: string } | null
}

export interface Matricula {
  id: string
  persona_id: string
  numero: string
  organismo_emisor_id: string | null
  fecha_emision: string
  fecha_vencimiento: string
  certificado_url: string | null
  activa: boolean
  created_at: string
  directorio_personas?: { nombre: string; apellido: string } | null
  organizaciones_externas?: { nombre: string } | null
}

export interface CertificadoCalibracion {
  id: string
  instrumento_id: string
  fecha_emision: string
  fecha_vencimiento: string
  organismo_emisor_id: string | null
  certificado_url: string | null
  activo: boolean
  created_at: string
  organizaciones_externas?: { nombre: string } | null
}

export interface GrupoGestion {
  id: string
  nombre: string
  created_at: string
}

export interface CategoriaGestion {
  id: string
  nombre: string
  grupo_id: string
  descripcion: string | null
  created_at: string
  grupo_gestiones?: { nombre: string } | null
}

export interface Gestion {
  id: string
  nombre: string
  categoria_id: string
  descripcion: string | null
  created_at: string
  categoria_gestiones?: { nombre: string; grupo_gestiones?: { nombre: string } | null } | null
}

export interface GestionEstablecimiento {
  id: string
  gestion_id: string
  establecimiento_id: string
  created_at: string
  gestiones?: Gestion | null
}

export interface RegistroGestion {
  id: string
  gestion_establecimiento_id: string
  index: number | null
  fecha_planificada: string
  fecha_ejecutada: string | null
  responsable_id: string | null
  aprobado_por_id: string | null
  evidencia_url: string | null
  observaciones: string | null
  notas: string | null
  created_at: string
  updated_at: string
  profiles?: { full_name: string } | null
  directorio_personas?: { nombre: string; apellido: string } | null
}

export interface ObservacionCategoria {
  id: string
  nombre: string
  nivel: number
  is_active: boolean
  created_at: string
}

export interface ObservacionGestion {
  id: string
  registro_gestion_id: string
  descripcion: string
  fecha_planificada: string
  fecha_cierre: string | null
  clasificacion_id: string | null
  categoria_id: string | null
  responsable_id: string | null
  responsable_cierre_id: string | null
  evidencia_cierre_url: string | null
  created_at: string
  updated_at: string
  clasificacion_observaciones?: { nombre: string } | null
  observacion_categoria?: { nombre: string; nivel: number } | null
  directorio_personas?: { nombre: string; apellido: string } | null
}

export interface Denuncia {
  id: string
  establecimiento_id: string
  fecha: string
  descripcion: string
  created_at: string
}

export type FeedbackTipo = 'positivo' | 'negativo' | 'sugerencia'

export interface FeedbackCliente {
  id: string
  establecimiento_id: string
  fecha: string
  cliente: string
  tipo: FeedbackTipo
  descripcion: string
  created_at: string
}

export type EstadoGestion = 'Realizado' | 'Pendiente' | 'Planificado'

export function calcularEstadoGestion(fechaEjecutada: string | null, fechaPlanificada: string): EstadoGestion {
  if (fechaEjecutada) return 'Realizado'
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const planificada = new Date(fechaPlanificada)
  planificada.setHours(0, 0, 0, 0)
  return planificada < hoy ? 'Pendiente' : 'Planificado'
}

// ---- Action result ----
export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string }
