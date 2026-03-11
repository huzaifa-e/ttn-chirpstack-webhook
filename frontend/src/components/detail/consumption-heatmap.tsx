"use client"

import { useMemo, useState, useRef, useCallback, useEffect } from "react"
import type { Reading } from "@/lib/types"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"
import { formatChartNumber } from "@/lib/formatters"

/* ── colour helpers ─────────────────────────────────────────────── */

/** Interpolate between blue → cyan → green → yellow → red */
function valueToColor(t: number): string {
  // t is 0..1, clamped
  const c = Math.max(0, Math.min(1, t))

  // 5-stop gradient: blue → cyan → green → yellow → red
  const stops: [number, number, number][] = [
    [59, 130, 246],   // blue-500
    [6, 182, 212],    // cyan-500
    [34, 197, 94],    // green-500
    [234, 179, 8],    // yellow-500
    [239, 68, 68],    // red-500
  ]
  const idx = c * (stops.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, stops.length - 1)
  const f = idx - lo
  const r = Math.round(stops[lo][0] + (stops[hi][0] - stops[lo][0]) * f)
  const g = Math.round(stops[lo][1] + (stops[hi][1] - stops[lo][1]) * f)
  const b = Math.round(stops[lo][2] + (stops[hi][2] - stops[lo][2]) * f)
  return `rgb(${r},${g},${b})`
}

const NO_DATA_COLOR = "rgba(128,128,128,0.1)"

/* ── data processing ────────────────────────────────────────────── */

interface HeatCell {
  date: string      // YYYY-MM-DD
  hour: number      // 0-23
  consumption: number
}

function buildHeatmapData(readings: Reading[]): { cells: HeatCell[]; dates: string[]; min: number; max: number } {
  if (readings.length < 2) return { cells: [], dates: [], min: 0, max: 0 }

  const sorted = [...readings].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  // Group readings by date+hour
  const buckets = new Map<string, { first: number; last: number }>()

  for (const r of sorted) {
    const d = new Date(r.at)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const key = `${dateStr}|${d.getHours()}`
    const existing = buckets.get(key)
    if (existing) {
      existing.last = r.meter_value
    } else {
      buckets.set(key, { first: r.meter_value, last: r.meter_value })
    }
  }

  const cells: HeatCell[] = []
  const dateSet = new Set<string>()
  let min = Infinity
  let max = -Infinity

  for (const [key, { first, last }] of buckets) {
    const [date, hourStr] = key.split("|")
    const consumption = Math.max(0, last - first)
    if (consumption > 0) {
      cells.push({ date, hour: Number(hourStr), consumption })
      dateSet.add(date)
      if (consumption < min) min = consumption
      if (consumption > max) max = consumption
    } else {
      cells.push({ date, hour: Number(hourStr), consumption: 0 })
      dateSet.add(date)
    }
  }

  if (min === Infinity) { min = 0; max = 0 }

  const dates = Array.from(dateSet).sort()
  return { cells, dates, min, max }
}

/* ── tooltip ────────────────────────────────────────────────────── */

interface TooltipInfo {
  x: number
  y: number
  date: string
  hour: number
  consumption: number
}

/* ── component ──────────────────────────────────────────────────── */

export function ConsumptionHeatmap({ readings, unit }: { readings: Reading[]; unit: string }) {
  const { cells, dates, min, max } = useMemo(() => buildHeatmapData(readings), [readings])
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Observe container width for responsive sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Determine which cell is hovered
      const cellW = (containerWidth - MARGIN.left - MARGIN.right) / dates.length
      const cellH = (SVG_HEIGHT - MARGIN.top - MARGIN.bottom) / 24
      const col = Math.floor((mouseX - MARGIN.left) / cellW)
      const row = Math.floor((mouseY - MARGIN.top) / cellH)

      if (col < 0 || col >= dates.length || row < 0 || row >= 24) {
        setTooltip(null)
        return
      }

      const date = dates[col]
      const hour = row
      const cell = cells.find((c) => c.date === date && c.hour === hour)

      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        date,
        hour,
        consumption: cell?.consumption ?? 0,
      })
    },
    [dates, cells, containerWidth],
  )

  if (!cells.length || !dates.length) return <ChartEmpty label="Verbrauchs-Heatmap" />

  // Build a fast lookup
  const cellMap = new Map<string, number>()
  for (const c of cells) cellMap.set(`${c.date}|${c.hour}`, c.consumption)

  const MARGIN = { top: 20, right: 20, bottom: 60, left: 45 }
  const SVG_HEIGHT = 360
  const chartW = containerWidth - MARGIN.left - MARGIN.right
  const chartH = SVG_HEIGHT - MARGIN.top - MARGIN.bottom
  const cellW = dates.length > 0 ? chartW / dates.length : 0
  const cellH = chartH / 24

  // Determine x-axis tick interval to avoid overlap
  const maxLabels = Math.floor(chartW / 50)
  const tickInterval = Math.max(1, Math.ceil(dates.length / maxLabels))

  const range = max - min

  // Legend dimensions
  const LEGEND_W = 200
  const LEGEND_H = 10
  const legendX = MARGIN.left + (chartW - LEGEND_W) / 2
  const legendY = SVG_HEIGHT - 18

  return (
    <ChartWrapper label="Verbrauchs-Heatmap">
      <div ref={containerRef} className="w-full" style={{ minHeight: SVG_HEIGHT }}>
        {containerWidth > 0 && (
          <svg
            ref={svgRef}
            width={containerWidth}
            height={SVG_HEIGHT}
            className="select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Grid cells */}
            {dates.map((date, col) =>
              Array.from({ length: 24 }, (_, hour) => {
                const val = cellMap.get(`${date}|${hour}`)
                const color =
                  val === undefined
                    ? NO_DATA_COLOR
                    : range > 0
                      ? valueToColor((val - min) / range)
                      : valueToColor(0.5)

                return (
                  <rect
                    key={`${col}-${hour}`}
                    x={MARGIN.left + col * cellW}
                    y={MARGIN.top + hour * cellH}
                    width={Math.max(cellW - 0.5, 1)}
                    height={Math.max(cellH - 0.5, 1)}
                    fill={color}
                    rx={1}
                  />
                )
              }),
            )}

            {/* Y-axis: hours */}
            {Array.from({ length: 24 }, (_, h) => (
              <text
                key={h}
                x={MARGIN.left - 4}
                y={MARGIN.top + h * cellH + cellH / 2}
                textAnchor="end"
                dominantBaseline="central"
                className="fill-zinc-400 dark:fill-zinc-500"
                fontSize={9}
              >
                {String(h).padStart(2, "0")}:00
              </text>
            ))}

            {/* Y-axis label */}
            <text
              x={10}
              y={MARGIN.top + chartH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(-90, 10, ${MARGIN.top + chartH / 2})`}
              className="fill-zinc-500 dark:fill-zinc-400"
              fontSize={10}
              fontWeight={500}
            >
              Uhrzeit
            </text>

            {/* X-axis: dates */}
            {dates.map((date, i) => {
              if (i % tickInterval !== 0) return null
              const d = new Date(date + "T00:00:00")
              const label = d.toLocaleDateString("de-DE", { day: "2-digit", month: "short" })
              return (
                <text
                  key={date}
                  x={MARGIN.left + i * cellW + cellW / 2}
                  y={MARGIN.top + chartH + 12}
                  textAnchor="end"
                  className="fill-zinc-400 dark:fill-zinc-500"
                  fontSize={9}
                  transform={`rotate(-45, ${MARGIN.left + i * cellW + cellW / 2}, ${MARGIN.top + chartH + 12})`}
                >
                  {label}
                </text>
              )
            })}

            {/* Colour legend */}
            <defs>
              <linearGradient id="heatmap-legend-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={valueToColor(0)} />
                <stop offset="25%" stopColor={valueToColor(0.25)} />
                <stop offset="50%" stopColor={valueToColor(0.5)} />
                <stop offset="75%" stopColor={valueToColor(0.75)} />
                <stop offset="100%" stopColor={valueToColor(1)} />
              </linearGradient>
            </defs>
            <rect x={legendX} y={legendY} width={LEGEND_W} height={LEGEND_H} rx={3} fill="url(#heatmap-legend-gradient)" />
            <text x={legendX} y={legendY - 3} textAnchor="start" className="fill-zinc-400 dark:fill-zinc-500" fontSize={8}>
              {formatChartNumber(min)} {unit}
            </text>
            <text x={legendX + LEGEND_W} y={legendY - 3} textAnchor="end" className="fill-zinc-400 dark:fill-zinc-500" fontSize={8}>
              {formatChartNumber(max)} {unit}
            </text>

            {/* Tooltip */}
            {tooltip && (
              <g style={{ pointerEvents: "none" }}>
                <rect
                  x={Math.min(tooltip.x + 10, containerWidth - 170)}
                  y={Math.max(tooltip.y - 50, 0)}
                  width={160}
                  height={46}
                  rx={6}
                  fill="rgba(0,0,0,0.85)"
                />
                <text
                  x={Math.min(tooltip.x + 18, containerWidth - 162)}
                  y={Math.max(tooltip.y - 50, 0) + 16}
                  fontSize={11}
                  fill="#fff"
                  fontWeight={600}
                >
                  {new Date(tooltip.date + "T00:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                </text>
                <text
                  x={Math.min(tooltip.x + 18, containerWidth - 162)}
                  y={Math.max(tooltip.y - 50, 0) + 34}
                  fontSize={11}
                  fill="#d4d4d8"
                >
                  {String(tooltip.hour).padStart(2, "0")}:00 – {String(tooltip.hour + 1).padStart(2, "0")}:00 · {formatChartNumber(tooltip.consumption)} {unit}
                </text>
              </g>
            )}
          </svg>
        )}
      </div>
    </ChartWrapper>
  )
}
