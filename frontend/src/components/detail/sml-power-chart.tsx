"use client"

import { useMemo } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine, Legend } from "recharts"
import type { Uplink } from "@/lib/types"
import { formatChartNumber } from "@/lib/formatters"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"
import { useChartZoom } from "./use-chart-zoom"

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function SMLPowerChart({ uplinks }: { uplinks: Uplink[] }) {
  const data = useMemo(
    () =>
      uplinks
        .filter((u) => {
          const d = u.decoded_json || u.payload_json
          if (!d || typeof d !== "object") return false
          return (d as Record<string, unknown>)["16.7.0"] != null ||
                 (d as Record<string, unknown>)["obis_16_7_0"] != null ||
                 (d as Record<string, unknown>)["18.7.0"] != null ||
                 (d as Record<string, unknown>)["obis_18_7_0"] != null ||
                 (d as Record<string, unknown>)["power"] != null ||
                 (d as Record<string, unknown>)["leistung"] != null
        })
        .map((u) => {
          const d = (u.decoded_json || u.payload_json) as Record<string, unknown>
          const powerRaw = asNumber(d["16.7.0"] ?? d["obis_16_7_0"] ?? d["power"] ?? d["leistung"] ?? 0) ?? 0
          const inhouseRaw = asNumber(d["18.7.0"] ?? d["obis_18_7_0"])
          return {
            time: new Date(u.at).toLocaleString("de-DE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
            power: powerRaw / 1000,
            inhousePower: inhouseRaw != null ? inhouseRaw / 1000 : null,
          }
        }),
    [uplinks],
  )

  const hasInhouseOverlay = useMemo(() => data.some((point) => point.inhousePower != null), [data])

  const zoom = useChartZoom(data, "time")
  if (!data.length) return <ChartEmpty label="SML Momentanleistung" />

  return (
    <ChartWrapper label="SML Momentanleistung" isZoomed={zoom.isZoomed} onReset={zoom.resetZoom} containerRef={zoom.containerRef} isDragging={zoom.isDragging} onDoubleClick={zoom.onDoubleClick}>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={zoom.zoomedData} {...zoom.chartProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} label={{ value: "kW", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }} formatter={(value, name) => [formatChartNumber(value), String(name)]} />
          {hasInhouseOverlay && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Line dataKey="power" name="Leistung (kW)" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="inhousePower" name="Inhouse Live (18.7.0) (kW)" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} isAnimationActive={false} />
          {zoom.refAreaLeft && zoom.refAreaRight && (
            <>
              <ReferenceArea x1={zoom.refAreaLeft} x2={zoom.refAreaRight} stroke="#a855f7" strokeWidth={1.5} strokeOpacity={0.6} fill="#a855f7" fillOpacity={0.2} />
              <ReferenceLine x={zoom.refAreaLeft} stroke="#a855f7" strokeWidth={1.5} strokeDasharray="4 2" />
              <ReferenceLine x={zoom.refAreaRight} stroke="#a855f7" strokeWidth={1.5} strokeDasharray="4 2" />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
