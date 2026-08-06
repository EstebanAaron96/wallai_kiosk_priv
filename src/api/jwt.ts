/**
 * El backend de wallAi filtra get_data_static / get_data por `plant_id` en la
 * query string, pero para un token de kiosco (scope=kiosk) exige que ese
 * plant_id coincida EXACTAMENTE con el `plant_id` embebido como claim en el
 * propio JWT (si no coincide, o falta, responde 403). Es decir: el kiosco no
 * "elige" la planta, simplemente tiene que reenviar el mismo plant_id que ya
 * lleva su token.
 *
 * Por eso decodificamos aquí el payload del JWT (solo lectura del claim
 * público, sin verificar la firma: la verificación real la hace el backend
 * en cada petición) para construir automáticamente la query string, sin
 * necesidad de duplicar el plant_id en config.json.
 */

interface KioskTokenPayload {
  scope?: string;
  plant_id?: number | string;
  [key: string]: unknown;
}

export class InvalidKioskTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidKioskTokenError';
  }
}

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );
  try {
    // atob produce una cadena "binaria" (1 byte por char code); decodeURIComponent
    // + escape la reinterpreta como UTF-8 para soportar claims con acentos, etc.
    return decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
  } catch {
    throw new InvalidKioskTokenError('El token de kiosco no es un JWT base64url válido.');
  }
}

export function decodeKioskTokenPlantId(token: string): number {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new InvalidKioskTokenError('El kioskToken no tiene formato de JWT (header.payload.signature).');
  }

  let payload: KioskTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(parts[1])) as KioskTokenPayload;
  } catch {
    throw new InvalidKioskTokenError('No se pudo parsear el payload del kioskToken.');
  }

  if (payload.scope !== 'kiosk') {
    throw new InvalidKioskTokenError('El kioskToken no tiene scope="kiosk".');
  }

  const plantId = Number(payload.plant_id);
  if (!Number.isFinite(plantId)) {
    throw new InvalidKioskTokenError('El kioskToken no lleva un plant_id numérico válido.');
  }

  return plantId;
}
