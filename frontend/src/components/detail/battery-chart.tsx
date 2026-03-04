"use client"

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import type { Reading } from "@/lib/types"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"

export function BatteryChart({ readings }: { readings: Reading[] }) {
  const data = readings
    .filter((r) => r.battery_mv != null)
    .map((r) => ({
      time: new Date(r.at).toLocaleString("de-DE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      battery_mv: r.battery_mv,
      meter_value: r.meter_value,
    }))

  if (!data.length) return <ChartEmpty label="Batteriespannung" />

  return (
    <ChartWrapper label="Batteriespannung">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10 }} domain={["dataMin - 50", "dataMax + 50"]} label={{ value: "mV", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip
            contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }}
            formatter={(value) => [`${value} mV`, "Batterie"]}
          />
          <Line dataKey="battery_mv" name="Batterie" stroke="#eab308" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
