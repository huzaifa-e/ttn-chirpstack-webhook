import type { DeviceType, DeviceStatus, DeviceSummary } from "./types"
import { DEVICE_TYPE_CONFIG, STATUS_ACTIVE_MULTIPLIER, STATUS_WARNING_MULTIPLIER } from "./constants"

export function formatMeterValue(value: number | null, deviceType: DeviceType = "unknown"): string {
  if (value == null) return "—"
  const unit = DEVICE_TYPE_CONFIG[deviceType].unit
  // German format: comma as decimal separator, no dot thousands separator
  const parts = value.toFixed(3).split(".")
  const intPart = parts[0]
  const decPart = parts[1]
  return `${intPart},${decPart} ${unit}`
}

/** Returns just the numeric part (comma-separated, no unit) for display */
export function formatMeterValueRaw(value: number | null): string {
  if (value == null) return "—"
  const parts = value.toFixed(3).split(".")
  return `${parts[0]},${parts[1]}`
}

export function formatBatteryMv(mv: number | null): string {
  if (mv == null) return "—"
  return `${mv} mV`
}

export function formatBatteryPercent(mv: number | null): number | null {
  if (mv == null) return null
  // Typical LoRaWAN AA lithium: 3600mV full → 2200mV empty
  const pct = Math.round(((mv - 2200) / (3600 - 2200)) * 100)
  return Math.max(0, Math.min(100, pct))
}

export function formatRSSI(rssi: number | null): string {
  if (rssi == null) return "—"
  return `${rssi} dBm`
}

export function estimateDistance(rssi: number | null): string {
  if (rssi == null) return "—"
  if (rssi >= -60) return "< 10 m"
  if (rssi >= -80) return "~10–100 m"
  if (rssi >= -100) return "~100–500 m"
  if (rssi >= -115) return "~0,5–2 km"
  return "> 2 km"
}

export function formatTimeAgo(isoDate: string | null): string {
  if (!isoDate) return "Nie"
  const diff = Date.now() - new Date(isoDate).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `vor ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `vor ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `vor ${hours}h`
  const days = Math.floor(hours / 24)
  return `vor ${days}d`
}

export function formatInterval(seconds: number | null): string {
  if (seconds == null) return "—"
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`
  return `${(seconds / 3600).toFixed(1)}h`
}

export function formatChartNumber(value: unknown): string {
  if (typeof value !== "number" || Number.isNaN(value)) return String(value ?? "")
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2, useGrouping: false }).format(value)
}

export function estimateBatteryLifetime(batteryMv: number | null, intervalSeconds: number | null): string {
  if (batteryMv == null || intervalSeconds == null) return "—"
  // Rough estimate: 2200mV cutoff, ~8µA sleep current, ~40mA tx for 1s
  const remainingMv = batteryMv - 2200
  if (remainingMv <= 0) return "Leer"
  const txPerDay = (24 * 3600) / intervalSeconds
  // ~0.011mAh per tx, 3000mAh typical AA lithium
  const remainingPct = remainingMv / (3600 - 2200)
  const remainingMah = remainingPct * 3000
  const dailyConsumption = txPerDay * 0.011 + 24 * 0.008 // tx + sleep
  const daysLeft = remainingMah / dailyConsumption
  if (daysLeft < 1) return "< 1 Tag"
  if (daysLeft < 30) return `~${Math.round(daysLeft)} Tage`
  if (daysLeft < 365) return `~${Math.round(daysLeft / 30)} Monate`
  return `~${(daysLeft / 365).toFixed(1)} Jahre`
}

export function getDeviceStatus(device: DeviceSummary): DeviceStatus {
  if (!device.last_seen) return "inactive"
  const elapsed = (Date.now() - new Date(device.last_seen).getTime()) / 1000
  const interval = device.avg_interval_seconds || 3600
  if (elapsed <= interval * STATUS_ACTIVE_MULTIPLIER) return "active"
  if (elapsed <= interval * STATUS_WARNING_MULTIPLIER) return "warning"
  return "offline"
}

export const STATUS_CONFIG: Record<DeviceStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: "Aktiv", color: "#10b981", bgColor: "bg-emerald-500/10" },
  warning: { label: "Verzögert", color: "#eab308", bgColor: "bg-yellow-500/10" },
  offline: { label: "Offline", color: "#ef4444", bgColor: "bg-red-500/10" },
  inactive: { label: "Inaktiv", color: "#6b7280", bgColor: "bg-zinc-500/10" },
}
