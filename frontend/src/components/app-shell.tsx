"use client"

import { Sidebar } from "./sidebar"
import { DeviceControlsProvider } from "@/lib/device-controls-context"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DeviceControlsProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </DeviceControlsProvider>
  )
}
