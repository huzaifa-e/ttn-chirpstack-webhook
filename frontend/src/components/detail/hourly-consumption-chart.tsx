"use client"

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from "recharts"
import type { Reading } from "@/lib/types"
import { formatChartNumber } from "@/lib/formatters"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"
import { useChartZoom } from "./use-chart-zoom"

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
  const zoom = useChartZoom(data, "hour")
  if (!data.length) return <ChartEmpty label="Stündlicher Verbrauch" />

  return (
    <ChartWrapper label="Stündlicher Verbrauch" isZoomed={zoom.isZoomed} onReset={zoom.resetZoom} containerRef={zoom.containerRef}>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={zoom.zoomedData} {...zoom.chartProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="hour" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} label={{ value: unit, angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }} formatter={(value, name) => [formatChartNumber(value), String(name)]} />
          <Bar dataKey="consumption" name={`Verbrauch (${unit})`} fill="#8b5cf6" radius={[3, 3, 0, 0]} />
          {zoom.refAreaLeft && zoom.refAreaRight && (
            <ReferenceArea x1={zoom.refAreaLeft} x2={zoom.refAreaRight} strokeOpacity={0.3} fill="#8b5cf6" fillOpacity={0.15} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
