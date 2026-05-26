# 01 — Primeros pasos

> Este módulo es para la primera vez que ingresás a SIGMETRÍA. Te lleva desde el registro hasta tener tu primera empresa y establecimiento listos para operar.

---

## ¿Qué resuelve?

Configurar la identidad de tu consultora, personalizar el sistema y dejar todo listo para empezar a trabajar con tus clientes.

---

## Flujo inicial recomendado

```
Registrarse / Ingresar
        ↓
Configurar datos de la consultora
        ↓
Cargar el logo
        ↓
Agregar el primer usuario del equipo  (opcional)
        ↓
Crear la primera empresa cliente
        ↓
Crear el primer establecimiento
        ↓
¡Listo para operar!
```

---

## Configurar la consultora {#configurar-la-consultora}

**Dónde**: Menú avatar (`Ctrl+Shift+A`) → **Consultora** → **Información**

### Campos disponibles

| Campo | Obligatorio | Para qué sirve |
|-------|:-----------:|----------------|
| Nombre de la consultora | ✅ | Aparece en reportes y cabeceras |
| Teléfono | — | Contacto visible para clientes |
| Email | — | Comunicaciones oficiales |
| Sitio web | — | Link en documentos generados |
| Logo | — | Se muestra en toda la plataforma |
| Redes sociales | — | Instagram, LinkedIn, WhatsApp, etc. |

> **Tip**: Cargá el logo desde el primer día. Aparece en todos los reportes que exportés.

---

## Primera empresa {#primera-empresa}

**Dónde**: Menú lateral → **Empresas** → botón **Nueva empresa**

### Campos del formulario

| Campo | Obligatorio | Notas |
|-------|:-----------:|-------|
| Razón social | ✅ | Nombre legal completo |
| CUIT | ✅ | Sin guiones |
| Rubro / Actividad | ✅ | Define normativa aplicable |
| Localidad | ✅ | Provincia + ciudad |

Una vez creada la empresa, el sistema te lleva directo a crear el primer establecimiento.

---

## Primer establecimiento

**Dónde**: Dentro de la empresa → **Nuevo establecimiento**

### Campos clave

| Campo | Obligatorio | Por qué importa |
|-------|:-----------:|-----------------|
| Nombre del establecimiento | ✅ | Identifica la ubicación |
| Domicilio completo | ✅ | Usado para georreferenciación en el mapa |
| Tipo | ✅ | Fábrica, oficina, depósito, etc. |
| Actividad principal | ✅ | Base para la evaluación de riesgos |
| Cantidad de trabajadores | ✅ | Incide en índices y normativa |
| Aplica ISO 45001 | — | Activa secciones específicas del sistema |

---

## Errores frecuentes

**❌ "No veo la opción de crear empresa"**  
→ Tu rol puede ser `read_only` o `viewer`. Pedile al admin de la consultora que te asigne `full_access_main`.

**❌ El establecimiento no aparece en el mapa**  
→ El domicilio puede tener un error de escritura. Verificá que la dirección sea reconocible por Google Maps (calle + número + ciudad + provincia).

**❌ Subí el logo pero no se ve**  
→ Usá formatos PNG o SVG. JPG muy comprimidos pueden no renderizarse correctamente.

---

## Tip pro 💡

Antes de cargar datos reales, invitá a un colega con rol `read_only` para que valide que ve todo correctamente. Es más fácil corregir la estructura inicial que migrar datos después.

---

[← Volver al índice](./README.md) | [Siguiente: Empresas y establecimientos →](./02-empresas-y-establecimientos.md)
