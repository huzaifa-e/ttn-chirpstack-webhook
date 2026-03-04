"use client"

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea } from "recharts"
import type { DailyConsumption } from "@/lib/types"
import { formatChartNumber } from "@/lib/formatters"
import { useChartZoom } from "./use-chart-zoom"
import type { RefObject } from "react"

const TOOLTIP_STYLE = { fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }

export function DailyConsumptionChart({ data, unit }: { data: DailyConsumption[]; unit: string }) {
  const zoom = useChartZoom(data, "date")
  if (!data.length) return <ChartEmpty label="Tagesverbrauch" />

  return (
    <ChartWrapper label="Tagesverbrauch" isZoomed={zoom.isZoomed} onReset={zoom.resetZoom} containerRef={zoom.containerRef}>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={zoom.zoomedData} {...zoom.chartProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-zinc-400" />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} className="text-zinc-400" label={{ value: unit, angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [formatChartNumber(value), String(name)]} />
          <Bar dataKey="consumption" name={`Verbrauch (${unit})`} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          {zoom.refAreaLeft && zoom.refAreaRight && (
            <ReferenceArea x1={zoom.refAreaLeft} x2={zoom.refAreaRight} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.15} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

export function MeterBatteryChart({ unit, readings }: { unit: string; readings: { at: string; battery_mv: number | null; meter_value: number | null }[] }) {
  const chartData = readings
    .filter((r) => r.meter_value != null || r.battery_mv != null)
    .map((r) => ({
      time: new Date(r.at).toLocaleString("de-DE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      meter_value: r.meter_value,
      battery_mv: r.battery_mv,
    }))

  const zoom = useChartZoom(chartData, "time")
  if (!chartData.length) return <ChartEmpty label="Zählerstand & Batterie" />

  return (
    <ChartWrapper label="Zählerstand & Batterie" isZoomed={zoom.isZoomed} onReset={zoom.resetZoom} containerRef={zoom.containerRef}>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={zoom.zoomedData} {...zoom.chartProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} className="text-zinc-400" />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} className="text-zinc-400" label={{ value: unit, angle: -90, position: "insideLeft", style: { fontSize: 10 } }} domain={["dataMin", "dataMax"]} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} className="text-zinc-400" label={{ value: "mV", angle: 90, position: "insideRight", style: { fontSize: 10 } }} domain={["dataMin - 50", "dataMax + 50"]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [formatChartNumber(value), String(name)]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line yAxisId="left" dataKey="meter_value" name="Zählerstand" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line yAxisId="right" dataKey="battery_mv" name="Batterie (mV)" stroke="#eab308" strokeWidth={2} dot={false} />
          {zoom.refAreaLeft && zoom.refAreaRight && (
            <ReferenceArea yAxisId="left" x1={zoom.refAreaLeft} x2={zoom.refAreaRight} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.15} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

interface ChartWrapperProps {
  label: string
  children: React.ReactNode
  isZoomed?: boolean
  onReset?: () => void
  containerRef?: RefObject<HTMLDivElement | null>
}

function ChartWrapper({ label, children, isZoomed, onReset, containerRef }: ChartWrapperProps) {
  return (
    <div
      ref={containerRef}
      className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-4 select-none"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{label}</h3>
        {isZoomed && onReset && (
          <button
            onClick={onReset}
            className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            ↩ Zoom zurücksetzen
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-4">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">{label}</h3>
      <p className="text-xs text-zinc-400 py-8 text-center">Keine Daten vorhanden</p>
    </div>
  )
}

export { ChartWrapper, ChartEmpty }
