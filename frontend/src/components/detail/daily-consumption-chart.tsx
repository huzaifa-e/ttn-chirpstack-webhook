"use client"

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import type { DailyConsumption } from "@/lib/types"

export function DailyConsumptionChart({ data, unit }: { data: DailyConsumption[]; unit: string }) {
  if (!data.length) return <ChartEmpty label="Tagesverbrauch" />

  return (
    <ChartWrapper label="Tagesverbrauch">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-zinc-400" />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} className="text-zinc-400" label={{ value: unit, angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} className="text-zinc-400" />
          <Tooltip contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="left" dataKey="consumption" name={`Verbrauch (${unit})`} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" dataKey="closing" name="Zählerstand" stroke="#10b981" strokeWidth={2} dot={false} />
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
