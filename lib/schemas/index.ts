import { z } from 'zod'

export const systemRoleSchema = z.enum(['developer', 'user'])
export type SystemRole = z.infer<typeof systemRoleSchema>

export const userRoleSchema = z.enum([
  'full_access_main',
  'full_access_branch',
  'colaborador',
  'full_viewer',
  'colaborador_viewer',
])
export type UserRole = z.infer<typeof userRoleSchema>

export const tipoEstablecimientoSchema = z.enum([
  'industria',
  'agro',
  'construccion',
  'comercio',
  'administrativo',
  'logistica',
  'centro_salud',
  'otro',
  'obra_construccion',
  'local_comercial',
  'local_administrativo',
])
export type TipoEstablecimiento = z.infer<typeof tipoEstablecimientoSchema>

export const siniestroTipoSchema = z.enum([
  'accidente',
  'incidente',
  'casi_accidente',
  'enfermedad_profesional',
])

export const siniestroEstadoSchema = z.enum([
  'pendiente',
  'en_investigacion',
  'cerrado',
])

export const inspeccionEstadoSchema = z.enum([
  'programada',
  'realizada',
  'con_observaciones',
  'cancelada',
])

export const capacitacionEstadoSchema = z.enum([
  'programada',
  'realizada',
  'cancelada',
])

export const riesgoNivelSchema = z.enum([
  'bajo',
  'medio',
  'alto',
  'critico',
])

export const medicionTipoSchema = z.enum([
  'ruido',
  'iluminacion',
  'temperatura',
  'humedad',
  'vibraciones',
  'gases',
  'polvo',
  'otro',
])

export const documentoTipoSchema = z.enum([
  'habilitacion',
  'seguro',
  'certificado',
  'procedimiento',
  'instructivo',
  'otro',
])

export const unidadMedidaSchema = z.enum([
  'g', 'kg', 'ml', 'l', 'unidad', 'par', 'caja', 'rollo', 'metro',
])

export const establecimientoStatusSchema = z.enum([
  'active',
  'finished',
  'proposal',
  'lead',
  'on_hold',
  'not_awarded',
  'cancelled',
])

export const feedbackTipoSchema = z.enum(['positivo', 'negativo', 'sugerencia'])

export const estadoGestionSchema = z.enum(['Realizado', 'Pendiente', 'Planificado'])

export const answerValueSchema = z.enum(['cumple', 'no_cumple', 'no_aplica'])

export const diaSemanaSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2),
  z.literal(3), z.literal(4), z.literal(5), z.literal(6),
])

export const puestoWorkTypeSchema = z.enum(['operativo', 'administrativo']).nullable()

export const subcontratistaIdentidadSchema = z.enum(['CUIT', 'CUIL', 'CDI']).nullable()

// ---- Domain entity schemas ----

export const profileSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1),
  avatar_url: z.string().url().nullable(),
  system_role: systemRoleSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const consultoraSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1),
  cuit: z.string().nullable(),
  telefono: z.string().nullable(),
  email: z.string().email().nullable(),
  logo_url: z.string().url().nullable(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const empresaSchema = z.object({
  id: z.string().uuid(),
  consultora_id: z.string().uuid(),
  razon_social: z.string().min(1),
  tipo_identidad_impositiva: z.string().nullable(),
  cuit: z.string().nullable(),
  rubro_id: z.string().uuid().nullable(),
  domicilio: z.string().nullable(),
  codigo_postal: z.string().nullable(),
  localidad_id: z.string().uuid().nullable(),
  art_id: z.string().uuid().nullable(),
  art_numero_contrato: z.string().nullable(),
  logo_small_url: z.string().url().nullable(),
  logo_destacado_url: z.string().url().nullable(),
  informacion_general: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const establecimientoSchema = z.object({
  id: z.string().uuid(),
  empresa_id: z.string().uuid(),
  nombre: z.string().min(1),
  tipo_id: z.string().uuid().nullable(),
  domicilio: z.string().nullable(),
  codigo_postal: z.string().nullable(),
  localidad_id: z.string().uuid().nullable(),
  actividad_principal: z.string().nullable(),
  cantidad_trabajadores: z.number().int().nonnegative().nullable(),
  horario_trabajo: z.string().nullable(),
  description: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  photo_site: z.string().nullable(),
  code: z.string().nullable(),
  ref: z.string().nullable(),
  floor_plan_pdf_url: z.string().url().nullable(),
  floor_plan_cad_url: z.string().url().nullable(),
  google_maps_url: z.string().url().nullable(),
  ac_area: z.number().nonnegative().nullable(),
  gross_area: z.number().nonnegative().nullable(),
  status: establecimientoStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const siniestroSchema = z.object({
  id: z.string().uuid(),
  establecimiento_id: z.string().uuid(),
  persona_id: z.string().uuid().nullable(),
  tipo: siniestroTipoSchema,
  estado: siniestroEstadoSchema,
  fecha_ocurrencia: z.string().min(1),
  descripcion: z.string().nullable(),
  dias_perdidos: z.number().int().nonnegative().nullable(),
  requiere_derivacion: z.boolean(),
  acciones_correctivas: z.string().nullable(),
  reportado_por: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const inspeccionSchema = z.object({
  id: z.string().uuid(),
  establecimiento_id: z.string().uuid(),
  estado: inspeccionEstadoSchema,
  fecha_programada: z.string().min(1),
  fecha_realizada: z.string().nullable(),
  inspector_id: z.string().uuid().nullable(),
  observaciones: z.string().nullable(),
  puntaje: z.number().int().min(0).max(100).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const riesgoSchema = z.object({
  id: z.string().uuid(),
  establecimiento_id: z.string().uuid(),
  descripcion: z.string().min(1),
  nivel: riesgoNivelSchema,
  medida_correctiva: z.string().nullable(),
  responsable_id: z.string().uuid().nullable(),
  fecha_identificacion: z.string().min(1),
  fecha_resolucion: z.string().nullable(),
  resuelto: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const documentoShema = z.object({
  id: z.string().uuid(),
  empresa_id: z.string().uuid().nullable(),
  establecimiento_id: z.string().uuid().nullable(),
  tipo_id: z.string().uuid().nullable(),
  archivo_url: z.string().url().nullable(),
  fecha_emision: z.string().nullable(),
  fecha_vencimiento: z.string().nullable(),
  legajo_tecnico: z.boolean(),
  subido_por: z.string().nullable(),
  created_at: z.string().datetime(),
})

export const registroGestionSchema = z.object({
  id: z.string().uuid(),
  gestion_establecimiento_id: z.string().uuid(),
  index: z.number().int().nonnegative().nullable(),
  fecha_planificada: z.string().min(1),
  fecha_ejecutada: z.string().nullable(),
  responsable_id: z.string().uuid().nullable(),
  aprobado_por_id: z.string().uuid().nullable(),
  evidencia_url: z.string().url().nullable(),
  observaciones: z.string().nullable(),
  notas: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const observacionGestionSchema = z.object({
  id: z.string().uuid(),
  registro_gestion_id: z.string().uuid(),
  descripcion: z.string().min(1),
  fecha_planificada: z.string().min(1),
  fecha_cierre: z.string().nullable(),
  clasificacion_id: z.string().uuid().nullable(),
  categoria_id: z.string().uuid().nullable(),
  responsable_id: z.string().uuid().nullable(),
  responsable_cierre_id: z.string().uuid().nullable(),
  evidencia_cierre_url: z.string().url().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const directorioPersonaSchema = z.object({
  id: z.string().uuid(),
  tipo_id: z.string().uuid(),
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  dni: z.string().nullable(),
  fecha_nacimiento: z.string().nullable(),
  fecha_ingreso: z.string().nullable(),
  legajo: z.string().nullable(),
  telefono: z.string().nullable(),
  email: z.string().email().nullable(),
  organizacion_id: z.string().uuid().nullable(),
  notas: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const denunciaSchema = z.object({
  id: z.string().uuid(),
  establecimiento_id: z.string().uuid(),
  fecha: z.string().min(1),
  descripcion: z.string().min(1),
  created_at: z.string().datetime(),
})

export const feedbackClienteSchema = z.object({
  id: z.string().uuid(),
  establecimiento_id: z.string().uuid(),
  fecha: z.string().min(1),
  cliente: z.string().min(1),
  tipo: feedbackTipoSchema,
  descripcion: z.string().min(1),
  created_at: z.string().datetime(),
})

// ---- Form schemas (for server action validation) ----

export const createEmpresaFormSchema = z.object({
  razon_social: z.string().min(1, 'Razón social requerida'),
  cuit: z.string().regex(/^\d{11}$/, 'CUIT debe tener 11 dígitos').nullable().optional(),
  domicilio: z.string().nullable().optional(),
  rubro_id: z.string().uuid().nullable().optional(),
  localidad_id: z.string().uuid().nullable().optional(),
})

export const createEstablecimientoFormSchema = z.object({
  empresa_id: z.string().uuid(),
  nombre: z.string().min(1, 'Nombre requerido'),
  tipo_id: z.string().uuid().nullable().optional(),
  domicilio: z.string().nullable().optional(),
  localidad_id: z.string().uuid().nullable().optional(),
  actividad_principal: z.string().nullable().optional(),
  cantidad_trabajadores: z.coerce.number().int().nonnegative().nullable().optional(),
  status: establecimientoStatusSchema.default('active'),
})

export const crearSiniestroFormSchema = z.object({
  establecimiento_id: z.string().uuid(),
  tipo: siniestroTipoSchema,
  fecha_ocurrencia: z.string().min(1, 'Fecha requerida'),
  descripcion: z.string().nullable().optional(),
  persona_id: z.string().uuid().nullable().optional(),
  requiere_derivacion: z.preprocess(v => v === 'on' || v === true, z.boolean()).default(false),
})

export const crearInspeccionFormSchema = z.object({
  establecimiento_id: z.string().uuid(),
  fecha_programada: z.string().min(1, 'Fecha requerida'),
  observaciones: z.string().nullable().optional(),
})

export const crearRiesgoFormSchema = z.object({
  establecimiento_id: z.string().uuid(),
  descripcion: z.string().min(1, 'Descripción requerida'),
  nivel: riesgoNivelSchema,
  medida_correctiva: z.string().nullable().optional(),
  fecha_identificacion: z.string().min(1, 'Fecha requerida'),
})

export const createSectorFormSchema = z.object({
  establecimiento_id: z.string().uuid(),
  nombre: z.string().min(1, 'Nombre requerido'),
})

export const createPuestoFormSchema = z.object({
  sector_id: z.string().uuid(),
  nombre: z.string().min(1, 'Nombre requerido'),
  tipo: puestoWorkTypeSchema,
})

export const createPersonaFormSchema = z.object({
  establecimiento_id: z.string().uuid(),
  nombre: z.string().min(1, 'Nombre requerido'),
  apellido: z.string().min(1, 'Apellido requerido'),
  tipo_id: z.string().uuid(),
  dni: z.string().nullable().optional(),
  fecha_ingreso: z.string().nullable().optional(),
})

export const createAsistenciaFormSchema = z.object({
  establecimiento_id: z.string().uuid(),
  persona_id: z.string().uuid(),
  fecha: z.string().min(1, 'Fecha requerida'),
  hora_entrada: z.string().min(1, 'Hora de entrada requerida'),
  hora_salida: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
})

export const createDocumentoFormSchema = z.object({
  empresa_id: z.string().uuid(),
  establecimiento_id: z.string().uuid().nullable().optional(),
  tipo_id: z.string().uuid(),
  archivo_url: z.string().url().nullable().optional(),
  fecha_emision: z.string().nullable().optional(),
  fecha_vencimiento: z.string().nullable().optional(),
})

export const createRegistroGestionFormSchema = z.object({
  gestion_establecimiento_id: z.string().uuid(),
  fecha_planificada: z.string().min(1, 'Fecha requerida'),
  responsable_id: z.string().uuid().nullable().optional(),
})

export const createObservacionFormSchema = z.object({
  registro_gestion_id: z.string().uuid(),
  descripcion: z.string().min(1, 'Descripción requerida'),
  fecha_planificada: z.string().min(1, 'Fecha requerida'),
  categoria_id: z.string().uuid().nullable().optional(),
  responsable_cierre_id: z.string().uuid().nullable().optional(),
})

export const createDenunciaFormSchema = z.object({
  establecimiento_id: z.string().uuid(),
  fecha: z.string().min(1, 'Fecha requerida'),
  descripcion: z.string().min(1, 'Descripción requerida'),
})

export const createFeedbackFormSchema = z.object({
  establecimiento_id: z.string().uuid(),
  fecha: z.string().min(1, 'Fecha requerida'),
  cliente: z.string().min(1, 'Cliente requerido'),
  tipo: feedbackTipoSchema,
  descripcion: z.string().min(1, 'Descripción requerida'),
})

export const addGestionEstablecimientoFormSchema = z.object({
  gestion_id: z.string().uuid(),
  establecimiento_id: z.string().uuid(),
})

export const addOrganizacionFormSchema = z.object({
  establecimiento_id: z.string().uuid(),
  nombre: z.string().min(1, 'Nombre requerido'),
  tipo_id: z.string().uuid(),
  email: z.string().email().nullable().optional(),
  telefono: z.string().nullable().optional(),
})

// ---- Action result ----
export const actionSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({ success: z.literal(true), data: dataSchema })

export const actionErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
})

export const actionResultSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.union([actionSuccessSchema(dataSchema), actionErrorSchema])

// ---- Utility schemas ----
export const uuidParamSchema = z.string().uuid('ID inválido')
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
export const cuitSchema = z.string().regex(/^\d{11}$/, 'CUIT debe tener 11 dígitos')
export const emailSchema = z.string().email('Email inválido').nullable().optional()
