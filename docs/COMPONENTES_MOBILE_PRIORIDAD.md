# Componentes a Adaptar para Mobile — Priorizados por Impacto/Esfuerzo

Priorización: **Alta** (bloqueante para navegación), **Media** (bloqueante para operación), **Baja** (mejora de UX)

---

## Fase 1 — Responsive Foundation

| # | Componente | Prioridad | Esfuerzo | Problema | Solución |
|---|-----------|-----------|----------|----------|----------|
| 1 | `components/layout/sidebar.tsx` | 🔴 Alta | M | Fixed 260px sidebar, overlay en mobile, hover tooltips | Slide-over drawer en <1024px. Menú hamburguesa existente pero sin animación smooth. Convertir a panel desde la izquierda con backdrop. |
| 2 | `app/(dashboard)/dashboard/empresas/page.tsx` | 🔴 Alta | M | Tabla empresas con columnas | Convertir a card stack en mobile. Cada card: nombre, CUIT, contacto. Swipe para acciones. |
| 3 | `components/establecimiento-tabs.tsx` (SectoresTab) | 🔴 Alta | M | 9 tabs + tablas anchas de sectores/puestos | Tabs → scroll horizontal nativo. Sectores → cards. Puestos → inline expand. |
| 4 | `app/(dashboard)/dashboard/personas/page.tsx` | 🔴 Alta | M | Tabla de personas con varias columnas | Card layout con avatar + nombre + tipo + teléfono. Búsqueda por texto obligatoria en mobile. |
| 5 | `app/(dashboard)/dashboard/productos/page.tsx` | 🔴 Alta | M | Tabla productos | Card layout. Filtro por categoría como dropdown. |
| 6 | `app/(dashboard)/dashboard/organizaciones-externas/page.tsx` | 🔴 Alta | S | Tabla simple | Card layout sencillo. |
| 7 | `app/(dashboard)/dashboard/instrumentos/page.tsx` | 🔴 Alta | M | CRUD con tabla | Card layout + bottom sheet para formularios. |
| 8 | `app/(dashboard)/dashboard/usuarios/page.tsx` | 🔴 Alta | S | Tabla miembros | Card layout. |
| 9 | `components/app-header.tsx` | 🟡 Media | S | Breadcrumb largo + dropdown avatar | Oculta breadcrumb en mobile (<640px). Avatar menu → bottom sheet. |
| 10 | `components/ui/modal.tsx` | 🟡 Media | M | `max-w-lg`/`max-w-4xl` no caben en mobile | Responsive: `max-w-[calc(100vw-2rem)] m-4`. Bottom sheet style cuando sea posible. |
| 11 | `components/dashboard-filter-bar.tsx` | 🟡 Media | S | Dos selects inline | Stack vertical en mobile. |
| 12 | `components/forms/*.tsx` (9 forms) | 🟡 Media | M | `grid-cols-2` | `grid-cols-1 sm:grid-cols-2`. Inputs full-width. |
| 13 | `components/establecimiento-tabs.tsx` (GestionesTab + PHVA) | 🟡 Media | M | PHVA 4-column layout en cards | Stack vertical. Cada fase (P/H/V/A) en su propia card. |
| 14 | `components/establecimiento-tabs.tsx` (DocumentosTab) | 🟡 Media | S | Tabla documentos con fechas | Card layout. Vencimiento con color badge. |
| 15 | `components/establecimiento-tabs.tsx` (RiesgosTab) | 🟡 Media | S | Tabla riesgos | Agrupar por nivel. Cada riesgo como card expandible. |
| 16 | `components/establecimiento-tabs.tsx` (SiniestrosTab) | 🟡 Media | S | Tabla siniestros | Card layout. |
| 17 | `components/establecimiento-tabs.tsx` (InspeccionesTab) | 🟡 Media | S | Tabla inspecciones | Card layout. |
| 18 | `components/establecimiento-tabs.tsx` (AsistenciaTab) | 🟡 Media | S | Form entrada/salida + tabla | Form vertical. Tabla simplificada. |
| 19 | `components/empresa-right-panel.tsx` | 🟢 Baja | S | Panel lateral en detalle empresa | Pasa a sección inferior o acordeón. |
| 20 | `components/establecimiento-location.tsx` | 🟢 Baja | S | Mapa + datos en grid | Stack vertical. |
| 21 | `components/weather-clock.tsx` | 🟢 Baja | S | Reloj + clima en header | Ocultar en mobile. |
| 22 | `components/reporte-fotografico-modal.tsx` | 🟢 Baja | S | Modal con fotos | Full screen en mobile. |
| 23 | `components/photo-canvas-editor.tsx` | 🟢 Baja | S | Editor de fotos | Asegurar touch events. |
| 24 | `components/phva-diagram.tsx` | 🟢 Baja | S | Diagrama PHVA | Versión simplificada para mobile. |
| 25 | `components/breadcrumb-nav.tsx` | 🟢 Baja | S | Breadcrumb | Ocultar en mobile (el header ya muestra ubicación actual). |
| 26 | `components/ui/stat-card.tsx` | 🟢 Baja | S | Card decorativa | Ya es responsive. |

---

## Fase 2 — Touch & Interaction

| # | Componente | Prioridad | Esfuerzo | Problema | Solución |
|---|-----------|-----------|----------|----------|----------|
| 1 | `establecimiento-tabs.tsx` (todos los forms inline) | 🟡 Media | M | Botones chicos, selects complejos | min-h-11 en todos los interactive elements. |
| 2 | `components/ui/button.tsx` | 🟡 Media | S | Sin tamaño "touch" | Agregar variant `touch` con min-h-11. |
| 3 | `sidebar.tsx` (hover tooltips) | 🟡 Media | S | No funcionan en touch | Tap-to-expand en mobile. |
| 4 | `app-header.tsx` (user dropdown) | 🟢 Baja | S | Hover dropdown | Click-to-toggle con portal. |
| 5 | `components/layout/mobile-menu-context.tsx` | 🟢 Baja | S | Solo contexto | Agregar swipe para cerrar sidebar. |

---

## Fase 3 — PWA + Capacitor

| # | Componente | Prioridad | Esfuerzo | Problema | Solución |
|---|-----------|-----------|----------|----------|----------|
| 1 | `app/layout.tsx` | 🟡 Media | S | Sin manifest link | Agregar `<link rel="manifest">` |
| 2 | `public/` | 🟡 Media | S | Sin icons | Agregar icons 192/512 + apple-touch-icon |
| 3 | `app/layout.tsx` | 🟢 Baja | S | Sin theme-color meta | Agregar `<meta name="theme-color">` |
| 4 | `app/layout.tsx` | 🟢 Baja | S | Sin apple-mobile-web-app-capable | Agregar meta tags iOS |

---

## Resumen

| Prioridad | Count | Esfuerzo estimado |
|-----------|-------|-------------------|
| 🔴 Alta | 8 | 2-3 semanas |
| 🟡 Media | 13 | 1-2 semanas |
| 🟢 Baja | 9 | 3-5 días |

Los 8 componentes de alta prioridad son todas tablas/lists que necesitan un card layout alternativo. El componente más complejo es `establecimiento-tabs.tsx` porque concentra 9 tabs + múltiples subcomponentes.
