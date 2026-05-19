-- ============================================================
-- Rename tables to follow consistent plural/domain-prefix naming.
-- Pattern: domain_entity  (e.g. gestiones_grupos, establecimientos_sectores)
--
-- After each group of renames, RLS policies whose names still carry
-- the old table name are renamed to match the new table name.
-- Only policies that actually exist are renamed (confirmed by reading
-- every migration file that contains CREATE POLICY statements).
-- Each ALTER POLICY block is wrapped in a DO $$ BEGIN … END $$ so the
-- migration is idempotent and safe even if a policy was already renamed.
-- ============================================================


-- ============================================================
-- GESTIONES
-- ============================================================
ALTER TABLE grupo_gestiones              RENAME TO gestiones_grupos;
ALTER TABLE categoria_gestiones          RENAME TO gestiones_categorias;
ALTER TABLE gestion_establecimiento      RENAME TO gestiones_establecimientos;
ALTER TABLE registro_gestiones           RENAME TO gestiones_registros;
ALTER TABLE observaciones_gestiones      RENAME TO gestiones_observaciones;
ALTER TABLE gestion_tipos_establecimiento RENAME TO gestiones_tipos_establecimiento;

DO $$ BEGIN
  ALTER POLICY "grupo_gestiones: select" ON gestiones_grupos    RENAME TO "gestiones_grupos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "grupo_gestiones: insert" ON gestiones_grupos    RENAME TO "gestiones_grupos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "grupo_gestiones: update" ON gestiones_grupos    RENAME TO "gestiones_grupos: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "grupo_gestiones: delete" ON gestiones_grupos    RENAME TO "gestiones_grupos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "categoria_gestiones: select" ON gestiones_categorias RENAME TO "gestiones_categorias: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "categoria_gestiones: insert" ON gestiones_categorias RENAME TO "gestiones_categorias: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "categoria_gestiones: update" ON gestiones_categorias RENAME TO "gestiones_categorias: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "categoria_gestiones: delete" ON gestiones_categorias RENAME TO "gestiones_categorias: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "gestion_establecimiento: select" ON gestiones_establecimientos RENAME TO "gestiones_establecimientos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "gestion_establecimiento: insert" ON gestiones_establecimientos RENAME TO "gestiones_establecimientos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "gestion_establecimiento: delete" ON gestiones_establecimientos RENAME TO "gestiones_establecimientos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "registro_gestiones: select" ON gestiones_registros RENAME TO "gestiones_registros: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "registro_gestiones: insert" ON gestiones_registros RENAME TO "gestiones_registros: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "registro_gestiones: update" ON gestiones_registros RENAME TO "gestiones_registros: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "registro_gestiones: delete" ON gestiones_registros RENAME TO "gestiones_registros: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "observaciones_gestiones: select" ON gestiones_observaciones RENAME TO "gestiones_observaciones: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "observaciones_gestiones: insert" ON gestiones_observaciones RENAME TO "gestiones_observaciones: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "observaciones_gestiones: update" ON gestiones_observaciones RENAME TO "gestiones_observaciones: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "observaciones_gestiones: delete" ON gestiones_observaciones RENAME TO "gestiones_observaciones: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "gestion_tipos_establecimiento: select" ON gestiones_tipos_establecimiento RENAME TO "gestiones_tipos_establecimiento: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "gestion_tipos_establecimiento: insert" ON gestiones_tipos_establecimiento RENAME TO "gestiones_tipos_establecimiento: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "gestion_tipos_establecimiento: delete" ON gestiones_tipos_establecimiento RENAME TO "gestiones_tipos_establecimiento: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- FORMULARIOS
-- ============================================================
ALTER TABLE formulario_secciones      RENAME TO formularios_secciones;
ALTER TABLE formulario_items          RENAME TO formularios_items;
ALTER TABLE formulario_respuestas     RENAME TO formularios_respuestas;
ALTER TABLE formulario_item_respuestas RENAME TO formularios_items_respuestas;
ALTER TABLE formulario_seccion_aspectos RENAME TO formularios_secciones_aspectos;

DO $$ BEGIN
  ALTER POLICY "formulario_secciones: select" ON formularios_secciones RENAME TO "formularios_secciones: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_secciones: insert" ON formularios_secciones RENAME TO "formularios_secciones: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_secciones: update" ON formularios_secciones RENAME TO "formularios_secciones: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_secciones: delete" ON formularios_secciones RENAME TO "formularios_secciones: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "formulario_items: select" ON formularios_items RENAME TO "formularios_items: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_items: insert" ON formularios_items RENAME TO "formularios_items: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_items: update" ON formularios_items RENAME TO "formularios_items: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_items: delete" ON formularios_items RENAME TO "formularios_items: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "formulario_respuestas: select" ON formularios_respuestas RENAME TO "formularios_respuestas: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_respuestas: insert" ON formularios_respuestas RENAME TO "formularios_respuestas: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_respuestas: update" ON formularios_respuestas RENAME TO "formularios_respuestas: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_respuestas: delete" ON formularios_respuestas RENAME TO "formularios_respuestas: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "formulario_item_respuestas: select" ON formularios_items_respuestas RENAME TO "formularios_items_respuestas: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_item_respuestas: insert" ON formularios_items_respuestas RENAME TO "formularios_items_respuestas: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_item_respuestas: update" ON formularios_items_respuestas RENAME TO "formularios_items_respuestas: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_item_respuestas: delete" ON formularios_items_respuestas RENAME TO "formularios_items_respuestas: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "formulario_seccion_aspectos: select" ON formularios_secciones_aspectos RENAME TO "formularios_secciones_aspectos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_seccion_aspectos: insert" ON formularios_secciones_aspectos RENAME TO "formularios_secciones_aspectos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "formulario_seccion_aspectos: delete" ON formularios_secciones_aspectos RENAME TO "formularios_secciones_aspectos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- ESTABLECIMIENTOS
-- ============================================================
ALTER TABLE sectores_establecimiento             RENAME TO establecimientos_sectores;
ALTER TABLE horarios_establecimiento             RENAME TO establecimientos_horarios;
ALTER TABLE establecimiento_documentos           RENAME TO establecimientos_documentos;
ALTER TABLE establecimiento_denuncias            RENAME TO establecimientos_denuncias;
ALTER TABLE establecimiento_feedback_clientes    RENAME TO establecimientos_feedback_clientes;
ALTER TABLE establecimiento_respuestas           RENAME TO establecimientos_respuestas;
ALTER TABLE tipos_establecimiento                RENAME TO establecimientos_tipos;
ALTER TABLE categorias_info_establecimiento      RENAME TO establecimientos_categorias_info;
ALTER TABLE organizacion_establecimiento         RENAME TO organizaciones_establecimientos;
ALTER TABLE persona_establecimiento              RENAME TO personas_establecimientos;
ALTER TABLE documentacion_tipos_establecimiento  RENAME TO establecimientos_tipos_documentos;

-- sectores_establecimiento had policies named "sectores: ..." (not "sectores_establecimiento: ...")
-- so there are no "sectores_establecimiento: ..." policy names to rename.

-- horarios_establecimiento had non-standard policy names ("Authenticated read/write horarios")
-- which do not follow the "tablename: verb" pattern — skip.

DO $$ BEGIN
  ALTER POLICY "establecimiento_documentos: select" ON establecimientos_documentos RENAME TO "establecimientos_documentos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "establecimiento_documentos: insert" ON establecimientos_documentos RENAME TO "establecimientos_documentos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "establecimiento_documentos: update" ON establecimientos_documentos RENAME TO "establecimientos_documentos: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "establecimiento_documentos: delete" ON establecimientos_documentos RENAME TO "establecimientos_documentos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "establecimiento_denuncias: select" ON establecimientos_denuncias RENAME TO "establecimientos_denuncias: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "establecimiento_denuncias: insert" ON establecimientos_denuncias RENAME TO "establecimientos_denuncias: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "establecimiento_denuncias: update" ON establecimientos_denuncias RENAME TO "establecimientos_denuncias: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "establecimiento_denuncias: delete" ON establecimientos_denuncias RENAME TO "establecimientos_denuncias: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "establecimiento_feedback_clientes: select" ON establecimientos_feedback_clientes RENAME TO "establecimientos_feedback_clientes: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "establecimiento_feedback_clientes: insert" ON establecimientos_feedback_clientes RENAME TO "establecimientos_feedback_clientes: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "establecimiento_feedback_clientes: update" ON establecimientos_feedback_clientes RENAME TO "establecimientos_feedback_clientes: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "establecimiento_feedback_clientes: delete" ON establecimientos_feedback_clientes RENAME TO "establecimientos_feedback_clientes: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "establecimiento_respuestas: select" ON establecimientos_respuestas RENAME TO "establecimientos_respuestas: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "establecimiento_respuestas: insert" ON establecimientos_respuestas RENAME TO "establecimientos_respuestas: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "establecimiento_respuestas: update" ON establecimientos_respuestas RENAME TO "establecimientos_respuestas: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "establecimiento_respuestas: delete" ON establecimientos_respuestas RENAME TO "establecimientos_respuestas: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- tipos_establecimiento had only a select policy
DO $$ BEGIN
  ALTER POLICY "tipos_establecimiento: select" ON establecimientos_tipos RENAME TO "establecimientos_tipos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "categorias_info_establecimiento: select" ON establecimientos_categorias_info RENAME TO "establecimientos_categorias_info: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "categorias_info_establecimiento: insert" ON establecimientos_categorias_info RENAME TO "establecimientos_categorias_info: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "categorias_info_establecimiento: update" ON establecimientos_categorias_info RENAME TO "establecimientos_categorias_info: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "categorias_info_establecimiento: delete" ON establecimientos_categorias_info RENAME TO "establecimientos_categorias_info: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "organizacion_establecimiento: select" ON organizaciones_establecimientos RENAME TO "organizaciones_establecimientos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "organizacion_establecimiento: insert" ON organizaciones_establecimientos RENAME TO "organizaciones_establecimientos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "organizacion_establecimiento: delete" ON organizaciones_establecimientos RENAME TO "organizaciones_establecimientos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "persona_establecimiento: select" ON personas_establecimientos RENAME TO "personas_establecimientos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "persona_establecimiento: insert" ON personas_establecimientos RENAME TO "personas_establecimientos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "persona_establecimiento: delete" ON personas_establecimientos RENAME TO "personas_establecimientos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "documentacion_tipos_establecimiento: select" ON establecimientos_tipos_documentos RENAME TO "establecimientos_tipos_documentos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "documentacion_tipos_establecimiento: insert" ON establecimientos_tipos_documentos RENAME TO "establecimientos_tipos_documentos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "documentacion_tipos_establecimiento: delete" ON establecimientos_tipos_documentos RENAME TO "establecimientos_tipos_documentos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- EMPRESAS
-- ============================================================
ALTER TABLE empresa_documentos         RENAME TO empresas_documentos;
ALTER TABLE rubros_empresa             RENAME TO empresas_rubros;
ALTER TABLE documentacion_rubros_empresa RENAME TO empresas_rubros_documentos;

DO $$ BEGIN
  ALTER POLICY "empresa_documentos: select" ON empresas_documentos RENAME TO "empresas_documentos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "empresa_documentos: insert" ON empresas_documentos RENAME TO "empresas_documentos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "empresa_documentos: update" ON empresas_documentos RENAME TO "empresas_documentos: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "empresa_documentos: delete" ON empresas_documentos RENAME TO "empresas_documentos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- rubros_empresa had select, insert, update (no delete policy)
DO $$ BEGIN
  ALTER POLICY "rubros_empresa: select" ON empresas_rubros RENAME TO "empresas_rubros: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "rubros_empresa: insert" ON empresas_rubros RENAME TO "empresas_rubros: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "rubros_empresa: update" ON empresas_rubros RENAME TO "empresas_rubros: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- documentacion_rubros_empresa had select, insert, delete (no update policy)
DO $$ BEGIN
  ALTER POLICY "documentacion_rubros_empresa: select" ON empresas_rubros_documentos RENAME TO "empresas_rubros_documentos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "documentacion_rubros_empresa: insert" ON empresas_rubros_documentos RENAME TO "empresas_rubros_documentos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "documentacion_rubros_empresa: delete" ON empresas_rubros_documentos RENAME TO "empresas_rubros_documentos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- ORGANIZACIONES
-- ============================================================
ALTER TABLE tipo_organizaciones RENAME TO organizaciones_tipos;

DO $$ BEGIN
  ALTER POLICY "tipo_organizaciones: select" ON organizaciones_tipos RENAME TO "organizaciones_tipos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "tipo_organizaciones: insert" ON organizaciones_tipos RENAME TO "organizaciones_tipos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "tipo_organizaciones: update" ON organizaciones_tipos RENAME TO "organizaciones_tipos: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "tipo_organizaciones: delete" ON organizaciones_tipos RENAME TO "organizaciones_tipos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- PERSONAS
-- ============================================================
ALTER TABLE directorio_personas RENAME TO personas_directorio;
ALTER TABLE tipo_personas        RENAME TO personas_tipos;
ALTER TABLE empleado_puesto      RENAME TO puestos_personas;
ALTER TABLE empleado_documentos  RENAME TO personas_documentos;

DO $$ BEGIN
  ALTER POLICY "directorio_personas: select" ON personas_directorio RENAME TO "personas_directorio: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "directorio_personas: insert" ON personas_directorio RENAME TO "personas_directorio: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "directorio_personas: update" ON personas_directorio RENAME TO "personas_directorio: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "directorio_personas: delete" ON personas_directorio RENAME TO "personas_directorio: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER POLICY "tipo_personas: select" ON personas_tipos RENAME TO "personas_tipos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "tipo_personas: insert" ON personas_tipos RENAME TO "personas_tipos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "tipo_personas: update" ON personas_tipos RENAME TO "personas_tipos: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "tipo_personas: delete" ON personas_tipos RENAME TO "personas_tipos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- empleado_puesto had policies named "empleado_puesto: ..."
DO $$ BEGIN
  ALTER POLICY "empleado_puesto: select" ON puestos_personas RENAME TO "puestos_personas: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "empleado_puesto: insert" ON puestos_personas RENAME TO "puestos_personas: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "empleado_puesto: update" ON puestos_personas RENAME TO "puestos_personas: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "empleado_puesto: delete" ON puestos_personas RENAME TO "puestos_personas: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- empleado_documentos had policies named "empleado_documentos: ..."
DO $$ BEGIN
  ALTER POLICY "empleado_documentos: select" ON personas_documentos RENAME TO "personas_documentos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "empleado_documentos: insert" ON personas_documentos RENAME TO "personas_documentos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "empleado_documentos: update" ON personas_documentos RENAME TO "personas_documentos: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "empleado_documentos: delete" ON personas_documentos RENAME TO "personas_documentos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- DOCUMENTOS
-- ============================================================
ALTER TABLE documento_tipos RENAME TO documentos_tipos;

DO $$ BEGIN
  ALTER POLICY "documento_tipos: select" ON documentos_tipos RENAME TO "documentos_tipos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "documento_tipos: insert" ON documentos_tipos RENAME TO "documentos_tipos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "documento_tipos: update" ON documentos_tipos RENAME TO "documentos_tipos: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "documento_tipos: delete" ON documentos_tipos RENAME TO "documentos_tipos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- PRODUCTOS
-- ============================================================
ALTER TABLE categoria_productos RENAME TO productos_categorias;

DO $$ BEGIN
  ALTER POLICY "categoria_productos: select" ON productos_categorias RENAME TO "productos_categorias: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "categoria_productos: insert" ON productos_categorias RENAME TO "productos_categorias: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "categoria_productos: update" ON productos_categorias RENAME TO "productos_categorias: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "categoria_productos: delete" ON productos_categorias RENAME TO "productos_categorias: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- PUESTOS
-- ============================================================
ALTER TABLE epp_por_puesto RENAME TO puestos_epp;

DO $$ BEGIN
  ALTER POLICY "epp_por_puesto: select" ON puestos_epp RENAME TO "puestos_epp: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "epp_por_puesto: insert" ON puestos_epp RENAME TO "puestos_epp: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "epp_por_puesto: update" ON puestos_epp RENAME TO "puestos_epp: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "epp_por_puesto: delete" ON puestos_epp RENAME TO "puestos_epp: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- MEDICIONES
-- ============================================================
ALTER TABLE instrumentos_medicion      RENAME TO mediciones_instrumentos;
ALTER TABLE tipo_instrumento_medicion  RENAME TO mediciones_instrumentos_tipos;

DO $$ BEGIN
  ALTER POLICY "instrumentos_medicion: select" ON mediciones_instrumentos RENAME TO "mediciones_instrumentos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "instrumentos_medicion: insert" ON mediciones_instrumentos RENAME TO "mediciones_instrumentos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "instrumentos_medicion: update" ON mediciones_instrumentos RENAME TO "mediciones_instrumentos: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "instrumentos_medicion: delete" ON mediciones_instrumentos RENAME TO "mediciones_instrumentos: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- tipo_instrumento_medicion had select, insert, update (no delete policy)
DO $$ BEGIN
  ALTER POLICY "tipo_instrumento_medicion: select" ON mediciones_instrumentos_tipos RENAME TO "mediciones_instrumentos_tipos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "tipo_instrumento_medicion: insert" ON mediciones_instrumentos_tipos RENAME TO "mediciones_instrumentos_tipos: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "tipo_instrumento_medicion: update" ON mediciones_instrumentos_tipos RENAME TO "mediciones_instrumentos_tipos: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- CAPACITACIONES
-- ============================================================
ALTER TABLE capacitacion_asistentes RENAME TO capacitaciones_asistentes;

DO $$ BEGIN
  ALTER POLICY "capacitacion_asistentes: select" ON capacitaciones_asistentes RENAME TO "capacitaciones_asistentes: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "capacitacion_asistentes: insert" ON capacitaciones_asistentes RENAME TO "capacitaciones_asistentes: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "capacitacion_asistentes: update" ON capacitaciones_asistentes RENAME TO "capacitaciones_asistentes: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "capacitacion_asistentes: delete" ON capacitaciones_asistentes RENAME TO "capacitaciones_asistentes: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- OBSERVACIONES
-- ============================================================
ALTER TABLE clasificacion_observaciones RENAME TO observaciones_clasificaciones;
ALTER TABLE observacion_categoria        RENAME TO observaciones_categorias;

-- clasificacion_observaciones had select, insert, update (no delete policy)
DO $$ BEGIN
  ALTER POLICY "clasificacion_observaciones: select" ON observaciones_clasificaciones RENAME TO "observaciones_clasificaciones: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "clasificacion_observaciones: insert" ON observaciones_clasificaciones RENAME TO "observaciones_clasificaciones: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "clasificacion_observaciones: update" ON observaciones_clasificaciones RENAME TO "observaciones_clasificaciones: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- observacion_categoria had only a non-standard policy ("Lectura pública para autenticados")
-- which does not follow the "tablename: verb" pattern — skip.


-- ============================================================
-- CONSULTORAS
-- ============================================================
ALTER TABLE consultora_members RENAME TO consultoras_members;

DO $$ BEGIN
  ALTER POLICY "consultora_members: select" ON consultoras_members RENAME TO "consultoras_members: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "consultora_members: insert" ON consultoras_members RENAME TO "consultoras_members: insert";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "consultora_members: update" ON consultoras_members RENAME TO "consultoras_members: update";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER POLICY "consultora_members: delete" ON consultoras_members RENAME TO "consultoras_members: delete";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- PREGUNTAS / RIESGOS
-- ============================================================
ALTER TABLE pregunta_tipos   RENAME TO preguntas_tipos;
ALTER TABLE preguntas_riesgo RENAME TO riesgos_preguntas;

-- pregunta_tipos had only a select policy
DO $$ BEGIN
  ALTER POLICY "pregunta_tipos: select" ON preguntas_tipos RENAME TO "preguntas_tipos: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- preguntas_riesgo had only a select policy
DO $$ BEGIN
  ALTER POLICY "preguntas_riesgo: select" ON riesgos_preguntas RENAME TO "riesgos_preguntas: select";
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ============================================================
-- SUBCONTRATISTAS
-- ============================================================
ALTER TABLE subcontratista_respuestas RENAME TO subcontratistas_respuestas;

-- subcontratista_respuestas had only a non-standard "all" policy ("subcontratista_respuestas: all")
-- Rename it to match the new table name.
DO $$ BEGIN
  ALTER POLICY "subcontratista_respuestas: all" ON subcontratistas_respuestas RENAME TO "subcontratistas_respuestas: all";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
