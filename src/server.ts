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

  const deduplicationId =
    (firstDefined(up, [
      ["deduplicationId"],
      ["deduplication_id"],
      ["uplink_message", "f_cnt"],
      ["f_cnt"],
    ]) ?? null) as string | number | null;

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
    ["message"],
    ["uplink_message", "decoded_payload", "meterValue"],
  ]);

  if (meterRaw == null && decodedObj) {
    meterRaw = findFirstKeyDeep(decodedObj, [
      "meterValue",
      "meter_value",
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

    pushEvent({ type: "up", provider, devEui, meterValue, battery_mv, rssi, snr, at });
    sseBroadcast({ type: "up", devEui, at, meterValue, battery_mv });
    console.log(`[STORE] devEui=${devEui} meter=${meterValue ?? "(null)"} batt=${battery_mv ?? "(null)"}mV at=${at}`);
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

app.get("/api/device-summaries", (_req, res) => res.json({ devices: getDeviceSummaries() }));

app.get("/api/readings", (req, res) => {
  const devEui = String(req.query.devEui || "");
  if (!devEui) return res.status(400).json({ error: "devEui is required" });

  const from = req.query.from ? String(req.query.from) : undefined;
  const to = req.query.to ? String(req.query.to) : undefined;
  res.json({ devEui, readings: listReadings(devEui, from, to) });
});

app.get("/api/uplinks", (req, res) => {
  const devEui = String(req.query.devEui || "");
  if (!devEui) return res.status(400).json({ error: "devEui is required" });

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
  const devEui = String(req.query.devEui || "");
  if (!devEui) return res.status(400).json({ error: "devEui is required" });

  const days = req.query.days ? Number(req.query.days) : DEFAULT_DAYS;
  const tz = req.query.tz ? String(req.query.tz) : DEFAULT_TZ;
  const end = req.query.end ? String(req.query.end) : undefined;

  res.json({ devEui, days, tz, series: dailyConsumption(devEui, days, tz, end) });
});

app.get("/api/last-reading", (req, res) => {
  const devEui = String(req.query.devEui || "");
  if (!devEui) return res.status(400).json({ error: "devEui is required" });
  res.json({ devEui, last: getLastReading(devEui) });
});

app.get("/api/last-uplink", (req, res) => {
  const devEui = String(req.query.devEui || "");
  if (!devEui) return res.status(400).json({ error: "devEui is required" });
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
  const devEui = req.query.devEui ? String(req.query.devEui) : null;
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");
  if (!from || !to) return res.status(400).json({ error: "from and to are required (ISO timestamps)" });
  res.json({ devEui, from, to, count: countTx(devEui, from, to) });
});

app.post("/api/downlink/upload-interval", async (req, res) => {
  const devEui = String(req.body?.devEui || "").trim().toLowerCase();
  const minutes = Number(req.body?.minutes);
  const fPortRaw = req.body?.fPort ?? TTN_DEFAULT_F_PORT;
  const fPort = Number(fPortRaw);

  if (!devEui) return res.status(400).json({ error: "devEui is required" });
  if (!Number.isFinite(minutes) || minutes < 1) {
    return res.status(400).json({ error: "minutes must be a positive number (minutes)" });
  }
  if (!Number.isInteger(fPort) || fPort < 1 || fPort > 255) {
    return res.status(400).json({ error: "fPort must be an integer between 1 and 255" });
  }
  if (!TTN_DOWNLINK_API_KEY) {
    return res.status(500).json({ error: "Server missing TTN_DOWNLINK_API_KEY" });
  }

  const last = getLastUplink(devEui);
  const applicationId = String(req.body?.applicationId || last?.application_id || "").trim();
  const deviceId = String(req.body?.deviceId || last?.device_name || "").trim();

  if (!applicationId || !deviceId) {
    return res.status(400).json({
      error: "Could not resolve TTN identifiers. Need applicationId and deviceId (from latest uplink or request body).",
      devEui,
      applicationId: applicationId || null,
      deviceId: deviceId || null,
    });
  }

  const ttnUrl = `${TTN_API_BASE}/api/v3/as/applications/${encodeURIComponent(applicationId)}/devices/${encodeURIComponent(deviceId)}/down/push`;
  const payload = {
    downlinks: [
      {
        f_port: fPort,
        confirmed: true,
        decoded_payload: { upload_interval: Math.round(minutes) },
      },
    ],
  };

  try {
    const r = await fetch(ttnUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TTN_DOWNLINK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const body = await r.text();
      return res.status(502).json({
        error: "TTN downlink request failed",
        status: r.status,
        details: body.slice(0, 800),
      });
    }

    let responseJson: unknown = null;
    try { responseJson = await r.json(); } catch {}

    return res.json({
      ok: true,
      devEui,
      applicationId,
      deviceId,
      minutes: Math.round(minutes),
      fPort,
      confirmed: true,
      ttn: responseJson,
    });
  } catch (err: any) {
    return res.status(502).json({ error: "Failed to call TTN downlink API", details: String(err?.message || err) });
  }
});

app.delete("/api/devices/:devEui", (req, res) => {
  const devEui = String(req.params.devEui || "").trim().toLowerCase();
  if (!devEui) return res.status(400).json({ error: "devEui is required" });

  const deleted = deleteDevice(devEui);
  return res.json({ devEui, ...deleted });
});

app.delete("/api/data-point", (req, res) => {
  const devEui = String(req.query.devEui || "").trim().toLowerCase();
  const at = String(req.query.at || "").trim();
  const sourceRaw = String(req.query.source || "both").toLowerCase();
  const source = (sourceRaw === "readings" || sourceRaw === "uplinks" || sourceRaw === "both")
    ? sourceRaw
    : "both";

  if (!devEui) return res.status(400).json({ error: "devEui is required" });
  if (!at) return res.status(400).json({ error: "at is required (ISO timestamp)" });

  const deleted = deleteDataPoint(devEui, at, source);
  return res.json({ devEui, at, source, ...deleted });
});

app.delete("/api/data-range", (req, res) => {
  const devEui = String(req.query.devEui || "").trim().toLowerCase();
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();
  const sourceRaw = String(req.query.source || "both").toLowerCase();
  const source = (sourceRaw === "readings" || sourceRaw === "uplinks" || sourceRaw === "both")
    ? sourceRaw
    : "both";

  if (!devEui) return res.status(400).json({ error: "devEui is required" });
  if (!from || !to) return res.status(400).json({ error: "from and to are required (ISO timestamps)" });
  if (from > to) return res.status(400).json({ error: "from must be <= to" });

  const deleted = deleteDataRange(devEui, from, to, source);
  return res.json({ devEui, from, to, source, ...deleted });
});

app.get("/api/export", (req, res) => {
  const devEui = String(req.query.devEui || "").trim().toLowerCase();
  const format = String(req.query.format || "json").toLowerCase();
  if (!devEui) return res.status(400).json({ error: "devEui is required" });

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
