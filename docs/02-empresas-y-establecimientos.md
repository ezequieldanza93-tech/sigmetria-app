# 02 — Empresas y establecimientos

> El núcleo de SIGMETRÍA. Todo el trabajo de campo —visitas, riesgos, documentos, incidentes— vive dentro de un establecimiento.

---

## ¿Qué resuelve?

Organizar el portfolio completo de empresas-cliente y sus ubicaciones físicas. Cada establecimiento es la "unidad de trabajo" del sistema.

---

## Estructura del módulo

```
Empresa (cliente)
 └── Establecimiento
      ├── Agenda / Gestiones   → visitas, inspecciones, reuniones
      ├── Ficha                → datos, documentos, sectores, firmas
      ├── Dashboard            → KPIs y métricas del establecimiento
      └── Seguimiento          → histórico, vencimientos, acciones pendientes
```

---

## Gestionar empresas

**Dónde**: Menú lateral → **Empresas**

### Lo que ves en el listado

| Columna | Descripción |
|---------|-------------|
| Razón social | Nombre legal de la empresa |
| CUIT | Identificación fiscal |
| Rubro | Actividad principal |
| Localidad | Ciudad + provincia |
| Establecimientos activos | Cantidad de sedes en operación |

### Acciones disponibles
- **Crear** nueva empresa (botón superior derecho)
- **Editar** datos desde el detalle
- **Ver establecimientos** expandiendo la fila

---

## Gestionar establecimientos

**Dónde**: Dentro de una empresa → lista de establecimientos

### Ficha del establecimiento {#ficha}

Todos los datos base del lugar físico:

| Campo | Notas |
|-------|-------|
| Nombre | Ej: "Planta Sur", "Oficina Central" |
| Domicilio + CP + Localidad + Provincia | Usado para el mapa y Google Maps |
| Tipo | Fábrica, Oficina, Depósito, Taller, etc. |
| Actividad principal | Descripción de la operación del lugar |
| Cantidad de trabajadores | Se usa para cálculo de índices SSO |
| Foto del establecimiento | JPG, PNG — aparece en la ficha |
| Plano | Imagen del layout del lugar |
| ISO 45001 | Checkbox — activa secciones normativas |

### Sectores / Áreas

Dividí el establecimiento en sectores para una evaluación de riesgos más granular.

**Cómo crear un sector**:
1. Entrá a la ficha del establecimiento
2. Scrolleá hasta **Sectores**
3. Clic en **Nuevo sector**
4. Nombre + descripción + tipo de actividad

> Ejemplos: "Área de producción", "Depósito de materias primas", "Oficinas administrativas", "Comedor"

---

## Las 4 secciones del establecimiento

### Agenda / Gestiones {#agenda}

Registrá cada vez que interactuás con el establecimiento.

**Tipos de gestión**:
- Visita de campo
- Inspección de seguridad
- Reunión con el cliente
- Auditoría
- Seguimiento de acciones

**Cómo registrar una gestión**:
1. Entrá al establecimiento → tab **Agenda**
2. Clic en **Nueva gestión**
3. Completá: tipo, fecha, hora, responsable, observaciones
4. Guardá

El calendario muestra todas las gestiones del mes con color por tipo.

---

### Dashboard del establecimiento

Vista rápida del estado de SSO:

- **KPIs**: incidentes del período, denuncias abiertas, riesgos críticos sin control
- **Gráficos de tendencia**: evolución de eventos en el tiempo
- **Heatmap de riesgos**: mapa de calor por sector
- **Indicadores de conformidad**: documentos al día vs. vencidos

---

### Seguimiento

Historial completo del establecimiento:
- Timeline de todas las gestiones realizadas
- Documentos vencidos o próximos a vencer
- Acciones correctivas pendientes
- Últimos incidentes registrados

---

## Errores frecuentes

**❌ El establecimiento no aparece en el mapa geográfico**  
→ El domicilio debe estar completo: calle, número, localidad y provincia. Revisá que no haya abreviaturas que confundan el geocodificador.

**❌ No puedo crear sectores**  
→ Primero guardá la ficha del establecimiento. La opción de sectores se habilita después del primer guardado.

**❌ Los KPIs del dashboard muestran cero aunque hay datos**  
→ Verificá el rango de fechas seleccionado en el dashboard. El default puede no incluir el período que buscás.

---

## Tip pro 💡

Usá los **sectores** desde el inicio, aunque el establecimiento sea chico. Cuando hagas la evaluación IPERC, podés asignar peligros por sector en vez de para todo el lugar. Los reportes quedan mucho más precisos.

---

[← Primeros pasos](./01-primeros-pasos.md) | [Siguiente: Agenda y gestiones →](./03-agenda-y-gestiones.md)
