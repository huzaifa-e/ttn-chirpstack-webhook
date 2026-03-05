"use client"

import { useMemo } from "react"
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea, ReferenceLine } from "recharts"
import type { DailyConsumption } from "@/lib/types"
import { formatChartNumber } from "@/lib/formatters"
import { useChartZoom } from "./use-chart-zoom"
import type { RefObject } from "react"

const TOOLTIP_STYLE = { fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }

export function DailyConsumptionChart({ data, unit }: { data: DailyConsumption[]; unit: string }) {
  const zoom = useChartZoom(data, "date")
  if (!data.length) return <ChartEmpty label="Tagesverbrauch" />

  return (
    <ChartWrapper label="Tagesverbrauch" isZoomed={zoom.isZoomed} onReset={zoom.resetZoom} containerRef={zoom.containerRef} isDragging={zoom.isDragging} onDoubleClick={zoom.onDoubleClick}>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={zoom.zoomedData} {...zoom.chartProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-zinc-400" />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} className="text-zinc-400" label={{ value: unit, angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [formatChartNumber(value), String(name)]} />
          <Bar dataKey="consumption" name={`Verbrauch (${unit})`} fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          {zoom.refAreaLeft && zoom.refAreaRight && (
            <>
              <ReferenceArea x1={zoom.refAreaLeft} x2={zoom.refAreaRight} stroke="#3b82f6" strokeWidth={1.5} strokeOpacity={0.6} fill="#3b82f6" fillOpacity={0.2} />
              <ReferenceLine x={zoom.refAreaLeft} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" />
              <ReferenceLine x={zoom.refAreaRight} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

export function MeterBatteryChart({ unit, readings }: { unit: string; readings: { at: string; battery_mv: number | null; meter_value: number | null }[] }) {
  const chartData = useMemo(
    () =>
      readings
        .filter((r) => r.meter_value != null || r.battery_mv != null)
        .map((r) => ({
          time: new Date(r.at).toLocaleString("de-DE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          meter_value: r.meter_value,
          battery_mv: r.battery_mv,
        })),
    [readings],
  )

  const zoom = useChartZoom(chartData, "time")
  if (!chartData.length) return <ChartEmpty label="Zählerstand & Batterie" />

  return (
    <ChartWrapper label="Zählerstand & Batterie" isZoomed={zoom.isZoomed} onReset={zoom.resetZoom} containerRef={zoom.containerRef} isDragging={zoom.isDragging} onDoubleClick={zoom.onDoubleClick}>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={zoom.zoomedData} {...zoom.chartProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} className="text-zinc-400" />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} className="text-zinc-400" label={{ value: unit, angle: -90, position: "insideLeft", style: { fontSize: 10 } }} domain={["dataMin", "dataMax"]} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} className="text-zinc-400" label={{ value: "mV", angle: 90, position: "insideRight", style: { fontSize: 10 } }} domain={["dataMin - 50", "dataMax + 50"]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [formatChartNumber(value), String(name)]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line yAxisId="left" dataKey="meter_value" name="Zählerstand" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line yAxisId="right" dataKey="battery_mv" name="Batterie (mV)" stroke="#eab308" strokeWidth={2} dot={false} isAnimationActive={false} />
          {zoom.refAreaLeft && zoom.refAreaRight && (
            <>
              <ReferenceArea yAxisId="left" x1={zoom.refAreaLeft} x2={zoom.refAreaRight} stroke="#3b82f6" strokeWidth={1.5} strokeOpacity={0.6} fill="#3b82f6" fillOpacity={0.2} />
              <ReferenceLine x={zoom.refAreaLeft} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" />
              <ReferenceLine x={zoom.refAreaRight} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" />
            </>
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
  isDragging?: boolean
  onDoubleClick?: () => void
}

function ChartWrapper({ label, children, isZoomed, onReset, containerRef, isDragging, onDoubleClick }: ChartWrapperProps) {
  return (
    <div
      ref={containerRef}
      onDoubleClick={onDoubleClick}
      className={`rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-4 select-none transition-shadow ${isDragging ? "cursor-col-resize ring-2 ring-blue-400/30 shadow-lg shadow-blue-500/10" : "cursor-crosshair"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{label}</h3>
        <div className="flex items-center gap-2">
          {isDragging && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 animate-pulse">
              Bereich auswählen…
            </span>
          )}
          {isZoomed && onReset && (
            <button
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              ↩ Zoom zurücksetzen
            </button>
          )}
        </div>
      </div>
      {children}
      {isZoomed && (
        <p className="text-[10px] text-zinc-400 mt-2 text-center">Doppelklick zum Zurücksetzen · Scrollen zum Zoomen · Ziehen zum Auswählen</p>
      )}
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
