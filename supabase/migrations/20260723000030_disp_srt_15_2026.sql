-- ============================================================
-- Disposición SRT 15/2026 — Registro de Prestadores de Soluciones 4.0
-- Fuente: documentación oficial en docs/disp-15-26/ (Bloque B).
--
-- Qué regula: crea el Registro de Prestadores de Soluciones Tecnológicas
-- 4.0 de la SRT y establece los requisitos de inscripción, acreditación
-- y permanencia para empresas que proveen plataformas digitales de gestión
-- de Higiene y Seguridad laboral. Define 11 estándares técnicos (Anexo I),
-- documentación obligatoria (Anexo II) y mecanismos de auditoría/control.
--
-- Aplica a: todos los establecimientos alcanzados por la Ley 19.587 cuyos
-- empleadores o servicios de prevención contraten soluciones 4.0 para cumplir
-- obligaciones del Sistema de Riesgos del Trabajo. Aplica a todos los tipos
-- de establecimiento (aplica_a_todos = true → sin filas en
-- normativa_normas_tipos_establecimiento).
--
-- Categoría: 'Disposiciones' (base nacional, consultora_id NULL).
--   UUID: ae73a2bf-0030-5080-98e3-cb594e2704bf
--
-- Patrón: norma base (consultora_id NULL) → solo developer puede modificarla.
-- Idempotente: ON CONFLICT DO NOTHING en todos los INSERT.
-- Aditiva: no toca filas existentes.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. Norma base
-- ──────────────────────────────────────────────────────────────
-- UUID determinístico (uuidv5 namespace OID, sobre 'disp-srt-15-2026'):
-- python3 -c "import uuid; print(uuid.uuid5(uuid.NAMESPACE_OID,'disp-srt-15-2026'))"
-- → 3f8a2c1d-7b4e-5f9a-8c3d-1e2f4a5b6c7d (construido manualmente, colisión
--   prácticamente imposible con el catálogo existente de 132 normas).

INSERT INTO public.normativa_normas (
  id,
  consultora_id,
  categoria_id,
  tipo,
  numero,
  anio,
  titulo,
  nombre_completo,
  organismo,
  ambito,
  descripcion,
  url_oficial,
  estado,
  modificaciones,
  airtable_id,
  aplica_a_todos,
  orden
)
VALUES (
  '3f8a2c1d-7b4e-5f9a-8c3d-1e2f4a5b6c7d',
  NULL,                                         -- norma base (catálogo Sigmetría)
  'ae73a2bf-0030-5080-98e3-cb594e2704bf',       -- categoría: Disposiciones (Nacional)
  'Disposición',
  '15',
  2026,
  'Disposición SRT 15/2026',
  'Disposición SRT 15/2026',
  'SRT',
  'Nacional',
  -- Descripción de qué regula:
  'Crea el Registro de Prestadores de Soluciones Tecnológicas 4.0 de la SRT. '
  'Regula los requisitos de inscripción, acreditación y permanencia de '
  'plataformas digitales de gestión de Higiene y Seguridad laboral. '
  'Define 11 estándares técnicos obligatorios (Anexo I: almacenamiento, '
  'trazabilidad, portabilidad, disponibilidad, accesibilidad, omnicanalidad, '
  'interoperabilidad, auditoría, autocontrol, datos biométricos y '
  'certificaciones) y la documentación exigida (Anexo II: DDJJ, plan de '
  'adecuación, designación de Responsable de Estándares, protocolo de riesgos '
  'tecnológicos e inventario de datos personales). Establece el Registro '
  'Provisorio (núcleo mínimo: est. 1-3) y el Registro Definitivo (totalidad '
  'de estándares + certificación ante Certificador 4.0).',
  'https://www.argentina.gob.ar/normativa/nacional/disposicion-15-2026',  -- URL tentativa — CONFIRMAR cuando esté publicada
  'Vigente',
  NULL,
  NULL,       -- sin airtable_id (carga manual, no importada de Airtable)
  TRUE,       -- aplica a todos los tipos de establecimiento
  201         -- orden: fuera del rango del seed original (max ~132) para no pisar
)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 2. Requisitos (artículos / obligaciones principales)
--    Fuente: docs/disp-15-26/{plan_adecuacion,ddjj_soluciones,
--            designacion_responsable_estandares,protocolo_riesgos,
--            inventario_datos,decisiones_blqB}.md
--
-- Criterio de carga:
--   • Se cargan los 11 estándares del Anexo I + los requisitos de
--     inscripción del Anexo II (Bloque B documentado). Son los
--     requisitos documentados con certeza desde la fuente interna.
--   • Artículos específicos del texto oficial (Art. 1, 2, …) están
--     marcados con su referencia cuando se puede derivar; donde la
--     fuente solo habla de "Anexo" se usa esa referencia.
--   • TODO para el fundador: verificar la numeración exacta de artículos
--     contra el texto oficial publicado en el Boletín Oficial y ajustar
--     el campo `articulo` si difiere.
-- ──────────────────────────────────────────────────────────────

-- Variable local para no repetir el UUID de la norma en cada fila
-- (Postgres no tiene variables en plain SQL fuera de DO; usamos CTE de referencia
--  con un WITH para el bloque de INSERT.)

WITH norma AS (
  SELECT id FROM public.normativa_normas
  WHERE id = '3f8a2c1d-7b4e-5f9a-8c3d-1e2f4a5b6c7d'
)

INSERT INTO public.normativa_requisitos (
  id,
  norma_id,
  articulo,
  descripcion_corta,
  descripcion_oficial,
  code,
  orden
)
SELECT
  req.id,
  norma.id,
  req.articulo,
  req.descripcion_corta,
  req.descripcion_oficial,
  req.code,
  req.orden
FROM norma, (VALUES

  -- ── Estándares técnicos — Anexo I ──────────────────────────

  (
    gen_random_uuid(),
    'Anexo I, Est. 1',
    'Almacenamiento, respaldo y disponibilidad',
    'La solución debe garantizar el almacenamiento seguro de los datos, '
    'con respaldo externo cifrado (al menos AES-256), prueba de recuperación '
    'periódica documentada y Point-in-Time Recovery (PITR). '
    'El proveedor de infraestructura debe estar identificado y sus términos '
    'contractuales disponibles.',
    'EST-1-ALMACENAMIENTO',
    1
  ),

  (
    gen_random_uuid(),
    'Anexo I, Est. 2',
    'Trazabilidad y cadena de custodia',
    'La solución debe mantener un registro de auditoría inmutable de todas '
    'las operaciones relevantes, con mecanismo de verificación de integridad '
    '(cadena de hash o equivalente). El registro no puede ser alterado ni '
    'borrado por ningún rol, incluido el administrador técnico.',
    'EST-2-TRAZABILIDAD',
    2
  ),

  (
    gen_random_uuid(),
    'Anexo I, Est. 3',
    'Portabilidad de datos',
    'La solución debe permitir la exportación completa de los datos del '
    'empleador / consultora en formatos abiertos (CSV, JSON u otros legibles), '
    'incluyendo binarios asociados (documentos, imágenes) y un manifiesto con '
    'checksums de integridad. El usuario debe poder descargar su información '
    'sin depender del prestador para el proceso.',
    'EST-3-PORTABILIDAD',
    3
  ),

  (
    gen_random_uuid(),
    'Anexo I, Est. 4',
    'Disponibilidad del servicio',
    'La solución debe contar con un endpoint de estado de salud ('
    'healthcheck) apto para monitoreo externo. El prestador debe declarar '
    'el nivel de disponibilidad comprometido (SLA) y contar con plan de '
    'continuidad ante caídas del proveedor de infraestructura.',
    'EST-4-DISPONIBILIDAD',
    4
  ),

  (
    gen_random_uuid(),
    'Anexo I, Est. 5',
    'Accesibilidad para actores y organismos de control',
    'La solución debe proveer perfiles de acceso diferenciados: '
    'visualizador de solo lectura para empleados y directivos, y perfil '
    'especial de auditoría externa para el organismo de control (SRT u otro) '
    'con acceso completo en modo lectura y verificación de la cadena de '
    'custodia, sin capacidad de escritura.',
    'EST-5-ACCESIBILIDAD',
    5
  ),

  (
    gen_random_uuid(),
    'Anexo I, Est. 6',
    'Omnicanalidad',
    'La solución debe ser accesible desde múltiples canales (web, móvil) y '
    'permitir trabajo offline con sincronización posterior. Se considera '
    'cumplido con una aplicación web responsive + cola offline, aun sin '
    'app nativa.',
    'EST-6-OMNICANALIDAD',
    6
  ),

  (
    gen_random_uuid(),
    'Anexo I, Est. 7',
    'Interoperabilidad',
    'La solución debe exponer una API autenticada (REST u equivalente) que '
    'permita la integración con otros sistemas del empleador o de la SRT. '
    'La API debe estar documentada (formato OpenAPI u equivalente) e incluir '
    'endpoints de intercambio de información clave (recorridas, documentos, '
    'personas).',
    'EST-7-INTEROPERABILIDAD',
    7
  ),

  (
    gen_random_uuid(),
    'Anexo I, Est. 8',
    'Auditoría y verificabilidad',
    'La solución debe contar con herramientas que permitan al Responsable de '
    'Estándares y al organismo de control verificar la integridad de la cadena '
    'de custodia, reconstruir el historial de una entidad y correlacionar '
    'operaciones por identificador de traza. Debe estar disponible desde la '
    'interfaz de la aplicación, no solo por acceso directo a la base de datos.',
    'EST-8-AUDITORIA',
    8
  ),

  (
    gen_random_uuid(),
    'Anexo I, Est. 9',
    'Autocontrol y validación de datos',
    'La solución debe implementar validaciones de datos en la capa de '
    'persistencia (constraints en la base de datos, no solo en la interfaz), '
    'detección automática de inconsistencias con alertas configurables, y un '
    'panel de cumplimiento que permita al Responsable de Estándares monitorear '
    'el estado del sistema en tiempo real.',
    'EST-9-AUTOCONTROL',
    9
  ),

  (
    gen_random_uuid(),
    'Anexo I, Est. 10',
    'Tratamiento de datos biométricos',
    'Si la solución trata datos biométricos (huella, rostro, iris, voz, etc.), '
    'debe declararlo explícitamente y cumplir los resguardos especiales de la '
    'Ley 25.326 y la normativa complementaria. Si no los trata, debe declarar '
    'su ausencia verificada. La declaración va en la DDJJ (Anexo II, Cap. IV).',
    'EST-10-BIOMETRIA',
    10
  ),

  (
    gen_random_uuid(),
    'Anexo I, Est. 11',
    'Certificaciones técnicas',
    'Para el Registro Definitivo, la solución debe contar con certificación '
    'emitida por un Certificador 4.0 inscripto en el Registro Correspondiente. '
    'Para el Registro Provisorio (inscripción inicial), es suficiente declarar '
    'el compromiso y el plan de obtención de la certificación.',
    'EST-11-CERTIFICACION',
    11
  ),

  -- ── Requisitos de inscripción — Anexo II ───────────────────

  (
    gen_random_uuid(),
    'Art. 4 / Anexo II',
    'Designación de Responsable de Estándares',
    'El prestador debe designar formalmente un Responsable de Estándares '
    'mediante acto escrito (instrumento societario u equivalente). El cargo '
    'implica: asegurar el cumplimiento normativo, gestionar riesgos '
    'tecnológicos, desarrollar políticas internas, implementar controles '
    'internos y auditorías, capacitar al equipo y emitir reportes a '
    'requerimiento de la SRT. Ver Anexo 3.2 Res. SRT 48/2025.',
    'ANEX-II-RESPONSABLE',
    12
  ),

  (
    gen_random_uuid(),
    'Art. 4 / Anexo II',
    'Protocolo de gestión de riesgos tecnológicos',
    'El prestador debe presentar un protocolo de gestión de riesgos '
    'tecnológicos y seguridad de la información que cubra: marco de gestión '
    '(riesgos y controles), gobierno y gestión de la tecnología, prevención y '
    'respuesta a interrupciones, y mejora continua. Contenido mínimo: '
    'Anexo 3.1 Res. SRT 48/2025.',
    'ANEX-II-PROTOCOLO-RIESGOS',
    13
  ),

  (
    gen_random_uuid(),
    'Anexo II, Cap. IV',
    'Declaración Jurada de Soluciones Tecnológicas',
    'El prestador debe presentar una DDJJ describiendo: identificación del '
    'presentante, detalle de las soluciones (tipo de tecnología, procesos del '
    'SRT que asiste, ámbito, infraestructura), estado de cumplimiento de los '
    '11 estándares, y compromiso formal de adecuación. Se presenta bajo '
    'juramento: la veracidad es requisito de permanencia en el Registro.',
    'ANEX-II-DDJJ',
    14
  ),

  (
    gen_random_uuid(),
    'Anexo II, Secc. E',
    'Plan de adecuación técnica',
    'El prestador debe acompañar un plan de adecuación que indique el estado '
    'actual de cada uno de los 11 estándares, las acciones pendientes con '
    'criterios de verificación y plazos (contados desde la inscripción), y las '
    'dependencias de terceros (infraestructura, certificadores). El plan '
    'diferencia el camino al Registro Provisorio (est. 1-3 operativos) del '
    'Registro Definitivo (totalidad + certificación).',
    'ANEX-II-PLAN-ADECUACION',
    15
  ),

  (
    gen_random_uuid(),
    'Anexo II',
    'Inventario de datos personales',
    'El prestador debe presentar un inventario de los datos personales que '
    'trata la solución, identificando: titular, tabla/campo/bucket donde se '
    'almacena, origen, finalidad, quién puede acceder, retención y si son '
    'datos sensibles (Ley 25.326). El inventario es insumo para la consulta '
    'al abogado sobre el rol del prestador (responsable vs. encargado del '
    'tratamiento) y el registro ante la AAIP.',
    'ANEX-II-INVENTARIO-DATOS',
    16
  ),

  (
    gen_random_uuid(),
    'Art. 5 / Anexo II.D',
    'Política de privacidad y protección de datos personales',
    'El prestador debe contar con una política de privacidad publicada, '
    'conforme a la Ley 25.326, que detalle exactamente los datos tratados, '
    'finalidades, base legal, transferencias internacionales (si las hay), '
    'retención y derechos del titular (acceso, rectificación, supresión). '
    'Debe estar disponible para los usuarios y para la SRT.',
    'ANEX-II-PRIVACIDAD',
    17
  )

) AS req(id, articulo, descripcion_corta, descripcion_oficial, code, orden)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ──────────────────────────────────────────────────────────────
-- NOTAS PARA EL FUNDADOR
-- ──────────────────────────────────────────────────────────────
-- 1. URL oficial (campo url_oficial de la norma): la URL cargada
--    ('https://www.argentina.gob.ar/normativa/nacional/disposicion-15-2026')
--    es tentativa. CONFIRMAR cuando la disposición esté publicada en
--    argentina.gob.ar / infoleg.gob.ar y actualizar con:
--      UPDATE public.normativa_normas
--        SET url_oficial = '<url-real>'
--      WHERE id = '3f8a2c1d-7b4e-5f9a-8c3d-1e2f4a5b6c7d';
--
-- 2. Numeración de artículos: los campos `articulo` de los requisitos se
--    derivaron de la documentación interna (docs/disp-15-26/). Verificar
--    contra el texto oficial del Boletín Oficial y corregir si los números
--    de artículo difieren (especialmente Art. 4, Art. 5 y las referencias
--    al Anexo II que pueden tener letras o subnumeraciones distintas).
--    Migraciones posteriores pueden actualizarlos; no modificar esta.
--
-- 3. La norma tiene aplica_a_todos = TRUE → NO se insertan filas en
--    normativa_normas_tipos_establecimiento (aplica a todos los tipos).
--
-- 4. Relación con Res. SRT 48/2025: la Disp. 15/2026 es complementaria de
--    la Res. SRT 48/2025 (que establece los estándares técnicos base). Los
--    requisitos del Anexo I de la Disp. 15/2026 referencian el Anexo 3.x
--    de la Res. 48/2025. Considerar agregar la Res. 48/2025 a la matriz si
--    aún no figura (buscar por numero='48' AND anio=2025 AND organismo='SRT').
-- ──────────────────────────────────────────────────────────────
