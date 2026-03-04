export type DeviceType = "gas" | "water" | "electricity_ferraris" | "electricity_sml" | "unknown"
export type DeleteSource = "readings" | "uplinks" | "both"
export type DeviceStatus = "active" | "warning" | "offline" | "inactive"

export interface DeviceSummary {
  dev_eui: string
  device_name: string | null
  last_seen: string | null
  battery_mv: number | null
  rssi: number | null
  snr: number | null
  total_uplinks: number
  avg_interval_seconds: number | null
  first_seen: string | null
  meter_value: number | null
  meter_value_raw: string | null
}

export interface Reading {
  dev_eui: string
  at: string
  meter_value: number
  meter_value_raw: string | null
  device_name: string | null
  application_id: string | null
  application_name: string | null
  deduplication_id: string | null
  battery_mv: number | null
  rssi: number | null
  snr: number | null
}

export interface Uplink {
  id: number
  dev_eui: string
  at: string
  provider: string | null
  device_name: string | null
  application_id: string | null
  application_name: string | null
  deduplication_id: string | null
  meter_value: number | null
  meter_value_raw: string | null
  battery_mv: number | null
  rssi: number | null
  snr: number | null
  decoded_json: Record<string, unknown> | null
  payload_json: Record<string, unknown> | null
}

export interface DailyConsumption {
  date: string
  consumption: number | null
  closing: number | null
}

export interface Anomaly {
  id: number
  dev_eui: string
  at: string
  event_type: string
  meter_value: number | null
  previous_value: number | null
  jump: number | null
  threshold: number | null
  action: string | null
  details: string | null
  created_at: string
}

export interface SSEEvent {
  type: "up" | "auto-recalibrate" | "manual-recalibrate"
  devEui: string
  deviceName?: string | null
  at?: string
  meterValue?: number | null
  battery_mv?: number | null
  jump?: number
  threshold?: number
}

export interface DownlinkIntervalRequest {
  devEui: string
  seconds: number
  fPort?: number
  applicationId?: string
  deviceId?: string
}

export interface DownlinkRecalibrateRequest {
  devEui: string
  fPort?: number
  applicationId?: string
  deviceId?: string
}
