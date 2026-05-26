# 06 — Documentos y vencimientos

> El radar documental de tu consultora. SIGMETRÍA te avisa antes de que un documento venza — no después.

---

## ¿Qué resuelve?

Elimina el riesgo de operar con documentación vencida. Centraliza certificados, permisos e inspecciones de todas las empresas en un solo lugar, con alertas automáticas por colores antes de que llegue el problema.

---

## Sistema de alertas por colores

| Color | Significado |
|-------|-------------|
| 🔴 Rojo | Vencido — acción urgente requerida |
| 🟠 Naranja | Vence en menos de 30 días |
| 🟡 Amarillo | Vence en 30–90 días |
| ⚪ Sin color | Vigente — todo en orden |

---

## Panel de vencimientos {#proximos-vencimientos}

**Dónde**: Menú avatar → **Herramientas** → **Vencimientos**

### Lo que ves

Una lista consolidada de **todos los documentos de todas las empresas** de la consultora, ordenada por urgencia.

**Columnas del listado**:

| Columna | Descripción |
|---------|-------------|
| Documento | Nombre del certificado / permiso |
| Empresa | A qué empresa pertenece |
| Establecimiento | En qué sede |
| Tipo de entidad | Empresa, Establecimiento, Persona |
| Vencimiento | Fecha exacta |
| Días restantes | Contador actualizado diariamente |
| Estado | Color según urgencia |

**Filtros disponibles**:
- Por empresa
- Por estado (vencido, próximo, vigente)
- Por tipo de entidad
- Por rango de fechas

---

## Tipos de documentos

SIGMETRÍA gestiona documentos vinculados a tres entidades:

### Documentos de empresa
- Razón social / estatuto / CUIT
- Habilitación municipal
- Póliza de seguro de responsabilidad civil
- Contrato vigente con la consultora

### Documentos de establecimiento
- Habilitación del establecimiento
- Inspección de instalaciones eléctricas
- Certificado de matafuegos
- Planos aprobados
- Certificado de calderas o recipientes a presión
- Permisos especiales según actividad

### Documentos de personas
- Ficha médica preocupacional
- Certificado de aptitud médica periódica
- Constancia de entrega de EPP
- Certificados de capacitaciones externas
- Cursos habilitantes (trabajo en altura, espacios confinados, etc.)

---

## Cargar un documento {#cargar-documento}

**Dónde**: Dentro del establecimiento → tab **Ficha** → sección **Documentos**

1. Clic en **Nuevo documento**
2. Completá:

| Campo | Obligatorio | Notas |
|-------|:-----------:|-------|
| Tipo de documento | ✅ | Seleccioná del catálogo predefinido |
| Nombre / descripción | ✅ | Ej: "Cert. matafuegos - Planta Sur 2024" |
| Fecha de emisión | ✅ | Cuándo fue emitido |
| Fecha de vencimiento | ✅ | Cuándo expira |
| Archivo adjunto | — | PDF, JPG, PNG |
| Entidad asociada | ✅ | Empresa, Establecimiento o Persona |

3. Guardá → el sistema empieza a contar los días y activa alertas según los umbrales configurados

---

## Configurar alertas de vencimiento {#configurar-alertas}

**Dónde**: Menú avatar → **Herramientas** → **Vencimientos** → configuración

Podés definir con cuántos días de anticipación el sistema te avisa:

- **Alerta naranja**: default 30 días antes
- **Alerta amarilla**: default 90 días antes

Las alertas se envían por:
1. Notificación dentro de la app (campana superior)
2. Email al usuario responsable del establecimiento

---

## Notificaciones de vencimiento

**Dónde**: Ícono de campana en el header → o `/dashboard/notificaciones`

Cada notificación de vencimiento muestra:
- Qué documento vence
- A qué empresa/establecimiento/persona corresponde
- Cuántos días faltan (o hace cuántos venció)
- Botón de acción directa para ir al documento

Podés marcarlas como leídas individualmente o **marcar todas como leídas** de una vez.

---

## Errores frecuentes

**❌ Cargué un documento pero no aparece en el panel de vencimientos**  
→ Verificá que hayas completado la **fecha de vencimiento**. Sin esa fecha, el sistema no puede generar alertas.

**❌ Tengo un documento que vence todos los años y no quiero cargarlo cada vez**  
→ Cuando cargás la renovación, editá el documento existente y actualizá la fecha de vencimiento en vez de crear uno nuevo. Así mantenés el historial.

**❌ Recibo alertas de establecimientos que ya no gestiono**  
→ Desactivá el establecimiento desde su ficha o reasignalo a otro responsable.

---

## Tip pro 💡

Antes de cada visita a un establecimiento, filtrá el panel de vencimientos por esa empresa. En 30 segundos sabés si hay algo crítico que resolver — y llegás con la información antes de que el cliente te lo señale.

---

[← Capacitación](./05-capacitacion.md) | [Siguiente: IPERC →](./07-iperc.md)
