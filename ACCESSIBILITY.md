# Accesibilidad — WCAG 2.1 Nivel AA

**Mandato legal**: Art. 4.5 Resolución SRT 48/2025  
**Estándar**: WCAG 2.1 Nivel AA  
**Fecha de auditoría**: 2026-05-28

---

## Resumen ejecutivo

Se auditaron y corrigieron 20 archivos con problemas de accesibilidad en las siguientes categorías: labels de formularios, roles ARIA, estados de carga, mensajes de error, navegación por teclado, e íconos decorativos.

---

## Correcciones aplicadas

### Cat 1: Labels en formularios

| Archivo | Problema | Corrección |
|---------|----------|------------|
| `components/forms/siniestro-form.tsx` | 4 `<select>` sin `htmlFor` vinculado | Agregado `id` + `htmlFor` + `focus-visible:ring-2` en todos |
| `components/forms/inspeccion-form.tsx` | `<select>` "Ente regulador" sin `htmlFor` | Agregado `id="inspeccion-ente"` + `htmlFor` |
| `components/forms/empresa-form.tsx` | `<textarea>` "Información general" sin `htmlFor` | Agregado `id="empresa-informacion-general"` + `htmlFor` |
| `components/forms/documento-form.tsx` | 3 controles (`select`, `input[date]`, `input[file]`) sin `htmlFor` | Agregado `id` + `htmlFor` en los tres |
| `components/forms/sector-form.tsx` | `<input>` "Nombre del sector" sin `htmlFor` | Agregado `id="sector-nombre"` + `htmlFor` + `aria-required` |
| `components/cierre-observacion-modal.tsx` | `<input[date]>` "Fecha de cierre" sin `htmlFor`; `<input[file]>` "Foto de evidencia" sin `htmlFor` | Agregado `id` + `htmlFor` + `aria-required` en fecha |
| `components/ui/file-upload-input.tsx` | Íconos `<Upload>` y `<ExternalLink>` sin `aria-hidden` | Agregado `aria-hidden="true"` |
| `app/(dashboard)/dashboard/incidentes/list-client.tsx` | `<input[text]>` de búsqueda sin `aria-label` | Cambiado a `type="search"` + `aria-label` |
| `app/(dashboard)/dashboard/denuncias/list-client.tsx` | `<input[text]>` de búsqueda sin `aria-label` | Cambiado a `type="search"` + `aria-label` |

### Cat 2: Roles y landmarks ARIA

| Archivo | Problema | Corrección |
|---------|----------|------------|
| `components/ui/modal.tsx` | `<dialog>` sin `aria-labelledby`; botón cerrar sin `aria-label` ni focus ring | Agregado `aria-labelledby` apuntando al `h2` con ID único; `aria-label="Cerrar"`; `focus-visible:ring-2` |
| `components/ui/tabs.tsx` | Tab buttons sin `role="tab"`, `aria-selected`, `aria-controls`; panel sin `role="tabpanel"` | Implementado patrón completo ARIA tabs |
| `components/dashboard/dashboard-shell.tsx` | Tab buttons sin roles ARIA | Agregado `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `id` |
| `components/alertas/alertas-bell.tsx` | Dropdown sin `role="dialog"`; botón sin `aria-expanded`/`aria-haspopup` | Agregado `role="dialog"`, `aria-expanded`, `aria-haspopup="dialog"`, `aria-modal="false"` |
| `components/notification-dropdown.tsx` | Dropdown sin `role="dialog"`; botón sin `aria-expanded` | Mismo tratamiento que alertas-bell |
| `components/agent/chat-panel.tsx` | Botones sin `aria-label`; textarea sin `aria-label`; íconos sin `aria-hidden` | Corregido completamente |
| `components/cierre-observacion-modal.tsx` | `input[search]` de búsqueda sin `aria-label`, `aria-autocomplete`, `aria-expanded`; input chat sin `aria-label`; botón enviar sin `aria-label` | Corregido completamente |
| `app/onboarding/page.tsx` | Stepper visual sin estructura semántica | Convertido a `<nav aria-label>` + `<ol>` con `aria-current="step"` |

### Cat 3: Mensajes de estado y errores

| Archivo | Corrección |
|---------|------------|
| `components/ui/toaster.tsx` | Agregado `role="status"`, `aria-live="polite"`, `aria-atomic="false"` al contenedor |
| `components/forms/incidente-form.tsx` | `role="alert"` en div de error |
| `components/forms/denuncia-form.tsx` | `role="alert"` en div de error |
| `components/forms/siniestro-form.tsx` | `role="alert"` en div de error |
| `components/forms/inspeccion-form.tsx` | `role="alert"` en div de error |
| `components/forms/empresa-form.tsx` | `role="alert"` en div de error |
| `components/forms/riesgo-form.tsx` | `role="alert"` en div de error |
| `components/forms/documento-form.tsx` | `role="alert"` en div de error |
| `components/forms/sector-form.tsx` | `role="alert"` en div de error |
| `components/forms/invite-usuario-form.tsx` | `role="alert"` en error; `role="status"` + `aria-live` en mensaje de éxito |
| `components/forms/organizacion-externa-form.tsx` | `role="alert"` en div de error |
| `components/cierre-observacion-modal.tsx` | `role="alert"` en div de error |
| `app/onboarding/page.tsx` | `role="alert"` en div de error |
| `components/alertas/alertas-bell.tsx` | `aria-busy="true"` + `aria-label` en estado de carga |
| `components/notification-dropdown.tsx` | `aria-busy="true"` + `aria-label` en estado de carga |
| `components/dashboard/dashboard-shell.tsx` | `aria-busy="true"` + `aria-label` en grid de carga |
| `components/agent/chat-panel.tsx` | `role="status"` + `aria-busy="true"` + `aria-label` en indicador de escritura |

### Cat 4: Navegación por teclado

| Archivo | Corrección |
|---------|------------|
| `components/ui/modal.tsx` | `focus-visible:ring-2` en botón cerrar |
| `components/alertas/alertas-bell.tsx` | `focus-visible:ring-2` en botón de campana |
| `components/notification-dropdown.tsx` | `focus-visible:ring-2` en botón de campana; en botón "marcar leída" |
| `components/agent/chat-panel.tsx` | `focus-visible:ring-2` en botones de aprobar/rechazar y enviar |
| `components/app-header.tsx` | `focus-visible` en DropdownItems y botón logout |
| `components/ui/tabs.tsx` | `focus-visible:ring-2 focus-visible:ring-inset` en tab buttons |
| `components/dashboard/dashboard-shell.tsx` | `focus-visible:ring-2` en tab buttons |

### Cat 5: SVGs e íconos decorativos

| Archivo | Corrección |
|---------|------------|
| `app/verificar-certificado/[codigo]/page.tsx` | `aria-hidden="true"` en `XCircle`, `AlertTriangle` (×2), `CheckCircle`, `Award`; emojis ⚠/✓ envueltos en `<span aria-hidden>` |
| `components/app-header.tsx` | `aria-hidden` en íconos dentro de `DropdownItem`; `aria-hidden` en icono de logout |
| `components/cierre-observacion-modal.tsx` | `aria-hidden` en ícono `<Send>` |
| `components/agent/chat-panel.tsx` | `aria-hidden` en `<Send>`, `<X>`, `<Loader2>`, `<ShieldAlert>`, `<Check>` |
| `components/forms/incidente-form.tsx` | `aria-hidden` en `<X>` de quitar foto |
| `components/forms/denuncia-form.tsx` | `aria-hidden` en `<X>` de quitar foto |

### Cat 6: Canvas de firma

| Archivo | Corrección |
|---------|------------|
| `components/firmas/firma-canvas.tsx` | `role="img"` + `aria-label` descriptivo en el `<canvas>` |

### Cat 7: Página pública /verificar-certificado/[codigo]

Archivo: `app/verificar-certificado/[codigo]/page.tsx`
- Todos los íconos con `aria-hidden="true"`
- Emojis decorativos (⚠ y ✓) separados en `<span aria-hidden>` para que el h1 sea legible como texto puro
- Estructura h1 lógica ya existente — sin cambios

---

## Problemas pendientes (requieren decisión de diseño)

### P1 — Focus trap en modales (impacto alto)
El componente `Modal` usa el elemento nativo `<dialog>` que tiene focus trap nativo en navegadores modernos (Chrome 98+, Firefox 98+, Safari 15.4+). En navegadores más antiguos o en iOS WebView, el focus trap nativo puede no funcionar. **Decisión**: evaluar si la audiencia target requiere soporte legacy. Si es necesario, agregar una librería de focus trap como `focus-trap-react` (~2KB).

### P2 — Contraste de colores (requiere verificación con design tokens reales)
Las clases de contraste usan CSS custom properties (`--warning`, `--danger`, `--success`, `--info`, `--brand-primary`). No es posible verificar el ratio exacto 4.5:1 sin los valores hexadecimales concretos de los tokens. **Acción**: ejecutar axe DevTools o Lighthouse en entorno de producción para verificar ratios reales. Los badges de severidad y las notificaciones de vencimiento son los más susceptibles.

### P3 — Aria-describedby en errores de campo (impacto medio)
Los campos individuales con error en `components/ui/input.tsx` y `components/ui/select.tsx` muestran el mensaje de error (`<p className="text-xs ...">`) pero el input no tiene `aria-describedby` apuntando a él ni `aria-invalid="true"`. La arquitectura actual pasa el `error` como prop, pero no genera un `id` dinámico para la referencia. **Solución futura**: generar `errorId = ${inputId}-error` y agregar `aria-describedby={errorId}` + `aria-invalid={!!error}` en ambos componentes.

### P4 — Paginación en listas sin roles ARIA (impacto bajo)
Las listas de incidentes y denuncias tienen paginación con botones Anterior/Siguiente pero sin `aria-label="Paginación"` ni `aria-current="page"`. Resolver cuando se refactorice la paginación.

### P5 — Reducción de movimiento (impacto bajo)
Las animaciones `animate-in`, `animate-pulse`, `animate-spin` no respetan `prefers-reduced-motion`. Agregar en `globals.css`: `@media (prefers-reduced-motion: reduce) { .animate-in, .animate-pulse { animation: none; } }`.

### P6 — Tabla establecimiento-tabs y otras tablas sin aria-label
Existen múltiples tablas en las vistas de establecimiento que no tienen `aria-label` descriptivo. Se priorizaron las de incidentes y denuncias por ser las de mayor tráfico.

---

## Herramientas recomendadas para validación continua

1. **axe DevTools** (extensión Chrome/Firefox) — auditoría automatizada en tiempo real
2. **Lighthouse** (DevTools > Lighthouse > Accessibility) — score general y recomendaciones
3. **NVDA** (Windows) o **VoiceOver** (macOS/iOS) — prueba real con lector de pantalla
4. **jest-axe** — integrar en test suite para prevenir regresiones:
   ```bash
   npm install --save-dev jest-axe
   ```
5. **eslint-plugin-jsx-a11y** — previene problemas en tiempo de desarrollo:
   ```bash
   npm install --save-dev eslint-plugin-jsx-a11y
   ```
   Agregar en `.eslintrc`: `"plugins": ["jsx-a11y"], "extends": ["plugin:jsx-a11y/recommended"]`

---

## Archivos modificados

```
components/ui/modal.tsx
components/ui/toaster.tsx
components/ui/tabs.tsx
components/ui/file-upload-input.tsx
components/forms/empresa-form.tsx
components/forms/incidente-form.tsx
components/forms/denuncia-form.tsx
components/forms/siniestro-form.tsx
components/forms/inspeccion-form.tsx
components/forms/riesgo-form.tsx
components/forms/documento-form.tsx
components/forms/sector-form.tsx
components/forms/organizacion-externa-form.tsx
components/forms/invite-usuario-form.tsx
components/alertas/alertas-bell.tsx
components/notification-dropdown.tsx
components/cierre-observacion-modal.tsx
components/firmas/firma-canvas.tsx
components/agent/chat-panel.tsx
components/app-header.tsx
components/dashboard/dashboard-shell.tsx
app/(dashboard)/dashboard/incidentes/list-client.tsx
app/(dashboard)/dashboard/denuncias/list-client.tsx
app/verificar-certificado/[codigo]/page.tsx
app/onboarding/page.tsx
```
