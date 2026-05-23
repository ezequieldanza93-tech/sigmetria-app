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

export interface TiposEstablecimiento {
  id: string
  codigo: string
  nombre: string
  created_at: string
}

export interface PreguntaRiesgo {
  id: string
  codigo: string
  texto: string
  orden: number
  is_active: boolean
}

export interface EstablecimientoRespuesta {
  id: string
  establecimiento_id: string
  pregunta_id: string
  respuesta: boolean
}

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
  website: string | null
  social_links: Record<string, string> | null
  is_active: boolean
  seats_max: number
  trial_used_at: string | null
  created_at: string
  updated_at: string
}

export interface PerfilProfesional {
  id: string
  user_id: string
  telefono: string | null
  fecha_nacimiento: string | null
  localidad_id: string | null
  provincia_residencia_id: string | null
  provincia_matricula_id: string | null
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

export interface Provincia {
  id: string
  nombre: string
}

export interface Localidad {
  id: string
  nombre: string
  provincia: string
  is_active: boolean
  created_at: string
}

export interface Rubro {
  id: string
  nombre: string
  descripcion: string | null
  is_active: boolean
}

export interface Empresa {
  id: string
  consultora_id: string
  razon_social: string
  tipo_identidad_impositiva: string | null
  cuit: string | null
  rubro_id: string | null
  empresas_rubros?: { nombre: string } | null
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
  tipo_id: string | null
  establecimientos_tipos?: { id: string; codigo: string; nombre: string } | null
  domicilio: string | null
  codigo_postal: string | null
  localidad_id: string | null
  actividad_principal: string | null
  cantidad_trabajadores: number | null
  horario_trabajo: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
  photo_site: string | null
  code: string | null
  ref: string | null
  floor_plan_pdf_url: string | null
  floor_plan_cad_url: string | null
  google_maps_url: string | null
  ac_area: number | null
  gross_area: number | null
  status: EstablecimientoStatus
  aplica_iso_45001?: boolean
  created_at: string
  updated_at: string
  localidades?: { nombre: string; provincia: string } | null
  establecimientos_horarios?: HorarioEstablecimiento[]
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

export interface SubcontratistaRubro {
  id: string
  nombre: string
  is_active: boolean
  created_at: string
}

export interface Subcontratista {
  id: string
  organizacion_id: string
  tipo_identidad_impositiva: 'CUIT' | 'CUIL' | 'CDI' | null
  cuit: string | null
  rubro_id: string | null
  domicilio: string | null
  localidad_id: string | null
  codigo_postal: string | null
  art_id: string | null
  art_numero_contrato: string | null
  tipo_establecimiento_id: string | null
  actividad_principal: string | null
  cantidad_trabajadores: number | null
  informacion_general: string | null
  created_at: string
  updated_at: string
  subcontratistas_rubros?: { nombre: string } | null
  localidades?: { nombre: string; provincia: string } | null
  establecimientos_tipos?: { nombre: string } | null
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
  organizaciones_tipos?: { nombre: string } | null
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
  personas_tipos?: { nombre: string } | null
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
  productos_categorias?: { nombre: string } | null
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
  personas_directorio?: { nombre: string; apellido: string } | null
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
  personas_directorio?: DirectorioPersona
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
  personas_directorio?: { nombre: string; apellido: string } | null
  capacitaciones_asistentes?: { count: number }[]
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
  establecimientos_sectores?: { nombre: string } | null
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
  aplica_por_iso: boolean
  is_active: boolean
}

export interface Documento {
  id: string
  empresa_id: string | null
  establecimiento_id: string | null
  tipo_id: string | null
  documentos_tipos: { nombre: string } | null
  archivo_url: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  legajo_tecnico: boolean
  subido_por: string | null
  created_at: string
}

export interface EmpresaDocumento {
  id: string
  empresa_id: string
  tipo_id: string | null
  documentos_tipos: { nombre: string } | null
  archivo_url: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  created_at: string
}

export interface EmpleadoDocumentoLegajo {
  id: string
  persona_id: string
  tipo_id: string | null
  documentos_tipos: { nombre: string } | null
  archivo_url: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  created_at: string
  personas_directorio: { nombre: string; apellido: string; legajo: string | null } | null
}

export interface LegajoGestion {
  id: string
  fecha_planificada: string
  notas: string | null
  gestiones_establecimientos: {
    mostrar_lt: boolean
    establecimiento_id: string
    gestiones: {
      nombre: string
      gestiones_categorias: { nombre: string } | null
    } | null
  } | null
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
  full_access_branch: 'bg-orange-100 text-gray-900',
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
  mediciones_instrumentos_tipos?: { nombre: string } | null
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
  personas_directorio?: { nombre: string; apellido: string } | null
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
  gestiones_grupos?: { nombre: string } | null
}

export interface Gestion {
  id: string
  nombre: string
  categoria_id: string
  descripcion: string | null
  created_at: string
  aplica_por_iso: boolean
  tiene_entregable: boolean
  gestiones_categorias?: { nombre: string; gestiones_grupos?: { nombre: string } | null } | null
}

export interface GestionEstablecimiento {
  id: string
  gestion_id: string
  establecimiento_id: string
  mostrar_lt: boolean
  created_at: string
  gestiones?: Gestion | null
}

export interface RegistroGestion {
  id: string
  gestion_establecimiento_id: string
  index: number | null
  fecha_planificada: string
  fecha_ejecutada: string | null
  fecha_vencimiento: string | null
  responsable_id: string | null
  aprobado_por_id: string | null
  evidencia_url: string | null
  observaciones: string | null
  notas: string | null
  created_at: string
  updated_at: string
  profiles?: { full_name: string } | null
  personas_directorio?: { nombre: string; apellido: string } | null
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
  observaciones_clasificaciones?: { nombre: string } | null
  observaciones_categorias?: { nombre: string; nivel: number } | null
  personas_directorio?: { nombre: string; apellido: string } | null
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

// ---- Formularios ----
export interface FormularioSeccion {
  id: string
  gestion_id: string
  title: string
  order_index: number
  created_at: string
  formularios_items?: FormularioItem[]
}

export interface FormularioItem {
  id: string
  section_id: string
  question: string
  order_index: number
  response_type: string
  required: boolean
  numero_item: number | null
  created_at: string
}

export interface FormularioRespuesta {
  id: string
  gestion_id: string
  establecimiento_id: string
  executed_by: string | null
  executed_at: string | null
  status: string
}

export interface FormularioItemRespuesta {
  id: string
  respuesta_id: string
  item_id: string
  answer: string
  comment: string | null
  created_at: string
}

export type AnswerValue = 'cumple' | 'no_cumple' | 'no_aplica'

export interface RespuestaDraft {
  item_id: string
  answer: AnswerValue | null
  comment: string
}

// ---- Notificaciones ----
export type NotificacionEntidadTipo =
  | 'gestion'
  | 'documento_empresa'
  | 'documento_establecimiento'
  | 'documento_persona'
  | 'matricula'
  | 'certificado'

export interface Notificacion {
  id: string
  consultora_id: string
  tipo: string
  entidad_tipo: NotificacionEntidadTipo
  entidad_id: string
  titulo: string
  mensaje: string
  entidad_nombre: string
  contexto_nombre: string | null
  fecha_vencimiento: string
  dias_restantes: number
  created_at: string
  updated_at: string
  leida?: boolean
}

// ---- Configuración de Vencimientos ----
export type TipoEntidadVencimiento = 'empresa' | 'establecimiento' | 'persona' | 'gestion'

export interface ConfiguracionVencimiento {
  id: string
  consultora_id: string
  tipo_entidad: TipoEntidadVencimiento
  nombre: string
  tiene_vencimiento: boolean
  dias_aviso: number
  activo: boolean
  created_at: string
  updated_at: string
}

// ---- Dashboard ----
export interface UserDashboardWidget {
  id: string
  user_id: string
  widget_key: string
  position: number
  visible: boolean
  created_at: string
  updated_at: string
}

// ---- Firmas ----
export type FirmaEntidadTipo = 'gestion' | 'capacitacion' | 'permiso_trabajo' | 'entrega_epp'
export type FirmaFirmanteTipo = 'usuario_interno' | 'trabajador'

export interface Firma {
  id: string
  consultora_id: string
  entidad_tipo: FirmaEntidadTipo
  entidad_id: string
  firmante_tipo: FirmaFirmanteTipo
  firmante_usuario_id: string | null
  trabajador_id: string | null
  nombre_completo: string
  dni: string
  rol: string | null
  firma_svg_data: string | null
  asistente_id: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  profiles?: { full_name: string } | null
  asistentes?: { full_name: string } | null
  personas_directorio?: { nombre: string; apellido: string } | null
}

export const FIRMA_ENTIDAD_LABELS: Record<FirmaEntidadTipo, string> = {
  gestion: 'Gestión',
  capacitacion: 'Capacitación',
  permiso_trabajo: 'Permiso de Trabajo',
  entrega_epp: 'Entrega de EPP',
}

// ---- Incidentes y Denuncias ----
export type IncidenteTipo =
  | 'electrico' | 'mecanico' | 'estructural' | 'quimico'
  | 'ergonomico' | 'ambiental' | 'incendio' | 'caida'
  | 'herramienta' | 'vehiculo' | 'otro'

export type DenunciaTipo =
  | 'laboral' | 'acoso' | 'condiciones_inseguras'
  | 'incumplimiento_normativo' | 'conducta' | 'otro'

export type DenuncianteTipo = 'interno' | 'externo' | 'anonimo'

export type SeguimientoEstado =
  | 'recibida' | 'en_analisis' | 'accion_planificada' | 'implementada' | 'cerrada'

export type Severidad = 'baja' | 'media' | 'alta' | 'critica'

export interface Incidente {
  id: string
  consultora_id: string
  empresa_id: string
  establecimiento_id: string | null
  titulo: string
  descripcion: string
  tipo_incidente: IncidenteTipo
  severidad: Severidad
  lugar_especifico: string | null
  fecha_incidente: string
  hora_incidente: string | null
  involucrados: string | null
  testigos: string | null
  estado: SeguimientoEstado
  responsable_asignado_id: string | null
  acciones_tomadas: string | null
  conclusion: string | null
  historial_estados: SeguimientoHistorico[]
  cerrado_por: string | null
  fecha_cierre: string | null
  created_at: string
  updated_at: string
  empresas?: { razon_social: string }
  establecimientos?: { nombre: string }
  profiles_responsable?: { full_name: string }
  incidentes_fotos?: IncidenteFoto[]
}

export interface IncidenteFoto {
  id: string
  incidente_id: string
  url: string
  filename: string
  created_at: string
}

export interface Denuncia {
  id: string
  consultora_id: string
  empresa_id: string
  establecimiento_id: string | null
  titulo: string
  descripcion: string
  tipo_denuncia: DenunciaTipo
  denunciante_tipo: DenuncianteTipo
  denunciante_nombre: string | null
  denunciante_dni: string | null
  denunciante_contacto: string | null
  fecha_denuncia: string
  involucrados: string | null
  estado: SeguimientoEstado
  responsable_asignado_id: string | null
  acciones_tomadas: string | null
  conclusion: string | null
  confidencial: boolean
  historial_estados: SeguimientoHistorico[]
  cerrado_por: string | null
  fecha_cierre: string | null
  created_at: string
  updated_at: string
  empresas?: { razon_social: string }
  establecimientos?: { nombre: string }
  profiles_responsable?: { full_name: string }
  denuncias_fotos?: DenunciaFoto[]
}

export interface DenunciaFoto {
  id: string
  denuncia_id: string
  url: string
  filename: string
  created_at: string
}

export interface SeguimientoHistorico {
  estado: SeguimientoEstado
  fecha: string
  usuario_id: string
  usuario_nombre?: string
}

export const SEGUIMIENTO_ESTADOS_ORDER: SeguimientoEstado[] = [
  'recibida',
  'en_analisis',
  'accion_planificada',
  'implementada',
  'cerrada',
]

export function estadoSiguiente(actual: SeguimientoEstado): SeguimientoEstado | null {
  const idx = SEGUIMIENTO_ESTADOS_ORDER.indexOf(actual)
  if (idx === -1 || idx >= SEGUIMIENTO_ESTADOS_ORDER.length - 1) return null
  return SEGUIMIENTO_ESTADOS_ORDER[idx + 1]
}

export function estadoAnterior(actual: SeguimientoEstado): SeguimientoEstado | null {
  const idx = SEGUIMIENTO_ESTADOS_ORDER.indexOf(actual)
  if (idx <= 0) return null
  return SEGUIMIENTO_ESTADOS_ORDER[idx - 1]
}

// ---- Action result ----
export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string }
