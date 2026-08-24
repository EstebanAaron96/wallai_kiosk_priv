/**
 * El kiosco vive en Canarias, pero el reloj del sistema del dispositivo que lo
 * ejecuta no es de fiar (a veces viene en UTC, a veces en la zona del
 * integrador que lo preparó). En vez de depender de la zona horaria del
 * dispositivo, todo el cálculo de "hoy/este mes/este año" y el reloj en
 * cabecera se ancla explícitamente a Atlantic/Canary.
 */
const CANARY_TZ = 'Atlantic/Canary';

const canaryPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CANARY_TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/**
 * Instante actual expresado como un Date cuyos getters locales
 * (getFullYear/getMonth/getDate/getHours...) devuelven la hora de Canarias,
 * sin importar la zona horaria configurada en el dispositivo.
 */
export function nowInCanary(): Date {
  const parts: Record<string, string> = {};
  for (const part of canaryPartsFormatter.formatToParts(new Date())) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  // Intl usa "24" para la medianoche en formato de 24h con hour12: false.
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  return new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
}
