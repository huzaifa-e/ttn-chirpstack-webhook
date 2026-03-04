"use client"

import { useEffect, useRef, useState } from "react"
import type { SSEEvent } from "./types"

export function useSSE(onEvent?: (event: SSEEvent) => void) {
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      const es = new EventSource("/events")
      eventSourceRef.current = es

      es.onopen = () => setConnected(true)

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as SSEEvent
          onEventRef.current?.(data)
        } catch {
          // ignore keepalive or malformed messages
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      eventSourceRef.current?.close()
    }
  }, [])

  return { connected }
}
