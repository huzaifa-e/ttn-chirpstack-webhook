"use client"

import { useState, useMemo, useRef, useEffect } from "react"

/**
 * Reusable chart zoom hook.
 * – Drag-to-select: click and drag across the chart to zoom into a region.
 * – Scroll-to-zoom: mouse-wheel zooms in/out around the centre of the view.
 * – Reset: call `resetZoom()` to restore the full dataset.
 *
 * Returns sliced `zoomedData`, chart event handlers, and ReferenceArea coords.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useChartZoom<T extends Record<string, any>>(
  fullData: T[],
  xKey: string & keyof T,
) {
  const [left, setLeft] = useState(0)
  const [right, setRight] = useState(Math.max(0, fullData.length - 1))
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null)
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep a mutable ref so wheel / mouseUp always read the latest values
  // without forcing the useEffect to re-register its listener.
  const stateRef = useRef({ left, right })
  stateRef.current = { left, right }

  // Reset when data length changes (new fetch)
  useEffect(() => {
    setLeft(0)
    setRight(Math.max(0, fullData.length - 1))
    setRefAreaLeft(null)
    setRefAreaRight(null)
  }, [fullData.length])

  const zoomedData = useMemo(
    () => fullData.slice(left, Math.min(right + 1, fullData.length)),
    [fullData, left, right],
  )

  const isZoomed = left !== 0 || right !== fullData.length - 1

  const resetZoom = () => {
    setLeft(0)
    setRight(Math.max(0, fullData.length - 1))
  }

  /* ---- drag-to-select ---- */

  const onMouseDown = (e: any) => {
    if (e?.activeLabel != null) {
      setRefAreaLeft(String(e.activeLabel))
      setRefAreaRight(String(e.activeLabel))
    }
  }

  const onMouseMove = (e: any) => {
    if (refAreaLeft != null && e?.activeLabel != null) {
      setRefAreaRight(String(e.activeLabel))
    }
  }

  const onMouseUp = () => {
    if (refAreaLeft == null || refAreaRight == null || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null)
      setRefAreaRight(null)
      return
    }

    const sliced = fullData.slice(left, right + 1)
    let li = sliced.findIndex((d) => String(d[xKey]) === refAreaLeft)
    let ri = sliced.findIndex((d) => String(d[xKey]) === refAreaRight)

    if (li >= 0 && ri >= 0) {
      if (li > ri) [li, ri] = [ri, li]
      if (ri - li >= 1) {
        setLeft(left + li)
        setRight(left + ri)
      }
    }

    setRefAreaLeft(null)
    setRefAreaRight(null)
  }

  /* ---- scroll-to-zoom (non-passive wheel for preventDefault) ---- */

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { left: l, right: r } = stateRef.current
      const range = r - l
      if (range < 3 && e.deltaY < 0) return // can't zoom further in

      const step = Math.max(1, Math.round(range * 0.1))

      if (e.deltaY < 0) {
        // zoom in — shrink from both sides
        const newL = Math.min(l + step, r - 2)
        const newR = Math.max(r - step, l + 2)
        if (newL < newR) {
          setLeft(newL)
          setRight(newR)
        }
      } else {
        // zoom out — expand both sides
        setLeft(Math.max(0, l - step))
        setRight(Math.min(fullData.length - 1, r + step))
      }
    }

    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [fullData.length])

  return {
    zoomedData,
    isZoomed,
    resetZoom,
    containerRef,
    chartProps: { onMouseDown, onMouseMove, onMouseUp },
    refAreaLeft,
    refAreaRight,
  }
}
