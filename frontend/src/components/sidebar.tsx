"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react"
import { EmoniLogo } from "./emoni-logo"
import { useDeviceControls } from "@/lib/device-controls-context"
import { LastUplinkPayload } from "@/components/detail/last-uplink-payload"
import { DownlinkPanel } from "@/components/detail/downlink-panel"

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
]

export function Sidebar() {
  const pathname = usePathname()
  const [hovered, setHovered] = useState(false)
  const collapsed = !hovered
  const deviceControls = useDeviceControls()
  const isDevicePage = pathname.startsWith("/device/")

  const expandedWidth = isDevicePage && deviceControls ? 320 : 220

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: collapsed ? 64 : expandedWidth }}
      className="sticky top-0 h-screen flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl z-30 shrink-0 overflow-hidden transition-[width] duration-200 ease-out will-change-[width]"
    >
      {/* Logo area */}
      <Link href="/" className="flex items-center gap-3 px-4 py-5 border-b border-zinc-200 dark:border-zinc-800 min-h-[72px]">
        <EmoniLogo size={36} className="shrink-0" />
        <div className={`overflow-hidden whitespace-nowrap transition-all duration-150 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
            EMONI-LoRaWAN
          </div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500 leading-tight">
            Dashboard
          </div>
        </div>
      </Link>

      {/* Nav items */}
      <nav className="px-2 py-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              } ${collapsed ? "justify-center" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} className="shrink-0" />
              <span className={`overflow-hidden whitespace-nowrap transition-all duration-150 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* Settings icon — only on device pages */}
        {isDevicePage && (
          <div
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? "Einstellungen" : undefined}
          >
            <SlidersHorizontal size={20} className="shrink-0" />
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-150 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
              Einstellungen
            </span>
          </div>
        )}
      </nav>

      {/* Device controls panel — only when expanded on device pages */}
      {isDevicePage && deviceControls && (
        <div className={`flex-1 overflow-y-auto px-3 pb-4 space-y-3 transition-opacity duration-150 ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          {/* Controls */}
          <div className="space-y-3 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-3">
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Steuerung</h3>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Tage: {deviceControls.days}</label>
              <input
                type="range"
                min={1}
                max={365}
                value={deviceControls.days}
                onChange={(e) => deviceControls.setDays(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Zeitzone</label>
              <input
                type="text"
                value={deviceControls.timezone}
                onChange={(e) => deviceControls.setTimezone(e.target.value)}
                className="text-xs px-2 py-1 w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={deviceControls.fetchData}
              disabled={deviceControls.refreshing}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={deviceControls.refreshing ? "animate-spin" : ""} />
              Aktualisieren
            </button>
          </div>

          {/* Last Uplink Payload */}
          <LastUplinkPayload uplink={deviceControls.lastUplink} />

          {/* Downlink Panel */}
          <DownlinkPanel devEui={deviceControls.devEui} deviceUuid={deviceControls.deviceUuid} />
        </div>
      )}
    </aside>
  )
}
