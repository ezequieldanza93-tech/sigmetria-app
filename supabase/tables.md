# Tablas — Sigmetría App (estado actual)

> Última actualización: 2026-05-20
> Proyecto Supabase: `lslzhgmoaxgkcjeweqaz` (us-east-2)

---

## Auth / Tenant

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Perfil del usuario (extiende `auth.users`) |
| `consultoras` | Tenant raíz del sistema |
| `consultoras_members` | Usuarios miembro de una consultora |
| `user_access` | Control de acceso granular por empresa/establecimiento |

---

## Geografía

| Tabla | Descripción |
|-------|-------------|
| `localidades` | Localidades de Argentina |
| `unidades` | Unidades de medida |

---

## Organizaciones externas

| Tabla | Descripción |
|-------|-------------|
| `organizaciones_externas` | Organismos, marcas, entidades externas |
| `organizaciones_tipos` | Catálogo de tipos de organización |
| `organizaciones_establecimientos` | Pivot organización ↔ establecimiento |

---

## Empresas

| Tabla | Descripción |
|-------|-------------|
| `empresas` | Empresa cliente de la consultora |
| `empresas_rubros` | Catálogo de rubros de empresa |
| `empresas_documentos` | Documentos asignados a una empresa |
| `empresas_rubros_documentos` | Pivot documentos ↔ rubro de empresa |

---

## Establecimientos

| Tabla | Descripción |
|-------|-------------|
| `establecimientos` | Establecimiento físico de una empresa |
| `establecimientos_tipos` | Catálogo de tipos de establecimiento |
| `establecimientos_sectores` | Sectores dentro de un establecimiento |
| `establecimientos_horarios` | Horarios del establecimiento |
| `establecimientos_documentos` | Documentos asignados al establecimiento |
| `establecimientos_denuncias` | Denuncias registradas en el establecimiento |
| `establecimientos_feedback_clientes` | Feedback del cliente sobre el servicio |
| `establecimientos_respuestas` | Respuestas generales del establecimiento |
| `establecimientos_categorias_info` | Categorías de info del establecimiento |
| `establecimientos_tipos_documentos` | Pivot documentos ↔ tipo de establecimiento |

---

## Personas y Empleados

| Tabla | Descripción |
|-------|-------------|
| `empleados` | Empleado de una empresa |
| `personas_tipos` | Catálogo de tipos de persona |
| `personas_directorio` | Directorio de personas (contactos, profesionales) |
| `personas_establecimientos` | Pivot persona ↔ establecimiento |
| `puestos_de_trabajo` | Catálogo de puestos |
| `puestos_personas` | Asignación empleado → puesto |
| `puestos_epp` | EPP requerido por puesto |
| `personas_documentos` | Documentos de empleados/personas |
| `empleado_sector` | Asignación empleado → sector |

---

## Gestiones

| Tabla | Descripción |
|-------|-------------|
| `gestiones` | Catálogo maestro de gestiones de HyS |
| `gestiones_categorias` | Categorías de gestión (Reuniones, Capacitación, etc.) |
| `gestiones_grupos` | Agrupaciones de gestiones |
| `gestiones_establecimientos` | Gestiones asignadas a un establecimiento |
| `gestiones_tipos_establecimiento` | Pivot gestión ↔ tipo de establecimiento |
| `gestiones_registros` | Registros de ejecución de gestiones |
| `gestiones_observaciones` | Observaciones vinculadas a gestiones |
| `observaciones_categorias` | Catálogo de categorías de observación |
| `observaciones_clasificaciones` | Clasificaciones de observaciones |

---

## Documentos

| Tabla | Descripción |
|-------|-------------|
| `documentos_tipos` | Catálogo de tipos de documento |
| `documentos` | Documentos generados/cargados |

---

## Formularios / Checklists

| Tabla | Descripción |
|-------|-------------|
| `formularios` | Formulario/checklist vinculado a una gestión |
| `categorias_formularios` | Categorías de formularios |
| `formularios_secciones` | Secciones dentro de un formulario |
| `formularios_secciones_aspectos` | Pivot sección ↔ aspecto de HyS |
| `formularios_items` | Preguntas/ítems de una sección |
| `formularios_respuestas` | Instancia de ejecución de un formulario |
| `formularios_items_respuestas` | Respuesta por ítem |

---

## Riesgos y Aspectos

| Tabla | Descripción |
|-------|-------------|
| `riesgos` | Catálogo de riesgos |
| `aspectos` | Aspectos de HyS (riesgo eléctrico, altura, etc.) |
| `riesgos_preguntas` | Pivot riesgo ↔ pregunta |
| `preguntas_tipos` | Tipos de pregunta |

---

## Capacitaciones

| Tabla | Descripción |
|-------|-------------|
| `capacitaciones` | Capacitación registrada |
| `capacitaciones_asistentes` | Asistentes a una capacitación |
| `asistencia_diaria` | Control de asistencia diaria |

---

## Mediciones e Instrumentos

| Tabla | Descripción |
|-------|-------------|
| `mediciones_instrumentos` | Instrumentos de medición |
| `mediciones_instrumentos_tipos` | Tipos de instrumento |
| `certificados_calibracion` | Calibraciones de instrumentos |
| `mediciones` | Mediciones realizadas |
| `inspecciones` | Inspecciones registradas |

---

## Productos / EPP

| Tabla | Descripción |
|-------|-------------|
| `productos` | Catálogo de productos/EPP |
| `productos_categorias` | Categorías de producto |

---

## Perfiles Profesionales y Matrículas

| Tabla | Descripción |
|-------|-------------|
| `perfiles_profesionales` | Perfil profesional del técnico/consultor |
| `matriculas` | Matrículas profesionales |
| `matriculas_profesionales` | Pivot matrícula ↔ perfil profesional |

---

## Subcontratistas

| Tabla | Descripción |
|-------|-------------|
| `subcontratistas` | Empresa subcontratista |
| `subcontratistas_rubros` | Rubros de subcontratistas |
| `subcontratistas_respuestas` | Respuestas de subcontratistas |

---

## Siniestros

| Tabla | Descripción |
|-------|-------------|
| `siniestros` | Siniestros laborales registrados |

---

## Resumen

- **Total de tablas**: ~72
- **Convención de nombres**: `dominio_entidad` (ej: `gestiones_registros`, `empresas_rubros`)
- **Multi-tenancy**: `consultora_id` en la raíz; RLS en todas las tablas

---

## Auditoría: Escalabilidad y 3FN

### 🔴 Crítico

**1. `empresas` — columnas geográficas como texto libre**
```
rubro       text   ← texto libre (debería ser FK a empresas_rubros)
domicilio   text
localidad   text   ← violación 3FN: localidad → provincia (dependencia transitiva)
provincia   text
codigo_postal text
```
`provincia` depende de `localidad`, no de la empresa. Si la localidad cambia de nombre o se normaliza, hay que actualizar miles de filas.
**Fix**: usar FK a `localidades` (ya existe la tabla).

**2. `establecimientos` — mismo problema geográfico**
```
domicilio   text
localidad   text   ← igual que empresas
provincia   text
codigo_postal text
```
Duplica el problema de `empresas`. Misma solución: FK a `localidades`.

**3. `empresas.rubro text`** — campo de texto libre coexistiendo con la tabla `empresas_rubros`. ¿Cuál es la fuente de verdad? Hay que eliminar el campo de texto y dejar solo la FK.

---

### 🟡 Advertencia

**4. `formularios_items.response_type text`**
Almacena el tipo de respuesta como texto libre (`'compliance'`, `'text'`, etc.). Debería referenciar `preguntas_tipos` con FK, o al menos tener un `CHECK` constraint con los valores permitidos. Sin esto, queries de agregación son frágiles.

**5. `formularios_respuestas.status text`**
Sin constraint ni enum. Valores como `'in_progress'`, `'completed'` están implícitos. Un typo en el código produce datos inconsistentes sin que la DB lo rechace.

**6. `user_access` — granularidad excesiva sin jerarquía**
La tabla tiene `(consultora_id, user_id, empresa_id, establecimiento_id)`. Para un usuario con acceso a 100 empresas × 10 establecimientos = 1.000 filas por usuario. Con 1.000 usuarios = 1.000.000 filas solo en control de acceso.
**Alternativa**: modelo jerárquico — acceso a nivel empresa implica acceso a todos sus establecimientos, salvo excepciones explícitas.

**7. `establecimientos_tipos_documentos` vs `empresas_rubros_documentos`**
Dos pivots casi idénticos con lógica similar. Si en el futuro se agrega ISO o más dimensiones, va a explotar en tablas pivot. Considerar una tabla `documentos_tipos_reglas` con columnas `dimension` + `dimension_value_id` para unificar.

---

### 🟢 Bien resuelto

- Separación clara de catálogos maestros vs. instancias operativas
- RLS en todas las tablas
- Índices en FKs de pivots
- Constraint UNIQUE en todas las tablas many-to-many
- `gestiones_tipos_establecimiento` correctamente normalizado
- `organizaciones_externas` como tabla polimórfica reutilizable (marcas, organismos, etc.)
