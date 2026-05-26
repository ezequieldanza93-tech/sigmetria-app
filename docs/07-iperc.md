# 07 — IPERC

> Identificación de Peligros, Evaluación de Riesgos y determinación de Controles. La herramienta técnica central del profesional HyS.

---

## ¿Qué resuelve?

Sistematiza la evaluación de riesgos laborales con una librería editable que vos mismo configurás. El resultado: una matriz de riesgos por sector, trazable, actualizable y presentable ante cualquier auditoría.

---

## Conceptos clave antes de empezar

```
Peligro → es la fuente de potencial daño
  ↓
Riesgo  → es la probabilidad de que ese daño ocurra en un contexto dado
  ↓
Medida de control → qué hacemos para eliminarlo o reducirlo
```

**Ejemplo**:
- **Peligro**: trabajo en altura
- **Riesgo**: caída de distinto nivel
- **Medida de control**: arnés + línea de vida + capacitación habilitante

---

## La Librería IPERC {#libreria-peligros}

**Dónde**: Menú avatar → **Herramientas** → **Librería IPERC**

La librería es la base de conocimiento de tu consultora. La configurás una vez y la reutilizás en todas tus evaluaciones.

### Las 6 pestañas de la librería

| Pestaña | Qué configurás |
|---------|----------------|
| **Peligros** | Catálogo de peligros laborales por categoría (físico, químico, ergonómico, psicosocial, etc.) |
| **Riesgos** | Riesgos derivados de cada peligro |
| **Medidas de control** | Acciones preventivas y correctivas (jerarquía de controles) |
| **Consecuencias** | Lesiones o enfermedades que puede causar cada riesgo |
| **Probabilidades** | Escala: Rara — Poco probable — Posible — Probable |
| **Niveles de riesgo** | Matriz de criticidad: Bajo — Medio — Alto — Crítico |

### Agregar un peligro nuevo

1. Pestaña **Peligros** → **Nuevo peligro**
2. Nombre + categoría + descripción
3. Guardá → queda disponible para todas las evaluaciones de la consultora

> La librería es **compartida** entre todas las empresas de tu consultora. Si agregás un peligro, lo podés usar en cualquier establecimiento.

---

## Hacer una evaluación de riesgos {#nueva-evaluacion}

**Dónde**: Establecimiento → sección **Riesgos**

### Flujo de la evaluación

```
Seleccioná el sector del establecimiento
        ↓
Seleccioná el peligro de la librería
        ↓
Asociá el riesgo derivado
        ↓
Definí la probabilidad (usando la escala)
        ↓
Definí la consecuencia (usando el catálogo)
        ↓
El sistema calcula el nivel de riesgo automáticamente
        ↓
Asigná la medida de control
        ↓
Establecé responsable y fecha límite para implementar el control
```

### La matriz de riesgo {#matriz}

La combinación de **probabilidad × consecuencia** determina el nivel de riesgo:

|  | Leve | Moderada | Severa | Catastrófica |
|--|------|----------|--------|--------------|
| **Rara** | Bajo | Bajo | Medio | Alto |
| **Poco probable** | Bajo | Medio | Alto | Crítico |
| **Posible** | Medio | Alto | Alto | Crítico |
| **Probable** | Alto | Alto | Crítico | Crítico |

Los riesgos **Críticos** y **Altos** se resaltan en el dashboard del establecimiento y aparecen en el mapa geográfico.

---

## Estados de un riesgo

| Estado | Significado |
|--------|-------------|
| **Identificado** | Se detectó, aún sin medida de control asignada |
| **Con control** | Se asignó una medida, pendiente de implementación |
| **En seguimiento** | La medida está en proceso de implementación |
| **Controlado** | La medida se implementó y se verificó su eficacia |
| **Residual** | El riesgo persiste aunque se aplicaron controles |

---

## Jerarquía de controles

Al asignar medidas, el sistema sugiere respetar la jerarquía:

```
1. Eliminación          (mejor opción — elimina el peligro)
2. Sustitución          (reemplazar por algo menos peligroso)
3. Controles de ingeniería  (aislar el peligro)
4. Controles administrativos (procedimientos, capacitación)
5. EPP                  (última línea de defensa)
```

---

## Errores frecuentes

**❌ No encuentro el peligro que necesito en la librería**  
→ La librería viene con un catálogo base pero es tuya para editar. Andá a **Librería IPERC** → **Peligros** → **Nuevo peligro** y agregalo.

**❌ El nivel de riesgo me parece incorrecto**  
→ Revisá la configuración de la matriz en **Librería IPERC** → **Niveles de riesgo**. La escala de criticidad la configurás vos.

**❌ Cambié la escala de probabilidades y ahora los riesgos existentes quedaron mal**  
→ Si modificás la librería después de tener evaluaciones hechas, los riesgos anteriores mantienen el valor viejo. Tenés que revisarlos manualmente. Configurá la librería ANTES de empezar a evaluar.

---

## Tip pro 💡

Configurá la librería completa **antes** de hacer la primera evaluación de riesgos. Una vez que tenés evaluaciones cargadas, cambiar la librería tiene impacto retroactivo. Dedicale una hora al inicio y después trabajás sin fricciones.

---

[← Documentos y vencimientos](./06-documentos-y-vencimientos.md) | [Siguiente: Analytics y mapas →](./08-analytics-y-mapas.md)
