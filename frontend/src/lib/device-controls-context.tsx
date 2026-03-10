"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { Uplink } from "./types"

export type DetailSectionId =
  | "sectionCharts"
  | "sectionPayload"
  | "sectionDownlink"
  | "sectionRecalibrate"
  | "sectionDataMgmt"
  | "sectionExport"
  | "sectionAddDevice"
  | "sectionDeleteDevice"

export interface DeviceControlsState {
  days: number
  setDays: (d: number) => void
  timezone: string
  setTimezone: (tz: string) => void
  refreshing: boolean
  fetchData: () => void
  lastUplink: Uplink | null
  devEui: string
  deviceUuid: string
  activeSection: DetailSectionId
  setActiveSection: (section: DetailSectionId) => void
}

interface ContextValue {
  controls: DeviceControlsState | null
  setControls: (c: DeviceControlsState | null) => void
}

const DeviceControlsContext = createContext<ContextValue>({
  controls: null,
  setControls: () => {},
})

export function DeviceControlsProvider({ children }: { children: ReactNode }) {
  const [controls, setControls] = useState<DeviceControlsState | null>(null)
  return (
    <DeviceControlsContext.Provider value={{ controls, setControls }}>
      {children}
    </DeviceControlsContext.Provider>
  )
}

/** Read current device controls (used by sidebar) */
export function useDeviceControls(): DeviceControlsState | null {
  return useContext(DeviceControlsContext).controls
}

/** Register device controls from a page (auto-cleans up on unmount) */
export function useSetDeviceControls(value: DeviceControlsState): void {
  const { setControls } = useContext(DeviceControlsContext)
  useEffect(() => {
    setControls(value)
    return () => setControls(null)
  }, [value, setControls])
}
