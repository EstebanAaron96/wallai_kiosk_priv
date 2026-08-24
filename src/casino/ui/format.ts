/**
 * Spanish number formatting: comma decimal separator, dot thousands separator.
 * Every user-facing number goes through here.
 */

const power = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const energy = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
const percent = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Instantaneous power, e.g. `3,69`. The unit is rendered separately. */
export const formatPower = (kW: number): string => power.format(kW)

/** Accumulated energy, e.g. `18.420`. */
export const formatEnergy = (kWh: number): string => energy.format(kWh)

/** Share as a percentage, e.g. `25,0`. Takes a 0..1 ratio. */
export const formatPercent = (ratio: number): string => percent.format(ratio * 100)

// Reloj de cabecera anclado a Canarias: el dispositivo puede tener cualquier
// zona horaria configurada, pero el kiosco siempre muestra la hora local de
// la planta.
const CANARY_TZ = 'Atlantic/Canary'

const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: CANARY_TZ })
const date = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: CANARY_TZ })

export const formatTime = (value: Date): string => time.format(value)

export function formatDate(value: Date): string {
  const text = date.format(value)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
