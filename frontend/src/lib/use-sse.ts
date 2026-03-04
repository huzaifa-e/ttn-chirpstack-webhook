"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { SSEEvent } from "./types"

/**
 * Hybrid live-update hook:
 *  - Tries SSE first (direct to Express backend, then via Next.js proxy)
 *  - Falls back to polling /api/last-events every 5 s so updates always arrive
 */
export function useSSE(onEvent?: (event: SSEEvent) => void) {
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const onEventRef = useRef(onEvent)
  const seenRef = useRef(new Set<string>())

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const handleEvent = useCallback((evt: SSEEvent) => {
    // Deduplicate so the same uplink isn't processed twice (SSE + poll)
    const key = `${evt.type}:${evt.devEui}:${evt.at ?? ""}`
    if (seenRef.current.has(key)) return
    seenRef.current.add(key)
    // Keep the set bounded
    if (seenRef.current.size > 200) {
      const arr = Array.from(seenRef.current)
      seenRef.current = new Set(arr.slice(arr.length - 100))
    }
    onEventRef.current?.(evt)
  }, [])

  // ---- SSE connection ----
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    function connect() {
      if (cancelled) return
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      // Try the proxied path (works when running behind the same origin e.g. Docker)
      const es = new EventSource("/events")
      eventSourceRef.current = es

      es.onopen = () => {
        if (!cancelled) setConnected(true)
      }

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as SSEEvent
          handleEvent(data)
        } catch {
          // ignore keepalive or malformed messages
        }
      }

      es.onerror = () => {
        if (!cancelled) setConnected(false)
        es.close()
        if (!cancelled) reconnectTimer = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      eventSourceRef.current?.close()
    }
  }, [handleEvent])

  // ---- Polling fallback (catches events even if SSE proxy buffers) ----
  useEffect(() => {
    let cancelled = false
    let lastPollTs = new Date().toISOString()

    async function poll() {
      if (cancelled) return
      try {
        const res = await fetch("/api/last-events")
        if (res.ok) {
          const events: Array<SSEEvent & { ts?: string }> = await res.json()
          for (const evt of events) {
            // Only process events newer than our last poll
            if (evt.ts && evt.ts > lastPollTs) {
              handleEvent(evt)
            }
          }
          if (events.length > 0 && events[events.length - 1].ts) {
            lastPollTs = events[events.length - 1].ts!
          }
          if (!connected) setConnected(true)
        }
      } catch {
        // silently retry
      }
    }

    const interval = setInterval(poll, 5000)
    // Initial poll after a short delay
    const initTimer = setTimeout(poll, 2000)

    return () => {
      cancelled = true
      clearInterval(interval)
      clearTimeout(initTimer)
    }
  }, [handleEvent, connected])

  return { connected }
}
