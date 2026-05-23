# Sistema de Firmas Electrónicas para Gestiones y Registros

## Objetivo
Sistema de firma electrónica simple con validez de auditoría (Fase 1). Los usuarios internos firman gestiones completas con un click + confirmación. Los trabajadores externos firman registros de capacitación, permisos de trabajo y entregas de EPP presencialmente en el dispositivo del profesional, capturando su nombre, DNI y firma manuscrita (dibujada). Todo queda registrado en DB con timestamp y en los PDFs generados.

## Stack
- Next.js 15 App Router + Server Actions
- Supabase PostgreSQL 17
- TanStack React Query 5
- Tailwind CSS + shadcn/ui primitives
- jsPDF + html2canvas (ya existen en el proyecto para exportación PDF)

## Decisiones tomadas

| Decisión | Opción |
|----------|--------|
| Tipo de firma Fase 1 | Firma electrónica simple (click + registro DB + PDF) |
| Fase 2 (futura) | Agregar capa criptográfica con certificado digital .p12 |
| Certificado | No lo tienen aún, hay que tramitarlo |
| Ámbito firma interna | Gestión completa (no por ítem) |
| Ámbito firma trabajadores | Capacitación, permisos de trabajo, entrega EPP |
| Acceso trabajadores | Firma presencial en el dispositivo del profesional |
| Bloque de firma PDF | Nombre, DNI, rol, fecha, hora + campo firma |
| Almacenamiento certificado | Archivo .p12 en servidor (Fase 2) |

## Requerimientos funcionales

### 1. Base de datos — Migración

```sql
CREATE TABLE firmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id UUID NOT NULL REFERENCES consultoras(id) ON DELETE CASCADE,
  entidad_tipo TEXT NOT NULL CHECK (entidad_tipo IN ('gestion', 'capacitacion', 'permiso_trabajo', 'entrega_epp')),
  entidad_id UUID NOT NULL,
  firmante_tipo TEXT NOT NULL CHECK (firmante_tipo IN ('usuario_interno', 'trabajador')),
  firmante_usuario_id UUID REFERENCES profiles(id),
  trabajador_id UUID REFERENCES trabajadores(id),
  nombre_completo TEXT NOT NULL,
  dni TEXT NOT NULL,
  rol TEXT,
  firma_svg_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_firmas_entidad ON firmas(entidad_tipo, entidad_id);
CREATE INDEX idx_firmas_consultora ON firmas(consultora_id);
```

Además, evaluar si las tablas existentes (`gestiones`, `capacitaciones`) necesitan un campo `firmada BOOLEAN DEFAULT false` o si se determina desde la tabla `firmas`.

### 2. Server Actions

- `firmar_gestion` — Crea registro en `firmas` para una gestión firmada por usuario interno. Recibe: gestion_id + confirmación. Detecta automáticamente el usuario logueado, su nombre, rol. Registra IP y user agent.
- `firmar_registro_trabajador` — Crea registro para firma de trabajador. Recibe: entidad_tipo, entidad_id, nombre_completo, dni, rol, firma_svg_data (base64 del canvas). El usuario logueado es quien "asiste" la firma.
- `get_firmas_entidad` — Query TanStack: obtiene todas las firmas de una entidad (gestión, capacitación, etc.)
- `get_entidades_pendientes_firma` — Query TanStack: gestiones/registros del usuario que aún no tienen firma
- `generar_pdf_con_firmas` — Server action que genera PDF de la entidad con todos los bloques de firma incluidos

### 3. Frontend — Firma de Usuario Interno

Un botón **"Firmar gestión"** en la pantalla de detalle de la gestión:
- Al hacer clic, muestra modal de confirmación con:
  - Datos del firmante (nombre, rol) — precargados del perfil
  - Fecha y hora actual
  - Botón "Confirmar firma"
- Al confirmar, se crea el registro en `firmas` y se actualiza el estado de la gestión
- Feedback visual: badge "Firmada" + nombre del firmante + fecha
- La gestión firmada no debería permitir edición (o sí? — decidir: si se permite re-editar, la firma queda como registro histórico)

### 4. Frontend — Firma de Trabajador (presencial)

Flujo desde el detalle de una capacitación, permiso de trabajo o entrega de EPP:

1. Botón **"Hacer firmar al trabajador"**
2. Modal de firma con:
   - Campo: Nombre completo del trabajador
   - Campo: DNI
   - Campo: Rol / Puesto
   - **Canvas de firma**: área donde el trabajador dibuja su firma con el dedo (touch) o mouse
     - Botón "Limpiar" para volver a dibujar
     - Lápiz de color oscuro sobre fondo blanco
   - Botón "Confirmar firma" (solo habilitado si todos los campos completos + firma dibujada)
3. Al confirmar:
   - Se guarda el SVG/Canvas como texto base64 en `firma_svg_data`
   - Se registra el timestamp
   - El profesional (usuario logueado) queda como "asistente" de la firma (se registra su ID en el contexto)
   - Feedback: "Firma registrada con éxito"

### 5. Bloque de Firma en PDF

Al generar PDF de una gestión o registro firmado:
- Encabezado: "Registro de Firmas"
- Por cada firma:
  - Nombre completo
  - DNI
  - Rol
  - Fecha y hora
  - Línea para firma manuscrita (mostrar la imagen SVG si existe, o una línea punteada)
- Footer: "Documento generado por Sigmetría HyS - Fecha de generación"
- Código QR opcional para Fase 2

### 6. UX

- La firma en canvas debe funcionar bien en dispositivos táctiles (tablet que usa el profesional en campo)
- Modal responsive: en mobile/tablet ocupa casi toda la pantalla
- Indicador visual de gestión firmada vs pendiente (en listados y detalle)
- Timeline de firmas en el detalle de la entidad

## Archivos existentes relevantes
- `lib/actions/` — Server actions existentes
- `lib/queries/` — React Query hooks
- `lib/types.ts` — Tipos
- `components/ui/` — Modal, Button, Input, Badge
- `components/forms/` — Formularios existentes (ver patrón)
- Módulo de gestiones — investigar estructura actual (ruta, componentes, tipos)
- Módulo de capacitaciones — investigar
- Módulo de EPP — investigar

## Notas de implementación
- El canvas de firma se implementa con un componente React que dibuja con eventos mouse/touch
- Guardar `firma_svg_data` como TEXT en base64
- No usar librerías externas de firma para Fase 1 (mantener simple)
- El PDF debe generarse con jsPDF (ya existe en el proyecto)
- Investigar si existe tabla `trabajadores` o si los trabajadores se referencian desde otra entidad
- La Fase 2 (certificado digital) no se implementa ahora, solo dejar la arquitectura preparada
- Validar que el DNI del trabajador se almacene como TEXT (puede tener formato variado)
