export interface KioskConfig {
  /** URL base del backend Django de wallAi, sin barra final. */
  apiBaseUrl: string;
  /** JWT de kiosco (scope=kiosk), restringido a una única planta. */
  kioskToken: string;
  /** Texto mostrado en cabecera mientras se carga el primer snapshot real. */
  plantLabel?: string;
}

export const REQUIRED_KIOSK_CONFIG_FIELDS: Array<keyof KioskConfig> = [
  'apiBaseUrl',
  'kioskToken',
];
