import { describe, it, expect } from 'vitest'
import {
  coefEquiv,
  equivMadera,
  cargaFuego,
  franjaQf,
  potencialNumero,
  claseFuegoSector,
  cantidadExtintoresArt176,
  dimensionarExtintores,
  PCI_MADERA_KCAL,
  POTENCIAL_UNITARIO_ABC_ASUMIDO,
  type MaterialCarga,
} from './calculos'

describe('coefEquiv', () => {
  it('madera (4400 kcal/kg) → 1', () => {
    expect(coefEquiv(PCI_MADERA_KCAL)).toBe(1)
  })

  it('nafta (11000 kcal/kg) → 2.5', () => {
    expect(coefEquiv(11000)).toBe(2.5)
  })

  it('papel/cartón (3900 kcal/kg) ≈ 0.886', () => {
    expect(coefEquiv(3900)).toBeCloseTo(0.886, 3)
  })

  it('valor no finito → 0', () => {
    expect(coefEquiv(NaN)).toBe(0)
    expect(coefEquiv(Infinity)).toBe(0)
  })
})

describe('equivMadera', () => {
  it('madera 2000 kg con C 1.0 → 2000', () => {
    expect(equivMadera(2000, 1.0)).toBe(2000)
  })

  it('gasoil 400 kg con C 2.318 → 927.2', () => {
    expect(equivMadera(400, 2.318)).toBeCloseTo(927.2, 4)
  })

  it('peso o coeficiente no finito → 0', () => {
    expect(equivMadera(NaN, 1)).toBe(0)
    expect(equivMadera(100, NaN)).toBe(0)
  })
})

describe('cargaFuego', () => {
  // Ejemplo del instructivo:
  // cartón 3000 (C 0.886) + madera 2000 (1.0) + PE 800 (2.386) + gasoil 400 (2.318) / 200
  const ejemplo: MaterialCarga[] = [
    { peso: 3000, c: 0.886 },
    { peso: 2000, c: 1.0 },
    { peso: 800, c: 2.386 },
    { peso: 400, c: 2.318 },
  ]

  it('ejemplo del instructivo → ≈ 37.5 kg/m²', () => {
    // Σ = 2658 + 2000 + 1908.8 + 927.2 = 7494 ; 7494 / 200 = 37.47
    expect(cargaFuego(ejemplo, 200)).toBeCloseTo(37.47, 2)
  })

  it('un solo material', () => {
    expect(cargaFuego([{ peso: 2000, c: 1 }], 100)).toBe(20)
  })

  it('lista vacía → 0', () => {
    expect(cargaFuego([], 200)).toBe(0)
  })

  it('superficie 0 → 0 (sin división por cero)', () => {
    expect(cargaFuego(ejemplo, 0)).toBe(0)
  })

  it('superficie negativa o no finita → 0', () => {
    expect(cargaFuego(ejemplo, -50)).toBe(0)
    expect(cargaFuego(ejemplo, NaN)).toBe(0)
  })
})

describe('franjaQf', () => {
  it('Qf del ejemplo (37.47) → "31 a 60"', () => {
    expect(franjaQf(37.47)).toBe('31 a 60')
  })

  it('límites de cada franja', () => {
    expect(franjaQf(0)).toBe('Hasta 15')
    expect(franjaQf(15)).toBe('Hasta 15')
    expect(franjaQf(15.1)).toBe('16 a 30')
    expect(franjaQf(30)).toBe('16 a 30')
    expect(franjaQf(30.1)).toBe('31 a 60')
    expect(franjaQf(60)).toBe('31 a 60')
    expect(franjaQf(60.1)).toBe('61 a 100')
    expect(franjaQf(100)).toBe('61 a 100')
    expect(franjaQf(100.1)).toBe('>100')
    expect(franjaQf(500)).toBe('>100')
  })

  it('valor no finito → "Hasta 15" (fallback seguro)', () => {
    expect(franjaQf(NaN)).toBe('Hasta 15')
  })
})

describe('potencialNumero', () => {
  it('extrae el número de una etiqueta de potencial', () => {
    expect(potencialNumero('3A')).toBe(3)
    expect(potencialNumero('20B')).toBe(20)
    expect(potencialNumero('10A')).toBe(10)
  })

  it('etiqueta vacía / guion / no parseable → null', () => {
    expect(potencialNumero('—')).toBe(null)
    expect(potencialNumero('')).toBe(null)
    expect(potencialNumero(null)).toBe(null)
    expect(potencialNumero(undefined)).toBe(null)
  })
})

describe('claseFuegoSector', () => {
  it('solo sólidos → "A"', () => {
    expect(claseFuegoSector([{ estado: 'solido' }, { estado: 'Sólido' }])).toBe('A')
  })

  it('solo líquidos/gases → "B"', () => {
    expect(claseFuegoSector([{ estado: 'liquido' }, { estado: 'gaseoso' }])).toBe('B')
  })

  it('sólidos + líquidos → "A·B"', () => {
    expect(claseFuegoSector([{ estado: 'solido' }, { estado: 'liquido' }])).toBe('A·B')
  })

  it('sin estados → "A" (conservador)', () => {
    expect(claseFuegoSector([])).toBe('A')
    expect(claseFuegoSector([{ estado: null }])).toBe('A')
  })
})

describe('cantidadExtintoresArt176', () => {
  it('un matafuego cada 200 m² (Art. 176)', () => {
    expect(cantidadExtintoresArt176(180)).toBe(1)
    expect(cantidadExtintoresArt176(200)).toBe(1)
    expect(cantidadExtintoresArt176(201)).toBe(2)
    expect(cantidadExtintoresArt176(450)).toBe(3)
    expect(cantidadExtintoresArt176(400)).toBe(2)
  })

  it('mínimo 1 aunque la superficie sea muy chica', () => {
    expect(cantidadExtintoresArt176(10)).toBe(1)
  })

  it('superficie nula / ≤ 0 / no finita → null', () => {
    expect(cantidadExtintoresArt176(null)).toBe(null)
    expect(cantidadExtintoresArt176(0)).toBe(null)
    expect(cantidadExtintoresArt176(-5)).toBe(null)
    expect(cantidadExtintoresArt176(NaN)).toBe(null)
  })
})

describe('dimensionarExtintores', () => {
  it('potencial exigido ≤ estándar asumido → "cumple"', () => {
    const dim = dimensionarExtintores({
      superficie: 450,
      materiales: [{ estado: 'solido' }],
      potencialA: '3A',
      potencialB: '—',
    })
    expect(dim.clase).toBe('A')
    expect(dim.cantidad).toBe(3)
    expect(dim.cumplimiento).toBe('cumple')
    expect(dim.tipo).toContain('ABC')
  })

  it('potencial A exigido > estándar asumido → "verificar"', () => {
    // POTENCIAL_UNITARIO_ABC_ASUMIDO.a = 4 ; 10A lo supera.
    expect(POTENCIAL_UNITARIO_ABC_ASUMIDO.a).toBe(4)
    const dim = dimensionarExtintores({
      superficie: 300,
      materiales: [{ estado: 'solido' }],
      potencialA: '10A',
      potencialB: '—',
    })
    expect(dim.cumplimiento).toBe('verificar')
  })

  it('sin potencial exigido (A y B vacíos) → "sin_dato"', () => {
    const dim = dimensionarExtintores({
      superficie: 100,
      materiales: [{ estado: 'solido' }],
      potencialA: '—',
      potencialB: '—',
    })
    expect(dim.cumplimiento).toBe('sin_dato')
  })

  it('sin superficie → cantidad null (no se puede dimensionar)', () => {
    const dim = dimensionarExtintores({
      superficie: null,
      materiales: [{ estado: 'solido' }],
      potencialA: '3A',
      potencialB: '—',
    })
    expect(dim.cantidad).toBe(null)
  })
})
