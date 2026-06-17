-- ============================================================
-- Catálogo GLOBAL de documentos — estado FIJADO (pinned)
-- ============================================================
-- Congela la configuración del catálogo `documentos_tipos` curada a mano
-- por Sigmetría (catálogo global): nivel, vigencia, periodicidad, jurisdicción,
-- aplicabilidad por tipo de establecimiento y defaults de alerta.
-- Los días de alerta acá son el DEFAULT GLOBAL; cada consultora overridea en
-- configuracion_vencimientos (no toca este catálogo).
-- Generado desde prod (Management API) — fuente única de verdad. No editar a mano.
-- Idempotente: INSERT ON CONFLICT (nombre) DO UPDATE + rebuild de la matriz.
-- Total: 62 tipos, 48 filas de aplicabilidad.
-- ============================================================

-- ─── 1. Upsert de los tipos de documento (match por nombre UNIQUE) ───
INSERT INTO public.documentos_tipos
  (nombre, descripcion, pais_id, categoria_legajo, nivel, vigencia_tipo, periodicidad, jurisdiccion, jurisdiccion_provincia, jurisdiccion_municipio, requiere_alerta, dias_alerta, is_active, aplica_empresa, aplica_establecimiento, aplica_empleado, aplica_por_iso, aplica_subcontratista)
VALUES
  ('Acta de Fin de Demolición', NULL, 'AR', 'establecimiento', 'establecimiento', 'unica_vez', NULL, 'provincial', 'Ciudad Autónoma de Buenos Aires', NULL, false, 30, true, false, true, false, false, false),
  ('Acta de Fin de Excavación', NULL, 'AR', 'establecimiento', 'establecimiento', 'unica_vez', NULL, 'provincial', 'Ciudad Autónoma de Buenos Aires', NULL, false, 30, true, false, true, false, false, false),
  ('Acta de Inicio de Demolición', NULL, 'AR', 'establecimiento', 'establecimiento', 'unica_vez', NULL, 'provincial', 'Ciudad Autónoma de Buenos Aires', NULL, false, 30, true, false, true, false, false, false),
  ('Acta de Inicio de Excavación', NULL, 'AR', 'establecimiento', 'establecimiento', 'unica_vez', NULL, 'provincial', 'Ciudad Autónoma de Buenos Aires', NULL, false, 30, true, false, true, false, false, false),
  ('Alta Temprana', NULL, 'AR', 'persona_por_establecimiento', 'persona_empresa', 'unica_vez', NULL, 'nacional', NULL, NULL, false, 30, true, false, false, true, false, false),
  ('Análisis Bacteriológico del Agua', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'semestral', 'nacional', NULL, NULL, true, 21, true, false, true, false, false, false),
  ('Análisis de Trabajo Seguro (ATS)', NULL, 'AR', 'persona', 'persona_establecimiento', 'periodica', 'semanal', 'nacional', NULL, NULL, false, 30, true, false, false, true, false, false),
  ('Análisis Fisicoquímico del Agua', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 21, true, false, true, false, false, false),
  ('Aviso de Obra (AIO)', NULL, 'AR', 'empresa_por_establecimiento', 'empresa_establecimiento', 'periodica', 'vto_aviso_obra', 'nacional', NULL, NULL, true, 10, true, false, true, false, false, false),
  ('Carga de Fuego', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 10, true, false, true, false, false, false),
  ('Cláusula de No Repetición (CNR)', NULL, 'AR', 'empresa_por_establecimiento', 'empresa_establecimiento', 'periodica', 'mensual', 'nacional', NULL, NULL, true, 3, true, true, false, false, false, false),
  ('Constancia de AFIP', NULL, 'AR', 'empresa', 'empresa', 'periodica', 'mensual', 'nacional', NULL, NULL, true, 3, true, true, false, false, false, false),
  ('Constancia de CUIL', NULL, 'AR', 'persona', 'persona', 'unica_vez', NULL, 'nacional', NULL, NULL, false, 30, true, false, false, true, false, false),
  ('Constancia de Recarga de Extintores', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 21, true, false, true, false, false, false),
  ('Corte de Suministro de Gas', NULL, 'AR', 'establecimiento', 'establecimiento', 'unica_vez', NULL, 'nacional', NULL, NULL, false, 30, true, false, true, false, false, false),
  ('Corte de Suministro Eléctrico', NULL, 'AR', 'establecimiento', 'establecimiento', 'unica_vez', NULL, 'nacional', NULL, NULL, false, 30, true, false, true, false, false, false),
  ('Cuota de Aporte Sindical', NULL, 'AR', 'empresa', 'empresa', 'periodica', 'mensual', 'nacional', NULL, NULL, true, 3, true, true, false, false, false, false),
  ('DDJJ 931 AFIP', NULL, 'AR', 'empresa', 'empresa', 'periodica', 'mensual', 'nacional', NULL, NULL, true, 3, true, true, false, false, false, false),
  ('Encomienda Profesional', NULL, 'AR', 'establecimiento', 'persona', 'unica_vez', NULL, 'nacional', NULL, NULL, false, 30, true, false, true, false, false, false),
  ('Estudio Bacteriológico del Agua para consumo humano', NULL, 'AR', 'establecimiento', 'establecimiento', NULL, NULL, NULL, NULL, NULL, true, 30, false, false, true, false, false, false),
  ('Estudio de Impacto Ambiental', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'cada_6_anios', 'nacional', NULL, NULL, true, 21, true, false, true, false, false, false),
  ('Estudio de Ventilación', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 21, true, false, true, false, false, false),
  ('Estudio Físico/Químico del Agua para consumo humano', NULL, 'AR', 'establecimiento', 'establecimiento', NULL, NULL, NULL, NULL, NULL, true, 30, false, false, true, false, false, false),
  ('Examen Preocupacional Apto', NULL, 'AR', 'persona', 'persona_empresa', 'unica_vez', NULL, 'nacional', NULL, NULL, false, 30, true, false, false, true, false, false),
  ('Foto DNI (Frente y Dorso)', NULL, 'AR', 'persona', 'persona', 'periodica', 'fecha_vto', 'nacional', NULL, NULL, true, 21, true, false, false, true, false, false),
  ('IERIC', NULL, 'AR', 'empresa', 'empresa', 'periodica', 'mensual', 'nacional', NULL, NULL, true, 3, true, true, false, false, false, false),
  ('Informe Técnico Demolición', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'semanal', 'provincial', 'Ciudad Autónoma de Buenos Aires', NULL, true, 1, true, false, true, false, false, false),
  ('Informe Técnico Excavación', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'semanal', 'provincial', 'Ciudad Autónoma de Buenos Aires', NULL, true, 1, true, false, true, false, false, false),
  ('Licencia de Conducir Profesional', NULL, 'AR', 'persona', 'persona', 'unica_vez', NULL, 'nacional', NULL, NULL, true, 21, true, false, false, true, false, false),
  ('Listado Nómina AFIP', NULL, 'AR', 'empresa', 'empresa', 'periodica', 'mensual', 'nacional', NULL, NULL, true, 3, true, true, false, false, false, false),
  ('Matrícula Auxiliar H;S&B', NULL, 'AR', 'empresa', 'persona', 'periodica', 'anual', 'nacional', NULL, NULL, true, 21, true, true, false, false, false, false),
  ('Matrícula Responsable de H;S&B', NULL, 'AR', 'empresa_por_establecimiento', 'persona', 'periodica', 'anual', 'nacional', NULL, NULL, true, 21, true, true, false, false, false, false),
  ('Medición de Contaminantes en el Aire', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 21, true, false, true, false, false, false),
  ('Nómina ART', NULL, 'AR', 'empresa', 'empresa', 'periodica', 'mensual', 'nacional', NULL, NULL, true, 3, true, true, false, false, false, false),
  ('Nota de Vinculación Aux H y S', NULL, 'AR', 'empresa', 'empresa_establecimiento', 'unica_vez', NULL, 'nacional', NULL, NULL, false, 30, true, true, false, false, false, false),
  ('Nota de Vinculación Auxiliar H;S&B', NULL, 'AR', 'empresa', 'empresa', 'unica_vez', NULL, 'nacional', NULL, NULL, false, 30, true, true, false, false, false, false),
  ('Pago Monotributo', NULL, 'AR', 'persona', 'persona', 'periodica', 'mensual', 'nacional', NULL, NULL, true, 3, true, false, false, true, false, false),
  ('Permiso de Trabajo Seguro (PTS)', NULL, 'AR', 'persona', 'persona_establecimiento', 'periodica', 'por_gestion', 'nacional', NULL, NULL, true, 30, true, false, false, true, false, false),
  ('Plan de Emergencia', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 30, true, false, true, false, false, false),
  ('Planilla de Entrega de EPP', NULL, 'AR', 'persona_por_establecimiento', 'persona_establecimiento', 'periodica', 'semestral', 'nacional', NULL, NULL, true, 21, true, false, false, true, false, false),
  ('Política de Higiene y Seguridad', 'Política de Higiene y Seguridad de la empresa', 'AR', 'empresa', 'empresa', 'unica_vez', NULL, 'nacional', NULL, NULL, false, 30, true, true, false, false, false, false),
  ('Poliza Contrato ART', NULL, 'AR', 'empresa', 'empresa', 'periodica', 'anual', 'nacional', NULL, NULL, true, 21, true, true, false, false, false, false),
  ('Programa de Seguridad', NULL, 'AR', 'empresa_por_establecimiento', 'empresa_establecimiento', 'unica_vez', 'vto_aviso_obra', NULL, NULL, NULL, true, 30, true, true, false, false, false, false),
  ('Protocolo de Carga Térmica - 2', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 21, true, false, true, false, false, false),
  ('Protocolo de Ergonomía - 2', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 21, true, false, true, false, false, false),
  ('Protocolo de Iluminación - 2', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 21, true, false, true, false, false, false),
  ('Protocolo de Ruido - 2', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 21, true, false, true, false, false, false),
  ('Protocolo PAT - 2', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 21, true, false, true, false, false, false),
  ('Registro de Capacitación', NULL, 'AR', 'empresa', 'empresa_establecimiento', 'periodica', 'mensual', 'nacional', NULL, NULL, true, 3, true, true, false, false, false, false),
  ('Registro de Capacitación Teórico/Práctica (10 Hs)', NULL, 'AR', 'persona', 'persona', 'periodica', 'anual', 'nacional', NULL, NULL, true, 3, true, false, false, true, false, false),
  ('Registro de Inducción', NULL, 'AR', 'persona_por_establecimiento', 'persona_establecimiento', 'unica_vez', NULL, 'nacional', NULL, NULL, false, 30, true, false, false, true, false, false),
  ('Registro Visita ART', NULL, 'AR', 'empresa', 'empresa_establecimiento', 'periodica', 'mensual', 'nacional', NULL, NULL, false, 30, true, true, false, false, false, false),
  ('Registro Visita HyS', NULL, 'AR', 'empresa_por_establecimiento', 'empresa_establecimiento', 'periodica', 'semanal', 'nacional', NULL, NULL, true, 1, true, true, false, false, false, false),
  ('Relevamiento de Agentes de Riesgo (RAR)', NULL, 'AR', 'empresa', 'empresa_establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 10, true, true, false, false, false, false),
  ('Relevamiento de Medianeras', NULL, 'AR', 'establecimiento', 'establecimiento', 'unica_vez', NULL, 'nacional', NULL, NULL, false, 30, true, false, true, false, false, false),
  ('Relevamiento General de Riesgo Laboral (RGRL)', NULL, 'AR', 'empresa', 'empresa_establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 10, true, true, false, false, false, false),
  ('Seguro de Accidentes Personales (SAP)', NULL, 'AR', 'persona', 'persona', 'periodica', 'mensual', 'nacional', NULL, NULL, true, 3, true, false, false, true, false, false),
  ('Seguro de Vida Obligatorio (SVO)', NULL, 'AR', 'empresa', 'empresa', 'periodica', 'mensual', 'nacional', NULL, NULL, true, 3, true, true, false, false, false, false),
  ('Seguro Responsabilidad Civil', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 30, true, false, true, false, false, false),
  ('Seguro Todo Riesgo Construcción', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'anual', 'nacional', NULL, NULL, true, 30, true, false, true, false, false, false),
  ('Servicio de Desratización', NULL, 'AR', 'establecimiento', 'establecimiento', 'periodica', 'mensual', 'nacional', NULL, NULL, true, 3, true, false, true, false, false, false),
  ('Tarjeta IERIC', NULL, 'AR', 'persona', 'persona', 'unica_vez', NULL, 'nacional', NULL, NULL, false, 30, true, false, false, true, false, false)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  pais_id = EXCLUDED.pais_id,
  categoria_legajo = EXCLUDED.categoria_legajo,
  nivel = EXCLUDED.nivel,
  vigencia_tipo = EXCLUDED.vigencia_tipo,
  periodicidad = EXCLUDED.periodicidad,
  jurisdiccion = EXCLUDED.jurisdiccion,
  jurisdiccion_provincia = EXCLUDED.jurisdiccion_provincia,
  jurisdiccion_municipio = EXCLUDED.jurisdiccion_municipio,
  requiere_alerta = EXCLUDED.requiere_alerta,
  dias_alerta = EXCLUDED.dias_alerta,
  is_active = EXCLUDED.is_active,
  aplica_empresa = EXCLUDED.aplica_empresa,
  aplica_establecimiento = EXCLUDED.aplica_establecimiento,
  aplica_empleado = EXCLUDED.aplica_empleado,
  aplica_por_iso = EXCLUDED.aplica_por_iso,
  aplica_subcontratista = EXCLUDED.aplica_subcontratista,
  updated_at = now();

-- ─── 2. Rebuild de la matriz de aplicabilidad por tipo de establecimiento ───
-- Sin filas para un documento = aplica a TODOS los tipos.
DELETE FROM public.documentos_tipos_tipos_establecimiento;

INSERT INTO public.documentos_tipos_tipos_establecimiento (documento_tipo_id, tipo_establecimiento_id)
SELECT dt.id, et.id
FROM (VALUES
  ('Acta de Fin de Demolición', 'CONSTRUCCION'),
  ('Acta de Fin de Excavación', 'CONSTRUCCION'),
  ('Acta de Inicio de Demolición', 'CONSTRUCCION'),
  ('Acta de Inicio de Excavación', 'CONSTRUCCION'),
  ('Aviso de Obra (AIO)', 'CONSTRUCCION'),
  ('Corte de Suministro de Gas', 'CONSTRUCCION'),
  ('Corte de Suministro Eléctrico', 'CONSTRUCCION'),
  ('Estudio de Impacto Ambiental', 'AGRO'),
  ('Estudio de Impacto Ambiental', 'CONSTRUCCION'),
  ('Estudio de Impacto Ambiental', 'ESTACION_SERVICIO'),
  ('Estudio de Impacto Ambiental', 'INDUSTRIA'),
  ('Estudio de Impacto Ambiental', 'LOGISTICA'),
  ('Estudio de Impacto Ambiental', 'MINERIA'),
  ('Estudio de Ventilación', 'CENTRO_SALUD'),
  ('Estudio de Ventilación', 'COMERCIO'),
  ('Estudio de Ventilación', 'EDUCATIVO'),
  ('Estudio de Ventilación', 'ESTACION_SERVICIO'),
  ('Estudio de Ventilación', 'INDUSTRIA'),
  ('Estudio de Ventilación', 'LOGISTICA'),
  ('Estudio de Ventilación', 'MINERIA'),
  ('Estudio de Ventilación', 'OFICINA'),
  ('Estudio de Ventilación', 'TALLER'),
  ('Informe Técnico Demolición', 'CONSTRUCCION'),
  ('Informe Técnico Excavación', 'CONSTRUCCION'),
  ('Medición de Contaminantes en el Aire', 'AGRO'),
  ('Medición de Contaminantes en el Aire', 'CENTRO_SALUD'),
  ('Medición de Contaminantes en el Aire', 'CONSTRUCCION'),
  ('Medición de Contaminantes en el Aire', 'ESTACION_SERVICIO'),
  ('Medición de Contaminantes en el Aire', 'INDUSTRIA'),
  ('Medición de Contaminantes en el Aire', 'LOGISTICA'),
  ('Medición de Contaminantes en el Aire', 'MINERIA'),
  ('Medición de Contaminantes en el Aire', 'TALLER'),
  ('Protocolo de Carga Térmica - 2', 'AGRO'),
  ('Protocolo de Carga Térmica - 2', 'CONSTRUCCION'),
  ('Protocolo de Carga Térmica - 2', 'ESTACION_SERVICIO'),
  ('Protocolo de Carga Térmica - 2', 'INDUSTRIA'),
  ('Protocolo de Carga Térmica - 2', 'LOGISTICA'),
  ('Protocolo de Carga Térmica - 2', 'MINERIA'),
  ('Protocolo de Carga Térmica - 2', 'TALLER'),
  ('Protocolo de Ruido - 2', 'CONSTRUCCION'),
  ('Protocolo de Ruido - 2', 'ESTACION_SERVICIO'),
  ('Protocolo de Ruido - 2', 'INDUSTRIA'),
  ('Protocolo de Ruido - 2', 'LOGISTICA'),
  ('Protocolo de Ruido - 2', 'MINERIA'),
  ('Protocolo de Ruido - 2', 'OTRO'),
  ('Protocolo de Ruido - 2', 'TALLER'),
  ('Relevamiento de Medianeras', 'CONSTRUCCION'),
  ('Seguro Todo Riesgo Construcción', 'CONSTRUCCION')
) AS m(doc_nombre, tipo_codigo)
JOIN public.documentos_tipos dt        ON dt.nombre = m.doc_nombre
JOIN public.establecimientos_tipos et  ON et.codigo = m.tipo_codigo
ON CONFLICT (documento_tipo_id, tipo_establecimiento_id) DO NOTHING;
