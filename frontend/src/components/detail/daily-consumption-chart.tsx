"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea, ReferenceLine } from "recharts"
import { Maximize2, X, Undo2 } from "lucide-react"
import type { DailyConsumption } from "@/lib/types"
import { formatChartNumber } from "@/lib/formatters"
import { useChartZoom } from "./use-chart-zoom"
import type { RefObject } from "react"

const TOOLTIP_STYLE = { fontSize: 12, backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8, color: "#fff" }

/**
 * German gas SLP (Standardlastprofil) monthly distribution weights.
 * Represents approximate % of annual gas consumption per month (heating-dominated).
 * Source: BDEW / SLP H0 profile for German households.
 */
const GAS_SLP_WEIGHTS: Record<number, number> = {
  1: 0.17,   // Jan
  2: 0.14,   // Feb
  3: 0.11,   // Mar
  4: 0.08,   // Apr
  5: 0.04,   // May
  6: 0.02,   // Jun
  7: 0.015,  // Jul
  8: 0.015,  // Aug
  9: 0.03,   // Sep
  10: 0.08,  // Oct
  11: 0.12,  // Nov
  12: 0.16,  // Dec
}

interface ConsumptionPoint {
  period: string
  consumption: number | null
  simulated: number | null
}

function buildHistoricalMonthWeights(actualMap: Map<string, number>): Record<number, number> {
  const byYear = new Map<number, Map<number, number>>()

  for (const [key, value] of actualMap) {
    const year = parseInt(key.slice(0, 4), 10)
    const month = parseInt(key.slice(5, 7), 10)
    if (!byYear.has(year)) byYear.set(year, new Map<number, number>())
    byYear.get(year)!.set(month, value)
  }

  const monthShareBuckets = new Map<number, number[]>()
  for (let m = 1; m <= 12; m++) monthShareBuckets.set(m, [])

  for (const [, months] of byYear) {
    const yearTotal = Array.from(months.values()).reduce((sum, v) => sum + v, 0)
    if (yearTotal <= 0) continue

    for (const [month, value] of months) {
      monthShareBuckets.get(month)!.push(value / yearTotal)
    }
  }

  const blended: Record<number, number> = {}
  let sumWeights = 0

  for (let m = 1; m <= 12; m++) {
    const samples = monthShareBuckets.get(m) ?? []
    const historicalAvg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null
    const slp = GAS_SLP_WEIGHTS[m] ?? 1 / 12

    const w = historicalAvg != null
      ? (historicalAvg * 0.8 + slp * 0.2)
      : slp

    blended[m] = w
    sumWeights += w
  }

  // Normalize to sum=1
  if (sumWeights > 0) {
    for (let m = 1; m <= 12; m++) blended[m] = blended[m] / sumWeights
  }

  return blended
}

/**
 * Given actual monthly data, estimate annual consumption via the SLP profile,
 * then fill missing months with simulated values.
 */
function fillMissingMonths(
  actualMap: Map<string, number>,
): ConsumptionPoint[] {
  if (actualMap.size === 0) return []

  const monthWeights = buildHistoricalMonthWeights(actualMap)

  // Determine year range from actual data
  const allKeys = Array.from(actualMap.keys()).sort()
  const firstYear = parseInt(allKeys[0].slice(0, 4))
  const lastYear = parseInt(allKeys[allKeys.length - 1].slice(0, 4))

  // Global annual fallback from observed full/partial years
  const annualTotals: number[] = []
  for (let y = firstYear; y <= lastYear; y++) {
    let total = 0
    let monthsWithData = 0
    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, "0")}`
      const val = actualMap.get(key)
      if (val != null) {
        total += val
        monthsWithData += 1
      }
    }
    if (monthsWithData > 0) annualTotals.push(total)
  }
  const globalAnnual = annualTotals.length
    ? annualTotals.reduce((a, b) => a + b, 0) / annualTotals.length
    : 0

  // Build full month range across full years (Jan..Dec), not only between first/last seen month.
  const result: ConsumptionPoint[] = []
  for (let y = firstYear; y <= lastYear; y++) {
    const annualEstimatesForYear: number[] = []
    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, "0")}`
      const actual = actualMap.get(key)
      const w = monthWeights[m] ?? GAS_SLP_WEIGHTS[m] ?? (1 / 12)
      if (actual != null && w > 0) {
        annualEstimatesForYear.push(actual / w)
      }
    }
    const estimatedAnnualForYear = annualEstimatesForYear.length
      ? annualEstimatesForYear.reduce((a, b) => a + b, 0) / annualEstimatesForYear.length
      : globalAnnual

    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, "0")}`
      const actual = actualMap.get(key)
      if (actual !== undefined) {
        result.push({ period: key, consumption: actual, simulated: null })
      } else {
        const sim = estimatedAnnualForYear * (monthWeights[m] ?? GAS_SLP_WEIGHTS[m] ?? (1 / 12))
        result.push({ period: key, consumption: null, simulated: Math.round(sim * 100) / 100 })
      }
    }
  }
  return result
}

export function DailyConsumptionChart({ data, unit, dailyWindowDays = 365 }: { data: DailyConsumption[]; unit: string; dailyWindowDays?: number }) {
  const [mode, setMode] = useState<"daily" | "monthly" | "yearly">("daily")

  const chartData = useMemo((): ConsumptionPoint[] => {
    if (mode === "daily") {
      return data
        .filter((d) => d.consumption != null)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-dailyWindowDays)
        .map((d) => ({ period: d.date, consumption: d.consumption, simulated: null }))
    }

    if (mode === "yearly") {
      const map = new Map<string, number>()
      for (const d of data) {
        if (d.consumption == null) continue
        const key = d.date.slice(0, 4)
        map.set(key, (map.get(key) ?? 0) + d.consumption)
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, consumption]) => ({ period, consumption, simulated: null }))
    }

    // Monthly: aggregate actual data, then fill gaps with SLP simulation
    const actualMap = new Map<string, number>()
    for (const d of data) {
      if (d.consumption == null) continue
      const key = d.date.slice(0, 7)
      actualMap.set(key, (actualMap.get(key) ?? 0) + d.consumption)
    }

    return fillMissingMonths(actualMap)
  }, [data, mode, dailyWindowDays])

  const zoom = useChartZoom(chartData, "period")
  if (!data.length) return <ChartEmpty label="Tagesverbrauch" />

  const modeLabel = mode === "daily" ? "Tag" : mode === "monthly" ? "Monat" : "Jahr"
  const hasSimulated = mode === "monthly" && chartData.some((d) => d.simulated != null)

  return (
    <ChartWrapper
      label="Verbrauch"
      controls={(
        <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <button
            onClick={(e) => { e.stopPropagation(); setMode("daily"); zoom.resetZoom() }}
            className={`px-2 py-1 text-[10px] transition-colors ${mode === "daily" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
          >
            Tag
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setMode("monthly"); zoom.resetZoom() }}
            className={`px-2 py-1 text-[10px] transition-colors ${mode === "monthly" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
          >
            Monat
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setMode("yearly"); zoom.resetZoom() }}
            className={`px-2 py-1 text-[10px] transition-colors ${mode === "yearly" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
          >
            Jahr
          </button>
        </div>
      )}
      isZoomed={zoom.isZoomed}
      onReset={zoom.resetZoom}
      containerRef={zoom.containerRef}
      isDragging={zoom.isDragging}
      onDoubleClick={zoom.onDoubleClick}
    >
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={zoom.zoomedData} {...zoom.chartProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} className="text-zinc-400" />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatChartNumber} className="text-zinc-400" label={{ value: unit, angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => {
              const label = String(name).includes("Prognose") ? `${formatChartNumber(value)} (SLP)` : formatChartNumber(value)
              return [label, String(name)]
            }}
          />
          {hasSimulated && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Bar dataKey="consumption" name={`${modeLabel}-Verbrauch (${unit})`} fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          {hasSimulated && (
            <Bar dataKey="simulated" name={`Prognose / SLP (${unit})`} fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} fillOpacity={0.7} />
          )}
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
  controls?: React.ReactNode
  isZoomed?: boolean
  onReset?: () => void
  containerRef?: RefObject<HTMLDivElement | null>
  isDragging?: boolean
  onDoubleClick?: () => void
}

function ChartWrapper({ label, children, controls, isZoomed, onReset, containerRef, isDragging, onDoubleClick }: ChartWrapperProps) {
  const [expanded, setExpanded] = useState(false)

  const closeExpanded = useCallback(() => setExpanded(false), [])

  // Close on Escape key
  useEffect(() => {
    if (!expanded) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeExpanded()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [expanded, closeExpanded])

  // Lock body scroll when expanded
  useEffect(() => {
    if (expanded) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [expanded])

  const header = (
    <div className="flex items-center justify-between mb-3">
      <h3 className={`font-semibold text-zinc-700 dark:text-zinc-300 ${expanded ? "text-base" : "text-sm"}`}>{label}</h3>
      <div className="flex items-center gap-2">
        {controls}
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
            <Undo2 size={10} className="inline mr-0.5" /> Zoom zurücksetzen
          </button>
        )}
        {expanded ? (
          <button
            onClick={(e) => { e.stopPropagation(); closeExpanded(); }}
            className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title="Schließen"
          >
            <X size={14} />
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title="Vergrößern"
          >
            <Maximize2 size={14} />
          </button>
        )}
      </div>
    </div>
  )

  const footer = isZoomed ? (
    <p className="text-[10px] text-zinc-400 mt-2 text-center">Doppelklick zum Zurücksetzen · Scrollen zum Zoomen · Ziehen zum Auswählen</p>
  ) : null

  return (
    <>
      <div
        ref={expanded ? undefined : containerRef}
        onDoubleClick={onDoubleClick}
        className={`rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-4 select-none transition-shadow ${isDragging ? "cursor-col-resize ring-2 ring-blue-400/30 shadow-lg shadow-blue-500/10" : "cursor-crosshair"}`}
      >
        {header}
        {!expanded && children}
        {!expanded && footer}
      </div>

      {expanded && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6 sm:p-10"
          onClick={closeExpanded}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          {/* Modal */}
          <div
            ref={containerRef}
            onDoubleClick={onDoubleClick}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-[90vw] max-h-[90vh] rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 p-6 shadow-2xl select-none overflow-auto ${isDragging ? "cursor-col-resize" : "cursor-crosshair"}`}
          >
            {header}
            <div className="[&_.recharts-responsive-container]:!h-[65vh]">
              {children}
            </div>
            {footer}
          </div>
        </div>,
        document.body,
      )}
    </>
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
