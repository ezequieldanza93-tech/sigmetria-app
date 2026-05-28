# Sigmetría HyS — API de Interoperabilidad

API REST para integración de datos de cumplimiento normativo según **Art. 4.7 Res. SRT 48/2025**.

**Base URL:** `https://app.sigmetria.com.ar/api/v1`  
**Spec OpenAPI:** `GET /api/v1/docs`  
**Límite:** 60 requests / minuto por API key

---

## Autenticación

Todas las requests requieren una API key en el header `Authorization`:

```
Authorization: Bearer sig_<tu_key>
```

Las keys se generan en **Configuración → API Keys** (requiere rol Administrador Principal).

---

## Endpoints

### `GET /empresas`

Lista todas las empresas gestionadas por tu consultora.

```bash
curl https://app.sigmetria.com.ar/api/v1/empresas \
  -H "Authorization: Bearer sig_tu_key_aqui"
```

**Respuesta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "razon_social": "Acme S.A.",
      "cuit": "30719848531",
      "rubro": "Construcción",
      "localidad": "Buenos Aires",
      "provincia": "Buenos Aires"
    }
  ],
  "total": 1
}
```

---

### `GET /empresas/{cuit}/cumplimiento`

Estado de cumplimiento por establecimiento para una empresa identificada por CUIT.

```bash
curl https://app.sigmetria.com.ar/api/v1/empresas/30719848531/cumplimiento \
  -H "Authorization: Bearer sig_tu_key_aqui"
```

**Respuesta:**
```json
{
  "empresa": {
    "id": "uuid",
    "razon_social": "Acme S.A.",
    "cuit": "30719848531"
  },
  "establecimientos": [
    {
      "id": "uuid",
      "nombre": "Planta Norte",
      "domicilio": "Ruta 9 km 45",
      "estado": "amarillo",
      "riesgos_criticos": 0,
      "riesgos_altos": 2,
      "siniestros_abiertos": 1,
      "documentos_vencidos": 0
    }
  ],
  "generado_en": "2026-06-10T14:30:00.000Z"
}
```

**Semáforo:**
| Estado | Condición |
|--------|-----------|
| `rojo` | Riesgos críticos, siniestros abiertos >30 días, o documentos vencidos |
| `amarillo` | Riesgos altos o siniestros abiertos recientes |
| `verde` | Sin alertas activas |

---

### `GET /establecimientos/{id}/legajo`

Legajo técnico completo de un establecimiento.

```bash
curl https://app.sigmetria.com.ar/api/v1/establecimientos/uuid-del-est/legajo \
  -H "Authorization: Bearer sig_tu_key_aqui"
```

**Respuesta:**
```json
{
  "establecimiento": {
    "id": "uuid",
    "nombre": "Planta Norte",
    "domicilio": "Ruta 9 km 45",
    "empresa": {
      "id": "uuid",
      "razon_social": "Acme S.A.",
      "cuit": "30719848531"
    }
  },
  "riesgos_activos": [
    { "nivel": "alto", "descripcion": "Zona sin EPP", "fecha_identificacion": "2026-05-01" }
  ],
  "inspecciones": [
    { "estado": "con_observaciones", "fecha_realizada": "2026-04-15", "observaciones": "Falta señalización" }
  ],
  "documentos": [
    { "tipo": "Habilitación Municipal", "fecha_vencimiento": "2026-12-31", "vigente": true }
  ],
  "capacitaciones": [
    { "titulo": "Primeros Auxilios", "fecha_realizada": "2026-03-10" }
  ],
  "siniestros_abiertos": [],
  "generado_en": "2026-06-10T14:30:00.000Z"
}
```

---

## Errores

| HTTP | `code` | Descripción |
|------|--------|-------------|
| 401 | `UNAUTHORIZED` | API key inválida, ausente, o revocada |
| 403 | `FORBIDDEN` | El recurso no pertenece a tu consultora |
| 404 | `NOT_FOUND` | Recurso no encontrado |
| 429 | `RATE_LIMITED` | Límite de 60 req/min superado |
| 500 | `INTERNAL_ERROR` | Error interno |

**Formato de error:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Empresa not found for this CUIT"
  }
}
```
