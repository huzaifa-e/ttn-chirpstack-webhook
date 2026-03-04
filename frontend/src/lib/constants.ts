import type { DeviceType } from "./types"

export const DEVICE_TYPE_CONFIG: Record<DeviceType, { label: string; unit: string; icon: string; color: string }> = {
  gas: { label: "Gas", unit: "m³", icon: "Flame", color: "#f97316" },
  water: { label: "Wasser", unit: "m³", icon: "Droplets", color: "#3b82f6" },
  electricity_ferraris: { label: "Strom (Ferraris)", unit: "kWh", icon: "Zap", color: "#eab308" },
  electricity_sml: { label: "Strom (SML)", unit: "kWh", icon: "Zap", color: "#a855f7" },
  unknown: { label: "Ohne Typ", unit: "m³", icon: "HelpCircle", color: "#6b7280" },
}

export const STATUS_ACTIVE_MULTIPLIER = 3
export const STATUS_WARNING_MULTIPLIER = 6

export const BATTERY_RANGES = {
  good: { min: 3200, color: "#10b981" },
  ok: { min: 2800, color: "#eab308" },
  low: { min: 0, color: "#ef4444" },
} as const

export const DEFAULT_DAYS = 30
export const DEFAULT_TIMEZONE = "Europe/Berlin"
