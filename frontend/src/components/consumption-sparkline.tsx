"use client"

import type React from "react"
import { useMemo, useRef, useState, useEffect } from "react"

const useElementSize = <T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] => {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const update = () => setSize({ width: node.clientWidth, height: node.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  return [ref, size]
}

export const ConsumptionSparkline: React.FC<{
  /** Raw meter reading values (ascending). Deltas will be computed. */
  meterValues: number[]
  height?: number
  barColor?: string
  className?: string
}> = ({ meterValues, height = 48, barColor = "#10b981", className }) => {
  const [containerRef, { width }] = useElementSize<HTMLDivElement>()

  // Compute consumption deltas
  const deltas = useMemo(() => {
    if (meterValues.length < 2) return []
    const d: number[] = []
    for (let i = 1; i < meterValues.length; i++) {
      const diff = meterValues[i] - meterValues[i - 1]
      d.push(Math.max(0, diff)) // clamp negative (recalibrations) to 0
    }
    return d
  }, [meterValues])

  const maxDelta = useMemo(() => Math.max(...deltas, 0.001), [deltas])
  const total = useMemo(() => deltas.reduce((s, v) => s + v, 0), [deltas])

  if (deltas.length < 2 || width === 0) {
    return (
      <div ref={containerRef} className={`w-full ${className || ""}`} style={{ height }}>
        <div className="flex items-center justify-center h-full text-[10px] text-zinc-400">
          Zu wenig Daten
        </div>
      </div>
    )
  }

  const padding = 2
  const innerW = width - padding * 2
  const innerH = height - 16 // leave room for label
  const barGap = 1
  const barWidth = Math.max(1, (innerW - barGap * (deltas.length - 1)) / deltas.length)

  return (
    <div ref={containerRef} className={`w-full ${className || ""}`} style={{ height }}>
      {/* Label */}
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          Verbrauch 24h
        </span>
        <span className="text-[9px] font-semibold text-zinc-600 dark:text-zinc-300">
          {total < 0.01 ? total.toFixed(4) : total < 1 ? total.toFixed(3) : total.toFixed(1)}
        </span>
      </div>
      {/* Bars */}
      <svg width={width} height={innerH} className="overflow-visible">
        {deltas.map((d, i) => {
          const barH = Math.max(1, (d / maxDelta) * (innerH - 2))
          const x = padding + i * (barWidth + barGap)
          const y = innerH - barH
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={Math.min(1, barWidth / 2)}
              fill={barColor}
              opacity={0.7 + 0.3 * (d / maxDelta)}
            />
          )
        })}
      </svg>
    </div>
  )
}
