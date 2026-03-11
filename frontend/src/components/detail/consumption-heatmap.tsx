"use client"

import { useMemo, useState, useRef, useCallback, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Reading } from "@/lib/types"
import { ChartWrapper, ChartEmpty } from "./daily-consumption-chart"
import { formatChartNumber } from "@/lib/formatters"

/* ── colour helpers ─────────────────────────────────────────────── */

const NO_DATA_COLOR = "rgb(15, 23, 42)" // slate-900 — very dark blue

function valueToColor(t: number): string {
  const c = Math.max(0, Math.min(1, t))
  const stops: [number, number, number][] = [
    [30, 58, 138],    // dark blue (low)
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

/* ── data processing ────────────────────────────────────────────── */

interface HeatCell {
  date: string
  day: number
  hour: number
  consumption: number
}

interface MonthData {
  key: string
  label: string
  cells: HeatCell[]
  daysInMonth: number
  min: number
  max: number
}

function buildMonthlyHeatmapData(readings: Reading[]): MonthData[] {
  if (readings.length < 2) return []

  const sorted = [...readings].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

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

  const cellsByMonth = new Map<string, HeatCell[]>()
  for (const [key, { first, last }] of buckets) {
    const [date, hourStr] = key.split("|")
    const monthKey = date.slice(0, 7)
    const day = Number(date.slice(8, 10))
    const consumption = Math.max(0, last - first)
    if (!cellsByMonth.has(monthKey)) cellsByMonth.set(monthKey, [])
    cellsByMonth.get(monthKey)!.push({ date, day, hour: Number(hourStr), consumption })
  }

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
  pageX: number
  pageY: number
  date: string
  hour: number
  consumption: number
}

/* ── single month SVG ───────────────────────────────────────────── */

const MARGIN = { top: 6, right: 8, bottom: 32, left: 38 }

function MonthGrid({
  month,
  width,
  unit,
  onTooltip,
}: {
  month: MonthData
  width: number
  unit: string
  onTooltip: (info: TooltipInfo | null) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  const cellMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of month.cells) m.set(`${c.day}|${c.hour}`, c.consumption)
    return m
  }, [month])

  const days = month.daysInMonth
  const range = month.max - month.min
  // Make cells square: derive cell size from fixed chart height
  const maxChartH = 280 - MARGIN.top - MARGIN.bottom
  const cellSize = Math.min(maxChartH / 24, (width - MARGIN.left - MARGIN.right) / days)
  const chartW = cellSize * days
  const chartH = cellSize * 24
  const svgW = chartW + MARGIN.left + MARGIN.right
  const svgH = chartH + MARGIN.top + MARGIN.bottom
  const cellW = cellSize
  const cellH = cellSize

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const col = Math.floor((mouseX - MARGIN.left) / cellW)
      const row = Math.floor((mouseY - MARGIN.top) / cellH)

      if (col < 0 || col >= days || row < 0 || row >= 24) {
        onTooltip(null)
        return
      }

      const day = col + 1
      const hour = row
      const [y, m] = month.key.split("-")
      const dateStr = `${y}-${m}-${String(day).padStart(2, "0")}`

      onTooltip({
        pageX: e.clientX,
        pageY: e.clientY,
        date: dateStr,
        hour,
        consumption: cellMap.get(`${day}|${hour}`) ?? 0,
      })
    },
    [month, cellMap, cellW, cellH, days, onTooltip],
  )

  const tickEvery = days > 20 ? 5 : days > 14 ? 3 : 2

  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">{month.label}</span>
      <svg
        ref={svgRef}
        width={svgW}
        height={svgH}
        className="select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onTooltip(null)}
      >
        {/* Grid cells */}
        {Array.from({ length: days }, (_, col) =>
          Array.from({ length: 24 }, (_, hour) => {
            const day = col + 1
            const val = cellMap.get(`${day}|${hour}`)
            const color =
              val === undefined || val === 0
                ? NO_DATA_COLOR
                : range > 0
                  ? valueToColor((val - month.min) / range)
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

        {/* Y-axis: hours (every 3h) */}
        {Array.from({ length: 8 }, (_, i) => {
          const h = i * 3
          return (
            <text
              key={h}
              x={MARGIN.left - 3}
              y={MARGIN.top + h * cellH + cellH * 1.5}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-zinc-400 dark:fill-zinc-500"
              fontSize={7}
            >
              {String(h).padStart(2, "0")}h
            </text>
          )
        })}

        {/* X-axis: days */}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1
          if (day !== 1 && day % tickEvery !== 0) return null
          return (
            <text
              key={day}
              x={MARGIN.left + i * cellW + cellW / 2}
              y={MARGIN.top + chartH + 10}
              textAnchor="middle"
              className="fill-zinc-400 dark:fill-zinc-500"
              fontSize={7}
            >
              {day}
            </text>
          )
        })}

        {/* X-axis label */}
        <text
          x={MARGIN.left + chartW / 2}
          y={MARGIN.top + chartH + 22}
          textAnchor="middle"
          className="fill-zinc-500 dark:fill-zinc-400"
          fontSize={7}
        >
          Tag
        </text>
      </svg>
    </div>
  )
}

/* ── main component ─────────────────────────────────────────────── */

export function ConsumptionHeatmap({ readings, unit }: { readings: Reading[]; unit: string }) {
  const months = useMemo(() => buildMonthlyHeatmapData(readings), [readings])
  // pairIdx points to the RIGHT month of the pair (the later one)
  const [pairIdx, setPairIdx] = useState(-1)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Default to latest pair
  useEffect(() => {
    if (months.length > 0 && pairIdx === -1) {
      setPairIdx(months.length - 1)
    }
  }, [months, pairIdx])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  if (!months.length) return <ChartEmpty label="Verbrauchs-Heatmap" />

  const rightIdx = Math.max(0, Math.min(pairIdx, months.length - 1))
  const leftIdx = Math.max(0, rightIdx - 1)
  const leftMonth = months[leftIdx]
  const rightMonth = months[rightIdx]
  const showTwo = leftIdx !== rightIdx

  const canPrev = leftIdx > 0
  const canNext = rightIdx < months.length - 1

  // Each month gets roughly half the container minus gap
  const gap = 12
  const gridWidth = containerWidth > 0 ? containerWidth : 400
  const monthW = showTwo ? Math.floor((gridWidth - gap) / 2) : Math.min(Math.floor(gridWidth / 2), 380)

  // Shared legend
  const globalMin = months[0]?.min ?? 0
  const globalMax = months[0]?.max ?? 0
  const LEGEND_W = Math.min(200, gridWidth * 0.4)

  return (
    <ChartWrapper
      label="Verbrauchs-Heatmap"
      controls={
        <div className="inline-flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); if (canPrev) { setPairIdx(rightIdx - 1); setTooltip(null) } }}
            disabled={!canPrev}
            className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 min-w-[80px] text-center whitespace-nowrap">
            {showTwo ? `${leftMonth.label} / ${rightMonth.label}` : rightMonth.label}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); if (canNext) { setPairIdx(rightIdx + 1); setTooltip(null) } }}
            disabled={!canNext}
            className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      }
    >
      <div ref={containerRef} className="w-full">
        {containerWidth > 0 && (
          <>
            <div className={`flex items-start ${showTwo ? "justify-between" : "justify-center"}`} style={{ gap }}>
              {showTwo && (
                <MonthGrid month={leftMonth} width={monthW} unit={unit} onTooltip={setTooltip} />
              )}
              <MonthGrid month={rightMonth} width={monthW} unit={unit} onTooltip={setTooltip} />
            </div>

            {/* Shared legend */}
            <div className="flex justify-center mt-2">
              <svg width={LEGEND_W + 80} height={22}>
                <defs>
                  <linearGradient id="heatmap-legend-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={NO_DATA_COLOR} />
                    <stop offset="10%" stopColor={valueToColor(0)} />
                    <stop offset="35%" stopColor={valueToColor(0.25)} />
                    <stop offset="55%" stopColor={valueToColor(0.5)} />
                    <stop offset="75%" stopColor={valueToColor(0.75)} />
                    <stop offset="100%" stopColor={valueToColor(1)} />
                  </linearGradient>
                </defs>
                <rect x={40} y={6} width={LEGEND_W} height={8} rx={3} fill="url(#heatmap-legend-grad)" />
                <text x={40} y={5} textAnchor="start" className="fill-zinc-400 dark:fill-zinc-500" fontSize={7}>
                  {formatChartNumber(globalMin)} {unit}
                </text>
                <text x={40 + LEGEND_W} y={5} textAnchor="end" className="fill-zinc-400 dark:fill-zinc-500" fontSize={7}>
                  {formatChartNumber(globalMax)} {unit}
                </text>
              </svg>
            </div>
          </>
        )}
      </div>

      {/* Floating tooltip positioned at cursor */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded-md bg-black/85 text-white text-[11px] leading-snug whitespace-nowrap"
          style={{
            left: tooltip.pageX + 14,
            top: tooltip.pageY - 8,
            transform: "translateY(-100%)",
          }}
        >
          <div className="font-semibold">
            {new Date(tooltip.date + "T00:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
          </div>
          <div className="text-zinc-300">
            {String(tooltip.hour).padStart(2, "0")}:00–{String(tooltip.hour + 1).padStart(2, "0")}:00 · {formatChartNumber(tooltip.consumption)} {unit}
          </div>
        </div>
      )}
    </ChartWrapper>
  )
}
