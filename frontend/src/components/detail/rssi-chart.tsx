"use client"

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import type { Reading } from "@/lib/types"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"

export function RSSIChart({ readings }: { readings: Reading[] }) {
  const data = readings
    .filter((r) => r.rssi != null)
    .map((r) => ({
      time: new Date(r.at).toLocaleString("de-DE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      rssi: r.rssi,
      snr: r.snr,
    }))

  if (!data.length) return <ChartEmpty label="RSSI & SNR" />

  return (
    <ChartWrapper label="RSSI & SNR">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
          <YAxis yAxisId="rssi" tick={{ fontSize: 10 }} label={{ value: "dBm", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <YAxis yAxisId="snr" orientation="right" tick={{ fontSize: 10 }} label={{ value: "dB", angle: 90, position: "insideRight", style: { fontSize: 10 } }} />
          <Tooltip contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line yAxisId="rssi" dataKey="rssi" name="RSSI (dBm)" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line yAxisId="snr" dataKey="snr" name="SNR (dB)" stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
