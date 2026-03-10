"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BarChart3,
  FileJson,
  Send,
  RotateCcw,
  Database,
  Download,
  Plus,
  Trash2,
} from "lucide-react"
import { EmoniLogo } from "./emoni-logo"
import { useDeviceControls } from "@/lib/device-controls-context"

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
]

const deviceSectionGroups = [
  {
    title: "Ansicht",
    items: [
      { id: "sectionCharts", label: "Diagramme", icon: BarChart3 },
      { id: "sectionPayload", label: "Letzter Payload", icon: FileJson },
    ],
  },
  {
    title: "Steuerung",
    items: [
      { id: "sectionDownlink", label: "Downlink", icon: Send },
      { id: "sectionRecalibrate", label: "Rekalibrierung", icon: RotateCcw },
    ],
  },
  {
    title: "Daten",
    items: [
      { id: "sectionDataMgmt", label: "Datenverwaltung", icon: Database },
      { id: "sectionExport", label: "Export", icon: Download },
    ],
  },
  {
    title: "Gerät",
    items: [
      { id: "sectionAddDevice", label: "Gerät hinzufügen", icon: Plus },
      { id: "sectionDeleteDevice", label: "Gerät löschen", icon: Trash2 },
    ],
  },
] as const

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

      </nav>

      {isDevicePage && deviceControls && (
        <div className={`flex-1 overflow-y-auto px-2 pb-4 transition-opacity duration-150 ${collapsed ? "opacity-100" : "opacity-100"}`}>
          <div className="space-y-4">
            {deviceSectionGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                {!collapsed && (
                  <h3 className="px-3 pt-2 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.18em]">
                    {group.title}
                  </h3>
                )}
                {group.items.map((item) => {
                  const isActive = deviceControls.activeSection === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => deviceControls.setActiveSection(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                      } ${collapsed ? "justify-center" : ""}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon size={18} className="shrink-0" />
                      <span className={`overflow-hidden whitespace-nowrap transition-all duration-150 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
                        {item.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
