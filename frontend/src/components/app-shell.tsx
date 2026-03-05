"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isDeviceRoute = pathname.startsWith("/device/")

  return (
    <div className="flex min-h-screen">
      {!isDeviceRoute && <Sidebar />}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
