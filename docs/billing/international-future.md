# Billing Internacional — Notas para expansión futura

## Estado actual (Mayo 2026)

Sigmetría HyS opera exclusivamente en Argentina. El sistema de billing actual está diseñado para:
- **Moneda**: ARS (peso argentino), campo `moneda CHAR(3)` en `payments`
- **IVA**: 21% discriminado en todos los pagos (AFIP)
- **Métodos de pago**: Transferencia bancaria manual + Mercado Pago Preapproval (pendiente)
- **Ciclos**: Mensual o anual

---

## Consideraciones para expansión internacional

### 1. Moneda y precios

La tabla `plans` tiene precios en ARS. Para multi-moneda:

```sql
-- Opción futura: tabla de precios por región
CREATE TABLE plan_prices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id    uuid REFERENCES plans(id),
  moneda     char(3) NOT NULL,       -- 'USD', 'BRL', 'CLP', etc.
  precio_mensual_neto numeric,
  precio_anual_neto   numeric,
  iva_porcentaje      numeric,       -- varía por país
  is_active           boolean DEFAULT true
);
```

### 2. IVA / impuestos por país

| País | IVA/Impuesto | Tasa aproximada |
|------|-------------|----------------|
| Argentina | IVA | 21% |
| Brasil | ISS / PIS / COFINS | Variable por servicio |
| Chile | IVA | 19% |
| Uruguay | IVA | 22% |
| Colombia | IVA | 19% |
| México | IVA | 16% |

El campo `iva_porcentaje` en `payments` ya está preparado para tasas variables. Los campos `monto_iva` y `monto_total` son columnas GENERATED ALWAYS AS para evitar inconsistencias.

### 3. Proveedores de pago internacionales

| Proveedor | Cobertura | Estado |
|-----------|-----------|--------|
| Mercado Pago | LATAM (AR, BR, MX, CO, CL, UY, PE) | Pendiente integración |
| Stripe | Global | No implementado |
| PayPal | Global | No implementado |
| LemonSqueezy | Global (con manejo de impuestos automático) | Opción recomendada para expansión |

**Recomendación para expansión**: LemonSqueezy o Paddle actúan como "Merchant of Record" — manejan impuestos locales automáticamente en 100+ países.

### 4. Cambios necesarios en el schema

```sql
-- En subscriptions: agregar campo de región
ALTER TABLE subscriptions ADD COLUMN pais char(2) DEFAULT 'AR';

-- En consultoras: agregar datos fiscales por país
ALTER TABLE consultoras ADD COLUMN pais char(2) DEFAULT 'AR';
ALTER TABLE consultoras ADD COLUMN tax_id text;  -- Reemplaza 'cuit' para ser genérico
```

### 5. Webhook de Mercado Pago (pendiente — Fase 6)

El webhook de MP Preapproval debe:
1. Verificar la firma con `MERCADOPAGO_WEBHOOK_SECRET`
2. Buscar el `external_reference` en `payments.provider_payment_id`
3. Actualizar `payments.estado = 'confirmed'`
4. Activar la suscripción como hace `confirm-payment`

```typescript
// app/api/webhooks/mercadopago/route.ts (esquema)
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('x-signature')
  // Verificar firma HMAC-SHA256
  // Buscar payment por external_reference
  // Confirmar si action === 'payment.updated' && status === 'approved'
}
```

**Variables de entorno necesarias** (agregar en Vercel cuando se implemente):
```
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=...
MERCADOPAGO_PUBLIC_KEY=APP_USR-...
```

---

## Arquitectura actual de billing (referencia)

```
Usuario → /dashboard/billing
  └── Selecciona plan + período
  └── Ingresa número de operación (transferencia)
  └── POST /api/billing/manual-payment
        └── payments (pending) + manual_payments

Admin → /dashboard/admin
  └── Ve pagos pendientes
  └── POST /api/admin/confirm-payment
        └── payments (confirmed)
        └── subscriptions.estado = 'active'
        └── subscriptions.current_period_end = now + 1 mes/año
```

### Add-on seats

```
Usuario → /dashboard/billing (sección seats)
  └── Selecciona cantidad
  └── POST /api/billing/add-on-seat
        └── subscriptions_add_ons (is_active=false)
        └── payments (pending, raw_payload.type='extra_seat')
        └── manual_payments

Admin confirma
  └── payments.estado = 'confirmed'
  └── subscriptions_add_ons.is_active = true
  └── consultoras.seats_max += cantidad
```
