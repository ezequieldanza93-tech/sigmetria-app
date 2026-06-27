-- Reemplaza el CHECK parcial de entidad_tipo (creado por el agente paralelo)
-- con el conjunto completo de tipos del legajo técnico.
ALTER TABLE public.notificaciones
  DROP CONSTRAINT IF EXISTS chk_notificaciones_entidad_tipo;

ALTER TABLE public.notificaciones
  ADD CONSTRAINT chk_notificaciones_entidad_tipo
  CHECK (entidad_tipo = ANY (ARRAY[
    'gestion',
    'documento_empresa',
    'documento_establecimiento',
    'documento_persona',
    'documento_subcontratista',
    'matricula',
    'certificado',
    'sap_presentacion',
    'observacion_accion_inmediata',
    'incidente',
    'constancia_visita',
    'protocolo_medicion'
  ]));
