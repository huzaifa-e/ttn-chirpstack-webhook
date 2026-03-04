"use client"

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush } from "recharts"
import type { Uplink } from "@/lib/types"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"

export function IMUChart({ uplinks }: { uplinks: Uplink[] }) {
  const data = uplinks
    .filter((u) => {
      const d = u.decoded_json || u.payload_json
      return d && (d.ax != null || d.ay != null || d.az != null)
    })
    .map((u) => {
      const d = (u.decoded_json || u.payload_json) as Record<string, unknown>
      return {
        time: new Date(u.at).toLocaleString("de-DE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        ax: typeof d.ax === "number" ? d.ax : null,
        ay: typeof d.ay === "number" ? d.ay : null,
        az: typeof d.az === "number" ? d.az : null,
      }
    })

  if (!data.length) return <ChartEmpty label="IMU Beschleunigung" />

  return (
    <ChartWrapper label="IMU Beschleunigung">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line dataKey="ax" name="aX" stroke="#ef4444" strokeWidth={1.5} dot={false} />
          <Line dataKey="ay" name="aY" stroke="#10b981" strokeWidth={1.5} dot={false} />
          <Line dataKey="az" name="aZ" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
          <Brush dataKey="time" height={25} fill="rgba(100,100,100,0.1)" stroke="#a1a1aa" travellerWidth={8} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
