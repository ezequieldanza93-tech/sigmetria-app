export interface ProrrataInput {
  precioActual: number
  precioNuevo: number
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

export interface ProrrataResult {
  monto: number
  diasRestantes: number
  diasTotal: number
  esUpgrade: boolean
  esDowngrade: boolean
}

/**
 * Calcula la prorrata para un cambio de plan mid-cycle.
 *
 * Upgrade: se cobra la diferencia proporcional de los días restantes.
 * Downgrade: no se cobra nada, se aplica al próximo ciclo.
 */
export function calcularProrrata(input: ProrrataInput): ProrrataResult {
  const { precioActual, precioNuevo, currentPeriodStart, currentPeriodEnd } = input

  const now = new Date()
  const diasTotal = Math.max(1, Math.round((currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / 86400000))
  const diasTranscurridos = Math.max(0, Math.round((now.getTime() - currentPeriodStart.getTime()) / 86400000))
  const diasRestantes = Math.max(0, diasTotal - diasTranscurridos)

  const diferencia = precioNuevo - precioActual
  const esUpgrade = diferencia > 0
  const esDowngrade = diferencia < 0

  let monto = 0
  if (esUpgrade && diasRestantes > 0) {
    monto = Math.round((diferencia * diasRestantes) / diasTotal * 100) / 100
  }

  return {
    monto,
    diasRestantes,
    diasTotal,
    esUpgrade,
    esDowngrade,
  }
}
