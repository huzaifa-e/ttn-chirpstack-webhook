"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { SSEEvent } from "./types"

export function useSSE(onEvent?: (event: SSEEvent) => void) {
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const connect = useCallback(() => {
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
      // reconnect after 3s
      setTimeout(connect, 3000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      eventSourceRef.current?.close()
    }
  }, [connect])

  return { connected }
}
