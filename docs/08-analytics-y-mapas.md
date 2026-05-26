# 08 — Analytics y mapas

> Datos de toda la consultora en una sola vista. Y un mapa que te muestra de un vistazo dónde están los focos de riesgo.

---

## ¿Qué resuelve?

Convierte los datos dispersos de incidentes, riesgos y documentos en información consolidada. Útil para reportes a clientes, decisiones de prioridad y demostrar el valor de tu trabajo como consultora.

---

## Analytics — Dashboard general {#dashboard}

**Dónde**: Menú avatar → **Herramientas** → **Analytics**  
También accesible desde el bottom nav en móvil.

### KPIs disponibles

| KPI | Descripción |
|-----|-------------|
| Incidentes del período | Total por rango de fechas seleccionado |
| Denuncias abiertas | Reclamos sin cerrar |
| Riesgos críticos activos | Sin medida de control implementada |
| Documentos vencidos | En todas las empresas del portfolio |
| Compliance de capacitación | % de personas con cursos al día |
| Establecimientos activos | Total gestionado por la consultora |

### Gráficos

- **Evolución de incidentes**: línea temporal del último año
- **Distribución de riesgos**: pie chart por nivel de criticidad
- **Top establecimientos con más eventos**: ranking por frecuencia
- **Tendencia de vencimientos**: documentos vencidos por mes

### Filtros del dashboard

- Rango de fechas (predefinidos: último mes, trimestre, año; o personalizado)
- Por empresa específica
- Por tipo de evento

---

## Dashboard del establecimiento

Cada establecimiento tiene su propio mini-dashboard, accesible desde el tab **Dashboard** dentro del establecimiento.

Muestra los mismos indicadores pero filtrados para ese establecimiento:
- Incidentes y denuncias del lugar
- Riesgos por sector (heatmap)
- Últimas gestiones registradas
- Documentos próximos a vencer

---

## Mapa de riesgos {#mapa-de-riesgos}

**Dónde**: Menú avatar → **Herramientas** → **Mapa de riesgos**

### Lo que ves

Un mapa interactivo (OpenStreetMap/Leaflet) con un marcador por cada establecimiento de la consultora.

**Significado del color del marcador**:

| Color | Nivel de riesgo máximo del establecimiento |
|-------|-------------------------------------------|
| 🟢 Verde | Sin riesgos críticos ni altos activos |
| 🟡 Amarillo | Tiene riesgos medios activos |
| 🟠 Naranja | Tiene riesgos altos activos |
| 🔴 Rojo | Tiene riesgos críticos activos |

### Interacción con el mapa

- **Zoom**: scroll del mouse o pinch en móvil
- **Clic en marcador**: muestra nombre, empresa, nivel de riesgo máximo y acceso directo al establecimiento
- **Clic en "Ver establecimiento"**: navega directo al perfil completo

### Para qué sirve en la práctica

- Antes de planificar la semana de visitas: ves de un vistazo dónde están los focos críticos
- Para reportes a clientes: imagen exportable del portfolio con estado de riesgos
- Para priorizar recursos cuando hay varios establecimientos en rojo

---

## Exportar datos {#exportar}

Desde el dashboard y desde los listados de incidentes, denuncias y vencimientos podés exportar:

- **CSV**: para análisis en Excel o Google Sheets
- **PDF**: para informes formales a clientes

**Dónde**: en cada listado, botón **Exportar** en la esquina superior derecha.

---

## Errores frecuentes

**❌ Los KPIs no reflejan los datos que cargué hoy**  
→ El dashboard puede tardar hasta unos minutos en sincronizar. Refrescá la página con `F5`.

**❌ Un establecimiento no aparece en el mapa**  
→ El domicilio del establecimiento no pudo ser geocodificado. Entrá a la ficha y verificá que la dirección esté completa y sin errores.

**❌ El color del marcador en el mapa no cambió aunque resolví un riesgo**  
→ Verificá que el riesgo esté marcado como **Controlado** (no solo "con control"). El mapa toma el estado final del riesgo.

---

## Tip pro 💡

Usá el mapa para el **cierre de año** con tu equipo. Un screenshot del mapa en enero y otro en diciembre, con los marcadores pasando de rojo a verde, es la evidencia más visual y contundente del trabajo que hizo la consultora durante el año.

---

[← IPERC](./07-iperc.md) | [Siguiente: Usuarios y roles →](./09-usuarios-y-roles.md)
