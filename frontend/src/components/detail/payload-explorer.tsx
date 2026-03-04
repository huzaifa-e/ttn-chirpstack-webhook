"use client"

import { useState, useMemo } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import type { Uplink } from "@/lib/types"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"

function extractNumericFields(uplinks: Uplink[]): string[] {
  const fields = new Set<string>()
  for (const u of uplinks) {
    const d = u.decoded_json || u.payload_json
    if (!d || typeof d !== "object") continue
    for (const [key, val] of Object.entries(d)) {
      if (typeof val === "number") fields.add(key)
    }
  }
  return Array.from(fields).sort()
}

export function PayloadExplorer({ uplinks }: { uplinks: Uplink[] }) {
  const fields = useMemo(() => extractNumericFields(uplinks), [uplinks])
  const [selectedField, setSelectedField] = useState(fields[0] || "")

  const data = useMemo(() => {
    if (!selectedField) return []
    return uplinks
      .filter((u) => {
        const d = u.decoded_json || u.payload_json
        return d && typeof (d as Record<string, unknown>)[selectedField] === "number"
      })
      .map((u) => {
        const d = (u.decoded_json || u.payload_json) as Record<string, number>
        return {
          time: new Date(u.at).toLocaleString("de-DE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          value: d[selectedField],
        }
      })
  }, [uplinks, selectedField])

  if (!fields.length) return <ChartEmpty label="Payload Explorer" />

  return (
    <ChartWrapper label="Payload Explorer">
      <div className="mb-3">
        <select
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {fields.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
            <XAxis dataKey="time" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }} />
            <Line dataKey="value" name={selectedField} stroke="#06b6d4" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-xs text-zinc-400 py-8 text-center">Keine numerischen Daten für &quot;{selectedField}&quot;</p>
      )}
    </ChartWrapper>
  )
}
