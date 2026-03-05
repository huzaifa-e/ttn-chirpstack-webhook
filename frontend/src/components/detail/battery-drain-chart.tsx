"use client"

import { useMemo } from "react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceArea, ReferenceLine } from "recharts"
import type { Reading } from "@/lib/types"
import { formatChartNumber } from "@/lib/formatters"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"
import { useChartZoom } from "./use-chart-zoom"

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
  const data = useMemo(() => computeHourlyDrain(readings), [readings])
  const zoom = useChartZoom(data, "time")
  if (!data.length) return <ChartEmpty label="Stündlicher Batterie-Verbrauch" />

  return (
    <ChartWrapper label="Stündlicher Batterie-Verbrauch" isZoomed={zoom.isZoomed} onReset={zoom.resetZoom} containerRef={zoom.containerRef} isDragging={zoom.isDragging} onDoubleClick={zoom.onDoubleClick}>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={zoom.zoomedData} {...zoom.chartProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} label={{ value: "mV/h", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }} formatter={(value, name) => [formatChartNumber(value), String(name)]} />
          <Bar dataKey="drain" name="Verbrauch (mV/h)" isAnimationActive={false}>
            {zoom.zoomedData.map((entry, index) => (
              <Cell key={index} fill={entry.drain >= 0 ? "#ef4444" : "#10b981"} />
            ))}
          </Bar>
          {zoom.refAreaLeft && zoom.refAreaRight && (
            <>
              <ReferenceArea x1={zoom.refAreaLeft} x2={zoom.refAreaRight} stroke="#3b82f6" strokeWidth={1.5} strokeOpacity={0.6} fill="#3b82f6" fillOpacity={0.2} />
              <ReferenceLine x={zoom.refAreaLeft} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" />
              <ReferenceLine x={zoom.refAreaRight} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" />
            </>
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
