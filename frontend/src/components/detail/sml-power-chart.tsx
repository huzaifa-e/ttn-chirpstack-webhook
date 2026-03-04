"use client"

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from "recharts"
import type { Uplink } from "@/lib/types"
import { formatChartNumber } from "@/lib/formatters"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"
import { useChartZoom } from "./use-chart-zoom"

export function SMLPowerChart({ uplinks }: { uplinks: Uplink[] }) {
  const data = uplinks
    .filter((u) => {
      const d = u.decoded_json || u.payload_json
      if (!d || typeof d !== "object") return false
      // SML live power is typically in OBIS 16.7.0
      return (d as Record<string, unknown>)["16.7.0"] != null ||
             (d as Record<string, unknown>)["obis_16_7_0"] != null ||
             (d as Record<string, unknown>)["power"] != null ||
             (d as Record<string, unknown>)["leistung"] != null
    })
    .map((u) => {
      const d = (u.decoded_json || u.payload_json) as Record<string, unknown>
      const power = Number(d["16.7.0"] ?? d["obis_16_7_0"] ?? d["power"] ?? d["leistung"] ?? 0)
      return {
        time: new Date(u.at).toLocaleString("de-DE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        power: power / 1000, // Convert W to kW
      }
    })

  const zoom = useChartZoom(data, "time")
  if (!data.length) return <ChartEmpty label="SML Momentanleistung" />

  return (
    <ChartWrapper label="SML Momentanleistung" isZoomed={zoom.isZoomed} onReset={zoom.resetZoom} containerRef={zoom.containerRef}>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={zoom.zoomedData} {...zoom.chartProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} label={{ value: "kW", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }} formatter={(value, name) => [formatChartNumber(value), String(name)]} />
          <Line dataKey="power" name="Leistung (kW)" stroke="#a855f7" strokeWidth={2} dot={false} />
          {zoom.refAreaLeft && zoom.refAreaRight && (
            <ReferenceArea x1={zoom.refAreaLeft} x2={zoom.refAreaRight} strokeOpacity={0.3} fill="#a855f7" fillOpacity={0.15} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
