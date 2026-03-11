# EMONI — LoRaWAN Meter Monitoring Dashboard

> A complete **vibe-coded** project. The focus was never on writing perfect code — it was on getting the systems integration right: connecting LoRaWAN networks, webhooks, real-time data pipelines, and a live analytics dashboard into a single, self-contained stack.

EMONI receives webhook data from **TTN (The Things Network)** and/or **ChirpStack**, stores meter readings in a local database, and serves a real-time web dashboard for monitoring gas, water, and electricity meters over LoRaWAN.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express.js, TypeScript |
| **Frontend** | Next.js 16, React 19, TypeScript |
| **Database** | SQLite3 (better-sqlite3, embedded) |
| **Styling** | Tailwind CSS v4, Radix UI, shadcn |
| **Charts** | Recharts, custom SVG heatmaps |
| **Animations** | Framer Motion |
| **Real-time** | Server-Sent Events (SSE) + polling fallback |
| **Protocols** | LoRaWAN webhooks (TTN, ChirpStack, generic) |
| **Deployment** | Docker multi-stage build, Docker Compose |
| **Tunneling** | ngrok, Cloudflare Tunnel, Caddy (HTTPS) |

---

## What It Does

- **Ingests** LoRaWAN uplink webhooks from multiple providers (TTN, ChirpStack, generic)
- **Parses** meter values from 10+ possible payload field paths (OBIS codes, base64 ASCII, compact formats)
- **Stores** readings, raw uplinks, device telemetry, and anomaly events in SQLite
- **Streams** live updates to the browser via SSE
- **Visualizes** consumption patterns with daily/monthly/yearly charts, hourly breakdowns, heatmaps, battery drain, signal quality, and anomaly detection
- **Controls** devices remotely via TTN downlinks (change reporting interval, trigger recalibration)
- **Detects** anomalies automatically and can self-recalibrate meters via downlink commands

---

## Systems Integration Overview

```
  TTN / ChirpStack
        |
        v  (webhook POST)
  +--------------+
  |   Express    |  Webhook ingestion, payload parsing,
  |   Backend    |  anomaly detection, downlink commands
  +--------------+
        |
   SQLite3 DB        SSE stream
        |                |
        v                v
  +--------------+   +-------------+
  |   REST API   |-->|  Next.js    |
  |   /api/*     |   |  Frontend   |
  +--------------+   +-------------+
                          |
                          v
                    Live Dashboard
```

Key integrations:
- **Webhook receivers** for TTN, ChirpStack, and generic LoRaWAN providers
- **TTN Downlink API** for remote device control (interval changes, meter recalibration)
- **SSE + polling hybrid** for real-time updates that work behind reverse proxies
- **Automatic anomaly detection** with configurable thresholds and cooldowns
- **SLP profile estimation** (German gas Standardlastprofil) for filling missing monthly data

---

## Quick Start

```bash
# Clone and run with Docker
docker compose up --build

# The app is available at http://localhost:8000
```

Point your TTN or ChirpStack webhook integration to:
- `http://<host>:8000/webhooks/ttn`
- `http://<host>:8000/webhooks/chirpstack`
- `http://<host>:8000/webhooks/lorawan` (generic)

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CHIRPSTACK_WEBHOOK_TOKEN` | — | Webhook auth token |
| `TTN_DOWNLINK_API_KEY` | — | TTN API key for downlink commands |
| `TTN_API_BASE` | `https://eu1.cloud.thethings.network` | TTN API endpoint |
| `UI_TIMEZONE` | `Europe/Berlin` | Default timezone for analytics |
| `UI_DAYS` | `30` | Default chart range in days |
| `AUTO_RECAL_DEFAULT_ENABLED` | `1` | Enable auto-recalibration |
| `AUTO_RECAL_DEFAULT_QMAX_FACTOR` | `6` | Anomaly detection sensitivity |
| `AUTO_RECAL_DEFAULT_MIN_JUMP` | `100000` | Minimum meter jump threshold |
| `AUTO_RECAL_DEFAULT_COOLDOWN_MIN` | `180` | Cooldown between recalibrations (min) |
| `TTN_DEFAULT_F_PORT` | `15` | LoRa FPort for downlinks |

---

## Deployment Options

Multiple Docker Compose configurations are provided:

| File | Use Case |
|---|---|
| `compose.yaml` | Default (port 8000 + ngrok) |
| `compose.production.yaml` | Production with Cloudflare Tunnel |
| `compose.nginx.yaml` | Behind Nginx reverse proxy |
| `compose.https.yaml` | HTTPS via Caddy |
| `compose.ngrok.yaml` | ngrok tunnel (free) |
| `compose.ngrok.domain.yaml` | ngrok with reserved domain |
| `compose.tunnel.yaml` | Cloudflare Tunnel |
| `compose.edge.yaml` | Edge deployment |

---

## Project Structure

```
ttn-chirpstack-webhook/
├── src/
│   ├── server.ts          # Express: webhooks, REST API, SSE, downlinks
│   └── db.ts              # SQLite schema, queries, anomaly detection
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js pages (dashboard, device detail, failures)
│   │   ├── components/    # UI components, charts, panels
│   │   └── lib/           # API client, types, hooks, formatters
│   └── package.json
├── Dockerfile             # Multi-stage build (frontend + backend)
├── compose*.yaml          # Deployment variants
└── package.json           # Backend dependencies
```

---

## Device Types Supported

- Gas meters
- Water meters
- Electricity meters (Ferraris / pulse-based)
- Electricity meters (SML / smart meter language)

---

## Dashboard Features

- Real-time device cards with sparkline consumption charts
- Daily / monthly / yearly consumption with SLP-based gap filling
- Consumption heatmap (hours x days, monthly navigation)
- Hourly consumption breakdown
- Battery voltage and drain rate monitoring
- RSSI / SNR signal quality tracking
- IMU acceleration data (for tilt/tamper detection)
- SML instantaneous power charts
- Anomaly event log with automatic detection
- Payload explorer for raw uplink inspection
- Data export (CSV / JSON)
- Remote device control (interval, recalibration)
- Uplink streak and failure analysis

---

*Built with Claude Code.*
