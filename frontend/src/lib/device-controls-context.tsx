"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Uplink } from "./types"

export interface DeviceControlsState {
  days: number
  setDays: (d: number) => void
  timezone: string
  setTimezone: (tz: string) => void
  refreshing: boolean
  fetchData: () => void
  lastUplink: Uplink | null
  devEui: string
}

const DeviceControlsContext = createContext<DeviceControlsState | null>(null)

export function DeviceControlsProvider({
  value,
  children,
}: {
  value: DeviceControlsState
  children: ReactNode
}) {
  return (
    <DeviceControlsContext.Provider value={value}>
      {children}
    </DeviceControlsContext.Provider>
  )
}

export function useDeviceControls(): DeviceControlsState | null {
  return useContext(DeviceControlsContext)
}
