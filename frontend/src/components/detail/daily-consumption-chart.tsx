"use client"

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush } from "recharts"
import type { DailyConsumption } from "@/lib/types"

const BRUSH_STYLE = { fill: "rgba(100,100,100,0.1)", stroke: "#a1a1aa", height: 25 }
const TOOLTIP_STYLE = { fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }

export function DailyConsumptionChart({ data, unit }: { data: DailyConsumption[]; unit: string }) {
  if (!data.length) return <ChartEmpty label="Tagesverbrauch" />

  return (
    <ChartWrapper label="Tagesverbrauch">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-zinc-400" />
          <YAxis tick={{ fontSize: 10 }} className="text-zinc-400" label={{ value: unit, angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="consumption" name={`Verbrauch (${unit})`} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Brush dataKey="date" {...BRUSH_STYLE} travellerWidth={8} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

export function MeterBatteryChart({ unit, readings }: { unit: string; readings: { at: string; battery_mv: number | null; meter_value: number | null }[] }) {
  // Use every individual reading for full resolution
  const chartData = readings
    .filter((r) => r.meter_value != null || r.battery_mv != null)
    .map((r) => ({
      time: new Date(r.at).toLocaleString("de-DE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      meter_value: r.meter_value,
      battery_mv: r.battery_mv,
    }))

  if (!chartData.length) return <ChartEmpty label="Zählerstand & Batterie" />

  return (
    <ChartWrapper label="Zählerstand & Batterie">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} className="text-zinc-400" />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} className="text-zinc-400" label={{ value: unit, angle: -90, position: "insideLeft", style: { fontSize: 10 } }} domain={["dataMin", "dataMax"]} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} className="text-zinc-400" label={{ value: "mV", angle: 90, position: "insideRight", style: { fontSize: 10 } }} domain={["dataMin - 50", "dataMax + 50"]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line yAxisId="left" dataKey="meter_value" name="Zählerstand" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line yAxisId="right" dataKey="battery_mv" name="Batterie (mV)" stroke="#eab308" strokeWidth={2} dot={false} />
          <Brush dataKey="time" {...BRUSH_STYLE} travellerWidth={8} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

function ChartWrapper({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-4">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">{label}</h3>
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
