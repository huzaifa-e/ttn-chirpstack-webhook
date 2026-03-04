"use client"

import type React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import { motion } from "framer-motion"

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

export const SparklineChart: React.FC<{
  data: number[]
  positive?: boolean
  height?: number
  className?: string
  formatValue?: (v: number) => string
}> = ({ data, positive = true, height = 120, className, formatValue }) => {
  const [containerRef, { width }] = useElementSize<HTMLDivElement>()
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [isPointer, setIsPointer] = useState(false)

  const padding = { top: 10, right: 10, bottom: 10, left: 10 }
  const innerW = Math.max(0, width - padding.left - padding.right)
  const innerH = Math.max(0, height - padding.top - padding.bottom)

  const minV = data.length ? Math.min(...data) : 0
  const maxV = data.length ? Math.max(...data) : 1
  const range = maxV - minV || 1

  const points = useMemo(() =>
    data.map((v, i) => [
      data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW,
      innerH - ((v - minV) / range) * innerH,
    ] as const),
    [data, innerW, innerH, minV, range]
  )

  const dPath = useMemo(() => {
    if (!points.length) return ""
    return points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ")
  }, [points])

  const handlePointer = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = clientX - rect.left - padding.left
    if (x < 0 || x > innerW) { setHoverIdx(null); return }
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((x / innerW) * (data.length - 1))))
    setHoverIdx(idx)
  }

  const strokeColor = positive ? "#10b981" : "#ef4444"
  const gradId = `spark-grad-${positive ? "pos" : "neg"}`

  return (
    <div
      ref={containerRef}
      className={`relative w-full cursor-crosshair ${className || ""}`}
      style={{ height }}
      onMouseMove={(e) => { setIsPointer(true); handlePointer(e.clientX) }}
      onMouseLeave={() => { setIsPointer(false); setHoverIdx(null) }}
      onTouchStart={(e) => { setIsPointer(true); if (e.touches[0]) handlePointer(e.touches[0].clientX) }}
      onTouchMove={(e) => { if (e.touches[0]) handlePointer(e.touches[0].clientX) }}
      onTouchEnd={() => { setIsPointer(false); setHoverIdx(null) }}
    >
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <g transform={`translate(${padding.left},${padding.top})`}>
          {points.length > 1 && (
            <path
              d={`${dPath} L ${innerW} ${innerH} L 0 ${innerH} Z`}
              fill={`url(#${gradId})`}
              stroke="none"
            />
          )}
          <path d={dPath} fill="none" stroke={strokeColor} strokeWidth={2} />
          {isPointer && hoverIdx !== null && points[hoverIdx] && (
            <>
              <line
                x1={points[hoverIdx][0]} y1={0}
                x2={points[hoverIdx][0]} y2={innerH}
                className="stroke-blue-500/50" strokeDasharray="3 3" strokeWidth="1"
              />
              <circle
                cx={points[hoverIdx][0]} cy={points[hoverIdx][1]}
                r={4} className="fill-white dark:fill-zinc-900 stroke-blue-500" strokeWidth={2}
              />
            </>
          )}
        </g>
      </svg>

      {isPointer && hoverIdx !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute pointer-events-none rounded-md border border-zinc-200 bg-white/95 backdrop-blur-sm px-2 py-1 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900/95"
          style={{
            top: Math.max(4, padding.top + (points[hoverIdx]?.[1] ?? 0) - 30),
            left: Math.min(Math.max(padding.left + (points[hoverIdx]?.[0] ?? 0) - 40, 4), (width || 0) - 90),
          }}
        >
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {formatValue ? formatValue(data[hoverIdx]) : data[hoverIdx].toFixed(2)}
          </span>
        </motion.div>
      )}
    </div>
  )
}
