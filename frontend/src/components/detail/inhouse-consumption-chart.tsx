"use client"

import { useMemo } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine } from "recharts"
import type { Uplink } from "@/lib/types"
import { formatChartNumber } from "@/lib/formatters"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"
import { useChartZoom } from "./use-chart-zoom"

interface InhousePoint {
  time: string
  inhouse: number
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function InhouseConsumptionChart({ uplinks }: { uplinks: Uplink[] }) {
  const data = useMemo<InhousePoint[]>(
    () =>
      uplinks
        .map((u) => {
          const d = (u.decoded_json || u.payload_json) as Record<string, unknown> | null
          if (!d) return null

          const inhouse = toNumber(d["3.8.0"] ?? d["obis_3_8_0"] ?? d["obis3_8_0"])
          if (inhouse == null) return null

          return {
            time: new Date(u.at).toLocaleString("de-DE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
            inhouse,
          }
        })
        .filter((point): point is InhousePoint => point != null),
    [uplinks],
  )

  const zoom = useChartZoom(data, "time")
  if (!data.length) return <ChartEmpty label="Inhouse Verbrauch (OBIS 3.8.0)" />

  return (
    <ChartWrapper label="Inhouse Verbrauch (OBIS 3.8.0)" isZoomed={zoom.isZoomed} onReset={zoom.resetZoom} containerRef={zoom.containerRef} isDragging={zoom.isDragging} onDoubleClick={zoom.onDoubleClick}>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={zoom.zoomedData} {...zoom.chartProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} label={{ value: "kWh", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }} formatter={(value: number | string | undefined, name: string | number) => [formatChartNumber(value), String(name)]} />
          <Line dataKey="inhouse" name="Inhouse Verbrauch (kWh)" stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={false} />
          {zoom.refAreaLeft && zoom.refAreaRight && (
            <>
              <ReferenceArea x1={zoom.refAreaLeft} x2={zoom.refAreaRight} stroke="#0ea5e9" strokeWidth={1.5} strokeOpacity={0.6} fill="#0ea5e9" fillOpacity={0.2} />
              <ReferenceLine x={zoom.refAreaLeft} stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="4 2" />
              <ReferenceLine x={zoom.refAreaRight} stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="4 2" />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
