"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"

/* ------------------------------------------------------------------ */
/*  Down-sample large arrays so SVG rendering stays fast               */
/* ------------------------------------------------------------------ */
const MAX_DISPLAY_POINTS = 600

function downsample<T>(data: T[], max: number): T[] {
  if (data.length <= max) return data
  const step = data.length / max
  const out: T[] = [data[0]]
  for (let i = 1; i < max - 1; i++) out.push(data[Math.round(i * step)])
  out.push(data[data.length - 1])
  return out
}

/* ------------------------------------------------------------------ */
/*  useChartZoom                                                       */
/*                                                                     */
/*  – Drag-to-select with vivid ReferenceArea overlay                  */
/*  – Scroll-to-zoom (throttled, non-passive wheel)                    */
/*  – Double-click to reset zoom                                       */
/*  – Returns `isDragging` for cursor feedback                         */
/* ------------------------------------------------------------------ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useChartZoom<T extends Record<string, any>>(
  fullData: T[],
  xKey: string & keyof T,
) {
  /* ---- viewport slice indices ---- */
  const [left, setLeft] = useState(0)
  const [right, setRight] = useState(Math.max(0, fullData.length - 1))

  /* ---- selection overlay labels ---- */
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null)
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null)

  /* ---- drag tracking via mutable ref (avoids stale closures) ---- */
  const dragRef = useRef({ active: false, startLabel: null as string | null })
  const [isDragging, setIsDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  /* Mutable copy so wheel handler always reads latest values */
  const stateRef = useRef({ left, right })
  stateRef.current = { left, right }

  /* ---- reset when upstream data length changes ---- */
  useEffect(() => {
    setLeft(0)
    setRight(Math.max(0, fullData.length - 1))
    setRefAreaLeft(null)
    setRefAreaRight(null)
    dragRef.current = { active: false, startLabel: null }
    setIsDragging(false)
  }, [fullData.length])

  /* ---- downsampled + sliced data ---- */
  const zoomedData = useMemo(
    () =>
      downsample(
        fullData.slice(left, Math.min(right + 1, fullData.length)),
        MAX_DISPLAY_POINTS,
      ),
    [fullData, left, right],
  )

  const isZoomed = left !== 0 || right !== fullData.length - 1

  const resetZoom = useCallback(() => {
    setLeft(0)
    setRight(Math.max(0, fullData.length - 1))
  }, [fullData.length])

  /* ================================================================ */
  /*  Drag-to-select handlers                                         */
  /* ================================================================ */

  const onMouseDown = useCallback((e: any) => {
    if (e?.activeLabel == null) return
    const label = String(e.activeLabel)
    dragRef.current = { active: true, startLabel: label }
    setRefAreaLeft(label)
    setRefAreaRight(label)
    setIsDragging(true)
  }, [])

  const onMouseMove = useCallback((e: any) => {
    if (!dragRef.current.active || e?.activeLabel == null) return
    setRefAreaRight(String(e.activeLabel))
  }, [])

  /* Commit zoom or cancel */
  const commitZoom = useCallback(() => {
    const { active, startLabel } = dragRef.current

    // always reset drag state immediately
    dragRef.current = { active: false, startLabel: null }
    setIsDragging(false)

    if (!active || startLabel == null) {
      setRefAreaLeft(null)
      setRefAreaRight(null)
      return
    }

    // Read the latest refAreaRight from a closure-safe path:
    // We set it synchronously inside onMouseMove, so
    // we grab it via a functional setState trick.
    setRefAreaRight((endLabel) => {
      if (endLabel == null || startLabel === endLabel) {
        setRefAreaLeft(null)
        return null
      }

      const { left: l, right: r } = stateRef.current
      const sliced = fullData.slice(l, r + 1)

      let li = sliced.findIndex((d) => String(d[xKey]) === startLabel)
      let ri = sliced.findIndex((d) => String(d[xKey]) === endLabel)

      if (li >= 0 && ri >= 0) {
        if (li > ri) [li, ri] = [ri, li]
        if (ri - li >= 1) {
          setLeft(l + li)
          setRight(l + ri)
        }
      }

      setRefAreaLeft(null)
      return null // clear refAreaRight
    })
  }, [fullData, xKey])

  const onMouseUp = useCallback(() => {
    commitZoom()
  }, [commitZoom])

  /* double-click → reset */
  const onDoubleClick = useCallback(() => {
    resetZoom()
  }, [resetZoom])

  /* ---- global mouseup so drag ends even if pointer leaves chart ---- */
  useEffect(() => {
    const handleGlobalUp = () => {
      if (dragRef.current.active) commitZoom()
    }
    window.addEventListener("mouseup", handleGlobalUp)
    return () => window.removeEventListener("mouseup", handleGlobalUp)
  }, [commitZoom])

  /* ================================================================ */
  /*  Scroll-to-zoom (throttled, non-passive)                          */
  /* ================================================================ */

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let lastWheel = 0
    const THROTTLE_MS = 60

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = Date.now()
      if (now - lastWheel < THROTTLE_MS) return
      lastWheel = now

      const { left: l, right: r } = stateRef.current
      const range = r - l
      if (range < 3 && e.deltaY < 0) return

      const step = Math.max(1, Math.round(range * 0.1))

      if (e.deltaY < 0) {
        const newL = Math.min(l + step, r - 2)
        const newR = Math.max(r - step, l + 2)
        if (newL < newR) {
          setLeft(newL)
          setRight(newR)
        }
      } else {
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
    onDoubleClick,
    refAreaLeft,
    refAreaRight,
    isDragging,
  }
}
