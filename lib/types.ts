export type SystemRole = 'developer' | 'user'
export type UserRole =
  | 'full_access_main'
  | 'full_access_branch'
  | 'colaborador'
  | 'full_viewer'
  | 'colaborador_viewer'

export type TipoEstablecimiento =
  | 'obra_construccion'
  | 'industria'
  | 'local_comercial'
  | 'local_administrativo'
  | 'otro'

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
}

export interface Empresa {
  id: string
  consultora_id: string
  razon_social: string
  cuit: string | null
  rubro: string | null
  domicilio: string | null
  localidad: string | null
  provincia: string | null
  codigo_postal: string | null
  is_active: boolean
  created_at: string
  updated_at: string
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
  localidad: string | null
  provincia: string | null
  codigo_postal: string | null
  actividad_principal: string | null
  cantidad_trabajadores: number | null
  latitude: number | null
  longitude: number | null
  photo_site: string | null
  status: EstablecimientoStatus
  created_at: string
  updated_at: string
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

export interface Empleado {
  id: string
  establecimiento_id: string
  nombre: string
  apellido: string
  dni: string | null
  cargo: string | null
  fecha_ingreso: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Siniestro {
  id: string
  establecimiento_id: string
  empleado_id: string | null
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
  empleado?: Empleado
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
  empresa_id: string | null
  establecimiento_id: string | null
  titulo: string
  descripcion: string | null
  estado: CapacitacionEstado
  fecha_programada: string
  fecha_realizada: string | null
  instructor: string | null
  duracion_horas: number | null
  created_at: string
  updated_at: string
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
  unidad: string | null
  sector: string | null
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

export function canManageUsers(role: UserRole | null, systemRole: SystemRole): boolean {
  if (systemRole === 'developer') return true
  return role === 'full_access_main'
}

export function canViewAll(role: UserRole | null, systemRole: SystemRole): boolean {
  if (systemRole === 'developer') return true
  return role === 'full_access_main' || role === 'full_access_branch' || role === 'full_viewer'
}

// ---- Action result ----
export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string }
