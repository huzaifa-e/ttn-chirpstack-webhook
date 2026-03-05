"use client"

import { useMemo } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine } from "recharts"
import type { Reading } from "@/lib/types"
import { formatChartNumber } from "@/lib/formatters"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"
import { useChartZoom } from "./use-chart-zoom"

export function BatteryChart({ readings }: { readings: Reading[] }) {
  const data = useMemo(
    () =>
      readings
        .filter((r) => r.battery_mv != null)
        .map((r) => ({
          time: new Date(r.at).toLocaleString("de-DE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          battery_mv: r.battery_mv,
          meter_value: r.meter_value,
        })),
    [readings],
  )

  const zoom = useChartZoom(data, "time")
  if (!data.length) return <ChartEmpty label="Batteriespannung" />

  return (
    <ChartWrapper label="Batteriespannung" isZoomed={zoom.isZoomed} onReset={zoom.resetZoom} containerRef={zoom.containerRef} isDragging={zoom.isDragging} onDoubleClick={zoom.onDoubleClick}>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={zoom.zoomedData} {...zoom.chartProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} domain={["dataMin - 50", "dataMax + 50"]} label={{ value: "mV", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip
            contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }}
            formatter={(value) => [`${formatChartNumber(value)} mV`, "Batterie"]}
          />
          <Line dataKey="battery_mv" name="Batterie" stroke="#eab308" strokeWidth={2} dot={false} isAnimationActive={false} />
          {zoom.refAreaLeft && zoom.refAreaRight && (
            <>
              <ReferenceArea x1={zoom.refAreaLeft} x2={zoom.refAreaRight} stroke="#eab308" strokeWidth={1.5} strokeOpacity={0.6} fill="#eab308" fillOpacity={0.2} />
              <ReferenceLine x={zoom.refAreaLeft} stroke="#eab308" strokeWidth={1.5} strokeDasharray="4 2" />
              <ReferenceLine x={zoom.refAreaRight} stroke="#eab308" strokeWidth={1.5} strokeDasharray="4 2" />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
