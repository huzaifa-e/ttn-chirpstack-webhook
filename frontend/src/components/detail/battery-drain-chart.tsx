"use client"

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Brush } from "recharts"
import type { Reading } from "@/lib/types"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"

interface DrainPoint {
  time: string
  drain: number
}

function computeHourlyDrain(readings: Reading[]): DrainPoint[] {
  const sorted = readings
    .filter((r) => r.battery_mv != null)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  if (sorted.length < 2) return []

  const hourlyMap = new Map<string, { first: number; last: number; firstTime: number; lastTime: number }>()

  for (const r of sorted) {
    const d = new Date(r.at)
    const key = `${d.toLocaleDateString("de-DE")} ${String(d.getHours()).padStart(2, "0")}:00`
    const existing = hourlyMap.get(key)
    if (existing) {
      existing.last = r.battery_mv!
      existing.lastTime = d.getTime()
    } else {
      hourlyMap.set(key, { first: r.battery_mv!, last: r.battery_mv!, firstTime: d.getTime(), lastTime: d.getTime() })
    }
  }

  return Array.from(hourlyMap.entries())
    .filter(([, v]) => v.firstTime !== v.lastTime)
    .map(([time, v]) => ({
      time,
      drain: v.first - v.last, // positive = drain, negative = charge
    }))
}

export function BatteryDrainChart({ readings }: { readings: Reading[] }) {
  const data = computeHourlyDrain(readings)
  if (!data.length) return <ChartEmpty label="Stündlicher Batterie-Verbrauch" />

  return (
    <ChartWrapper label="Stündlicher Batterie-Verbrauch">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10 }} label={{ value: "mV/h", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }} />
          <Bar dataKey="drain" name="Verbrauch (mV/h)">
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.drain >= 0 ? "#ef4444" : "#10b981"} />
            ))}
          </Bar>
          <Brush dataKey="time" height={25} fill="rgba(100,100,100,0.1)" stroke="#a1a1aa" travellerWidth={8} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
