-- ============================================================
-- Sigmetría — Seed: librería de tipos de documento
-- ============================================================

INSERT INTO public.documento_tipos (nombre, aplica_empresa, aplica_establecimiento, aplica_empleado) VALUES

-- EMPRESAS
('Constancia de AFIP',                              true,  false, false),
('Cuota de Aporte Sindical',                        true,  false, false),
('DDJJ 931 AFIP',                                   true,  false, false),
('IERIC',                                           true,  false, false),
('Listado Nómina AFIP',                             true,  false, false),
('Aviso de Obra (AIO)',                              true,  false, false),
('Cláusula de No Repetición (CNR)',                 true,  false, false),
('Nómina ART',                                      true,  false, false),
('Nota de Vinculación Aux H y S',                   true,  false, false),
('Nota de Vinculación Auxiliar H;S&B',              true,  false, false),
('Programa de Seguridad',                           true,  false, false),
('Registro Visita ART',                             true,  false, false),
('Registro Visita HyS',                             true,  false, false),
('Relevamiento de Agentes de Riesgo (RAR)',         true,  false, false),
('Relevamiento General de Riesgo Laboral (RGRL)',   true,  false, false),
('Seguro de Vida Obligatorio (SVO)',                true,  false, false),
('Matrícula Responsable de H;S&B',                  true,  false, false),
('Matrícula Auxiliar H;S&B',                        true,  false, false),
('Poliza Contrato ART',                             true,  false, false),

-- EMPRESAS + PERSONAS
('Registro de Capacitación',                        true,  false, true),

-- ESTABLECIMIENTOS
('Estudio Bacteriológico del Agua para consumo humano',   false, true, false),
('Estudio Físico/Químico del Agua para consumo humano',   false, true, false),
('Protocolo de Ergonomía',                                false, true, false),
('Protocolo de Medición de Iluminación',                  false, true, false),
('Protocolo de Medición de Ruido en el Ambiente',         false, true, false),
('Protocolo de Medición Puesta a Tierra',                 false, true, false),
('Protocolo de Estrés Térmico',                           false, true, false),
('Seguro Responsabilidad Civil',                          false, true, false),
('Seguro Todo Riesgo Construcción',                       false, true, false),
('Servicio de Desratización',                             false, true, false),
('Estudio de Ventilación',                                false, true, false),
('Medición de Contaminantes en el Aire',                  false, true, false),
('Carga de Fuego',                                        false, true, false),
('Estudio de Impacto Ambiental',                          false, true, false),
('Plan de Emergencia',                                    false, true, false),
('Encomienda Profesional',                                false, true, false),
('Informe Técnico Excavación',                            false, true, false),
('Informe Técnico Demolición',                            false, true, false),
('Acta de Inicio de Excavación',                          false, true, false),
('Acta de Fin de Excavación',                             false, true, false),
('Acta de Inicio de Demolición',                          false, true, false),
('Acta de Fin de Demolición',                             false, true, false),
('Corte de Suministro Eléctrico',                         false, true, false),
('Corte de Suministro de Gas',                            false, true, false),

-- PERSONAS
('Alta Temprana',                                         false, false, true),
('Examen Preocupacional Apto',                            false, false, true),
('Foto DNI (Frente y Dorso)',                             false, false, true),
('Licencia de Conducir Profesional',                      false, false, true),
('Pago Monotributo',                                      false, false, true),
('Planilla de Entrega de EPP',                            false, false, true),
('Permiso de Trabajo Seguro (PTS)',                       false, false, true),
('Registro de Capacitación Teórico/Práctica (10 Hs)',    false, false, true),
('Seguro de Accidentes Personales (SAP)',                 false, false, true),
('Análisis de Trabajo Seguro (ATS)',                      false, false, true);
