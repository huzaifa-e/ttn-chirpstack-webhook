"use client"

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import type { Reading } from "@/lib/types"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"

interface HourlyPoint {
  hour: string
  consumption: number
}

function computeHourly(readings: Reading[]): HourlyPoint[] {
  if (readings.length < 2) return []
  const sorted = [...readings].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  const hourlyMap = new Map<string, { first: number; last: number }>()

  for (const r of sorted) {
    const d = new Date(r.at)
    const hourKey = `${d.toLocaleDateString("de-DE")} ${String(d.getHours()).padStart(2, "0")}:00`
    const existing = hourlyMap.get(hourKey)
    if (existing) {
      existing.last = r.meter_value
    } else {
      hourlyMap.set(hourKey, { first: r.meter_value, last: r.meter_value })
    }
  }

  return Array.from(hourlyMap.entries()).map(([hour, { first, last }]) => ({
    hour,
    consumption: Math.max(0, last - first),
  }))
}

export function HourlyConsumptionChart({ readings, unit }: { readings: Reading[]; unit: string }) {
  const data = computeHourly(readings)
  if (!data.length) return <ChartEmpty label="Stündlicher Verbrauch" />

  return (
    <ChartWrapper label="Stündlicher Verbrauch">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="hour" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10 }} label={{ value: unit, angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }} />
          <Bar dataKey="consumption" name={`Verbrauch (${unit})`} fill="#8b5cf6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
