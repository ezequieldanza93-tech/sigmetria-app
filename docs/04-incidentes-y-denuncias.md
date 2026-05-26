# 04 — Incidentes y denuncias

> Dos canales distintos para dos tipos de eventos. Los incidentes son lo que vos observás. Las denuncias son lo que los trabajadores reportan.

---

## ¿Qué resuelve?

Centraliza el registro de eventos adversos y reclamos formales, con trazabilidad completa desde la detección hasta el cierre. Reemplaza las planillas en papel y los emails informales.

---

## Diferencia entre incidente y denuncia

| | Incidente | Denuncia |
|--|-----------|----------|
| **¿Quién lo reporta?** | El consultor / profesional HyS | El trabajador u otra parte |
| **¿Qué registra?** | Casi-accidentes, eventos sin lesión, desvíos | Reclamos formales, situaciones de riesgo reportadas |
| **¿Requiere respuesta formal?** | Acciones correctivas | Respuesta documentada obligatoria |
| **¿Afecta indicadores?** | Índices de siniestralidad | Indicadores de clima laboral y compliance |

---

## Incidentes {#incidentes}

### Registrar un incidente nuevo {#nuevo-incidente}

**Dónde**: Menú avatar → **Incidentes y denuncias** → **Incidentes** → **Nuevo incidente**

O también desde dentro del establecimiento → sección Seguimiento.

### Campos del formulario

| Campo | Obligatorio | Notas |
|-------|:-----------:|-------|
| Empresa | ✅ | Empresa donde ocurrió |
| Establecimiento | ✅ | Sede específica |
| Fecha y hora del evento | ✅ | Momento real del incidente |
| Tipo de evento | ✅ | Casi-accidente, incidente sin lesión, condición insegura, acto inseguro |
| Descripción | ✅ | Qué pasó, cómo, dónde exactamente |
| Personas involucradas | — | Vinculadas desde el directorio |
| Sector | — | Área del establecimiento donde ocurrió |
| Causas identificadas | — | Inmediatas y raíz |
| Acciones correctivas | — | Medidas tomadas o a tomar |
| Evidencia fotográfica | — | Imágenes adjuntas |

### Estados de un incidente

```
ABIERTO  →  EN INVESTIGACIÓN  →  ACCIONES DEFINIDAS  →  CERRADO
```

---

## Denuncias {#denuncias}

### Registrar una denuncia nueva

**Dónde**: Menú avatar → **Incidentes y denuncias** → **Denuncias** → **Nueva denuncia**

### Campos del formulario

| Campo | Obligatorio | Notas |
|-------|:-----------:|-------|
| Empresa | ✅ | Empresa involucrada |
| Establecimiento | ✅ | Sede específica |
| Fecha de recepción | ✅ | Cuándo llegó la denuncia |
| Tipo | ✅ | Reclamo de seguridad, condición de trabajo, acoso, etc. |
| Descripción | ✅ | Contenido de la denuncia |
| Parte denunciante | — | Puede cargarse anónimamente |
| Estado | ✅ | En análisis, en proceso, cerrada |
| Respuesta formal | — | Texto de la respuesta enviada |

### Buenas prácticas al gestionar denuncias

1. **Registrá el día que recibís la denuncia**, no cuando la analizás
2. **Nunca identifiques al denunciante** si el trabajador pidió anonimato
3. **Documentá la respuesta** antes de cerrar — en una auditoría te lo van a pedir
4. **Vinculá a un incidente** si la denuncia derivó en uno

---

## Listado y seguimiento

**Dónde**: Menú avatar → **Incidentes** o **Denuncias**

El listado muestra todos los registros de la consultora con:
- Empresa y establecimiento
- Fecha
- Tipo
- Estado actual
- Responsable asignado

**Filtros disponibles**:
- Por empresa
- Por estado (abierto, cerrado, en proceso)
- Por rango de fechas

---

## Errores frecuentes

**❌ Registré un incidente en la empresa equivocada**  
→ Editá el incidente y cambiá la empresa y el establecimiento. No hay que borrarlo y crearlo de nuevo.

**❌ No encuentro el incidente que acabo de crear**  
→ El listado por default muestra los abiertos. Si está cerrado, aplicá el filtro **Todos los estados**.

**❌ ¿Puedo borrar un incidente?**  
→ Solo los usuarios con `full_access_main` pueden eliminar registros. Por diseño, los incidentes tienen trazabilidad permanente — si fue un error, preferí editarlo.

---

## Tip pro 💡

Usá el campo **Causas raíz** aunque parezca redundante con la descripción. Cuando llegue una auditoría externa y te pidan el análisis de causalidad, vas a tener todo documentado sin tener que reconstruirlo de memoria.

---

[← Agenda y gestiones](./03-agenda-y-gestiones.md) | [Siguiente: Capacitación →](./05-capacitacion.md)
