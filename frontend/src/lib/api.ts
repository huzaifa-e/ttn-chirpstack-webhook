import type {
  DeviceSummary,
  DeviceType,
  ConfiguredDevice,
  Reading,
  Uplink,
  DailyConsumption,
  Anomaly,
  DeleteSource,
  DownlinkIntervalRequest,
  DownlinkRecalibrateRequest,
} from "./types"

const BASE = "" // proxied via next.config.ts rewrites

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUUID(v: string): boolean {
  return UUID_RE.test(v)
}

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

// Configured Devices (UUID-based)
export async function getConfiguredDevices(): Promise<ConfiguredDevice[]> {
  const data = await fetchJSON<{ devices: ConfiguredDevice[] }>("/api/configured-devices")
  return data.devices
}

export async function getConfiguredDevice(uuid: string): Promise<ConfiguredDevice> {
  const data = await fetchJSON<{ device: ConfiguredDevice }>(`/api/configured-devices/${encodeURIComponent(uuid)}`)
  return data.device
}

export async function createConfiguredDevice(input: {
  dev_eui: string
  name: string
  device_type: string
}): Promise<ConfiguredDevice> {
  const data = await fetchJSON<{ device: ConfiguredDevice }>("/api/configured-devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return data.device
}

export async function updateConfiguredDevice(
  uuid: string,
  input: { name?: string; device_type?: string },
): Promise<ConfiguredDevice> {
  const data = await fetchJSON<{ device: ConfiguredDevice }>(`/api/configured-devices/${encodeURIComponent(uuid)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return data.device
}

export async function deleteConfiguredDevice(uuid: string): Promise<void> {
  await fetchJSON(`/api/configured-devices/${encodeURIComponent(uuid)}`, { method: "DELETE" })
}

// Readings & Uplinks
export async function getReadings(devEuiOrUuid: string, from?: string, to?: string): Promise<Reading[]> {
  const params = new URLSearchParams()
  if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
  else params.set("devEui", devEuiOrUuid)
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const data = await fetchJSON<{ readings: Reading[] }>(`/api/readings?${params}`)
  return data.readings
}

export async function getUplinks(devEuiOrUuid: string, from?: string, to?: string, limit?: number): Promise<Uplink[]> {
  const params = new URLSearchParams()
  if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
  else params.set("devEui", devEuiOrUuid)
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  if (limit) params.set("limit", String(limit))
  const data = await fetchJSON<{ uplinks: Uplink[] }>(`/api/uplinks?${params}`)
  return data.uplinks
}

export async function getLastUplink(devEuiOrUuid: string): Promise<Uplink | null> {
  const params = new URLSearchParams()
  if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
  else params.set("devEui", devEuiOrUuid)
  const data = await fetchJSON<{ last: Uplink | null }>(`/api/last-uplink?${params}`)
  return data.last
}

// Consumption
export async function getDailyConsumption(
  devEuiOrUuid: string,
  days?: number,
  tz?: string,
  end?: string,
): Promise<{ series: DailyConsumption[]; days: number; tz: string }> {
  const params = new URLSearchParams()
  if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
  else params.set("devEui", devEuiOrUuid)
  if (days) params.set("days", String(days))
  if (tz) params.set("tz", tz)
  if (end) params.set("end", end)
  return fetchJSON(`/api/consumption/daily?${params}`)
}

// Anomalies
export async function getAnomalies(devEuiOrUuid?: string, limit?: number): Promise<Anomaly[]> {
  const params = new URLSearchParams()
  if (devEuiOrUuid) {
    if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
    else params.set("devEui", devEuiOrUuid)
  }
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
export async function getTxCount(devEuiOrUuid: string, from: string, to: string): Promise<number> {
  const params = new URLSearchParams({ from, to })
  if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
  else params.set("devEui", devEuiOrUuid)
  const data = await fetchJSON<{ count: number }>(`/api/tx-count?${params}`)
  return data.count
}

export async function deleteDataPoint(
  devEuiOrUuid: string,
  at: string,
  source: DeleteSource = "both",
): Promise<{ readingsDeleted: number; uplinksDeleted: number }> {
  const params = new URLSearchParams({ at, source })
  if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
  else params.set("devEui", devEuiOrUuid)
  return fetchJSON(`/api/data-point?${params}`, { method: "DELETE" })
}

export async function deleteDataRange(
  devEuiOrUuid: string,
  from: string,
  to: string,
  source: DeleteSource = "both",
): Promise<{ readingsDeleted: number; uplinksDeleted: number }> {
  const params = new URLSearchParams({ from, to, source })
  if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
  else params.set("devEui", devEuiOrUuid)
  return fetchJSON(`/api/data-range?${params}`, { method: "DELETE" })
}

export async function resetUplinkCount(devEuiOrUuid: string): Promise<{ ok: boolean }> {
  const params = new URLSearchParams()
  if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
  else params.set("devEui", devEuiOrUuid)
  return fetchJSON(`/api/reset-uplink-count?${params}`, { method: "POST" })
}

export async function getUplinkCountResetAt(devEuiOrUuid: string): Promise<string | null> {
  const params = new URLSearchParams()
  if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
  else params.set("devEui", devEuiOrUuid)
  const data = await fetchJSON<{ resetAt: string | null }>(`/api/uplink-count-reset-at?${params}`)
  return data.resetAt
}

export async function resetFailureLogs(devEuiOrUuid: string): Promise<{ ok: boolean }> {
  const params = new URLSearchParams()
  if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
  else params.set("devEui", devEuiOrUuid)
  return fetchJSON(`/api/reset-failure-logs?${params}`, { method: "POST" })
}

export async function getFailureLogsResetAt(devEuiOrUuid: string): Promise<string | null> {
  const params = new URLSearchParams()
  if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
  else params.set("devEui", devEuiOrUuid)
  const data = await fetchJSON<{ resetAt: string | null }>(`/api/failure-logs-reset-at?${params}`)
  return data.resetAt
}

export function getExportUrl(devEuiOrUuid: string, format: "json" | "csv", from?: string, to?: string): string {
  const params = new URLSearchParams({ format })
  if (isUUID(devEuiOrUuid)) params.set("uuid", devEuiOrUuid)
  else params.set("devEui", devEuiOrUuid)
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  return `/api/export?${params}`
}
