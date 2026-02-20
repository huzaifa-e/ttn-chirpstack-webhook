import Database from "better-sqlite3";
import path from "node:path";

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
  return {
    readingsDeleted: Number(infoReadings.changes || 0),
    uplinksDeleted: Number(infoUplinks.changes || 0),
  };
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
}

export function getDeviceSummaries(): DeviceSummary[] {
  const devices = listDevices();
  const summaries: DeviceSummary[] = [];

  for (const d of devices) {
    const lastUp = stmtLastUplink.get(d.dev_eui) as UplinkRow | undefined;
    const lastRead = stmtLastReading.get(d.dev_eui) as any | undefined;
    const stats = db.prepare(`
      SELECT COUNT(*) AS cnt, MIN(at) AS first_at, MAX(at) AS last_at
      FROM uplinks WHERE dev_eui = ?
    `).get(d.dev_eui) as any;

    let avgInterval: number | null = null;
    if (stats && stats.cnt > 1 && stats.first_at && stats.last_at) {
      const first = new Date(stats.first_at).getTime();
      const last = new Date(stats.last_at).getTime();
      avgInterval = Math.round((last - first) / (stats.cnt - 1) / 1000);
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
