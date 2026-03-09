"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BackgroundPlus } from "../demos/background-plus"
import { EmoniLogo } from "@/components/emoni-logo"
import { DeviceCard } from "@/components/device-card"
import { OverviewStats } from "@/components/overview-stats"
import { SearchModal } from "@/components/search-modal"
import { AddDeviceModal } from "@/components/add-device-modal"
import { LiveIndicator } from "@/components/live-indicator"
import { ThemeToggle } from "@/components/theme-toggle"
import { getDeviceSummaries, getDeviceTypes, getReadings, createConfiguredDevice } from "@/lib/api"
import { useSSE } from "@/lib/use-sse"
import { getDeviceStatus } from "@/lib/formatters"
import type { DeviceSummary, DeviceType, DeviceStatus, SSEEvent } from "@/lib/types"

export default function Home() {
  const router = useRouter()
  const [devices, setDevices] = useState<DeviceSummary[]>([])
  const [deviceTypes, setDeviceTypes] = useState<Record<string, DeviceType>>({})
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({})
  const [loading, setLoading] = useState(true)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false)
  const [filterType, setFilterType] = useState<DeviceType | "all">("all")

  const fetchData = useCallback(async () => {
    try {
      const [devs, types] = await Promise.all([getDeviceSummaries(), getDeviceTypes()])
      setDevices(devs)
      setDeviceTypes(types)

      // Fetch sparkline data for each device (last 24h readings)
      const now = new Date().toISOString()
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const sparks: Record<string, number[]> = {}
      await Promise.all(
        devs.map(async (d) => {
          try {
            const readings = await getReadings(d.dev_eui, dayAgo, now)
            sparks[d.dev_eui] = readings.map((r) => r.meter_value)
          } catch {
            sparks[d.dev_eui] = []
          }
        })
      )
      setSparklines(sparks)
    } catch (err) {
      toast.error("Fehler beim Laden der Geräte")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // SSE live updates
  const handleSSE = useCallback(
    (event: SSEEvent) => {
      if (event.type === "up") {
        const label = event.deviceName || event.devEui
        toast(`Uplink von ${label}`, {
          description: event.meterValue != null ? `Zählerstand: ${event.meterValue}` : undefined,
          style: {
            background: "#27272a",
            color: "#a1a1aa",
            border: "1px solid #3f3f46",
          },
        })
        // Refresh data
        fetchData()
      } else if (event.type === "auto-recalibrate") {
        toast.warning(`Auto-Rekalibrierung: ${event.devEui}`, {
          description: `Sprung: ${event.jump}, Schwelle: ${event.threshold}`,
        })
      } else if (event.type === "manual-recalibrate") {
        toast.info(`Manuelle Rekalibrierung: ${event.devEui}`)
      }
    },
    [fetchData]
  )
  const { connected } = useSSE(handleSSE)

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Compute status counts
  const statusCounts = devices.reduce(
    (acc, d) => {
      const status = getDeviceStatus(d)
      acc[status]++
      acc.total++
      return acc
    },
    { total: 0, active: 0, warning: 0, offline: 0, inactive: 0 } as Record<DeviceStatus | "total", number>
  )

  // Filter devices
  const filteredDevices =
    filterType === "all"
      ? devices
      : devices.filter((d) => (deviceTypes[d.dev_eui] || "unknown") === filterType)

  const handleTypeChange = (devEui: string, newType: DeviceType) => {
    setDeviceTypes((prev) => ({ ...prev, [devEui]: newType }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-zinc-600 dark:text-zinc-300">Geräte werden geladen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <BackgroundPlus className="fixed inset-0 opacity-[0.03]" plusColor="#3b82f6" plusSize={60} fade={true} />

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 sm:mb-10">
          <div className="flex items-center justify-between mb-4">
            <motion.div
              className="flex items-center gap-4"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <EmoniLogo size={64} className="text-zinc-900 dark:text-zinc-100" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-wide leading-tight">
                  EMONI-LoRaWAN
                </h1>
                <p className="text-base sm:text-lg text-zinc-400 dark:text-zinc-500 font-medium">
                  Dashboard
                </p>
              </div>
            </motion.div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <LiveIndicator connected={connected} />
            </div>
          </div>

          {/* Stats + Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <OverviewStats counts={statusCounts} />

            <div className="flex items-center gap-2">
              {/* Type filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as DeviceType | "all")}
                className="text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Alle Typen</option>
                <option value="gas">Gas</option>
                <option value="water">Wasser</option>
                <option value="electricity_ferraris">Strom (Ferraris)</option>
                <option value="electricity_sml">Strom (SML)</option>
                <option value="unknown">Ohne Typ</option>
              </select>

              {/* Add Device button */}
              <motion.button
                onClick={() => setIsAddDeviceOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all text-xs"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span>+ Gerät</span>
              </motion.button>

              {/* Search button */}
              <motion.button
                onClick={() => setIsSearchOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200/50 bg-white/80 text-zinc-700 hover:bg-white hover:border-zinc-300 shadow-sm transition-all dark:border-zinc-700/50 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-900 backdrop-blur-sm text-xs"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span>Suche</span>
                <kbd className="hidden sm:inline bg-zinc-100 px-1.5 py-0.5 rounded text-[10px] border border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 font-mono">
                  ⌘K
                </kbd>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Device Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6">
          <AnimatePresence mode="popLayout">
            {filteredDevices.map((device, index) => (
              <DeviceCard
                key={device.dev_eui}
                device={device}
                deviceType={deviceTypes[device.dev_eui] || "unknown"}
                sparklineData={sparklines[device.dev_eui]}
                delay={index * 0.05}
                onTypeChange={handleTypeChange}
              />
            ))}
          </AnimatePresence>
        </div>

        {filteredDevices.length === 0 && (
          <div className="text-center py-20 text-zinc-400">
            Keine Geräte gefunden
          </div>
        )}

        {/* Search Modal */}
        <AnimatePresence>
          {isSearchOpen && (
            <SearchModal
              isOpen={isSearchOpen}
              onClose={() => setIsSearchOpen(false)}
              devices={devices}
              deviceTypes={deviceTypes}
              onSelect={(id) => {
                router.push(`/device/${encodeURIComponent(id)}`)
              }}
            />
          )}
        </AnimatePresence>

        {/* Add Device Modal */}
        <AnimatePresence>
          {isAddDeviceOpen && (
            <AddDeviceModal
              isOpen={isAddDeviceOpen}
              onClose={() => setIsAddDeviceOpen(false)}
              onSubmit={async (data) => {
                const device = await createConfiguredDevice(data)
                toast.success(`Gerät "${device.name}" erstellt`, {
                  description: `UUID: ${device.uuid}`,
                })
                fetchData()
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
