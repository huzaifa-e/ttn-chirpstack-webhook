import type {
  DeviceSummary,
  DeviceType,
  Reading,
  Uplink,
  DailyConsumption,
  Anomaly,
  DeleteSource,
  DownlinkIntervalRequest,
  DownlinkRecalibrateRequest,
} from "./types"

const BASE = "" // proxied via next.config.ts rewrites

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, init)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body}`)
  }
  return res.json()
}

// Devices
export async function getDeviceSummaries(): Promise<DeviceSummary[]> {
  const data = await fetchJSON<{ devices: DeviceSummary[] }>("/api/device-summaries")
  return data.devices
}

export async function getDeviceTypes(): Promise<Record<string, DeviceType>> {
  const data = await fetchJSON<{ deviceTypes: Record<string, DeviceType> }>("/api/device-types")
  return data.deviceTypes
}

export async function setDeviceType(devEui: string, deviceType: DeviceType): Promise<void> {
  await fetchJSON(`/api/device-types/${encodeURIComponent(devEui)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceType }),
  })
}

export async function deleteDevice(devEui: string): Promise<{ readingsDeleted: number; uplinksDeleted: number }> {
  return fetchJSON(`/api/devices/${encodeURIComponent(devEui)}`, { method: "DELETE" })
}

// Readings & Uplinks
export async function getReadings(devEui: string, from?: string, to?: string): Promise<Reading[]> {
  const params = new URLSearchParams({ devEui })
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const data = await fetchJSON<{ readings: Reading[] }>(`/api/readings?${params}`)
  return data.readings
}

export async function getUplinks(devEui: string, from?: string, to?: string, limit?: number): Promise<Uplink[]> {
  const params = new URLSearchParams({ devEui })
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  if (limit) params.set("limit", String(limit))
  const data = await fetchJSON<{ uplinks: Uplink[] }>(`/api/uplinks?${params}`)
  return data.uplinks
}

export async function getLastUplink(devEui: string): Promise<Uplink | null> {
  const data = await fetchJSON<{ last: Uplink | null }>(`/api/last-uplink?devEui=${encodeURIComponent(devEui)}`)
  return data.last
}

// Consumption
export async function getDailyConsumption(
  devEui: string,
  days?: number,
  tz?: string,
  end?: string,
): Promise<{ series: DailyConsumption[]; days: number; tz: string }> {
  const params = new URLSearchParams({ devEui })
  if (days) params.set("days", String(days))
  if (tz) params.set("tz", tz)
  if (end) params.set("end", end)
  return fetchJSON(`/api/consumption/daily?${params}`)
}

// Anomalies
export async function getAnomalies(devEui?: string, limit?: number): Promise<Anomaly[]> {
  const params = new URLSearchParams()
  if (devEui) params.set("devEui", devEui)
  if (limit) params.set("limit", String(limit))
  const data = await fetchJSON<{ anomalies: Anomaly[] }>(`/api/anomalies?${params}`)
  return data.anomalies
}

// Downlinks
export async function sendIntervalDownlink(req: DownlinkIntervalRequest): Promise<{ ok: boolean }> {
  return fetchJSON("/api/downlink/upload-interval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  })
}

export async function sendRecalibrateDownlink(req: DownlinkRecalibrateRequest): Promise<{ ok: boolean }> {
  return fetchJSON("/api/downlink/recalibrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  })
}

// Data Management
export async function getTxCount(devEui: string, from: string, to: string): Promise<number> {
  const params = new URLSearchParams({ devEui, from, to })
  const data = await fetchJSON<{ count: number }>(`/api/tx-count?${params}`)
  return data.count
}

export async function deleteDataPoint(
  devEui: string,
  at: string,
  source: DeleteSource = "both",
): Promise<{ readingsDeleted: number; uplinksDeleted: number }> {
  const params = new URLSearchParams({ devEui, at, source })
  return fetchJSON(`/api/data-point?${params}`, { method: "DELETE" })
}

export async function deleteDataRange(
  devEui: string,
  from: string,
  to: string,
  source: DeleteSource = "both",
): Promise<{ readingsDeleted: number; uplinksDeleted: number }> {
  const params = new URLSearchParams({ devEui, from, to, source })
  return fetchJSON(`/api/data-range?${params}`, { method: "DELETE" })
}

export function getExportUrl(devEui: string, format: "json" | "csv", from?: string, to?: string): string {
  const params = new URLSearchParams({ devEui, format })
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  return `/api/export?${params}`
}
