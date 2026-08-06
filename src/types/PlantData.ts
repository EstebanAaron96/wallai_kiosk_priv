/**
 * Tipos que reflejan, campo a campo, los serializers de salida del backend
 * Django (demo_eave_app/serializers/{static_data_serializer,get_data_serializer}.py).
 * Cualquier cambio en el backend debe reflejarse aquí.
 */

export interface EnergyFlowData {
  pvKw: number;
  loadKw: number;
  gridKw: number;
  battPct: number;
  hasBattery: boolean;
  hasBatteryHistorical: boolean;
  battKw: number;
  /** Batería cargando desde la red */
  pb: boolean;
  /** Consumo de la casa desde la fotovoltaica */
  pc: boolean;
  /** Excedente vertido a la red */
  pr: boolean;
  /** Batería descargando a la casa */
  bc: boolean;
  /** Batería descargando a la red (no usado actualmente en backend) */
  br: boolean;
  /** Consumo de la casa desde la red */
  rc: boolean;
  /** Batería cargando desde la red (redundante con pb) */
  rb: boolean;
}

export interface PlantAlarm {
  _id?: string;
  alarmName: string;
  code: number;
  startDate?: string | null;
  endDate?: string | null;
  alarmLevel: number;
  alarmCause: string;
  alarmSolutions: string[];
  devSn: string;
  idAlarm: string;
}

/** Un elemento de `static_info` en GET /api/data/get_data_static/ */
export interface PlantSnapshot {
  code: number;
  imei: string;
  username: string;
  email_user?: string;
  modbus_table: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  tz: string;
  alarm_state?: string;
  battery_capacity?: number | null;
  battery?: number | null;
  has_battery: boolean;
  energy_flow_data?: EnergyFlowData | null;
  n_inv: number;
  n_bat: number;
  n_wallai: number;
  strings_capacity_kwp?: number | null;
  gen_today_kwh?: number | null;
  gen_total_kwh?: number | null;
  today_incomes?: number | null;
  today_consumption?: number | null;
  alarms: PlantAlarm[];
  alarm_count_by_level: Record<string, number>;
  alarm_count: number;
}

/** GET /api/data/get_data_static/?plant_id=X (respuesta completa) */
export interface StaticDataResponse {
  static_info: PlantSnapshot[];
  total_count_filtered: number;
  total_count_plants: number;
  total_count_inv: number;
  total_count_wallai: number;
  page: number;
  page_size: number;
}

export interface PlantKPIs {
  last_solar_output: number;
  last_power_bat: number;
  last_soc: number;
  last_power_grid: number;
  last_house_consumption: number;
  photovoltaic_production: number;
  production_to_grid_percentage: number;
  production_to_home_percentage: number;
  production_to_battery_percentage: number;
  house_consumption: number;
  grid_consumption_percentage: number;
  photovoltaic_consumption_percentage: number;
  self_consumption_percentage: number;
  total_savings: number;
  photovoltaic_savings: number;
  surplus_payments: number;
  total_accumulated_savings: number;
  current_battery_capacity: number;
  surplus_used: number;
  maximum_stored: number;
  battery_savings: number;
  has_battery: boolean;
  has_battery_historical: boolean;
}

/**
 * Series temporales del día consultado. Todos los arrays comparten índice
 * con `formatted_labels` (timestamps ISO "YYYY-MM-DDTHH:MM:SSZ").
 */
export interface PlantVariablesData {
  solar_output: number[];
  batt_charge: number[];
  batt_discharge: number[];
  house_consumption: number[];
  grid_consumption: number[];
  grid_surplus: number[];
  total_consumption: number[];
  soc: number[];
  formatted_labels: string[];
  today_incomes: number;
  today_consumption: number;
  today_consumptionApi: number;
  today_generation: number;
}

/** GET /api/data/get_data/?plant_id=X&start_date=...&end_date=... */
export interface PlantHistoryResponse {
  variables_data: PlantVariablesData;
  energy_flow_data: EnergyFlowData;
  plant_status_now: boolean;
  ident: string;
  kpis: PlantKPIs;
}

/** Punto ya normalizado para el gráfico de histórico (un elemento por timestamp). */
export interface PlantHistoryPoint {
  timestamp: string;
  solarOutputKw: number;
  gridConsumptionKw: number;
}
