# 05 — Capacitación

> El LMS integrado de SIGMETRÍA. Sin herramienta externa: creás los cursos, los asignás, hacés el seguimiento y generás el certificado — todo desde el mismo sistema.

---

## ¿Qué resuelve?

Gestiona el ciclo completo de capacitación obligatoria en SSO: desde la creación del contenido hasta la evidencia de que cada persona completó y aprobó lo requerido.

---

## Estructura del módulo

```
Cursos (catálogo)
 ├── Para usuarios: Mis cursos asignados
 └── Para admins:
      ├── Administrar cursos (crear, editar, asignar)
      └── Compliance (estado de cumplimiento por empresa)
```

---

## Para usuarios — Mis cursos

**Dónde**: Menú avatar → **Capacitación** → **Mis cursos**

### Lo que ves

Cada curso asignado aparece como una tarjeta con:
- Nombre del curso
- Progreso en porcentaje
- Fecha límite para completarlo
- Estado: pendiente / en curso / aprobado / vencido

### Filtros

| Filtro | Cuándo usarlo |
|--------|---------------|
| **Todos** | Vista completa del historial |
| **Pendientes** | Los que todavía no empezaste |
| **En curso** | Los que ya iniciaste pero no terminaste |
| **Aprobados** | Historial de lo que completaste |
| **Vencidos** | Cursos que expiró su fecha límite sin completarse |

### Hacer un curso

1. Clic en el curso → abre el reproductor
2. Navegá las lecciones en orden
3. Completá los quizzes al final de cada lección
4. Al aprobar → el certificado se genera automáticamente

---

## Para administradores — Crear y gestionar cursos {#administrar-cursos}

**Dónde**: Menú avatar → **Capacitación** → **Administrar cursos**

Solo visible para roles `full_access_main` y `full_access_branch`.

### Crear un nuevo curso

1. Clic en **Nuevo curso**
2. Completá:

| Campo | Obligatorio | Notas |
|-------|:-----------:|-------|
| Nombre del curso | ✅ | Claro y descriptivo |
| Descripción | ✅ | Para qué sirve, a quién va dirigido |
| Duración estimada | — | En minutos, ayuda a los participantes a planificarse |
| Categoría | — | Ej: "Prevención de incendios", "Ergonomía", "Trabajo en altura" |
| Fecha de expiración | — | Si el curso vence (ej: anual) |

3. Agregá **lecciones** al curso:
   - Texto formateado
   - Videos embebidos (URL)
   - Quizzes de opción múltiple

4. Publicá el curso → queda disponible para asignar

### Asignar cursos a personas {#asignar-curso}

**Dónde**: Administrar cursos → clic en el curso → **Asignaciones**

- Asignación individual: buscá la persona en el directorio y asignale el curso
- Asignación grupal: seleccioná por empresa o por tipo de persona

Al asignar, el sistema:
1. Notifica al usuario (email + notificación en la app)
2. Agrega el curso a su lista con el estado **Pendiente**
3. Empieza a contar el tiempo hasta la fecha límite

---

## Compliance de capacitación {#compliance}

**Dónde**: Menú avatar → **Capacitación** → **Compliance**

Vista consolidada del estado de cumplimiento por empresa.

### Lo que muestra

- Tabla con todas las empresas del portfolio
- Para cada empresa: % de personas que aprobaron cada curso obligatorio
- Alertas de cursos vencidos sin renovar
- Personas con capacitación incompleta

### Cómo usar el reporte de compliance

1. Identificá las empresas con % bajo (marcadas en rojo/naranja)
2. Hacé clic para ver qué personas están pendientes
3. Reenviá la asignación o extendé el plazo si corresponde
4. Exportá el reporte para presentarlo al cliente

---

## Certificados {#certificados}

El certificado se genera automáticamente cuando el usuario aprueba el curso.

**Cómo acceder**:
- Usuario: **Mis cursos** → curso aprobado → **Descargar certificado**
- Admin: **Administrar cursos** → curso → **Participantes** → descargá el certificado de cualquier persona

**Formato**: PDF con nombre del participante, nombre del curso, fecha de aprobación y firma digital de la consultora.

---

## Errores frecuentes

**❌ Un usuario dice que no le llegó el curso asignado**  
→ Verificá que el email del usuario esté cargado en su perfil. Las notificaciones de asignación van al email. El curso igual aparece en la app.

**❌ El quiz no avanza aunque las respuestas son correctas**  
→ Refrescá la página. Si persiste, verificá que el navegador tenga JavaScript habilitado y no use bloqueadores agresivos.

**❌ No puedo generar el certificado de un curso**  
→ El certificado solo se genera si el usuario completó **todas** las lecciones y aprobó **todos** los quizzes. Revisá el progreso desde Administrar cursos → participante.

---

## Tip pro 💡

Creá un curso de **inducción general** y asignalo automáticamente a toda persona nueva que entre al directorio. No es una función automática del sistema, pero si lo hacés como primer paso cuando cargás a alguien, garantizás que nadie empiece a trabajar sin la capacitación básica.

---

[← Incidentes y denuncias](./04-incidentes-y-denuncias.md) | [Siguiente: Documentos y vencimientos →](./06-documentos-y-vencimientos.md)
