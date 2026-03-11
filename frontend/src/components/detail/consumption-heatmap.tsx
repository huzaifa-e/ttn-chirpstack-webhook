"use client"

import { useMemo, useState, useRef, useCallback, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Reading } from "@/lib/types"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"
import { formatChartNumber } from "@/lib/formatters"

/* ── colour helpers ─────────────────────────────────────────────── */

function valueToColor(t: number): string {
  const c = Math.max(0, Math.min(1, t))
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

const NO_DATA_COLOR = "rgba(128,128,128,0.08)"

/* ── data processing ────────────────────────────────────────────── */

interface HeatCell {
  date: string      // YYYY-MM-DD
  day: number       // 1-31
  hour: number      // 0-23
  consumption: number
}

interface MonthData {
  key: string       // YYYY-MM
  label: string     // e.g. "März 2026"
  cells: HeatCell[]
  daysInMonth: number
  min: number
  max: number
}

function buildMonthlyHeatmapData(readings: Reading[]): MonthData[] {
  if (readings.length < 2) return []

  const sorted = [...readings].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  // Group readings by date+hour bucket
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

  // Build cells
  const cellsByMonth = new Map<string, HeatCell[]>()
  for (const [key, { first, last }] of buckets) {
    const [date, hourStr] = key.split("|")
    const monthKey = date.slice(0, 7)
    const day = Number(date.slice(8, 10))
    const consumption = Math.max(0, last - first)
    if (!cellsByMonth.has(monthKey)) cellsByMonth.set(monthKey, [])
    cellsByMonth.get(monthKey)!.push({ date, day, hour: Number(hourStr), consumption })
  }

  // Compute global min/max across ALL months for consistent colour scale
  let globalMin = Infinity
  let globalMax = -Infinity
  for (const cells of cellsByMonth.values()) {
    for (const c of cells) {
      if (c.consumption > 0) {
        if (c.consumption < globalMin) globalMin = c.consumption
        if (c.consumption > globalMax) globalMax = c.consumption
      }
    }
  }
  if (globalMin === Infinity) { globalMin = 0; globalMax = 0 }

  const months: MonthData[] = []
  const sortedKeys = Array.from(cellsByMonth.keys()).sort()
  for (const key of sortedKeys) {
    const cells = cellsByMonth.get(key)!
    const [y, m] = key.split("-").map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const label = new Date(y, m - 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" })
    months.push({ key, label, cells, daysInMonth, min: globalMin, max: globalMax })
  }

  return months
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

const MONTH_NAMES_DE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]

export function ConsumptionHeatmap({ readings, unit }: { readings: Reading[]; unit: string }) {
  const months = useMemo(() => buildMonthlyHeatmapData(readings), [readings])
  const [monthIdx, setMonthIdx] = useState(-1) // -1 = will be set to latest
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Default to latest month
  useEffect(() => {
    if (months.length > 0 && monthIdx === -1) {
      setMonthIdx(months.length - 1)
    }
  }, [months, monthIdx])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const currentMonth = months[monthIdx] ?? months[months.length - 1]

  const cellMap = useMemo(() => {
    if (!currentMonth) return new Map<string, number>()
    const m = new Map<string, number>()
    for (const c of currentMonth.cells) m.set(`${c.day}|${c.hour}`, c.consumption)
    return m
  }, [currentMonth])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!currentMonth || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const MARGIN = { top: 28, right: 12, bottom: 40, left: 42 }
      const days = currentMonth.daysInMonth
      const svgSize = Math.min(containerWidth, 420)
      const chartW = svgSize - MARGIN.left - MARGIN.right
      const chartH = svgSize - MARGIN.top - MARGIN.bottom
      const cellW = chartW / days
      const cellH = chartH / 24

      const col = Math.floor((mouseX - MARGIN.left) / cellW)
      const row = Math.floor((mouseY - MARGIN.top) / cellH)

      if (col < 0 || col >= days || row < 0 || row >= 24) {
        setTooltip(null)
        return
      }

      const day = col + 1
      const hour = row
      const [y, m] = currentMonth.key.split("-")
      const dateStr = `${y}-${m}-${String(day).padStart(2, "0")}`

      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        date: dateStr,
        hour,
        consumption: cellMap.get(`${day}|${hour}`) ?? 0,
      })
    },
    [currentMonth, cellMap, containerWidth],
  )

  if (!months.length || !currentMonth) return <ChartEmpty label="Verbrauchs-Heatmap" />

  const days = currentMonth.daysInMonth
  const range = currentMonth.max - currentMonth.min

  const MARGIN = { top: 28, right: 12, bottom: 40, left: 42 }
  const svgSize = Math.min(containerWidth, 420)
  const chartW = svgSize - MARGIN.left - MARGIN.right
  const chartH = svgSize - MARGIN.top - MARGIN.bottom
  const cellW = chartW / days
  const cellH = chartH / 24

  const LEGEND_W = Math.min(180, chartW * 0.7)
  const LEGEND_H = 8
  const legendX = MARGIN.left + (chartW - LEGEND_W) / 2
  const legendY = svgSize - 12

  const canPrev = monthIdx > 0
  const canNext = monthIdx < months.length - 1

  return (
    <ChartWrapper
      label="Verbrauchs-Heatmap"
      controls={
        <div className="inline-flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); if (canPrev) { setMonthIdx(monthIdx - 1); setTooltip(null) } }}
            disabled={!canPrev}
            className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 min-w-[100px] text-center">
            {currentMonth.label}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); if (canNext) { setMonthIdx(monthIdx + 1); setTooltip(null) } }}
            disabled={!canNext}
            className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      }
    >
      <div ref={containerRef} className="w-full flex justify-center">
        {containerWidth > 0 && svgSize > 0 && (
          <svg
            ref={svgRef}
            width={svgSize}
            height={svgSize}
            className="select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Grid cells */}
            {Array.from({ length: days }, (_, col) =>
              Array.from({ length: 24 }, (_, hour) => {
                const day = col + 1
                const val = cellMap.get(`${day}|${hour}`)
                const color =
                  val === undefined
                    ? NO_DATA_COLOR
                    : val === 0
                      ? NO_DATA_COLOR
                      : range > 0
                        ? valueToColor((val - currentMonth.min) / range)
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

            {/* Y-axis: hours (show every 2h to keep it tidy) */}
            {Array.from({ length: 12 }, (_, i) => {
              const h = i * 2
              return (
                <text
                  key={h}
                  x={MARGIN.left - 4}
                  y={MARGIN.top + h * cellH + cellH}
                  textAnchor="end"
                  dominantBaseline="central"
                  className="fill-zinc-400 dark:fill-zinc-500"
                  fontSize={8}
                >
                  {String(h).padStart(2, "0")}:00
                </text>
              )
            })}

            {/* X-axis: days of month */}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1
              // Show every few days depending on space
              const tickEvery = days > 20 ? 5 : days > 14 ? 3 : 2
              if (day !== 1 && day % tickEvery !== 0) return null
              return (
                <text
                  key={day}
                  x={MARGIN.left + i * cellW + cellW / 2}
                  y={MARGIN.top + chartH + 12}
                  textAnchor="middle"
                  className="fill-zinc-400 dark:fill-zinc-500"
                  fontSize={8}
                >
                  {day}
                </text>
              )
            })}

            {/* X-axis label */}
            <text
              x={MARGIN.left + chartW / 2}
              y={MARGIN.top + chartH + 24}
              textAnchor="middle"
              className="fill-zinc-500 dark:fill-zinc-400"
              fontSize={9}
            >
              Tag des Monats
            </text>

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
            <text x={legendX} y={legendY - 3} textAnchor="start" className="fill-zinc-400 dark:fill-zinc-500" fontSize={7}>
              {formatChartNumber(currentMonth.min)} {unit}
            </text>
            <text x={legendX + LEGEND_W} y={legendY - 3} textAnchor="end" className="fill-zinc-400 dark:fill-zinc-500" fontSize={7}>
              {formatChartNumber(currentMonth.max)} {unit}
            </text>

            {/* Tooltip */}
            {tooltip && (
              <g style={{ pointerEvents: "none" }}>
                <rect
                  x={Math.min(tooltip.x + 10, svgSize - 170)}
                  y={Math.max(tooltip.y - 50, 0)}
                  width={160}
                  height={46}
                  rx={6}
                  fill="rgba(0,0,0,0.85)"
                />
                <text
                  x={Math.min(tooltip.x + 18, svgSize - 162)}
                  y={Math.max(tooltip.y - 50, 0) + 16}
                  fontSize={11}
                  fill="#fff"
                  fontWeight={600}
                >
                  {new Date(tooltip.date + "T00:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                </text>
                <text
                  x={Math.min(tooltip.x + 18, svgSize - 162)}
                  y={Math.max(tooltip.y - 50, 0) + 34}
                  fontSize={11}
                  fill="#d4d4d8"
                >
                  {String(tooltip.hour).padStart(2, "0")}:00–{String(tooltip.hour + 1).padStart(2, "0")}:00 · {formatChartNumber(tooltip.consumption)} {unit}
                </text>
              </g>
            )}
          </svg>
        )}
      </div>
    </ChartWrapper>
  )
}
