# Propuesta de normalización — sap_presentaciones (82 columnas)

> **Estado**: Análisis. NO implementar sin validación del equipo.
> **Motivación**: WIDE-001 del informe de auditoría (tabla 3× más ancha que la siguiente).

---

## Bloques identificados

### Bloque CORE — queda en tabla principal (18 cols)
Identidad, estado del trámite y auditoría. Toda consulta los necesita.

```
id, establecimiento_id, empresa_id, consultora_id,
estado, via_tramite, paso_actual,
grupo_calculado, admite_revalida, clasificacion_motivo,
fecha_presentacion, fecha_aprobacion, fecha_vencimiento,
expediente_nro, disposicion_nro, observaciones_autoridad,
created_by, created_at, updated_at, deleted_at
```

### Bloque A — Datos del local e infraestructura (14 cols → `sap_presentaciones_local`)
Características físicas del establecimiento. Solo necesarias en paso 1 del wizard.

```
uso_id, superficie_cubierta_m2, superficie_aire_libre_m2,
pisos_elevados, tiene_subsuelo, cantidad_subsuelos, actividad_en_subsuelo,
tiene_inflamables, litros_inflamables, tiene_baterias_litio, kg_baterias_litio,
estaciones_carga_ev, presta_servicio_ve, propiedad_horizontal
```

### Bloque B — Actividad y ocupación (10 cols → `sap_presentaciones_actividad`)
Datos del habilitante y ocupación. Necesarios en paso 2.

```
razon_social, cuit, nombre_comercial,
habilitacion_tipo, habilitacion_detalle, dias_horarios,
aforo, ocupacion_diurna, ocupacion_nocturna, personas_movilidad_reducida
```

### Bloque C — Sección G1 (datos de presentación Grupo 1) (12 cols → `sap_presentaciones_g1`)
Solo aplica a establecimientos clasificados Grupo 1. Nullable para G2/G3.

```
g1_declarante_persona_id, g1_declarante_nombre, g1_declarante_dni_cuit,
g1_caracter, g1_capacidad_m2_persona,
g1_tiene_entrepiso, g1_entrepiso_superficie, g1_entrepiso_destino,
g1_subsuelo_destino, g1_elementos_mitigacion,
g1_personal_instruido, g1_responsabilidad_evacuacion
```

### Bloque D — Sección G3 (riesgos de entorno) (4 cols → `sap_presentaciones_g3`)
Solo aplica a establecimientos Grupo 3.

```
g3_riesgos_entorno, g3_riesgos_procesos,
g3_procedimientos_respuesta, g3_procedimiento_alarma
```

### Bloque E — Profesional actuante (6 cols → eliminar y usar FK + vista)
Ya existe `profesional_persona_id`. Las otras 5 columnas son redundancia 3FN:
si el profesional está en `personas_directorio`, su nombre/título/matrícula/contacto
están disponibles por JOIN. Son snapshot solo si el profesional puede cambiar.

```
profesional_persona_id  (FK → mantener en tabla principal)
profesional_nombre      → traer por JOIN o snapshot explícito
profesional_titulo      → ídem
profesional_matricula   → ídem
profesional_email       → ídem
profesional_telefono    → ídem
```

**Decisión requerida**: ¿Son snapshot histórico (el profesional al momento del trámite) o
siempre el actual? Si son snapshot → renombrar a `*_snapshot` y documentar (COMMENT ON).
Si son actuales → eliminar y traer por JOIN.

### Bloque F — Plan de evacuación (7 cols → `sap_presentaciones_evacuacion`)
Sección específica del plan de contingencia.

```
aviso_descripcion, aviso_viva_voz,
evacuacion_procedimiento, punto_reunion_descripcion,
puesta_a_resguardo, enclavamientos, medidas_supletorias
```

### Bloque G — Declaraciones y contacto (5 cols → queda en tabla principal o bloque B)
Cortas, necesarias en casi todos los contextos.

```
decl_viabilidad, decl_comunicar_cambios,
telefono_emergencia, qr_ifci, requisitos_tecnicos
```

### Bloque H — Condiciones especiales (4 cols → queda en tabla principal o bloque A)
Flags booleanos simples de alta consulta.

```
procesos_soldadura, tiene_internacion,
gases_medicinales, tiene_deposito_telones_utileria
```

---

## Modelo propuesto

```
sap_presentaciones (principal, ~27 cols = CORE + G + H + profesional_persona_id)
  ├── sap_presentaciones_local (1:1 via presentacion_id FK)
  ├── sap_presentaciones_actividad (1:1 via presentacion_id FK)
  ├── sap_presentaciones_g1 (1:0..1 via presentacion_id FK, solo si grupo=1)
  ├── sap_presentaciones_g3 (1:0..1 via presentacion_id FK, solo si grupo=3)
  └── sap_presentaciones_evacuacion (1:0..1 via presentacion_id FK)
```

Cada satélite tiene:
- `presentacion_id uuid NOT NULL REFERENCES sap_presentaciones(id) ON DELETE CASCADE`
- `PRIMARY KEY (presentacion_id)` (relación 1:1 garantizada)

---

## Migración sugerida (NO ejecutar — requiere validación)

```sql
-- Satélite: local
CREATE TABLE public.sap_presentaciones_local (
  presentacion_id uuid PRIMARY KEY REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,
  uso_id uuid REFERENCES ...,
  superficie_cubierta_m2 numeric,
  -- ... resto de columnas del Bloque A
);

-- Migrar datos
INSERT INTO public.sap_presentaciones_local (presentacion_id, uso_id, ...)
SELECT id, uso_id, ... FROM public.sap_presentaciones;

-- Quitar columnas de la tabla principal (SOLO tras verificar que la app usa las nuevas)
ALTER TABLE public.sap_presentaciones DROP COLUMN uso_id, DROP COLUMN ...;
```

---

## Impacto estimado en la app

### Queries a cambiar
- Toda consulta `SELECT * FROM sap_presentaciones WHERE id = ?` necesitaría un JOIN opcional o una **vista** que lo haga transparente.
- Las server actions en `lib/actions/sap*.ts` y las páginas en `app/(dashboard)/dashboard/sap*` necesitarían refactoring.

### Enfoque alternativo (menor impacto): Vista desnormalizada
Crear una vista `sap_presentaciones_full` que haga los JOINs, y migrar gradualmente las apps a usarla. La tabla principal queda normalizada internamente pero la vista mantiene compatibilidad.

```sql
CREATE OR REPLACE VIEW public.sap_presentaciones_full AS
SELECT
  p.*,
  l.superficie_cubierta_m2, l.tiene_inflamables, ...,
  a.razon_social, a.habilitacion_tipo, ...,
  g1.g1_declarante_nombre, ...,
  ev.evacuacion_procedimiento, ...
FROM public.sap_presentaciones p
LEFT JOIN public.sap_presentaciones_local l ON l.presentacion_id = p.id
LEFT JOIN public.sap_presentaciones_actividad a ON a.presentacion_id = p.id
LEFT JOIN public.sap_presentaciones_g1 g1 ON g1.presentacion_id = p.id
LEFT JOIN public.sap_presentaciones_evacuacion ev ON ev.presentacion_id = p.id;
```

---

## Recomendación

Por el tamaño actual de la tabla (pocas filas en producción — pre-lanzamiento) y el costo
de refactorizar las server actions del SAP, la normalización completa es viable ahora **antes
del lanzamiento**. Después del lanzamiento con datos reales, el costo de migrar sería mayor.

**Prioridad**: Alta si se va a hacer — conviene hacerlo en esta etapa de build.
**Bloqueante**: Decisión del equipo sobre las columnas del profesional actuante (Bloque E).
