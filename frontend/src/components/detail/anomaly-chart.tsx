"use client"

import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts"
import type { Anomaly } from "@/lib/types"
import { formatChartNumber } from "@/lib/formatters"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"

const EVENT_COLORS: Record<string, string> = {
  overshoot: "#ef4444",
  auto_recalibrate: "#f97316",
  manual_recalibrate: "#3b82f6",
}

export function AnomalyChart({ anomalies }: { anomalies: Anomaly[] }) {
  if (!anomalies.length) return <ChartEmpty label="Anomalien (OCR/Overshoot)" />

  const data = anomalies.map((a) => ({
    time: new Date(a.at).toLocaleString("de-DE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    jump: a.jump ?? 0,
    threshold: a.threshold ?? 0,
    event_type: a.event_type,
    meter_value: a.meter_value,
    previous_value: a.previous_value,
    action: a.action,
    x: new Date(a.at).getTime(),
  }))

  return (
    <ChartWrapper label="Anomalien (OCR/Overshoot)">
      <ResponsiveContainer width="100%" height={250}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis
            dataKey="x"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => new Date(v).toLocaleDateString("de-DE", { month: "short", day: "numeric" })}
            tick={{ fontSize: 9 }}
          />
          <YAxis dataKey="jump" tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} label={{ value: "Sprung", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip
            contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }}
            formatter={(value) => [typeof value === "number" ? value.toFixed(2) : String(value ?? "")]}
          />
          <Scatter data={data} name="Anomalien">
            {data.map((entry, index) => (
              <Cell key={index} fill={EVENT_COLORS[entry.event_type] || "#6b7280"} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="text-left py-1.5 px-2 text-zinc-500 font-medium">Zeit</th>
              <th className="text-left py-1.5 px-2 text-zinc-500 font-medium">Typ</th>
              <th className="text-right py-1.5 px-2 text-zinc-500 font-medium">Vorher</th>
              <th className="text-right py-1.5 px-2 text-zinc-500 font-medium">Nachher</th>
              <th className="text-right py-1.5 px-2 text-zinc-500 font-medium">Sprung</th>
              <th className="text-right py-1.5 px-2 text-zinc-500 font-medium">Schwelle</th>
              <th className="text-left py-1.5 px-2 text-zinc-500 font-medium">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {anomalies.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <td className="py-1.5 px-2 text-zinc-700 dark:text-zinc-300">{new Date(a.at).toLocaleString("de-DE")}</td>
                <td className="py-1.5 px-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ color: EVENT_COLORS[a.event_type] || "#6b7280", backgroundColor: `${EVENT_COLORS[a.event_type] || "#6b7280"}15` }}>
                    {a.event_type}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-right text-zinc-700 dark:text-zinc-300">{a.previous_value?.toFixed(2) ?? "—"}</td>
                <td className="py-1.5 px-2 text-right text-zinc-700 dark:text-zinc-300">{a.meter_value?.toFixed(2) ?? "—"}</td>
                <td className="py-1.5 px-2 text-right font-semibold text-red-500">{a.jump?.toFixed(2) ?? "—"}</td>
                <td className="py-1.5 px-2 text-right text-zinc-500">{a.threshold?.toFixed(2) ?? "—"}</td>
                <td className="py-1.5 px-2 text-zinc-500">{a.action ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartWrapper>
  )
}
