import Database from "better-sqlite3";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data.db");
const db = new Database(DB_PATH);

// --- schema bootstrap / migration ---
db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    dev_eui TEXT NOT NULL,
    at TEXT NOT NULL,
    meter_value REAL NOT NULL,
    meter_value_raw TEXT,
    device_name TEXT,
    application_id TEXT,
    application_name TEXT,
    deduplication_id TEXT,
    battery_mv INTEGER,
    rssi INTEGER,
    snr REAL
  );
`);

db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_readings_dev_at ON readings(dev_eui, at);`);

db.exec(`
  CREATE TABLE IF NOT EXISTS uplinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dev_eui TEXT NOT NULL,
    at TEXT NOT NULL,
    provider TEXT,
    device_name TEXT,
    application_id TEXT,
    application_name TEXT,
    deduplication_id TEXT,
    meter_value REAL,
    meter_value_raw TEXT,
    battery_mv INTEGER,
    rssi INTEGER,
    snr REAL,
    decoded_json TEXT,
    payload_json TEXT
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_uplinks_dev_at ON uplinks(dev_eui, at);`);
db.exec(`DROP INDEX IF EXISTS idx_uplinks_dedup;`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_uplinks_dev_dedup ON uplinks(dev_eui, deduplication_id);`);

db.exec(`
  CREATE TABLE IF NOT EXISTS device_settings (
    dev_eui TEXT PRIMARY KEY,
    device_type TEXT NOT NULL DEFAULT 'unknown',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function columnExists(table: string, col: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return rows.some(r => String(r.name) === col);
}

function ensureColumns(): void {
  const add = (col: string, typeSql: string) => {
    if (!columnExists("readings", col)) {
      db.exec(`ALTER TABLE readings ADD COLUMN ${col} ${typeSql};`);
    }
  };
  add("battery_mv", "INTEGER");
  add("rssi", "INTEGER");
  add("snr", "REAL");
}
ensureColumns();

function ensureDeviceSettingsColumns(): void {
  const add = (col: string, typeSql: string) => {
    if (!columnExists("device_settings", col)) {
      db.exec(`ALTER TABLE device_settings ADD COLUMN ${col} ${typeSql};`);
    }
  };

  add("auto_recalibrate_enabled", "INTEGER NOT NULL DEFAULT 1");
  add("auto_recalibrate_qmax_factor", "REAL NOT NULL DEFAULT 6.0");
  add("auto_recalibrate_min_jump", "REAL NOT NULL DEFAULT 100000");
  add("auto_recalibrate_cooldown_min", "INTEGER NOT NULL DEFAULT 180");
  add("auto_recalibrate_f_port", "INTEGER NOT NULL DEFAULT 15");
  add("last_auto_recalibrated_at", "TEXT");
  add("failure_logs_reset_at", "TEXT");
  add("uplink_count_reset_at", "TEXT");
}
ensureDeviceSettingsColumns();

// --- anomaly log table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS anomaly_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dev_eui TEXT NOT NULL,
    at TEXT NOT NULL,
    event_type TEXT NOT NULL,
    meter_value REAL,
    previous_value REAL,
    jump REAL,
    threshold REAL,
    action TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_anomaly_dev_at ON anomaly_log(dev_eui, at);`);

// --- devices table (logical device configurations with UUID) ---
db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    uuid TEXT PRIMARY KEY,
    dev_eui TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    device_type TEXT NOT NULL DEFAULT 'unknown',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_devices_dev_eui ON devices(dev_eui);`);

// Auto-assign UUIDs to existing devices that don't have an entry yet
function migrateExistingDevicesToUUID(): void {
  const existingDevEuis = db.prepare(`
    SELECT DISTINCT dev_eui FROM (
      SELECT dev_eui FROM readings
      UNION
      SELECT dev_eui FROM uplinks
    )
  `).all() as Array<{ dev_eui: string }>;

  const hasEntry = db.prepare(`SELECT 1 FROM devices WHERE dev_eui = ?`);
  const insertDevice = db.prepare(`
    INSERT INTO devices (uuid, dev_eui, name, device_type, created_at)
    VALUES (@uuid, @dev_eui, @name, @device_type, @created_at)
  `);

  for (const row of existingDevEuis) {
    if (hasEntry.get(row.dev_eui)) continue;
    // Get device name from readings/uplinks
    const nameRow = db.prepare(`
      SELECT device_name FROM (
        SELECT device_name FROM readings WHERE dev_eui = ? AND device_name IS NOT NULL
        UNION ALL
        SELECT device_name FROM uplinks WHERE dev_eui = ? AND device_name IS NOT NULL
      ) LIMIT 1
    `).get(row.dev_eui, row.dev_eui) as { device_name: string } | undefined;
    // Get device type from device_settings
    const typeRow = db.prepare(`SELECT device_type FROM device_settings WHERE dev_eui = ?`).get(row.dev_eui) as { device_type: string } | undefined;

    insertDevice.run({
      uuid: randomUUID(),
      dev_eui: row.dev_eui,
      name: nameRow?.device_name ?? "",
      device_type: typeRow?.device_type ?? "unknown",
      created_at: new Date().toISOString(),
    });
  }
}
migrateExistingDevicesToUUID();

const stmtInsertAnomaly = db.prepare(`
  INSERT INTO anomaly_log (dev_eui, at, event_type, meter_value, previous_value, jump, threshold, action, details, created_at)
  VALUES (@dev_eui, @at, @event_type, @meter_value, @previous_value, @jump, @threshold, @action, @details, @created_at)
`);

const stmtListAnomalies = db.prepare(`
  SELECT * FROM anomaly_log
  WHERE dev_eui = ?
  ORDER BY at DESC
  LIMIT ?
`);

const stmtListAllAnomalies = db.prepare(`
  SELECT * FROM anomaly_log
  ORDER BY at DESC
  LIMIT ?
`);

export interface AnomalyLogEntry {
  id: number;
  dev_eui: string;
  at: string;
  event_type: string;
  meter_value: number | null;
  previous_value: number | null;
  jump: number | null;
  threshold: number | null;
  action: string | null;
  details: string | null;
  created_at: string;
}

export function storeAnomaly(input: {
  dev_eui: string;
  at: string;
  event_type: string;
  meter_value?: number | null;
  previous_value?: number | null;
  jump?: number | null;
  threshold?: number | null;
  action?: string | null;
  details?: string | null;
}): void {
  stmtInsertAnomaly.run({
    dev_eui: input.dev_eui,
    at: input.at,
    event_type: input.event_type,
    meter_value: input.meter_value ?? null,
    previous_value: input.previous_value ?? null,
    jump: input.jump ?? null,
    threshold: input.threshold ?? null,
    action: input.action ?? null,
    details: input.details ?? null,
    created_at: new Date().toISOString(),
  });
}

export function listAnomalies(devEui?: string | null, limit = 200): AnomalyLogEntry[] {
  if (devEui) {
    return stmtListAnomalies.all(devEui, Math.max(1, limit)) as AnomalyLogEntry[];
  }
  return stmtListAllAnomalies.all(Math.max(1, limit)) as AnomalyLogEntry[];
}

// --- types ---
export interface StoreReadingInput {
  dev_eui: string;
  at: string;
  meter_value: number;
  meter_value_raw: string | number | null;
  device_name: string | null;
  application_id: string | null;
  application_name: string | null;
  deduplication_id: string | null;
  battery_mv: number | null;
  rssi: number | null;
  snr: number | null;
}

export interface StoreUplinkInput {
  dev_eui: string;
  at: string;
  provider: string | null;
  device_name: string | null;
  application_id: string | null;
  application_name: string | null;
  deduplication_id: string | null;
  meter_value: number | null;
  meter_value_raw: string | number | null;
  battery_mv: number | null;
  rssi: number | null;
  snr: number | null;
  decoded_json: unknown | null;
  payload_json: unknown | null;
}

export interface ReadingRow {
  dev_eui: string;
  at: string;
  meter_value: number;
  meter_value_raw: string | null;
  device_name: string | null;
  application_id: string | null;
  application_name: string | null;
  deduplication_id: string | null;
  battery_mv: number | null;
  rssi: number | null;
  snr: number | null;
}

export interface UplinkRow {
  id: number;
  dev_eui: string;
  at: string;
  provider: string | null;
  device_name: string | null;
  application_id: string | null;
  application_name: string | null;
  deduplication_id: string | null;
  meter_value: number | null;
  meter_value_raw: string | null;
  battery_mv: number | null;
  rssi: number | null;
  snr: number | null;
  decoded_json: string | null;
  payload_json: string | null;
}

// --- prepared statements ---
const stmtInsert = db.prepare(`
  INSERT INTO readings (
    dev_eui, at, meter_value, meter_value_raw,
    device_name, application_id, application_name, deduplication_id,
    battery_mv, rssi, snr
  )
  VALUES (
    @dev_eui, @at, @meter_value, @meter_value_raw,
    @device_name, @application_id, @application_name, @deduplication_id,
    @battery_mv, @rssi, @snr
  )
  ON CONFLICT(dev_eui, at) DO UPDATE SET
    meter_value = excluded.meter_value,
    meter_value_raw = excluded.meter_value_raw,
    device_name = excluded.device_name,
    application_id = excluded.application_id,
    application_name = excluded.application_name,
    deduplication_id = excluded.deduplication_id,
    battery_mv = excluded.battery_mv,
    rssi = excluded.rssi,
    snr = excluded.snr
`);

const stmtInsertUplink = db.prepare(`
  INSERT INTO uplinks (
    dev_eui, at, provider,
    device_name, application_id, application_name, deduplication_id,
    meter_value, meter_value_raw,
    battery_mv, rssi, snr,
    decoded_json, payload_json
  )
  VALUES (
    @dev_eui, @at, @provider,
    @device_name, @application_id, @application_name, @deduplication_id,
    @meter_value, @meter_value_raw,
    @battery_mv, @rssi, @snr,
    @decoded_json, @payload_json
  )
  ON CONFLICT(dev_eui, deduplication_id) DO UPDATE SET
    at = excluded.at,
    provider = excluded.provider,
    device_name = excluded.device_name,
    application_id = excluded.application_id,
    application_name = excluded.application_name,
    meter_value = excluded.meter_value,
    meter_value_raw = excluded.meter_value_raw,
    battery_mv = excluded.battery_mv,
    rssi = excluded.rssi,
    snr = excluded.snr,
    decoded_json = excluded.decoded_json,
    payload_json = excluded.payload_json
`);

const stmtListDevices = db.prepare(`
  SELECT dev_eui, MAX(device_name) AS device_name
  FROM (
    SELECT dev_eui, device_name FROM readings
    UNION ALL
    SELECT dev_eui, device_name FROM uplinks
  ) d
  GROUP BY dev_eui
  ORDER BY dev_eui ASC
`);

const stmtLastReading = db.prepare(`
  SELECT dev_eui, at, meter_value, meter_value_raw, battery_mv, rssi, snr
  FROM readings
  WHERE dev_eui = ?
  ORDER BY at DESC
  LIMIT 1
`);

const stmtAllReadingsForDevice = db.prepare(`
  SELECT at, meter_value, battery_mv, rssi, snr
  FROM readings
  WHERE dev_eui = ?
  ORDER BY at ASC
`);

const stmtAllUplinksForDevice = db.prepare(`
  SELECT *
  FROM uplinks
  WHERE dev_eui = ?
  ORDER BY at ASC, id ASC
`);

const stmtLastUplink = db.prepare(`
  SELECT *
  FROM uplinks
  WHERE dev_eui = ?
  ORDER BY at DESC, id DESC
  LIMIT 1
`);

const stmtDeleteReadingsForDevice = db.prepare(`
  DELETE FROM readings
  WHERE dev_eui = ?
`);

const stmtDeleteUplinksForDevice = db.prepare(`
  DELETE FROM uplinks
  WHERE dev_eui = ?
`);

const stmtDeleteSettingsForDevice = db.prepare(`
  DELETE FROM device_settings
  WHERE dev_eui = ?
`);

const stmtSetDeviceType = db.prepare(`
  INSERT INTO device_settings (dev_eui, device_type, updated_at)
  VALUES (@dev_eui, @device_type, @updated_at)
  ON CONFLICT(dev_eui) DO UPDATE SET
    device_type = excluded.device_type,
    updated_at = excluded.updated_at
`);

const stmtGetDeviceType = db.prepare(`
  SELECT dev_eui, device_type
  FROM device_settings
  WHERE dev_eui = ?
`);

const stmtListDeviceTypes = db.prepare(`
  SELECT dev_eui, device_type
  FROM device_settings
`);

const stmtGetDeviceAutoRecalibration = db.prepare(`
  SELECT
    dev_eui,
    auto_recalibrate_enabled,
    auto_recalibrate_qmax_factor,
    auto_recalibrate_min_jump,
    auto_recalibrate_cooldown_min,
    auto_recalibrate_f_port,
    last_auto_recalibrated_at
  FROM device_settings
  WHERE dev_eui = ?
`);

const stmtSetDeviceAutoRecalibration = db.prepare(`
  INSERT INTO device_settings (
    dev_eui,
    device_type,
    auto_recalibrate_enabled,
    auto_recalibrate_qmax_factor,
    auto_recalibrate_min_jump,
    auto_recalibrate_cooldown_min,
    auto_recalibrate_f_port,
    updated_at
  )
  VALUES (
    @dev_eui,
    @device_type,
    @auto_recalibrate_enabled,
    @auto_recalibrate_qmax_factor,
    @auto_recalibrate_min_jump,
    @auto_recalibrate_cooldown_min,
    @auto_recalibrate_f_port,
    @updated_at
  )
  ON CONFLICT(dev_eui) DO UPDATE SET
    auto_recalibrate_enabled = excluded.auto_recalibrate_enabled,
    auto_recalibrate_qmax_factor = excluded.auto_recalibrate_qmax_factor,
    auto_recalibrate_min_jump = excluded.auto_recalibrate_min_jump,
    auto_recalibrate_cooldown_min = excluded.auto_recalibrate_cooldown_min,
    auto_recalibrate_f_port = excluded.auto_recalibrate_f_port,
    updated_at = excluded.updated_at
`);

const stmtSetLastAutoRecalibratedAt = db.prepare(`
  UPDATE device_settings
  SET last_auto_recalibrated_at = @last_auto_recalibrated_at,
      updated_at = @updated_at
  WHERE dev_eui = @dev_eui
`);

const stmtRecentReadings = db.prepare(`
  SELECT at, meter_value
  FROM readings
  WHERE dev_eui = ?
  ORDER BY at DESC
  LIMIT ?
`);

export type DeviceType = "gas" | "water" | "electricity_ferraris" | "electricity_sml" | "unknown";

const DEVICE_TYPES: readonly DeviceType[] = [
  "gas",
  "water",
  "electricity_ferraris",
  "electricity_sml",
  "unknown",
];

export function normalizeDeviceType(input: unknown): DeviceType {
  const v = String(input ?? "").trim().toLowerCase();
  return (DEVICE_TYPES as readonly string[]).includes(v) ? (v as DeviceType) : "unknown";
}

export function setDeviceType(devEui: string, deviceType: unknown): DeviceType {
  const normalizedDevEui = String(devEui || "").trim().toLowerCase();
  const normalizedType = normalizeDeviceType(deviceType);
  if (!normalizedDevEui) return normalizedType;

  stmtSetDeviceType.run({
    dev_eui: normalizedDevEui,
    device_type: normalizedType,
    updated_at: new Date().toISOString(),
  });

  return normalizedType;
}

export function getDeviceType(devEui: string): DeviceType {
  const row = stmtGetDeviceType.get(String(devEui || "").trim().toLowerCase()) as { device_type?: string } | undefined;
  return normalizeDeviceType(row?.device_type ?? "unknown");
}

export interface DeviceAutoRecalibrationSettings {
  enabled: boolean;
  qmax_factor: number;
  min_jump: number;
  cooldown_minutes: number;
  f_port: number;
  last_auto_recalibrated_at: string | null;
}

export function getDeviceAutoRecalibrationSettings(devEui: string): DeviceAutoRecalibrationSettings | null {
  const normalizedDevEui = String(devEui || "").trim().toLowerCase();
  if (!normalizedDevEui) return null;

  const row = stmtGetDeviceAutoRecalibration.get(normalizedDevEui) as {
    auto_recalibrate_enabled?: number | null;
    auto_recalibrate_qmax_factor?: number | null;
    auto_recalibrate_min_jump?: number | null;
    auto_recalibrate_cooldown_min?: number | null;
    auto_recalibrate_f_port?: number | null;
    last_auto_recalibrated_at?: string | null;
  } | undefined;

  if (!row) return null;

  return {
    enabled: Number(row.auto_recalibrate_enabled ?? 1) !== 0,
    qmax_factor: Number(row.auto_recalibrate_qmax_factor ?? 6.0),
    min_jump: Number(row.auto_recalibrate_min_jump ?? 100000),
    cooldown_minutes: Number(row.auto_recalibrate_cooldown_min ?? 180),
    f_port: Number(row.auto_recalibrate_f_port ?? 15),
    last_auto_recalibrated_at: row.last_auto_recalibrated_at ?? null,
  };
}

export function setDeviceAutoRecalibrationSettings(
  devEui: string,
  input: {
    enabled: boolean;
    qmax_factor: number;
    min_jump: number;
    cooldown_minutes: number;
    f_port: number;
  }
): DeviceAutoRecalibrationSettings {
  const normalizedDevEui = String(devEui || "").trim().toLowerCase();
  const deviceType = getDeviceType(normalizedDevEui);

  stmtSetDeviceAutoRecalibration.run({
    dev_eui: normalizedDevEui,
    device_type: deviceType,
    auto_recalibrate_enabled: input.enabled ? 1 : 0,
    auto_recalibrate_qmax_factor: Number(input.qmax_factor),
    auto_recalibrate_min_jump: Number(input.min_jump),
    auto_recalibrate_cooldown_min: Math.round(Number(input.cooldown_minutes)),
    auto_recalibrate_f_port: Math.round(Number(input.f_port)),
    updated_at: new Date().toISOString(),
  });

  return getDeviceAutoRecalibrationSettings(normalizedDevEui) ?? {
    enabled: input.enabled,
    qmax_factor: input.qmax_factor,
    min_jump: input.min_jump,
    cooldown_minutes: input.cooldown_minutes,
    f_port: input.f_port,
    last_auto_recalibrated_at: null,
  };
}

export function setLastAutoRecalibratedAt(devEui: string, atIso: string): void {
  const normalizedDevEui = String(devEui || "").trim().toLowerCase();
  if (!normalizedDevEui) return;

  if (!getDeviceAutoRecalibrationSettings(normalizedDevEui)) {
    setDeviceAutoRecalibrationSettings(normalizedDevEui, {
      enabled: true,
      qmax_factor: 6.0,
      min_jump: 100000,
      cooldown_minutes: 180,
      f_port: 15,
    });
  }

  stmtSetLastAutoRecalibratedAt.run({
    dev_eui: normalizedDevEui,
    last_auto_recalibrated_at: atIso,
    updated_at: new Date().toISOString(),
  });
}

export function listDeviceTypes(): Record<string, DeviceType> {
  const rows = stmtListDeviceTypes.all() as Array<{ dev_eui: string; device_type: string }>;
  const out: Record<string, DeviceType> = {};
  for (const row of rows) {
    if (!row?.dev_eui) continue;
    out[row.dev_eui] = normalizeDeviceType(row.device_type);
  }
  return out;
}

export function storeReading(input: StoreReadingInput): void {
  const dev_eui = input.dev_eui;
  const at = input.at;
  const meter_value = input.meter_value;

  const meter_value_raw =
    input.meter_value_raw == null ? null : String(input.meter_value_raw);

  const device_name = input.device_name == null ? null : input.device_name;
  const application_id = input.application_id == null ? null : input.application_id;
  const application_name = input.application_name == null ? null : input.application_name;
  const deduplication_id =
    input.deduplication_id == null ? null : input.deduplication_id;

  const battery_mv =
    typeof input.battery_mv === "number" && Number.isFinite(input.battery_mv)
      ? Math.round(input.battery_mv)
      : null;

  const rssi =
    typeof input.rssi === "number" && Number.isFinite(input.rssi)
      ? Math.round(input.rssi)
      : null;

  const snr =
    typeof input.snr === "number" && Number.isFinite(input.snr)
      ? input.snr
      : null;

  stmtInsert.run({
    dev_eui,
    at,
    meter_value,
    meter_value_raw,
    device_name,
    application_id,
    application_name,
    deduplication_id,
    battery_mv,
    rssi,
    snr,
  });
}

export function storeUplink(input: StoreUplinkInput): void {
  const meter_value =
    typeof input.meter_value === "number" && Number.isFinite(input.meter_value)
      ? input.meter_value
      : null;

  const meter_value_raw =
    input.meter_value_raw == null ? null : String(input.meter_value_raw);

  const battery_mv =
    typeof input.battery_mv === "number" && Number.isFinite(input.battery_mv)
      ? Math.round(input.battery_mv)
      : null;

  const rssi =
    typeof input.rssi === "number" && Number.isFinite(input.rssi)
      ? Math.round(input.rssi)
      : null;

  const snr =
    typeof input.snr === "number" && Number.isFinite(input.snr)
      ? input.snr
      : null;

  const deduplication_id =
    input.deduplication_id == null || input.deduplication_id === ""
      ? `${input.dev_eui}:${input.at}`
      : input.deduplication_id;

  stmtInsertUplink.run({
    dev_eui: input.dev_eui,
    at: input.at,
    provider: input.provider,
    device_name: input.device_name,
    application_id: input.application_id,
    application_name: input.application_name,
    deduplication_id,
    meter_value,
    meter_value_raw,
    battery_mv,
    rssi,
    snr,
    decoded_json: input.decoded_json == null ? null : JSON.stringify(input.decoded_json),
    payload_json: input.payload_json == null ? null : JSON.stringify(input.payload_json),
  });
}

export function listDevices(): { dev_eui: string; device_name?: string | null }[] {
  return stmtListDevices.all() as any[];
}

export function getLastReading(
  devEui: string
): { at: string; meter_value: number; battery_mv: number | null; rssi: number | null; snr: number | null } | null {
  const row = stmtLastReading.get(devEui) as any;
  if (!row) return null;
  return {
    at: row.at,
    meter_value: row.meter_value,
    battery_mv: row.battery_mv == null ? null : row.battery_mv,
    rssi: row.rssi == null ? null : row.rssi,
    snr: row.snr == null ? null : row.snr,
  };
}

export function listReadings(devEui: string, from?: string, to?: string): ReadingRow[] {
  const all = stmtAllReadingsForDevice.all(devEui) as any[];
  return all.filter((r) => {
    if (from && r.at < from) return false;
    if (to && r.at > to) return false;
    return true;
  }).map((r) => ({
    dev_eui: devEui,
    at: r.at,
    meter_value: r.meter_value,
    meter_value_raw: null,
    device_name: null,
    application_id: null,
    application_name: null,
    deduplication_id: null,
    battery_mv: r.battery_mv == null ? null : r.battery_mv,
    rssi: r.rssi == null ? null : r.rssi,
    snr: r.snr == null ? null : r.snr,
  }));
}

export function listRecentReadings(devEui: string, limit = 8): Array<{ at: string; meter_value: number }> {
  const rows = stmtRecentReadings.all(devEui, Math.max(1, Math.floor(limit))) as Array<{ at: string; meter_value: number }>;
  return rows.slice().reverse();
}

export function listUplinks(devEui: string, from?: string, to?: string, limit = 500): UplinkRow[] {
  const all = stmtAllUplinksForDevice.all(devEui) as UplinkRow[];
  const filtered = all.filter((r) => {
    if (from && r.at < from) return false;
    if (to && r.at > to) return false;
    return true;
  });
  return filtered.slice(Math.max(0, filtered.length - Math.max(1, limit)));
}

export function getLastUplink(devEui: string): UplinkRow | null {
  const row = stmtLastUplink.get(devEui) as UplinkRow | undefined;
  return row ?? null;
}

export function deleteDevice(devEui: string): { readingsDeleted: number; uplinksDeleted: number } {
  const infoReadings = stmtDeleteReadingsForDevice.run(devEui);
  const infoUplinks = stmtDeleteUplinksForDevice.run(devEui);
  stmtDeleteSettingsForDevice.run(devEui);
  db.prepare(`DELETE FROM anomaly_log WHERE dev_eui = ?`).run(devEui);
  return {
    readingsDeleted: Number(infoReadings.changes || 0),
    uplinksDeleted: Number(infoUplinks.changes || 0),
  };
}

export function resetUplinkCount(devEui: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO device_settings (dev_eui, uplink_count_reset_at, updated_at)
    VALUES (@dev_eui, @reset_at, @updated_at)
    ON CONFLICT(dev_eui) DO UPDATE SET
      uplink_count_reset_at = excluded.uplink_count_reset_at,
      updated_at = excluded.updated_at
  `).run({ dev_eui: devEui, reset_at: now, updated_at: now });
}

export function getUplinkCountResetAt(devEui: string): string | null {
  const row = db.prepare(`SELECT uplink_count_reset_at FROM device_settings WHERE dev_eui = ?`).get(devEui) as { uplink_count_reset_at: string | null } | undefined;
  return row?.uplink_count_reset_at ?? null;
}

export function resetFailureLogs(devEui: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO device_settings (dev_eui, failure_logs_reset_at, updated_at)
    VALUES (@dev_eui, @reset_at, @updated_at)
    ON CONFLICT(dev_eui) DO UPDATE SET
      failure_logs_reset_at = excluded.failure_logs_reset_at,
      updated_at = excluded.updated_at
  `).run({ dev_eui: devEui, reset_at: now, updated_at: now });
}

export function getFailureLogsResetAt(devEui: string): string | null {
  const row = db.prepare(`SELECT failure_logs_reset_at FROM device_settings WHERE dev_eui = ?`).get(devEui) as { failure_logs_reset_at: string | null } | undefined;
  return row?.failure_logs_reset_at ?? null;
}

export function exportDeviceData(devEui: string, from?: string, to?: string): { readings: ReadingRow[]; uplinks: UplinkRow[] } {
  const readings = listReadings(devEui, from, to);
  const uplinks = listUplinks(devEui, from, to, 100000);
  return { readings, uplinks };
}

export type DeleteSource = "readings" | "uplinks" | "both";

export function deleteDataPoint(devEui: string, at: string, source: DeleteSource = "both"): { readingsDeleted: number; uplinksDeleted: number } {
  let readingsDeleted = 0;
  let uplinksDeleted = 0;

  if (source === "readings" || source === "both") {
    const info = db.prepare(`DELETE FROM readings WHERE dev_eui = ? AND at = ?`).run(devEui, at);
    readingsDeleted = Number(info.changes || 0);
  }

  if (source === "uplinks" || source === "both") {
    const info = db.prepare(`DELETE FROM uplinks WHERE dev_eui = ? AND at = ?`).run(devEui, at);
    uplinksDeleted = Number(info.changes || 0);
  }

  return { readingsDeleted, uplinksDeleted };
}

export function deleteDataRange(devEui: string, from: string, to: string, source: DeleteSource = "both"): { readingsDeleted: number; uplinksDeleted: number } {
  let readingsDeleted = 0;
  let uplinksDeleted = 0;

  if (source === "readings" || source === "both") {
    const info = db.prepare(`DELETE FROM readings WHERE dev_eui = ? AND at >= ? AND at <= ?`).run(devEui, from, to);
    readingsDeleted = Number(info.changes || 0);
  }

  if (source === "uplinks" || source === "both") {
    const info = db.prepare(`DELETE FROM uplinks WHERE dev_eui = ? AND at >= ? AND at <= ?`).run(devEui, from, to);
    uplinksDeleted = Number(info.changes || 0);
  }

  return { readingsDeleted, uplinksDeleted };
}

export interface DeviceSummary {
  dev_eui: string;
  device_name: string | null;
  last_seen: string | null;
  battery_mv: number | null;
  rssi: number | null;
  snr: number | null;
  total_uplinks: number;
  avg_interval_seconds: number | null;
  first_seen: string | null;
  meter_value: number | null;
  meter_value_raw: string | null;
  /** Start of the last (or current) continuous uplink streak */
  last_streak_start: string | null;
  /** End of the last streak (= last_seen when currently active) */
  last_streak_end: string | null;
}

const stmtUplinkTimestamps = db.prepare(`
  SELECT at FROM uplinks WHERE dev_eui = ? ORDER BY at ASC
`);

/** Gap detection multiplier – a gap wider than median_interval * this is an offline break */
const STREAK_GAP_MULTIPLIER = 6;

export function getDeviceSummaries(): DeviceSummary[] {
  const devices = listDevices();
  const summaries: DeviceSummary[] = [];

  for (const d of devices) {
    const lastUp = stmtLastUplink.get(d.dev_eui) as UplinkRow | undefined;
    const lastRead = stmtLastReading.get(d.dev_eui) as any | undefined;
    const uplinkResetAt = getUplinkCountResetAt(d.dev_eui);
    const stats = uplinkResetAt
      ? db.prepare(`
          SELECT COUNT(*) AS cnt, MIN(at) AS first_at, MAX(at) AS last_at
          FROM uplinks WHERE dev_eui = ? AND at > ?
        `).get(d.dev_eui, uplinkResetAt) as any
      : db.prepare(`
          SELECT COUNT(*) AS cnt, MIN(at) AS first_at, MAX(at) AS last_at
          FROM uplinks WHERE dev_eui = ?
        `).get(d.dev_eui) as any;

    // Fetch all uplink timestamps once (used for median interval + streak detection)
    const timestamps = (stats && stats.cnt > 1)
      ? stmtUplinkTimestamps.all(d.dev_eui) as Array<{ at: string }>
      : [];

    // Compute intervals between consecutive uplinks
    const intervalsMs: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      const prev = new Date(timestamps[i - 1].at).getTime();
      const curr = new Date(timestamps[i].at).getTime();
      intervalsMs.push(curr - prev);
    }

    // Use median interval (robust against offline gaps inflating the average)
    let medianIntervalMs: number | null = null;
    if (intervalsMs.length > 0) {
      const sorted = [...intervalsMs].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianIntervalMs = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }

    // avg_interval based on the last 3 uplinks
    let avgInterval: number | null = null;
    if (timestamps.length >= 2) {
      const recent = timestamps.slice(-3);
      let sum = 0;
      for (let i = 1; i < recent.length; i++) {
        sum += new Date(recent[i].at).getTime() - new Date(recent[i - 1].at).getTime();
      }
      avgInterval = Math.round(sum / (recent.length - 1) / 1000);
    }

    // Detect the last continuous streak by scanning for offline gaps
    let lastStreakStart: string | null = stats?.first_at ?? null;
    const lastStreakEnd: string | null = stats?.last_at ?? null;

    if (medianIntervalMs != null) {
      const gapThreshold = medianIntervalMs * STREAK_GAP_MULTIPLIER;

      for (let i = 0; i < intervalsMs.length; i++) {
        if (intervalsMs[i] > gapThreshold) {
          // Found an offline gap – streak restarts at the next uplink
          lastStreakStart = timestamps[i + 1].at;
        }
      }
    }

    summaries.push({
      dev_eui: d.dev_eui,
      device_name: d.device_name ?? null,
      last_seen: lastUp?.at ?? stats?.last_at ?? null,
      battery_mv: lastUp?.battery_mv ?? null,
      rssi: lastUp?.rssi ?? null,
      snr: lastUp?.snr ?? null,
      total_uplinks: stats?.cnt ?? 0,
      avg_interval_seconds: avgInterval,
      first_seen: stats?.first_at ?? null,
      meter_value: lastRead?.meter_value ?? null,
      meter_value_raw: lastRead?.meter_value_raw ?? null,
      last_streak_start: lastStreakStart,
      last_streak_end: lastStreakEnd,
    });
  }
  return summaries;
}

export function countTx(devEui: string | null, from: string, to: string): number {
  let sql = `
    SELECT COUNT(*) AS cnt
    FROM uplinks
    WHERE at >= @from AND at <= @to
  `;
  const params: any = { from, to };
  if (devEui) {
    sql += ` AND dev_eui = @dev_eui`;
    params.dev_eui = devEui;
  }
  const row = db.prepare(sql).get(params) as any;
  return row && row.cnt != null ? Number(row.cnt) : 0;
}

// --- daily consumption (delta of meter values per local day) ---
export interface DailyPoint {
  date: string; // YYYY-MM-DD in local tz
  consumption: number | null;
  closing: number | null;
}

function getLocalDateString(iso: string, tz: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // YYYY-MM-DD
}

export function dailyConsumption(devEui: string, days: number, tz: string, endIso?: string): DailyPoint[] {
  const all = stmtAllReadingsForDevice.all(devEui) as any[];
  if (!all.length) return [];

  const endMs = endIso ? new Date(endIso).getTime() : Date.now();
  const startMs = endMs - days * 24 * 60 * 60 * 1000;

  const byDate: Record<string, { first?: number; last?: number }> = {};

  for (const r of all) {
    const t = new Date(r.at).getTime();
    if (t < startMs || t > endMs) continue;

    const date = getLocalDateString(r.at, tz);
    const mv = typeof r.meter_value === "number" ? r.meter_value : null;
    if (mv == null) continue;

    if (!byDate[date]) byDate[date] = {};
    if (byDate[date].first == null) byDate[date].first = mv;
    byDate[date].last = mv;
  }

  const dates = Object.keys(byDate).sort();
  const out: DailyPoint[] = [];
  for (const d of dates) {
    const first = byDate[d].first;
    const last = byDate[d].last;
    const cons = (first != null && last != null) ? (last - first) : null;
    out.push({
      date: d,
      consumption: cons != null ? cons : null,
      closing: last != null ? last : null,
    });
  }
  return out;
}

// --- Configured Devices (UUID-based) ---

export interface ConfiguredDevice {
  uuid: string;
  dev_eui: string;
  name: string;
  device_type: DeviceType;
  created_at: string;
}

export function listConfiguredDevices(): ConfiguredDevice[] {
  const rows = db.prepare(`SELECT * FROM devices ORDER BY created_at DESC`).all() as ConfiguredDevice[];
  return rows.map(r => ({ ...r, device_type: normalizeDeviceType(r.device_type) }));
}

/** Resolve a UUID to a dev_eui. Returns null if not found. */
export function getDevEuiByUuid(uuid: string): string | null {
  const row = db.prepare(`SELECT dev_eui FROM devices WHERE uuid = ?`).get(uuid) as { dev_eui: string } | undefined;
  return row?.dev_eui ?? null;
}

export function getConfiguredDevice(uuid: string): ConfiguredDevice | null {
  const row = db.prepare(`SELECT * FROM devices WHERE uuid = ?`).get(uuid) as ConfiguredDevice | undefined;
  if (!row) return null;
  return { ...row, device_type: normalizeDeviceType(row.device_type) };
}

export function createConfiguredDevice(input: { dev_eui: string; name: string; device_type: string }): ConfiguredDevice {
  const uuid = randomUUID();
  const devEui = String(input.dev_eui || "").trim().toLowerCase();
  const deviceType = normalizeDeviceType(input.device_type);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO devices (uuid, dev_eui, name, device_type, created_at)
    VALUES (@uuid, @dev_eui, @name, @device_type, @created_at)
  `).run({
    uuid,
    dev_eui: devEui,
    name: String(input.name || "").trim(),
    device_type: deviceType,
    created_at: now,
  });

  // Also sync to device_settings
  setDeviceType(devEui, deviceType);

  return { uuid, dev_eui: devEui, name: String(input.name || "").trim(), device_type: deviceType, created_at: now };
}

export function updateConfiguredDevice(uuid: string, input: { name?: string; device_type?: string }): ConfiguredDevice | null {
  const existing = getConfiguredDevice(uuid);
  if (!existing) return null;

  const name = input.name !== undefined ? String(input.name).trim() : existing.name;
  const deviceType = input.device_type !== undefined ? normalizeDeviceType(input.device_type) : existing.device_type;

  db.prepare(`
    UPDATE devices SET name = @name, device_type = @device_type WHERE uuid = @uuid
  `).run({ uuid, name, device_type: deviceType });

  // Sync to device_settings
  setDeviceType(existing.dev_eui, deviceType);

  return { ...existing, name, device_type: deviceType };
}

export function deleteConfiguredDevice(uuid: string): boolean {
  const info = db.prepare(`DELETE FROM devices WHERE uuid = ?`).run(uuid);
  return Number(info.changes) > 0;
}
