import express, { Request, Response } from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  storeReading,
  storeUplink,
  listDevices,
  dailyConsumption,
  listReadings,
  listUplinks,
  getLastReading,
  getLastUplink,
  countTx,
  deleteDevice,
  exportDeviceData,
  deleteDataPoint,
  deleteDataRange,
  getDeviceSummaries,
  listDeviceTypes,
  setDeviceType,
  normalizeDeviceType,
  listRecentReadings,
  getDeviceAutoRecalibrationSettings,
  setDeviceAutoRecalibrationSettings,
  setLastAutoRecalibratedAt,
  storeAnomaly,
  listAnomalies,
  listConfiguredDevices,
  getConfiguredDevice,
  getDevEuiByUuid,
  createConfiguredDevice,
  updateConfiguredDevice,
  deleteConfiguredDevice,
  resetUplinkCount,
  getUplinkCountResetAt,
  resetFailureLogs,
  getFailureLogsResetAt,
} from "./db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "2mb" }));

// ---- simple request logger ----
app.use((req, _res, next) => {
  if (req.path !== "/healthz") {
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
    console.log(`[HIT] ${req.method} ${req.url} ip=${ip} ua=${req.headers["user-agent"] || "-"}`);
  }
  next();
});

// ---- ENV defaults ----
const EXPECTED_TOKEN = process.env.CHIRPSTACK_WEBHOOK_TOKEN || "";
const PORT = Number(process.env.PORT || 8000);
const DEFAULT_TZ = process.env.UI_TIMEZONE || "Europe/Berlin";
const DEFAULT_DAYS = Number(process.env.UI_DAYS || "30");
const TTN_DOWNLINK_API_KEY = process.env.TTN_DOWNLINK_API_KEY || "";
const TTN_API_BASE = (process.env.TTN_API_BASE || "https://eu1.cloud.thethings.network").replace(/\/$/, "");
const TTN_DEFAULT_F_PORT = Number(process.env.TTN_DEFAULT_F_PORT || "15");
const AUTO_RECAL_DEFAULT_ENABLED = String(process.env.AUTO_RECAL_DEFAULT_ENABLED || "1") !== "0";
const AUTO_RECAL_DEFAULT_QMAX_FACTOR = Number(process.env.AUTO_RECAL_DEFAULT_QMAX_FACTOR || "6");
const AUTO_RECAL_DEFAULT_MIN_JUMP = Number(process.env.AUTO_RECAL_DEFAULT_MIN_JUMP || "100000");
const AUTO_RECAL_DEFAULT_COOLDOWN_MIN = Number(process.env.AUTO_RECAL_DEFAULT_COOLDOWN_MIN || "180");

// ---- helpers ----
const HEX16 = /^[0-9a-fA-F]{16}$/;

function normalizeDevEui(v: unknown): { hex?: string; base64?: string } {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return {};
  if (HEX16.test(s)) return { hex: s.toLowerCase() };
  try {
    const buf = Buffer.from(s, "base64");
    if (buf.length === 8) return { hex: buf.toString("hex"), base64: s };
  } catch {}
  return { hex: s.toLowerCase() };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a devEui from query params.
 * Accepts either `uuid` or `devEui`; if `uuid` is given, looks up the dev_eui
 * from the configured_devices table. Returns the devEui string or null.
 */
function resolveDevEui(query: Record<string, unknown>): string | null {
  const uuid = query.uuid ? String(query.uuid).trim() : "";
  if (uuid && UUID_RE.test(uuid)) {
    return getDevEuiByUuid(uuid);
  }
  const raw = query.devEui ? String(query.devEui).trim().toLowerCase() : "";
  return raw || null;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function getDeep(obj: unknown, path: Array<string | number>): unknown {
  let cur: unknown = obj;
  for (const seg of path) {
    if (typeof seg === "number") {
      if (!Array.isArray(cur) || seg < 0 || seg >= cur.length) return undefined;
      cur = cur[seg];
      continue;
    }
    const rec = asRecord(cur);
    if (!rec || !(seg in rec)) return undefined;
    cur = rec[seg];
  }
  return cur;
}

function firstDefined(obj: unknown, paths: Array<Array<string | number>>): unknown {
  for (const p of paths) {
    const v = getDeep(obj, p);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string") return null;
  try {
    const v = JSON.parse(raw);
    return asRecord(v);
  } catch {
    return null;
  }
}

function decodeBase64Ascii(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    return Buffer.from(v, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function findFirstKeyDeep(root: unknown, keys: string[], maxDepth = 4): unknown {
  const wanted = new Set(keys);
  const seen = new Set<unknown>();
  const stack: Array<{ v: unknown; depth: number }> = [{ v: root, depth: 0 }];

  while (stack.length) {
    const { v, depth } = stack.pop()!;
    if (v == null || seen.has(v) || depth > maxDepth) continue;
    seen.add(v);

    if (Array.isArray(v)) {
      for (const item of v) stack.push({ v: item, depth: depth + 1 });
      continue;
    }

    const rec = asRecord(v);
    if (!rec) continue;

    for (const [k, val] of Object.entries(rec)) {
      if (wanted.has(k) && val != null) return val;
      stack.push({ v: val, depth: depth + 1 });
    }
  }

  return undefined;
}

function parseMeterNumber(raw: unknown): { meterValue: number | null; meterValueRaw: string | number | null } {
  if (typeof raw === "number") {
    return {
      meterValue: Number.isFinite(raw) ? raw : null,
      meterValueRaw: Number.isFinite(raw) ? raw : null,
    };
  }

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return { meterValue: null, meterValueRaw: null };

    const direct = Number(s.replace(",", "."));
    if (Number.isFinite(direct)) {
      return { meterValue: direct, meterValueRaw: s };
    }

    const compact = s.match(/^(\d{5})(\d{1,3})$/);
    if (compact) {
      const normalized = `${compact[1]}.${compact[2]}`;
      const n = Number(normalized);
      if (Number.isFinite(n)) return { meterValue: n, meterValueRaw: s };
    }

    const firstNum = s.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    if (firstNum) {
      const n = Number(firstNum[0]);
      if (Number.isFinite(n)) return { meterValue: n, meterValueRaw: s };
    }

    return { meterValue: null, meterValueRaw: s };
  }

  return { meterValue: null, meterValueRaw: null };
}

function bestSignal(rxItems: unknown[]): { rssi: number | null; snr: number | null } {
  let bestRssi: number | null = null;
  let bestSnr: number | null = null;

  for (const item of rxItems) {
    const r = numOrNull(firstDefined(item, [["rssi"], ["channel_rssi"]]));
    const s = numOrNull(firstDefined(item, [["loRaSNR"], ["loraSNR"], ["snr"]]));
    if (r == null) continue;
    if (bestRssi == null || r > bestRssi) {
      bestRssi = r;
      bestSnr = s;
    }
  }

  return { rssi: bestRssi, snr: bestSnr };
}

function parseLoRaPayload(up: any) {
  const provider =
    up?.end_device_ids ? "ttn" :
    up?.deviceInfo ? "chirpstack" :
    up?.device ? "generic-device" :
    "generic";

  const devEuiRaw = firstDefined(up, [
    ["deviceInfo", "devEui"],
    ["end_device_ids", "dev_eui"],
    ["endDeviceIds", "devEui"],
    ["device", "devEui"],
    ["devEui"],
    ["devEUI"],
    ["dev_eui"],
    ["deviceEui"],
  ]);
  const { hex: devEui, base64: devEuiB64 } = normalizeDevEui(devEuiRaw);

  const deviceName = (firstDefined(up, [
    ["deviceInfo", "deviceName"],
    ["end_device_ids", "device_id"],
    ["endDeviceIds", "deviceId"],
    ["device", "name"],
    ["deviceName"],
  ]) ?? null) as string | null;

  const applicationId = (firstDefined(up, [
    ["deviceInfo", "applicationId"],
    ["end_device_ids", "application_ids", "application_id"],
    ["endDeviceIds", "applicationIds", "applicationId"],
    ["applicationId"],
  ]) ?? null) as string | null;

  const applicationName = (firstDefined(up, [
    ["deviceInfo", "applicationName"],
    ["applicationName"],
  ]) ?? null) as string | null;

  const at = String(
    firstDefined(up, [
      ["time"],
      ["publishedAt"],
      ["received_at"],
      ["uplink_message", "received_at"],
    ]) ?? new Date().toISOString()
  );

  const dedupRaw =
    (firstDefined(up, [
      ["deduplicationId"],
      ["deduplication_id"],
      ["uplink_message", "f_cnt"],
      ["f_cnt"],
    ]) ?? null) as string | number | null;

  // f_cnt resets when a device restarts/rejoins, so combine it with the
  // timestamp to avoid falsely deduplicating new uplinks against old ones.
  // True duplicates (same uplink via multiple gateways) share both f_cnt AND
  // receive time, so they will still be deduplicated correctly.
  const deduplicationId =
    dedupRaw != null ? `${dedupRaw}:${at}` : null;

  const rxCandidates =
    (Array.isArray(up?.rxInfo) ? up.rxInfo : []).concat(
      Array.isArray(up?.uplink_message?.rx_metadata) ? up.uplink_message.rx_metadata : []
    );
  const signal = bestSignal(rxCandidates);
  const rssi = signal.rssi ?? numOrNull(firstDefined(up, [["rssi"], ["uplink_message", "rssi"]]));
  const snr = signal.snr ?? numOrNull(firstDefined(up, [["loRaSNR"], ["loraSNR"], ["snr"], ["uplink_message", "snr"]]));

  const decodedObj =
    asRecord(firstDefined(up, [["object"], ["decoded_payload"], ["uplink_message", "decoded_payload"]])) ??
    parseJsonObject(firstDefined(up, [["objectJSON"], ["objectJson"]])) ??
    null;

  let meterRaw = firstDefined(up, [
    ["meterValue"],
    ["meter_value"],
    ["obis_1_8_0"],
    ["message"],
    ["uplink_message", "decoded_payload", "meterValue"],
    ["uplink_message", "decoded_payload", "obis_1_8_0"],
  ]);

  if (meterRaw == null && decodedObj) {
    meterRaw = findFirstKeyDeep(decodedObj, [
      "meterValue",
      "meter_value",
      "obis_1_8_0",
      "obis1_8_0",
      "obis_1_8_0_value",
      "meter",
      "reading",
      "counter",
      "message",
      "value",
    ]);
  }

  if (meterRaw == null) {
    const frmPayload = firstDefined(up, [["data"], ["frm_payload"], ["uplink_message", "frm_payload"], ["payload_raw"]]);
    const ascii = decodeBase64Ascii(frmPayload);
    if (ascii) meterRaw = ascii.replace(/^(\d{5})(\d+)/, "$1.$2");
  }

  const { meterValue, meterValueRaw } = parseMeterNumber(meterRaw);

  let battery_mv = numOrNull(firstDefined(up, [
    ["battery_mv"],
    ["batteryMv"],
    ["uplink_message", "decoded_payload", "battery_mv"],
  ]));

  if (battery_mv == null && decodedObj) {
    battery_mv = numOrNull(findFirstKeyDeep(decodedObj, [
      "battery_mv",
      "batteryMv",
      "battery_mV",
      "battery",
      "battery_voltage",
      "batteryVoltage",
      "batt",
      "voltage",
    ]));
  }

  // if decoder gives volts (e.g. 3.6), convert to mV
  if (battery_mv != null && battery_mv > 0 && battery_mv < 20) {
    battery_mv = Math.round(battery_mv * 1000);
  }

  return {
    provider,
    devEui,
    devEuiB64,
    deviceName,
    applicationId,
    applicationName,
    at,
    deduplicationId: deduplicationId == null ? null : String(deduplicationId),
    rssi,
    snr,
    battery_mv,
    meterValue,
    meterValueRaw,
    decodedObj,
    payloadObj: up,
  };
}

function isWebhookAuthorized(req: Request): boolean {
  if (!EXPECTED_TOKEN) return true;
  const apiKey = req.get("X-API-Key") || "";
  const auth = req.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return apiKey === EXPECTED_TOKEN || bearer === EXPECTED_TOKEN;
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function getSafeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getEffectiveAutoRecalibrationSettings(devEui: string) {
  const saved = getDeviceAutoRecalibrationSettings(devEui);
  return {
    enabled: saved?.enabled ?? AUTO_RECAL_DEFAULT_ENABLED,
    qmax_factor: getSafeNumber(saved?.qmax_factor, AUTO_RECAL_DEFAULT_QMAX_FACTOR),
    min_jump: getSafeNumber(saved?.min_jump, AUTO_RECAL_DEFAULT_MIN_JUMP),
    cooldown_minutes: Math.max(1, Math.round(getSafeNumber(saved?.cooldown_minutes, AUTO_RECAL_DEFAULT_COOLDOWN_MIN))),
    f_port: Math.min(255, Math.max(1, Math.round(getSafeNumber(saved?.f_port, TTN_DEFAULT_F_PORT)))),
    last_auto_recalibrated_at: saved?.last_auto_recalibrated_at ?? null,
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const arr = values.slice().sort((a, b) => a - b);
  const m = Math.floor(arr.length / 2);
  if (arr.length % 2 === 1) return arr[m];
  return (arr[m - 1] + arr[m]) / 2;
}

function resolveTtnIdentifiers(devEui: string, overrides?: { applicationId?: string | null; deviceId?: string | null }) {
  const last = getLastUplink(devEui);
  const applicationId = String(overrides?.applicationId || last?.application_id || "").trim();
  const deviceId = String(overrides?.deviceId || last?.device_name || "").trim();
  return { applicationId, deviceId };
}

async function pushTtnJsonDownlink(input: {
  applicationId: string;
  deviceId: string;
  payloadObj: Record<string, unknown>;
  fPort: number;
  confirmed?: boolean;
}) {
  const ttnUrl = `${TTN_API_BASE}/api/v3/as/applications/${encodeURIComponent(input.applicationId)}/devices/${encodeURIComponent(input.deviceId)}/down/push`;
  const frmPayload = Buffer.from(JSON.stringify(input.payloadObj), "utf8").toString("base64");
  const payload = {
    downlinks: [
      {
        f_port: input.fPort,
        confirmed: input.confirmed ?? true,
        frm_payload: frmPayload,
      },
    ],
  };

  const r = await fetch(ttnUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TTN_DOWNLINK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let responseJson: unknown = null;
  let responseText = "";
  if (!r.ok) {
    responseText = await r.text();
  } else {
    try { responseJson = await r.json(); } catch {}
  }

  return {
    ok: r.ok,
    status: r.status,
    frmPayload,
    ttn: responseJson,
    details: responseText,
  };
}

async function maybeIssueAutoRecalibration(input: {
  devEui: string;
  meterValue: number;
  at: string;
  applicationId?: string | null;
  deviceId?: string | null;
}) {
  if (!TTN_DOWNLINK_API_KEY) return;

  const cfg = getEffectiveAutoRecalibrationSettings(input.devEui);
  if (!cfg.enabled) return;

  const nowMs = Date.now();
  if (cfg.last_auto_recalibrated_at) {
    const lastMs = new Date(cfg.last_auto_recalibrated_at).getTime();
    if (Number.isFinite(lastMs) && nowMs - lastMs < cfg.cooldown_minutes * 60 * 1000) {
      return;
    }
  }

  const recent = listRecentReadings(input.devEui, 8);
  if (recent.length < 2) return;

  const prev = recent[recent.length - 2]?.meter_value;
  const cur = recent[recent.length - 1]?.meter_value;
  if (!Number.isFinite(prev) || !Number.isFinite(cur)) return;

  const jump = cur - prev;
  if (!(jump > 0)) return;

  const trendDeltas: number[] = [];
  for (let i = 1; i < recent.length - 1; i++) {
    const d = recent[i].meter_value - recent[i - 1].meter_value;
    if (Number.isFinite(d) && d > 0) trendDeltas.push(d);
  }

  const trendMedian = median(trendDeltas);
  const trendThreshold = trendMedian > 0 ? trendMedian * Math.max(1, cfg.qmax_factor) : 0;
  const effectiveThreshold = Math.max(cfg.min_jump, trendThreshold);
  if (!(jump >= effectiveThreshold)) return;

  // log overshoot anomaly regardless of whether we can send downlink
  storeAnomaly({
    dev_eui: input.devEui,
    at: input.at,
    event_type: "overshoot",
    meter_value: cur,
    previous_value: prev,
    jump,
    threshold: effectiveThreshold,
    action: "auto_recalibrate_pending",
    details: `Meter jumped ${jump.toFixed(3)} (threshold ${effectiveThreshold.toFixed(3)}, Qmax factor ${cfg.qmax_factor})`,
  });

  const ids = resolveTtnIdentifiers(input.devEui, {
    applicationId: input.applicationId,
    deviceId: input.deviceId,
  });
  if (!ids.applicationId || !ids.deviceId) {
    pushEvent({
      type: "auto-recalibrate-skip",
      devEui: input.devEui,
      reason: "missing-ttn-identifiers",
      jump,
      threshold: effectiveThreshold,
      at: input.at,
    });
    return;
  }

  try {
    const sent = await pushTtnJsonDownlink({
      applicationId: ids.applicationId,
      deviceId: ids.deviceId,
      payloadObj: { recalibrate: 1 },
      fPort: cfg.f_port,
      confirmed: true,
    });

    if (!sent.ok) {
      pushEvent({
        type: "auto-recalibrate-failed",
        devEui: input.devEui,
        at: input.at,
        status: sent.status,
        details: sent.details?.slice(0, 300),
        jump,
        threshold: effectiveThreshold,
      });
      return;
    }

    setLastAutoRecalibratedAt(input.devEui, new Date().toISOString());
    pushEvent({
      type: "auto-recalibrate",
      devEui: input.devEui,
      at: input.at,
      jump,
      threshold: effectiveThreshold,
      fPort: cfg.f_port,
      applicationId: ids.applicationId,
      deviceId: ids.deviceId,
    });
    sseBroadcast({ type: "auto-recalibrate", devEui: input.devEui, at: input.at, jump, threshold: effectiveThreshold });
    console.log(`[AUTO-RECAL] devEui=${input.devEui} jump=${jump.toFixed(3)} threshold=${effectiveThreshold.toFixed(3)} fPort=${cfg.f_port}`);
  } catch (err) {
    pushEvent({
      type: "auto-recalibrate-error",
      devEui: input.devEui,
      at: input.at,
      error: String((err as any)?.message || err),
    });
  }
}

// keep a few recent events in memory
const lastEvents: any[] = [];
function pushEvent(e: any) {
  lastEvents.push({ ts: new Date().toISOString(), ...e });
  if (lastEvents.length > 50) lastEvents.shift();
}

// ---- SSE for auto-refresh ----
type SSEClient = { id: number; res: Response };
let sseId = 1;
const sseClients: SSEClient[] = [];

function sseBroadcast(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const c of sseClients) {
    try { c.res.write(msg); } catch {}
  }
}

// Polling fallback – returns the most recent events so the frontend can
// pick up new uplinks even when SSE is buffered by a proxy.
app.get("/api/last-events", (_req, res) => {
  res.json(lastEvents);
});

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const client = { id: sseId++, res };
  sseClients.push(client);

  // keepalive
  const t = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch {}
  }, 25000);

  req.on("close", () => {
    clearInterval(t);
    const idx = sseClients.findIndex(x => x.id === client.id);
    if (idx >= 0) sseClients.splice(idx, 1);
  });
});

// ---- webhook (TTN / ChirpStack / generic LoRaWAN → us) ----
async function handleLoRaWebhook(req: Request, res: Response) {
  if (!isWebhookAuthorized(req)) {
    console.warn(`[WARN] Unauthorized POST to ${req.path}`);
    return res.status(401).send("unauthorized");
  }

  const event = String(req.query.event || "");
  const up: any = req.body || {};
  console.log(`[RECV] path=${req.path} event=${event || "(none)"} keys=${Object.keys(up)} length=${JSON.stringify(up).length}`);

  const parsed = parseLoRaPayload(up);
  const {
    provider,
    devEui,
    devEuiB64,
    deviceName,
    applicationId,
    applicationName,
    at,
    deduplicationId,
    rssi,
    snr,
    battery_mv,
    meterValue,
    meterValueRaw,
    decodedObj,
    payloadObj,
  } = parsed;

  console.log(
    `[RECV] provider=${provider} devEui=${devEui ?? devEuiB64 ?? "(missing)"} meter=${meterValue ?? "(null)"} batt=${battery_mv ?? "(null)"}mV rssi=${rssi ?? "(null)"} snr=${snr ?? "(null)"} at=${at}`
  );

  if (!devEui) {
    pushEvent({ type: "up-missing", provider, devEui: devEui ?? devEuiB64, meterValue, at });
    return res.status(200).send("ok");
  }

  try {
    storeUplink({
      dev_eui: devEui,
      at,
      provider,
      meter_value: meterValue,
      meter_value_raw: meterValueRaw,
      device_name: deviceName,
      application_id: applicationId,
      application_name: applicationName,
      deduplication_id: deduplicationId,
      battery_mv,
      rssi,
      snr,
      decoded_json: decodedObj,
      payload_json: payloadObj,
    });

    if (meterValue != null) {
      storeReading({
        dev_eui: devEui,
        at,
        meter_value: meterValue,
        meter_value_raw: meterValueRaw,
        device_name: deviceName,
        application_id: applicationId,
        application_name: applicationName,
        deduplication_id: deduplicationId,
        battery_mv,
        rssi,
        snr,
      });
    }

    pushEvent({ type: "up", provider, devEui, deviceName, meterValue, battery_mv, rssi, snr, at });
    sseBroadcast({ type: "up", devEui, deviceName, at, meterValue, battery_mv });
    console.log(`[STORE] devEui=${devEui} meter=${meterValue ?? "(null)"} batt=${battery_mv ?? "(null)"}mV at=${at}`);

    // auto-recalibration check
    if (meterValue != null) {
      try {
        await maybeIssueAutoRecalibration({
          devEui,
          meterValue,
          at,
          applicationId,
          deviceId: deviceName,
        });
      } catch (autoErr) {
        console.error("[AUTO-RECAL] error:", autoErr);
      }
    }
  } catch (e) {
    console.error("[ERROR] storeReading failed:", e);
  }

  return res.status(200).send("ok");
}

app.post("/webhooks/chirpstack", handleLoRaWebhook);
app.post("/webhooks/ttn", handleLoRaWebhook);
app.post("/webhooks/lorawan", handleLoRaWebhook);

// debug
app.get("/debug/last", (_req, res) => res.json({ lastEvents }));

// REST API
app.get("/api/devices", (_req, res) => res.json({ devices: listDevices() }));

app.get("/api/device-summaries", (_req, res) => {
  const summaries = getDeviceSummaries();
  const configured = listConfiguredDevices();

  // Merge UUID into existing summaries
  const seenDevEuis = new Set<string>();
  const enriched = summaries.map(s => {
    seenDevEuis.add(s.dev_eui);
    const cfg = configured.find(c => c.dev_eui === s.dev_eui);
    return { ...s, uuid: cfg?.uuid ?? null };
  });

  // Add configured devices that have no data yet (not in readings/uplinks)
  for (const cfg of configured) {
    if (!seenDevEuis.has(cfg.dev_eui)) {
      enriched.push({
        dev_eui: cfg.dev_eui,
        device_name: cfg.name || null,
        last_seen: null,
        battery_mv: null,
        rssi: null,
        snr: null,
        total_uplinks: 0,
        avg_interval_seconds: null,
        first_seen: null,
        meter_value: null,
        meter_value_raw: null,
        uuid: cfg.uuid,
        last_streak_start: null,
        last_streak_end: null,
      });
    }
  }

  res.json({ devices: enriched });
});

app.get("/api/device-types", (_req, res) => {
  res.json({ deviceTypes: listDeviceTypes() });
});

app.put("/api/device-types/:devEui", (req, res) => {
  const devEui = String(req.params.devEui || "").trim().toLowerCase();
  if (!devEui) return res.status(400).json({ error: "devEui is required" });

  const rawType = req.body?.deviceType;
  const deviceType = normalizeDeviceType(rawType);
  setDeviceType(devEui, deviceType);
  return res.json({ devEui, deviceType });
});

// --- Configured Devices (UUID-based) ---

app.get("/api/configured-devices", (_req, res) => {
  res.json({ devices: listConfiguredDevices() });
});

app.get("/api/configured-devices/:uuid", (req, res) => {
  const device = getConfiguredDevice(req.params.uuid);
  if (!device) return res.status(404).json({ error: "Device not found" });
  return res.json({ device });
});

app.post("/api/configured-devices", (req, res) => {
  const { dev_eui, name, device_type } = req.body || {};
  if (!dev_eui) return res.status(400).json({ error: "dev_eui is required" });
  if (!name) return res.status(400).json({ error: "name is required" });

  const device = createConfiguredDevice({
    dev_eui: String(dev_eui),
    name: String(name),
    device_type: String(device_type || "unknown"),
  });
  return res.status(201).json({ device });
});

app.put("/api/configured-devices/:uuid", (req, res) => {
  const { name, device_type } = req.body || {};
  const device = updateConfiguredDevice(req.params.uuid, { name, device_type });
  if (!device) return res.status(404).json({ error: "Device not found" });
  return res.json({ device });
});

app.delete("/api/configured-devices/:uuid", (req, res) => {
  const deleted = deleteConfiguredDevice(req.params.uuid);
  if (!deleted) return res.status(404).json({ error: "Device not found" });
  return res.json({ ok: true });
});

app.get("/api/readings", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>);
  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });

  const from = req.query.from ? String(req.query.from) : undefined;
  const to = req.query.to ? String(req.query.to) : undefined;
  res.json({ devEui, readings: listReadings(devEui, from, to) });
});

app.get("/api/uplinks", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>);
  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });

  const from = req.query.from ? String(req.query.from) : undefined;
  const to = req.query.to ? String(req.query.to) : undefined;
  const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : 500;

  const uplinks = listUplinks(devEui, from, to, limit).map((u) => ({
    ...u,
    decoded_json: typeof u.decoded_json === "string" ? (() => { try { return JSON.parse(u.decoded_json); } catch { return null; } })() : null,
    payload_json: typeof u.payload_json === "string" ? (() => { try { return JSON.parse(u.payload_json); } catch { return null; } })() : null,
  }));

  return res.json({ devEui, uplinks });
});

app.get("/api/consumption/daily", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>);
  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });

  const days = req.query.days ? Number(req.query.days) : DEFAULT_DAYS;
  const tz = req.query.tz ? String(req.query.tz) : DEFAULT_TZ;
  const end = req.query.end ? String(req.query.end) : undefined;

  res.json({ devEui, days, tz, series: dailyConsumption(devEui, days, tz, end) });
});

app.get("/api/last-reading", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>);
  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });
  res.json({ devEui, last: getLastReading(devEui) });
});

app.get("/api/last-uplink", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>);
  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });
  const last = getLastUplink(devEui);
  if (!last) return res.json({ devEui, last: null });

  return res.json({
    devEui,
    last: {
      ...last,
      decoded_json: typeof last.decoded_json === "string" ? (() => { try { return JSON.parse(last.decoded_json); } catch { return null; } })() : null,
      payload_json: typeof last.payload_json === "string" ? (() => { try { return JSON.parse(last.payload_json); } catch { return null; } })() : null,
    },
  });
});

app.get("/api/tx-count", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>);
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");
  if (!from || !to) return res.status(400).json({ error: "from and to are required (ISO timestamps)" });
  res.json({ devEui, from, to, count: countTx(devEui, from, to) });
});

app.post("/api/downlink/upload-interval", async (req, res) => {
  const devEuiRaw = String(req.body?.devEui || "").trim().toLowerCase();
  const uuidRaw = String(req.body?.uuid || "").trim();
  const devEui = (uuidRaw && UUID_RE.test(uuidRaw)) ? (getDevEuiByUuid(uuidRaw) || "") : devEuiRaw;
  const seconds = Number(req.body?.seconds);
  const fPortRaw = req.body?.fPort ?? TTN_DEFAULT_F_PORT;
  const fPort = Number(fPortRaw);

  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });
  if (!Number.isFinite(seconds) || seconds < 1) {
    return res.status(400).json({ error: "seconds must be a positive number" });
  }
  if (!Number.isInteger(fPort) || fPort < 1 || fPort > 255) {
    return res.status(400).json({ error: "fPort must be an integer between 1 and 255" });
  }
  if (!TTN_DOWNLINK_API_KEY) {
    return res.status(500).json({ error: "Server missing TTN_DOWNLINK_API_KEY" });
  }

  const ids = resolveTtnIdentifiers(devEui, {
    applicationId: req.body?.applicationId,
    deviceId: req.body?.deviceId,
  });
  if (!ids.applicationId || !ids.deviceId) {
    return res.status(400).json({
      error: "Could not resolve TTN identifiers. Need applicationId and deviceId (from latest uplink or request body).",
      devEui,
      applicationId: ids.applicationId || null,
      deviceId: ids.deviceId || null,
    });
  }

  const roundedSec = Math.round(seconds);
  const minutesVal = Math.round(seconds / 60);
  const downlinkObj: Record<string, number> = {
    upload_interval: minutesVal > 0 ? minutesVal : 1,
    upload_interval_sec: roundedSec,
    upload_sec: roundedSec,
    upload_interval_min: minutesVal > 0 ? minutesVal : 1,
  };

  try {
    const sent = await pushTtnJsonDownlink({
      applicationId: ids.applicationId,
      deviceId: ids.deviceId,
      payloadObj: downlinkObj,
      fPort,
      confirmed: true,
    });

    if (!sent.ok) {
      return res.status(502).json({
        error: "TTN downlink request failed",
        status: sent.status,
        details: sent.details?.slice(0, 800),
      });
    }

    return res.json({
      ok: true,
      devEui,
      applicationId: ids.applicationId,
      deviceId: ids.deviceId,
      seconds: roundedSec,
      minutes: minutesVal,
      fPort,
      confirmed: true,
      downlinkPayload: downlinkObj,
      frm_payload: sent.frmPayload,
      ttn: sent.ttn,
    });
  } catch (err: any) {
    return res.status(502).json({ error: "Failed to call TTN downlink API", details: String(err?.message || err) });
  }
});

// ---- manual recalibration downlink ----
app.post("/api/downlink/recalibrate", async (req, res) => {
  const devEuiRaw = String(req.body?.devEui || "").trim().toLowerCase();
  const uuidRaw = String(req.body?.uuid || "").trim();
  const devEui = (uuidRaw && UUID_RE.test(uuidRaw)) ? (getDevEuiByUuid(uuidRaw) || "") : devEuiRaw;
  const fPortRaw = req.body?.fPort ?? TTN_DEFAULT_F_PORT;
  const fPort = Number(fPortRaw);

  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });
  if (!Number.isInteger(fPort) || fPort < 1 || fPort > 255) {
    return res.status(400).json({ error: "fPort must be an integer between 1 and 255" });
  }
  if (!TTN_DOWNLINK_API_KEY) {
    return res.status(500).json({ error: "Server missing TTN_DOWNLINK_API_KEY" });
  }

  const ids = resolveTtnIdentifiers(devEui, {
    applicationId: req.body?.applicationId,
    deviceId: req.body?.deviceId,
  });
  if (!ids.applicationId || !ids.deviceId) {
    return res.status(400).json({
      error: "Could not resolve TTN identifiers.",
      devEui,
    });
  }

  try {
    const sent = await pushTtnJsonDownlink({
      applicationId: ids.applicationId,
      deviceId: ids.deviceId,
      payloadObj: { recalibrate: 1 },
      fPort,
      confirmed: true,
    });

    if (!sent.ok) {
      return res.status(502).json({
        error: "TTN recalibrate downlink failed",
        status: sent.status,
        details: sent.details?.slice(0, 800),
      });
    }

    storeAnomaly({
      dev_eui: devEui,
      at: new Date().toISOString(),
      event_type: "manual_recalibrate",
      action: "recalibrate_downlink_sent",
      details: `Manual recalibrate via UI (fPort ${fPort})`,
    });

    pushEvent({ type: "manual-recalibrate", devEui, fPort });
    sseBroadcast({ type: "manual-recalibrate", devEui });

    return res.json({
      ok: true,
      devEui,
      applicationId: ids.applicationId,
      deviceId: ids.deviceId,
      fPort,
      ttn: sent.ttn,
    });
  } catch (err: any) {
    return res.status(502).json({ error: "Failed to call TTN downlink API", details: String(err?.message || err) });
  }
});

// ---- anomaly log API ----
app.get("/api/anomalies", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>);
  const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : 200;
  const entries = listAnomalies(devEui, limit);
  return res.json({ devEui, anomalies: entries });
});

app.delete("/api/devices/:devEui", (req, res) => {
  const devEui = String(req.params.devEui || "").trim().toLowerCase();
  if (!devEui) return res.status(400).json({ error: "devEui is required" });

  const deleted = deleteDevice(devEui);
  return res.json({ devEui, ...deleted });
});

app.delete("/api/data-point", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>) || "";
  const at = String(req.query.at || "").trim();
  const sourceRaw = String(req.query.source || "both").toLowerCase();
  const source = (sourceRaw === "readings" || sourceRaw === "uplinks" || sourceRaw === "both")
    ? sourceRaw
    : "both";

  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });
  if (!at) return res.status(400).json({ error: "at is required (ISO timestamp)" });

  const deleted = deleteDataPoint(devEui, at, source);
  return res.json({ devEui, at, source, ...deleted });
});

app.delete("/api/data-range", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>) || "";
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();
  const sourceRaw = String(req.query.source || "both").toLowerCase();
  const source = (sourceRaw === "readings" || sourceRaw === "uplinks" || sourceRaw === "both")
    ? sourceRaw
    : "both";

  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });
  if (!from || !to) return res.status(400).json({ error: "from and to are required (ISO timestamps)" });
  if (from > to) return res.status(400).json({ error: "from must be <= to" });

  const deleted = deleteDataRange(devEui, from, to, source);
  return res.json({ devEui, from, to, source, ...deleted });
});

app.post("/api/reset-uplink-count", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>) || "";
  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });

  resetUplinkCount(devEui);
  return res.json({ devEui, ok: true });
});

app.get("/api/uplink-count-reset-at", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>) || "";
  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });

  const resetAt = getUplinkCountResetAt(devEui);
  return res.json({ devEui, resetAt });
});

app.post("/api/reset-failure-logs", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>) || "";
  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });

  resetFailureLogs(devEui);
  return res.json({ devEui, ok: true });
});

app.get("/api/failure-logs-reset-at", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>) || "";
  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });

  const resetAt = getFailureLogsResetAt(devEui);
  return res.json({ devEui, resetAt });
});

app.get("/api/export", (req, res) => {
  const devEui = resolveDevEui(req.query as Record<string, unknown>) || "";
  const format = String(req.query.format || "json").toLowerCase();
  if (!devEui) return res.status(400).json({ error: "devEui or uuid is required" });

  const from = req.query.from ? String(req.query.from) : undefined;
  const to = req.query.to ? String(req.query.to) : undefined;
  const data = exportDeviceData(devEui, from, to);

  if (format === "csv") {
    const header = [
      "source",
      "dev_eui",
      "at",
      "meter_value",
      "meter_value_raw",
      "battery_mv",
      "rssi",
      "snr",
      "provider",
      "device_name",
      "application_id",
      "application_name",
      "deduplication_id",
      "decoded_json",
      "payload_json",
    ];

    const rows: string[] = [header.join(",")];
    for (const r of data.readings) {
      rows.push([
        "readings",
        r.dev_eui,
        r.at,
        r.meter_value,
        r.meter_value_raw,
        r.battery_mv,
        r.rssi,
        r.snr,
        "",
        r.device_name,
        r.application_id,
        r.application_name,
        r.deduplication_id,
        "",
        "",
      ].map(csvEscape).join(","));
    }
    for (const u of data.uplinks) {
      rows.push([
        "uplinks",
        u.dev_eui,
        u.at,
        u.meter_value,
        u.meter_value_raw,
        u.battery_mv,
        u.rssi,
        u.snr,
        u.provider,
        u.device_name,
        u.application_id,
        u.application_name,
        u.deduplication_id,
        u.decoded_json,
        u.payload_json,
      ].map(csvEscape).join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${devEui}-export.csv`);
    return res.send(rows.join("\n"));
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=${devEui}-export.json`);
  return res.send(JSON.stringify({ devEui, from: from ?? null, to: to ?? null, ...data }, null, 2));
});

// static frontend
app.use(
  "/vendor/apexcharts",
  express.static(path.join(__dirname, "..", "node_modules", "apexcharts", "dist"))
);
app.use("/", express.static(path.join(__dirname, "..", "public")));

// health
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Webhook + UI listening on http://0.0.0.0:${PORT}`);
});
