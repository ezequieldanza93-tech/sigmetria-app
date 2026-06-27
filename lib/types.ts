export type SystemRole = 'developer' | 'user'
export type UserRole =
  | 'full_access_main'
  | 'full_access_branch'
  | 'colaborador'
  | 'full_viewer'
  | 'colaborador_viewer'
  | 'visualizador_comentarista'
  | 'responsable_estandares'
  | 'viewer_observaciones'
  | 'auditor_externo'
  | 'trabajador'

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

export type IncidenteTipo =
  | 'incidente'
  | 'accidente_leve'
  | 'accidente_moderado'
  | 'accidente_grave'
  | 'enfermedad_profesional'

export type IncidenteEstado =
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
  tipo: string | null
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
  actividad_id: string | null
  actividades_economicas?: { codigo: string; nombre: string } | null
  domicilio: string | null
  codigo_postal: string | null
  localidad_id: string | null
  latitude: number | null
  longitude: number | null
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
  actividad_id: string | null
  cantidad_trabajadores: number | null
  cantidad_trabajadores_operativos: number | null
  cantidad_trabajadores_administrativos: number | null
  categoria_hys: 'A' | 'B' | 'C' | null
  description: string | null
  latitud: number | null
  longitud: number | null
  photo_site: string | null
  plano_url: string | null
  code: string | null
  ref: string | null
  floor_plan_cad_url: string | null
  google_maps_url: string | null
  ac_area: number | null
  gross_area: number | null
  status: EstablecimientoStatus
  aplica_iso_45001?: boolean
  tiene_habilitacion?: boolean
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
  /** Tipos con este flag solo se crean vía cuenta de usuario, no desde el directorio manual. */
  solo_via_cuenta?: boolean
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
  rubro_id: string | null
  art_id: string | null
  art_numero_contrato: string | null
  tipo_establecimiento_id: string | null
  actividad_principal: string | null
  cantidad_trabajadores: number | null
  informacion_general: string | null
  created_at: string
  updated_at: string
  subcontratistas_rubros?: { nombre: string } | null
  establecimientos_tipos?: { nombre: string } | null
  organizaciones_externas?: {
    nombre: string
    cuit: string | null
    domicilio: string | null
    email: string | null
    telefono: string | null
    tipo_identidad_impositiva: string | null
    localidades?: { nombre: string; provincia: string } | null
  } | null
}

export interface SubcontratistaDocumento {
  id: string
  subcontratista_id: string
  tipo_id: string
  archivo_url: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  observaciones: string | null
  subido_por: string
  created_at: string
  updated_at: string
  documentos_tipos?: { nombre: string } | null
}

export interface SubcontratistaWithOrg extends Subcontratista {
  subcontratistas_documentos?: SubcontratistaDocumento[]
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
  direccion: string | null
  talle_calzado: string | null
  talle_pantalon: string | null
  talle_remera: string | null
  talle_camisa: string | null
  talle_buzo: string | null
  talle_campera: string | null
  beneficiario_seguro: string | null
  contacto_emergencia_nombre: string | null
  contacto_emergencia_telefono: string | null
  is_active: boolean
  created_in_consultora_id: string | null
  created_at: string
  updated_at: string
  personas_tipos?: { nombre: string } | null
  organizaciones_externas?: { nombre: string } | null
}

// ── Catálogo de protecciones — jerarquía de 3 niveles (híbrida base/propios) ──
// CLASE (nivel 1) → CATEGORÍA (nivel 2) → COMPONENTE (intermedio) → PRODUCTO
export interface ProductoClase {
  id: string
  nombre: string
  descripcion: string | null
  consultora_id: string | null // NULL = base Sigmetría, <id> = propia de la consultora
  created_at: string
}

export interface ProductoComponente {
  id: string
  categoria_id: string
  nombre: string
  descripcion: string | null
  consultora_id: string | null // NULL = base Sigmetría, <id> = propio de la consultora
  created_at: string
}

export interface CategoriaProducto {
  id: string
  nombre: string
  descripcion: string | null
  clase_id: string | null // Clase (nivel 1) a la que pertenece
  consultora_id: string | null // NULL = base Sigmetría, <id> = propia de la consultora
  created_at: string
}

export interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  marca_id: string | null
  proveedor_id: string | null
  codigo: string | null
  url_origen: string | null
  categoria_id: string
  componente_id: string | null // Componente (intermedio). NULL = sin reclasificar. La clase se deriva vía categoria.
  consultora_id: string | null
  tamano: number | null
  unidad_id: string | null
  foto_url: string | null
  airtable_id: string | null
  unidades?: { nombre: string; simbolo: string } | null
  is_active: boolean
  created_at: string
  updated_at: string
  productos_categorias?: { nombre: string } | null
  // Embeds desambiguados: marca_id y proveedor_id apuntan a organizaciones_externas.
  marca?: { nombre: string } | null
  proveedor?: { nombre: string } | null
  // Count de variantes (PostgREST embed `producto_variantes(count)`).
  producto_variantes?: { count: number }[]
}

export interface ProductoVariante {
  id: string
  producto_id: string
  sku: string | null
  codigo: string | null
  talle: string | null
  color: string | null
  atributos: Record<string, unknown>
  orden: number
  is_active: boolean
  created_at: string
}

export interface ProductoAsset {
  id: string
  producto_id: string
  tipo: 'foto' | 'ficha_tecnica'
  bucket: string
  path_storage: string
  url_origen: string | null
  filename: string | null
  mime_type: string | null
  tamano_bytes: number | null
  orden: number
  is_principal: boolean
  created_at: string
}

export interface EppPorPuesto {
  id: string
  puesto_id: string
  producto_id: string
  horas_vida_util: number | null
  created_at: string
  productos?: Producto | null
}

export interface TipoHora {
  id: string
  nombre: string
  descripcion: string | null
  color: string
  is_active: boolean
  created_at: string
}

export interface AsistenciaDiaria {
  id: string
  persona_id: string
  establecimiento_id: string
  fecha: string
  hora_entrada: string
  hora_salida: string | null
  tipo_hora_id: string | null
  observaciones: string | null
  registrado_por: string | null
  created_at: string
  personas_directorio?: { nombre: string; apellido: string } | null
  tipos_horas?: TipoHora | null
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

export type TipoRelacionLaboral = 'permanente' | 'temporal' | 'contratista' | 'pasante'

export interface TrabajadorPuesto {
  id: string
  persona_id: string
  puesto_id: string
  fecha_desde: string | null
  fecha_alta: string | null
  fecha_baja: string | null
  motivo_baja: string | null
  tipo_relacion: TipoRelacionLaboral | null
  created_at: string
  personas_directorio?: DirectorioPersona
}

export type TipoPersonaIncidente = 'trabajador_interno' | 'trabajador_externo'

export interface Incidente {
  id: string
  establecimiento_id: string
  persona_id: string | null
  tipo: IncidenteTipo
  estado: IncidenteEstado
  fecha_ocurrencia: string
  hora_ocurrencia: string | null
  tipo_persona: TipoPersonaIncidente | null
  descripcion: string | null
  dias_perdidos: number | null
  dias_perdidos_calculados: number | null
  fecha_baja_medica: string | null
  fecha_alta_medica: string | null
  tiene_denuncia_adjunta: boolean
  tiene_evolucion_medica: boolean
  denuncia_adjuntos_urls: string[] | null
  investigacion_adjuntos_urls: string[] | null
  ente_investigador: string | null
  fecha_investigacion: string | null
  causa_inmediata: string | null
  causa_basica: string | null
  requiere_derivacion: boolean
  acciones_correctivas: string | null
  reportado_por: string | null
  created_at: string
  updated_at: string
  persona?: DirectorioPersona
  incidentes_involucrados?: PersonaVinculo[]
  incidentes_testigos?: PersonaVinculo[]
}

/**
 * Fila de una tabla N:M persona↔(incidente|denuncia). Exactamente uno de
 * `persona_id` (FK al directorio) o `nombre_suelto` (tercero) viene seteado.
 */
export interface PersonaVinculo {
  id: string
  persona_id: string | null
  nombre_suelto: string | null
  personas_directorio?: { nombre: string; apellido: string } | null
}

export interface InspeccionObservacion {
  id: string
  inspeccion_id: string
  descripcion: string
  resuelta: boolean
  fecha_resolucion: string | null
  resuelto_por: string | null
  created_at: string
}

export type InspeccionEstadoVisual = 'verde' | 'amarillo' | 'rojo'

export interface Inspeccion {
  id: string
  establecimiento_id: string
  estado: InspeccionEstado
  fecha_programada: string
  fecha_realizada: string | null
  inspector_id: string | null
  observaciones: string | null
  puntaje: number | null
  ente_regulador_id: string | null
  ente_especificar: string | null
  adjuntos_urls: string[]
  estado_visual: InspeccionEstadoVisual | null
  created_at: string
  updated_at: string
  inspector?: Profile
  inspecciones_observaciones?: InspeccionObservacion[]
  entes_reguladores?: { nombre: string; abreviatura: string } | null
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
  aplica_subcontratista: boolean
  aplica_por_iso: boolean
  is_active: boolean
}

// ---- Legajo Técnico: categorías fijas + periodicidad de renovación ----
// Espejo TS de las columnas globales documentos_tipos.categoria_legajo /
// documentos_tipos.periodicidad (migración 20260617000005).

export type CategoriaLegajo =
  | 'empresa'
  | 'empresa_por_establecimiento'
  | 'empresa_gestiones'
  | 'establecimiento'
  | 'persona'
  | 'persona_por_establecimiento'

export type PeriodicidadDoc =
  | 'mensual'
  | 'semanal'
  | 'semestral'
  | 'anual'
  | 'cada_6_anios'
  | 'no_vence'
  | 'vto_aviso_obra'
  | 'vto_inicio_obra'
  | 'por_gestion'
  | 'fecha_vto'

// Shape del join a documentos_tipos en las vistas del Legajo Técnico.
// categoria_legajo / periodicidad son opcionales: solo las queries del Legajo
// Técnico las seleccionan; el resto de las queries traen únicamente `nombre`.
export interface DocumentoTipoLegajo {
  nombre: string
  categoria_legajo?: CategoriaLegajo | null
  periodicidad?: PeriodicidadDoc | null
}

export interface Documento {
  id: string
  empresa_id: string | null
  establecimiento_id: string | null
  tipo_id: string | null
  documentos_tipos: DocumentoTipoLegajo | null
  archivo_url: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  legajo_tecnico: boolean
  /** Visibilidad en la vista pública del QR (inspector). Default true. */
  legajo_publico_visible?: boolean
  subido_por: string | null
  created_at: string
}

export interface EmpresaDocumento {
  id: string
  empresa_id: string
  tipo_id: string | null
  documentos_tipos: DocumentoTipoLegajo | null
  archivo_url: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  created_at: string
}

export interface EmpleadoDocumentoLegajo {
  id: string
  persona_id: string
  tipo_id: string | null
  documentos_tipos: DocumentoTipoLegajo | null
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
  mostrar_lt: boolean
  gestiones_establecimientos: {
    establecimiento_id: string
    gestiones: {
      nombre: string
      gestiones_categorias: { nombre: string } | null
    } | null
  } | null
}

// ---- Legajo Técnico como CHECKLIST: esperados + último + historial ----
// El legajo se modela como una lista FIJA de documentos ESPERADOS (catálogo
// curado de documentos_tipos con periodicidad seteada). Para cada esperado se
// resuelve la última instancia vigente cargada (o `null` = pendiente) y todo
// su historial (versiones cargadas, INSERT puro = historial natural).

/** Una versión cargada de un documento esperado (instancia en alguna *_documentos). */
export interface LegajoVersion {
  id: string
  archivo_url: string | null
  fecha_vencimiento: string | null
  fecha_emision: string | null
  created_at: string
}

/** Fila ESPERADA del legajo: el tipo + su último + su historial. */
export interface LegajoEsperadoRow {
  tipo_id: string
  nombre: string
  periodicidad: PeriodicidadDoc | null
  ultimo: LegajoVersion | null
  historial: LegajoVersion[]
}

/** Persona con sus filas esperadas (para las categorías persona*). */
export interface LegajoEsperadoPersona {
  persona_id: string
  persona: { nombre: string; apellido: string; legajo: string | null } | null
  filas: LegajoEsperadoRow[]
}

/**
 * Resultado del checklist de esperados del Legajo Técnico.
 * Las 4 categorías de entidad simple traen `filas`; las 2 de persona traen
 * `personas` (cada persona con su propio set de filas esperadas).
 */
export interface LegajoEsperados {
  empresa: LegajoEsperadoRow[]
  empresa_por_establecimiento: LegajoEsperadoRow[]
  establecimiento: LegajoEsperadoRow[]
  persona: LegajoEsperadoPersona[]
  persona_por_establecimiento: LegajoEsperadoPersona[]
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
  visualizador_comentarista: 'Visualizador Comentarista',
  responsable_estandares: 'Resp. de Estándares',
  viewer_observaciones: 'Viewer de Observaciones',
  auditor_externo: 'Auditor (organismo de control)',
  trabajador: 'Trabajador',
}

export const ROLE_COLORS: Record<UserRole | 'developer', string> = {
  developer: 'bg-purple-100 text-purple-800',
  full_access_main: 'bg-red-100 text-red-800',
  full_access_branch: 'bg-orange-100 text-gray-900',
  colaborador: 'bg-blue-100 text-blue-800',
  full_viewer: 'bg-green-100 text-green-800',
  colaborador_viewer: 'bg-gray-100 text-gray-800',
  visualizador_comentarista: 'bg-teal-100 text-teal-800',
  responsable_estandares: 'bg-indigo-100 text-indigo-800',
  viewer_observaciones: 'bg-amber-100 text-amber-800',
  auditor_externo: 'bg-slate-100 text-slate-800',
  trabajador: 'bg-cyan-100 text-cyan-800',
}

export const RIESGO_NIVEL_COLORS: Record<RiesgoNivel, string> = {
  bajo: 'bg-green-100 text-green-800',
  medio: 'bg-yellow-100 text-yellow-800',
  alto: 'bg-orange-100 text-orange-800',
  critico: 'bg-red-100 text-red-800',
}

export const INCIDENTE_ESTADO_COLORS: Record<IncidenteEstado, string> = {
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

export function canViewReportes(role: UserRole | null, systemRole: SystemRole): boolean {
  if (systemRole === 'developer') return true
  return role === 'full_access_main' || role === 'responsable_estandares'
}

// ── Auditoría de geo-sello ───────────────────────────────────────────────────
// Solo los roles auditores ven DESDE DÓNDE se cargó cada gestión (distancia al
// establecimiento + semáforo). El colaborador común NO ve este dato.
export function canAuditarGeo(role: UserRole | null, systemRole: SystemRole): boolean {
  if (systemRole === 'developer') return true
  return (
    role === 'full_access_main' ||
    role === 'responsable_estandares' ||
    role === 'auditor_externo'
  )
}

// ── Usuarios viewer "sin cargo" ──────────────────────────────────────────────
// Roles de solo-lectura (pueden ver y comentar, nunca escribir). NO consumen
// seat del plan y los puede crear tanto el Admin como cualquier colaborador.
export const FREE_VIEWER_ROLES: UserRole[] = [
  'full_viewer',
  'colaborador_viewer',
  'visualizador_comentarista',
  'viewer_observaciones',
]

export function isFreeViewerRole(role: UserRole | null | undefined): boolean {
  return role != null && FREE_VIEWER_ROLES.includes(role)
}

// ¿El rol consume un seat del plan? Los free-viewers NO. El `auditor_externo`
// (organismo de control, solo lectura) TAMPOCO consume seat, pero —a diferencia de
// los free-viewers— solo lo asigna el Admin Principal (mantiene su gating de rol con
// cargo). Desacopla "no consume seat" de "lo puede invitar un colaborador".
export function consumesSeat(role: UserRole | null | undefined): boolean {
  if (role == null) return false
  // El trabajador (usuario final / operario) TAMPOCO consume seat: puede haber
  // cientos o miles por consultora. Lo da de alta cualquier colaborador desde el
  // directorio (persona tipo "Trabajadores"). Ve solo lo suyo.
  return !isFreeViewerRole(role) && role !== 'auditor_externo' && role !== 'trabajador'
}

// El Admin (full_access_main) gestiona todo el equipo; los colaboradores
// (full_access_branch / colaborador) SOLO pueden crear usuarios viewer.
export function canInviteViewers(role: UserRole | null, systemRole: SystemRole): boolean {
  if (systemRole === 'developer') return true
  return role === 'full_access_main' || role === 'full_access_branch' || role === 'colaborador'
}

// Cualquier PROFESIONAL de la consultora (admin o colaborador) puede crear
// usuarios TRABAJADORES desde el directorio. Mismo set que canInviteViewers,
// pero con nombre explícito porque es otro acto (alta de usuario final, no viewer).
export function canCreateTrabajadores(role: UserRole | null, systemRole: SystemRole): boolean {
  if (systemRole === 'developer') return true
  return role === 'full_access_main' || role === 'full_access_branch' || role === 'colaborador'
}

// ── Roles amigables (mapea los 7 roles internos a 3 categorías + compliance) ──
export type FriendlyRoleKey = 'admin' | 'colaborador' | 'visualizador' | 'viewer_obs' | 'auditor' | 'trabajador'
export type ScopeKey = 'todo' | 'especifico'

export interface FriendlyRole {
  label: string
  scope?: string
  color: string
}

export function roleToFriendly(role: UserRole | 'developer' | null | undefined): FriendlyRole {
  switch (role) {
    case 'developer': return { label: 'Developer', color: 'bg-purple-100 text-purple-800' }
    case 'full_access_main': return { label: 'Admin', color: 'bg-red-100 text-red-800' }
    case 'full_access_branch': return { label: 'Colaborador', scope: 'Toda la consultora', color: 'bg-blue-100 text-blue-800' }
    case 'colaborador': return { label: 'Colaborador', scope: 'Acceso específico', color: 'bg-blue-100 text-blue-800' }
    case 'full_viewer': return { label: 'Visualizador', scope: 'Toda la consultora', color: 'bg-green-100 text-green-800' }
    case 'colaborador_viewer': return { label: 'Visualizador', scope: 'Acceso específico', color: 'bg-green-100 text-green-800' }
    case 'visualizador_comentarista': return { label: 'Visualizador', scope: 'Ve y comenta', color: 'bg-teal-100 text-teal-800' }
    case 'viewer_observaciones': return { label: 'Viewer de Observaciones', scope: 'Solo sus observaciones', color: 'bg-amber-100 text-amber-800' }
    case 'responsable_estandares': return { label: 'Resp. de Estándares', scope: 'Compliance SRT', color: 'bg-indigo-100 text-indigo-800' }
    case 'auditor_externo': return { label: 'Auditor', scope: 'Organismo de control (solo lectura)', color: 'bg-slate-100 text-slate-800' }
    case 'trabajador': return { label: 'Trabajador', scope: 'Solo lo suyo (capacitaciones y EPP)', color: 'bg-cyan-100 text-cyan-800' }
    default: return { label: 'Sin rol', color: 'bg-surface-elevated text-text-secondary' }
  }
}

// Traduce la elección amigable (rol + alcance) al rol interno del enum.
// REGLA: un visualizador NUNCA es consultora-wide. Su techo es nivel empresa
// (acceso puntual vía user_access), para que no vea datos de otro cliente.
export function resolveUserRole(friendly: FriendlyRoleKey, scope: ScopeKey): UserRole {
  if (friendly === 'admin') return 'full_access_main'
  if (friendly === 'colaborador') return scope === 'todo' ? 'full_access_branch' : 'colaborador'
  // El viewer de observaciones está scopeado por "responsable", no por empresa.
  if (friendly === 'viewer_obs') return 'viewer_observaciones'
  // Auditor del organismo de control: solo lectura consultora-wide, nunca escribe.
  if (friendly === 'auditor') return 'auditor_externo'
  // Trabajador: usuario final (operario). Ve solo lo suyo. No consume seat.
  if (friendly === 'trabajador') return 'trabajador'
  return 'visualizador_comentarista'
}

export interface VerificacionToken {
  id: string
  establecimiento_id: string
  token: string
  created_at: string
  last_accessed_at: string | null
  access_count: number
}

export interface InstrumentoMedicion {
  id: string
  // El instrumento se clasifica por la SUBCATEGORÍA del catálogo ("Mediciones HyS")
  // y su modelo sale del producto del catálogo. modelo/marca_id quedan denormalizados
  // (se setean desde el producto) para no romper lecturas existentes.
  subcategoria_id: string | null
  producto_id: string | null
  marca_id: string | null
  modelo: string | null
  numero_serie: string | null
  dueño_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  productos_componentes?: { nombre: string } | null
  productos?: { nombre: string } | null
  organizaciones_externas?: { nombre: string } | null
  personas_directorio?: { nombre: string; apellido: string } | null
}

export interface Matricula {
  id: string
  persona_id: string
  numero: string
  organismo_emisor_id: string | null
  colegio_profesional_id: string | null
  fecha_emision: string
  fecha_vencimiento: string
  certificado_url: string | null
  activa: boolean
  created_at: string
  personas_directorio?: { nombre: string; apellido: string } | null
  organizaciones_externas?: { nombre: string } | null
  colegios_profesionales?: { sigla: string; nombre: string; provincia: string } | null
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
  consultora_id: string | null
  created_at: string
}

export interface CategoriaGestion {
  id: string
  nombre: string
  grupo_id: string
  descripcion: string | null
  consultora_id: string | null
  created_at: string
  gestiones_grupos?: { nombre: string } | null
}

export type TipoEjecucion =
  | 'estandar'
  | 'reporte_fotografico'
  | 'medicion_iluminacion'
  | 'medicion_ruido'
  | 'medicion_carga_termica'
  | 'calculo_carga_fuego'
  | 'medicion_pat'
  | 'presentacion_autoproteccion'
  | 'protocolo_ergonomia'

export interface GestionChecklistCategoria {
  id: string
  categoria_id: string
  nombre: string
  descripcion: string | null
  consultora_id: string | null
  created_at: string
}

export interface Gestion {
  id: string
  nombre: string
  categoria_id: string
  checklist_categoria_id: string | null
  descripcion: string | null
  consultora_id: string | null
  created_at: string
  aplica_por_iso: boolean
  tiene_entregable: boolean
  tipo_ejecucion?: TipoEjecucion
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
  /** Timestamp (con hora) de la COMPLETACIÓN/FINALIZACIÓN real. NULL en borradores y no ejecutados. */
  ejecutado_at: string | null
  fecha_vencimiento: string | null
  responsable_id: string | null
  aprobado_por_id: string | null
  evidencia_url: string | null
  observaciones: string | null
  notas: string | null
  mostrar_lt: boolean
  secuencia: number
  created_at: string
  updated_at: string
  profiles?: { full_name: string } | null
  personas_directorio?: { nombre: string; apellido: string } | null
}

export interface ObservacionCategoria {
  id: string
  nombre: string
  nivel: number
  color: string
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
  foto_url: string | null
  sector_id: string | null
  puesto_id: string | null
  cliente_visto_at: string | null
  created_at: string
  updated_at: string
  observaciones_clasificaciones?: { nombre: string } | null
  observaciones_categorias?: { nombre: string; nivel: number } | null
  personas_directorio?: { nombre: string; apellido: string } | null
  establecimientos_sectores?: { nombre: string } | null
  puestos_de_trabajo?: { nombre: string } | null
}

export interface ObservacionComentario {
  id: string
  observacion_id: string
  autor_id: string
  es_viewer: boolean
  contenido: string
  created_at: string
  profiles?: { full_name: string | null; email: string | null } | null
}

export interface ObservacionFotoCliente {
  id: string
  observacion_id: string
  autor_id: string
  url: string
  categoria: string | null
  created_at: string
}

export interface Denuncia {
  id: string
  consultora_id: string
  empresa_id: string
  establecimiento_id: string
  titulo: string | null
  descripcion: string
  tipo_denuncia: string | null
  denunciante_tipo: string
  persona_id: string | null
  denunciante_nombre: string | null
  fecha_denuncia: string
  estado: string
  confidencial: boolean
  responsable_asignado_id: string | null
  acciones_tomadas: string | null
  conclusion: string | null
  cerrado_por: string | null
  fecha_cierre: string | null
  created_at: string
  updated_at: string
  personas_directorio?: { nombre: string; apellido: string } | null
  denuncias_fotos?: { url: string }[]
  denuncias_involucrados?: PersonaVinculo[]
}

/** @deprecated usar Denuncia */
export interface EstablecimientoDenuncia {
  id: string
  establecimiento_id: string
  fecha: string
  descripcion: string
  persona_id: string | null
  adjuntos_urls: string[]
  created_at: string
  personas_directorio?: { nombre: string; apellido: string } | null
}

export type FeedbackTipo = 'positivo' | 'negativo' | 'sugerencia'

// ---- Feedback + NPS (internal) ----
export type FeedbackNpsTipo = 'nps' | 'bug' | 'sugerencia' | 'general'
export type FeedbackStatus = 'nuevo' | 'revisado' | 'descartado' | 'implementado'
export type NpsCategoria = 'promotor' | 'pasivo' | 'detractor'

export interface Feedback {
  id: string
  user_id: string | null
  consultora_id: string | null
  tipo: FeedbackNpsTipo
  nps_score: number | null
  nps_categoria: NpsCategoria | null
  titulo: string | null
  comentario: string
  status: FeedbackStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joins opcionales (desde la query)
  user_email?: string
  user_nombre?: string
  consultora_nombre?: string
}

export interface NpsStats {
  total_respuestas: number
  promotores: number
  pasivos: number
  detractores: number
  nps_score: number
}

export interface NpsTrendPoint {
  mes: string
  total_respuestas: number
  nps_score: number
}

export interface EnteRegulador {
  id: string
  nombre: string
  abreviatura: string | null
  is_active: boolean
  created_at: string
}

export interface FeedbackCliente {
  id: string
  establecimiento_id: string
  fecha: string
  cliente: string
  tipo: FeedbackTipo
  descripcion: string
  persona_id: string | null
  adjuntos_urls: string[]
  created_at: string
  personas_directorio?: { nombre: string; apellido: string } | null
}

export type EstadoGestion = 'Realizado' | 'Pendiente' | 'Planificado'

export function calcularEstadoGestion(fechaEjecutada: string | null, fechaPlanificada: string): EstadoGestion {
  if (fechaEjecutada) return 'Realizado'
  // Comparación string-a-string en formato ISO (YYYY-MM-DD).
  // Evita el bug de timezone de `new Date(string)` que para fechas planas
  // parsea como UTC midnight y se "corre" un día en zonas con offset negativo
  // (ej. Argentina UTC-3 → '2026-05-31' termina representando el día anterior).
  const hoy = new Date()
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  return fechaPlanificada < hoyIso ? 'Pendiente' : 'Planificado'
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
  | 'documento_subcontratista'
  | 'matricula'
  | 'certificado'
  | 'sap_presentacion'
  | 'observacion_accion_inmediata'
  | 'incidente'
  | 'constancia_visita'
  | 'protocolo_medicion'

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
  // Derivados del documento_tipo asociado (match por nombre). Solo presentes para
  // items de tipo documento (empresa/establecimiento/persona); null para gestión.
  documento_tipo_id?: string | null
  pais_id?: string | null
}

export interface Pais {
  codigo: string
  nombre: string
  activo: boolean
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
export type FirmaEntidadTipo = 'gestion' | 'capacitacion' | 'permiso_trabajo' | 'entrega_epp' | 'curso_certificado' | 'medicion_pat' | 'medicion_iluminacion' | 'medicion_ruido' | 'medicion_carga_termica' | 'calculo_carga_fuego'
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

// ---- Entrega de EPP (conformidad / descargo POR ÍTEM) ----
// El profesional registra la entrega; el trabajador (cuenta + MFA) confirma u
// observa cada ítem. Validez legal vía audit_log con hash encadenado + firmas.
export type EntregaEppEstado = 'pendiente' | 'parcial' | 'confirmada' | 'observada'
export type EntregaEppItemConformidad = 'pendiente' | 'conforme' | 'observado'

export interface EntregaEppItem {
  id: string
  entrega_id: string
  consultora_id: string
  producto_id: string | null
  variante_id: string | null
  producto_nombre: string   // snapshot: qué se entregó (congelado para validez legal)
  talle: string | null
  cantidad: number
  conformidad: EntregaEppItemConformidad
  descargo: string | null   // motivo del trabajador si observa
  respondido_at: string | null
  created_at: string
}

export interface EntregaEpp {
  id: string
  consultora_id: string
  establecimiento_id: string | null
  persona_id: string        // el trabajador que recibe
  entregado_por_id: string | null
  entregado_por_nombre: string | null
  fecha_entrega: string
  estado: EntregaEppEstado
  observaciones: string | null
  geo_lat: number | null
  geo_lng: number | null
  geo_precision_m: number | null
  geo_captured_at: string | null
  respondida_at: string | null
  firma_id: string | null
  created_at: string
  updated_at: string
  // joins / agregados opcionales
  items?: EntregaEppItem[]
  personas_directorio?: { nombre: string; apellido: string } | null
  establecimientos?: { nombre: string } | null
}

export const ENTREGA_EPP_ESTADO_LABELS: Record<EntregaEppEstado, string> = {
  pendiente: 'Pendiente de conformidad',
  parcial: 'Respondida parcialmente',
  confirmada: 'Confirmada',
  observada: 'Con observaciones',
}

export const ENTREGA_EPP_ESTADO_COLORS: Record<EntregaEppEstado, string> = {
  pendiente: 'bg-gray-100 text-gray-800',
  parcial: 'bg-blue-100 text-blue-800',
  confirmada: 'bg-green-100 text-green-800',
  observada: 'bg-amber-100 text-amber-800',
}

// ---- Campus Virtual (Cursos) ----
export type CursoEstado = 'borrador' | 'publicado' | 'archivado'
export type CursoNivel = 'basico' | 'intermedio' | 'avanzado'
export type LeccionTipo = 'video' | 'pdf' | 'texto' | 'embed'
export type PreguntaTipo = 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_text'
export type AsignacionEstado = 'pendiente' | 'en_curso' | 'aprobado' | 'vencido' | 'desasignado'
export type ObligatorioScope = 'empresa' | 'establecimiento' | 'sector' | 'puesto'

export interface Curso {
  id: string
  consultora_id: string | null
  autor_id: string | null
  titulo: string
  descripcion_corta: string | null
  descripcion_larga: string | null
  portada_url: string | null
  categoria: string | null
  nivel: CursoNivel
  idioma: string
  duracion_estimada_minutos: number | null
  vencimiento_meses: number | null
  vigente_desde: string | null
  vigente_hasta: string | null
  estado: CursoEstado
  es_publico: boolean
  version: number
  configuracion_quiz: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CursoModulo {
  id: string
  curso_id: string
  orden: number
  titulo: string
  descripcion: string | null
  created_at: string
  updated_at: string
  lecciones: CursoLeccion[]
  quiz?: CursoQuiz | null
}

export interface CursoLeccion {
  id: string
  modulo_id: string
  orden: number
  titulo: string
  tipo: LeccionTipo
  contenido_url: string | null
  contenido_texto: string | null
  duracion_minutos: number | null
  descargable: boolean
  anti_skip: boolean
  created_at: string
  updated_at: string
}

export interface CursoQuiz {
  id: string
  curso_id: string
  modulo_id: string | null
  titulo: string
  porcentaje_aprobacion: number
  max_intentos: number | null
  tiempo_limite_minutos: number | null
  randomizar_preguntas: boolean
  mostrar_correctas: boolean
  created_at: string
  updated_at: string
  preguntas: CursoPregunta[]
}

export interface CursoPregunta {
  id: string
  quiz_id: string
  orden: number
  enunciado: string
  tipo: PreguntaTipo
  puntaje: number
  explicacion: string | null
  short_text_respuesta: string | null
  created_at: string
  opciones: CursoOpcion[]
}

export interface CursoOpcion {
  id: string
  pregunta_id: string
  orden: number
  texto: string
  es_correcta: boolean
}

export interface CursoAsignacion {
  id: string
  curso_id: string
  persona_id: string
  empresa_id: string | null
  establecimiento_id: string | null
  asignado_por_id: string | null
  fecha_asignacion: string
  fecha_limite: string | null
  obligatorio: boolean
  estado: AsignacionEstado
  fecha_inicio: string | null
  fecha_aprobacion: string | null
  progreso_porcentaje: number
  ultimo_acceso: string | null
  curso_version: number
  created_at: string
  updated_at: string
}

export interface CursoCertificado {
  id: string
  asignacion_id: string | null
  codigo_validacion: string
  firma_id: string | null
  pdf_path: string | null
  pdf_url: string | null
  fecha_emision: string
  fecha_vencimiento: string | null
  invalidado: boolean
  motivo_invalidacion: string | null
  created_at: string
}

export interface CertificadoPublico {
  codigo: string
  curso_titulo: string
  persona_nombre: string
  fecha_emision: string
  fecha_vencimiento: string | null
  valido: boolean
  autor_nombre: string | null
  consultora_nombre: string | null
}

export interface CumplimientoStats {
  porcentaje_global: number
  total_asignaciones: number
  aprobadas: number
  pendientes: number
  vencidas: number
  proximas_a_vencer: number
}

export interface CumplimientoEmpresa {
  empresa_id: string
  empresa_nombre: string
  porcentaje: number
  total: number
  aprobadas: number
  vencidas: number
  detalle_por_establecimiento?: {
    establecimiento_id: string
    establecimiento_nombre: string
    porcentaje: number
    total: number
    aprobadas: number
  }[]
}

export interface CumplimientoEmpresaResumen {
  empresa_id: string
  empresa_nombre: string
  porcentaje: number
  total: number
  aprobadas: number
  vencidas: number
}

export interface CumplimientoTrendPoint {
  mes: string
  porcentaje: number
  total: number
}

export const CURSO_NIVEL_LABELS: Record<CursoNivel, string> = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

export const CURSO_NIVEL_COLORS: Record<CursoNivel, string> = {
  basico: 'bg-green-100 text-green-800',
  intermedio: 'bg-yellow-100 text-yellow-800',
  avanzado: 'bg-red-100 text-red-800',
}

export const CURSO_ESTADO_LABELS: Record<CursoEstado, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  archivado: 'Archivado',
}

export const CURSO_ESTADO_COLORS: Record<CursoEstado, string> = {
  borrador: 'bg-gray-100 text-gray-800',
  publicado: 'bg-green-100 text-green-800',
  archivado: 'bg-orange-100 text-orange-800',
}

export const ASIGNACION_ESTADO_LABELS: Record<AsignacionEstado, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  aprobado: 'Aprobado',
  vencido: 'Vencido',
  desasignado: 'Desasignado',
}

export const ASIGNACION_ESTADO_COLORS: Record<AsignacionEstado, string> = {
  pendiente: 'bg-gray-100 text-gray-800',
  en_curso: 'bg-blue-100 text-blue-800',
  aprobado: 'bg-green-100 text-green-800',
  vencido: 'bg-red-100 text-red-800',
  desasignado: 'bg-gray-100 text-gray-500',
}

export const FIRMA_ENTIDAD_LABELS: Record<FirmaEntidadTipo, string> = {
  gestion: 'Gestión',
  capacitacion: 'Capacitación',
  permiso_trabajo: 'Permiso de Trabajo',
  entrega_epp: 'Entrega de EPP',
  curso_certificado: 'Certificado de Curso',
  medicion_pat: 'Medición de Puesta a Tierra',
  medicion_iluminacion: 'Medición de Iluminación',
  medicion_ruido: 'Medición de Ruido',
  medicion_carga_termica: 'Medición de Carga Térmica',
  calculo_carga_fuego: 'Cálculo de Carga de Fuego',
}

// ---- IPERC ----
export type IpercFactor =
  | 'Ambiental' | 'Biológico' | 'Ergonómico' | 'Físico'
  | 'Locativo' | 'Mecánico' | 'Psicosocial' | 'Químico'

export type IpercRiesgoTipo = 'Accidente' | 'Enfermedad Profesional' | 'Daños Materiales'

export type IpercProbabilidadNivel =
  | 'Muy Improbable' | 'Improbable' | 'Moderada' | 'Probable' | 'Muy Probable'

export type IpercConsecuenciaNivel =
  | 'Daño Leve' | 'Daño Moderado' | 'Daño Grave' | 'Daño Muy Grave' | 'Daño Fatal'

export type IpercNivelRiesgoNombre =
  | 'Riesgo Trivial' | 'Riesgo Tolerable' | 'Riesgo Moderado' | 'Riesgo Importante' | 'Riesgo Intolerable'

export interface IpercConsecuencia {
  id: string
  consultora_id: string | null
  nivel: IpercConsecuenciaNivel
  valor_numerico: number
  orden: number
  created_at: string
}

export interface IpercConsecuenciaItem {
  id: string
  consecuencia_id: string
  nombre: string
  descripcion: string | null
  created_at: string
}

export interface IpercProbabilidad {
  id: string
  consultora_id: string | null
  nivel: IpercProbabilidadNivel
  valor_numerico: number
  orden: number
  created_at: string
}

export interface IpercNivelRiesgo {
  id: string
  consultora_id: string | null
  nombre: IpercNivelRiesgoNombre
  valor_ref: number
  valor_min: number
  valor_max: number
  color: string
  acciones_requeridas: string
  created_at: string
}

export interface IpercPeligro {
  id: string
  consultora_id: string | null
  nombre: string
  factor: IpercFactor
  created_at: string
}

export interface IpercRiesgo {
  id: string
  consultora_id: string | null
  nombre: string
  tipo: IpercRiesgoTipo
  created_at: string
}

export interface MedidaControl {
  id: string
  consultora_id: string | null
  texto: string
  activo: boolean
  veces_usada: number
  created_at: string
  updated_at: string
}

export interface IpercSector {
  id: string
  establecimiento_id: string
  nombre: string
  descripcion: string | null
  poligono_coords: Record<string, number>[] | null
  nivel_riesgo_maximo_id: string | null
  nivel_riesgo_maximo?: IpercNivelRiesgo | null
  created_at: string
  updated_at: string
}

export interface IpercProceso {
  id: string
  sector_id: string
  nombre: string
  descripcion: string | null
  created_at: string
  tareas?: IpercTarea[]
}

export interface IpercTarea {
  id: string
  proceso_id: string
  nombre: string
  descripcion: string | null
  task_number: number
  created_at: string
  peligros?: IpercMatrizPeligroWithRelations[]
}

export interface IpercMatrizPeligro {
  id: string
  tarea_id: string
  peligro_id: string
  created_at: string
}

export interface IpercMatrizPeligroWithRelations extends IpercMatrizPeligro {
  peligro: IpercPeligro
  riesgos?: IpercMatrizRiesgoWithRelations[]
}

export interface IpercMatrizRiesgo {
  id: string
  peligro_matriz_id: string
  riesgo_id: string
  probabilidad_id: string | null
  consecuencia_id: string | null
  nivel_riesgo_id: string | null
  valor_calculado: number | null
  created_at: string
  updated_at: string
}

export interface IpercMatrizRiesgoWithRelations extends IpercMatrizRiesgo {
  riesgo: IpercRiesgo
  probabilidad?: IpercProbabilidad | null
  consecuencia?: IpercConsecuencia | null
  nivel_riesgo?: IpercNivelRiesgo | null
  medidas?: IpercRiesgoMedidaWithRelations[]
}

export interface IpercRiesgoMedida {
  id: string
  riesgo_matriz_id: string
  medida_id: string
  created_at: string
}

export interface IpercRiesgoMedidaWithRelations extends IpercRiesgoMedida {
  medida: MedidaControl
}

export interface IpercHistorialEstado {
  id: string
  riesgo_matriz_id: string
  estado_anterior_id: string | null
  estado_nuevo_id: string
  observacion: string | null
  usuario_id: string
  created_at: string
}

export const FACTOR_LABELS: Record<IpercFactor, string> = {
  Ambiental: 'Ambiental',
  Biológico: 'Biológico',
  Ergonómico: 'Ergonómico',
  Físico: 'Físico',
  Locativo: 'Locativo',
  Mecánico: 'Mecánico',
  Psicosocial: 'Psicosocial',
  Químico: 'Químico',
}

export const RIESGO_TIPO_LABELS: Record<IpercRiesgoTipo, string> = {
  Accidente: 'Accidente',
  'Enfermedad Profesional': 'Enfermedad Profesional',
  'Daños Materiales': 'Daños Materiales',
}

export const NIVEL_RIESGO_COLORS: Record<IpercNivelRiesgoNombre, string> = {
  'Riesgo Trivial': '#22c55e',
  'Riesgo Tolerable': '#eab308',
  'Riesgo Moderado': '#f97316',
  'Riesgo Importante': '#ef4444',
  'Riesgo Intolerable': '#7f1d1d',
}

export const NIVEL_RIESGO_BADGE: Record<IpercNivelRiesgoNombre, string> = {
  'Riesgo Trivial': 'bg-green-100 text-green-800',
  'Riesgo Tolerable': 'bg-yellow-100 text-yellow-800',
  'Riesgo Moderado': 'bg-orange-100 text-orange-800',
  'Riesgo Importante': 'bg-red-100 text-red-800',
  'Riesgo Intolerable': 'bg-red-900 text-white',
}

export function calcularNivelRiesgo(probabilidad: number, consecuencia: number): {
  valor: number
  nombre: IpercNivelRiesgoNombre
} {
  const valor = probabilidad * consecuencia
  if (valor >= 20 && valor <= 25) return { valor, nombre: 'Riesgo Intolerable' }
  if (valor >= 15 && valor < 20) return { valor, nombre: 'Riesgo Importante' }
  if (valor >= 10 && valor < 15) return { valor, nombre: 'Riesgo Moderado' }
  if (valor >= 5 && valor < 10) return { valor, nombre: 'Riesgo Tolerable' }
  return { valor, nombre: 'Riesgo Trivial' }
}

// ---- Plan types (admin) ----
export interface Plan {
  id: string
  nombre: string
  slug: string
  tipo: string
  precio_mensual_neto: number | null
  precio_anual_neto: number | null
  iva_porcentaje: number
  max_colaboradores: number | null
  max_empresas: number | null
  max_establecimientos: number | null
  max_gestiones_registros: number | null
  max_horarios_registros: number | null
  precio_extra_seat_neto: number | null
  is_active: boolean
  sort_order: number
  is_visible: boolean
  descripcion_corta: string | null
  destacado: boolean
  created_at: string
  updated_at: string
  plan_features?: PlanFeature[]
}

export interface PlanFeature {
  id: string
  plan_id: string
  feature_key: string
  habilitado: boolean
  created_at: string
}

export interface PlanWithSubscribers extends Plan {
  subscriber_count?: number
  active_subscriptions_count?: number
}

// ---- Mercado Pago types ----
export type SubscriptionEstadoMP = 'pending' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'
export type PlanTipo = 'profesional' | 'consultora'
export type MPTopic = 'payment' | 'subscription_preapproval' | 'subscription_authorized_payment' | 'plan'

export interface SubscriptionState {
  id: string
  consultora_id: string
  plan_id: string
  plan_nombre: string
  plan_precio: number
  plan_tipo: string
  estado: SubscriptionEstadoMP
  current_period_start?: string
  current_period_end?: string
  trial_end?: string
  past_due_grace_until?: string
  mp_preapproval_id?: string
  card_last4?: string
  card_brand?: string
  cancelled_at?: string
  plan_id_pendiente?: string
  aplicar_cambio_en?: string
}

export interface ProrrataResult {
  monto: number
  dias_restantes: number
  precio_actual: number
  precio_nuevo: number
}

// ---- Action result ----
export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string; data?: unknown }

// ---- Catálogo de documentos (Fase 1 Legajo Técnico) ----

export type NivelDocumento =
  | 'empresa'
  | 'empresa_establecimiento'
  | 'establecimiento'
  | 'persona'
  | 'persona_empresa'
  | 'persona_establecimiento'

export type VigenciaTipo = 'unica_vez' | 'periodica'

export type Jurisdiccion = 'nacional' | 'provincial' | 'municipal'

export type PeriodicidadDocumento =
  | 'mensual' | 'semanal' | 'semestral' | 'anual' | 'cada_6_anios'
  | 'no_vence' | 'vto_aviso_obra' | 'vto_inicio_obra' | 'por_gestion' | 'fecha_vto'

/** Fila del catálogo establecimientos_tipos (id + codigo + nombre) */
export interface TipoEstablecimientoItem {
  id: string
  codigo: string
  nombre: string
}

/** Fila del catálogo global documentos_tipos con las columnas de Fase 1 */
export interface DocumentoTipoConfig {
  id: string
  nombre: string
  descripcion: string | null
  aplica_empresa: boolean
  aplica_establecimiento: boolean
  aplica_empleado: boolean
  pais_id: string | null
  categoria_legajo: string | null
  periodicidad: PeriodicidadDocumento | null
  is_active: boolean
  // Columnas nuevas — Fase 1
  nivel: NivelDocumento | null
  vigencia_tipo: VigenciaTipo | null
  jurisdiccion: Jurisdiccion | null
  jurisdiccion_provincia: string | null
  jurisdiccion_municipio: string | null
  requiere_alerta: boolean
  dias_alerta: number
  // Legajo condicional — modo de aplicación + pregunta inducida + norma
  requiere_pregunta: boolean
  pregunta_sugerida: string | null
  pregunta_id: string | null
  norma_id: string | null
  // IDs de tipos de establecimiento a los que aplica (vacío = todos)
  tipos_establecimiento_ids: string[]
}

/** Opción de pregunta de riesgo (para el selector del catálogo). */
export interface PreguntaRiesgoItem {
  id: string
  codigo: string
  texto: string
}

/** Opción de norma (para el selector de FK del catálogo). */
export interface NormaItem {
  id: string
  etiqueta: string
}

// ─────────────────────────────────────────────────────────────
// PROTOCOLO DE ERGONOMÍA (Res. SRT 886/15 + Disp. SRT 1/2016)
// ─────────────────────────────────────────────────────────────

/** Factores de riesgo ergonómico identificados por la resolución. */
export type FactorErgonomia = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'

/** Nivel de riesgo determinado por la evaluación inicial (Planilla 2). */
export type NivelRiesgoErgonomia = 'tolerable' | 'no_tolerable' | 'requiere_evaluacion'

/** Subtipo de vibraciones — solo aplica al factor G. */
export type VibSubtipo = 'mano_brazo' | 'cuerpo_entero'

/** Resultado de una pregunta individual de Paso 1 o Paso 2. */
export interface RespuestaPaso {
  n: number
  respuesta: boolean
}

/** Medida específica (libre) de la Planilla 3. */
export interface MedidaEspecifica {
  descripcion: string
  tipo: 'administrativa' | 'ingenieria'
  fecha?: string | null
  observaciones?: string | null
}

// ── Input para crear el protocolo (viene del FormData como JSON) ──

export interface ErgonomiaFactorTareaInput {
  factor: FactorErgonomia
  tarea_numero: 1 | 2 | 3
  presente: boolean
  tiempo_exposicion?: string | null
  nivel_riesgo?: NivelRiesgoErgonomia | null
}

export interface ErgonomiaEvaluacionFactorInput {
  factor: FactorErgonomia
  tarea_numero: 1 | 2 | 3
  paso1_respuestas: RespuestaPaso[]
  paso1_implica: boolean
  paso2_respuestas: RespuestaPaso[]
  nivel_resultante: NivelRiesgoErgonomia | null
  observaciones?: string | null
  vibracion_subtipo?: VibSubtipo | null
}

export interface ErgonomiaMedidasInput {
  tarea_numero?: 1 | 2 | 3 | null
  mg1_informado?: boolean | null
  mg1_fecha?: string | null
  mg1_observaciones?: string | null
  mg2_capacitado_sintomas?: boolean | null
  mg2_fecha?: string | null
  mg2_observaciones?: string | null
  mg3_capacitado_medidas?: boolean | null
  mg3_fecha?: string | null
  mg3_observaciones?: string | null
  medidas_especificas: MedidaEspecifica[]
  observaciones?: string | null
}

export interface ErgonomiaSeguimientoInput {
  numero_mcp?: number | null
  nombre_puesto?: string | null
  fecha_evaluacion?: string | null
  nivel_riesgo?: string | null
  fecha_implementacion_admin?: string | null
  fecha_implementacion_ingenieria?: string | null
  fecha_cierre?: string | null
  observaciones?: string | null
  orden?: number | null
}

// ── Tipos para el viewer (lectura completa) ──

export interface ErgonomiaEvaluacionDetalle {
  id: string
  consultora_id: string
  establecimiento_id: string
  registro_gestion_id: string
  rg_fecha_planificada: string
  area_sector: string | null
  puesto_de_trabajo: string | null
  n_trabajadores: number | null
  capacitacion: boolean | null
  procedimiento_escrito: boolean | null
  ubicacion_sintoma: string | null
  nombre_trabajadores: string | null
  manifestacion_temprana: boolean | null
  firmante: string | null
  firmante_persona_id: string | null
  observaciones: string | null
  conclusiones: string | null
  recomendaciones: string | null
  estado: string
  fecha_evaluacion: string | null
  created_at: string
  establecimientos?: {
    id: string
    nombre: string
    domicilio?: string | null
    empresas?: { id: string; razon_social: string; cuit?: string | null } | null
  } | null
  ergonomia_tareas?: Array<{
    id: string
    numero: number
    descripcion: string | null
    orden: number | null
  }> | null
  ergonomia_factores_tarea?: Array<{
    id: string
    factor: FactorErgonomia
    tarea_numero: number
    presente: boolean
    tiempo_exposicion: string | null
    nivel_riesgo: NivelRiesgoErgonomia | null
  }> | null
  ergonomia_evaluacion_factor?: Array<{
    id: string
    factor: FactorErgonomia
    tarea_numero: number
    paso1_respuestas: RespuestaPaso[]
    paso1_implica: boolean | null
    paso2_respuestas: RespuestaPaso[]
    nivel_resultante: NivelRiesgoErgonomia | null
    observaciones: string | null
    vibracion_subtipo: VibSubtipo | null
  }> | null
  ergonomia_medidas?: Array<{
    id: string
    tarea_numero: number | null
    mg1_informado: boolean | null
    mg1_fecha: string | null
    mg1_observaciones: string | null
    mg2_capacitado_sintomas: boolean | null
    mg2_fecha: string | null
    mg2_observaciones: string | null
    mg3_capacitado_medidas: boolean | null
    mg3_fecha: string | null
    mg3_observaciones: string | null
    medidas_especificas: MedidaEspecifica[]
    observaciones: string | null
  }> | null
  ergonomia_seguimiento?: Array<{
    id: string
    numero_mcp: number | null
    nombre_puesto: string | null
    fecha_evaluacion: string | null
    nivel_riesgo: string | null
    fecha_implementacion_admin: string | null
    fecha_implementacion_ingenieria: string | null
    fecha_cierre: string | null
    observaciones: string | null
    orden: number | null
  }> | null
}
