"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { BackgroundPlus } from "@/demos/background-plus"
import { DeviceIcon } from "@/components/device-icon"
import { StatusBadge } from "@/components/status-badge"
import { LiveIndicator } from "@/components/live-indicator"
import { KPICards } from "@/components/detail/kpi-cards"
import { LastUplinkPayload } from "@/components/detail/last-uplink-payload"
import { ControlsPanel } from "@/components/detail/controls-panel"
import { DownlinkPanel } from "@/components/detail/downlink-panel"
import { DataManagement } from "@/components/detail/data-management"
import { DailyConsumptionChart, MeterBatteryChart } from "@/components/detail/daily-consumption-chart"
import { HourlyConsumptionChart } from "@/components/detail/hourly-consumption-chart"
import { BatteryDrainChart } from "@/components/detail/battery-drain-chart"
import { RSSIChart } from "@/components/detail/rssi-chart"
import { IMUChart } from "@/components/detail/imu-chart"
import { SMLPowerChart } from "@/components/detail/sml-power-chart"
import { AnomalyChart } from "@/components/detail/anomaly-chart"
import { PayloadExplorer } from "@/components/detail/payload-explorer"

import {
  getDeviceSummaries,
  getDeviceTypes,
  getReadings,
  getUplinks,
  getLastUplink,
  getDailyConsumption,
  getAnomalies,
} from "@/lib/api"
import { useSSE } from "@/lib/use-sse"
import { getDeviceStatus } from "@/lib/formatters"
import { DEVICE_TYPE_CONFIG, DEFAULT_DAYS, DEFAULT_TIMEZONE } from "@/lib/constants"
import type { DeviceSummary, DeviceType, Reading, Uplink, DailyConsumption, Anomaly, SSEEvent } from "@/lib/types"

export default function DeviceDetailPage() {
  const params = useParams()
  const devEui = decodeURIComponent(params.devEui as string)

  const [device, setDevice] = useState<DeviceSummary | null>(null)
  const [deviceType, setDeviceType] = useState<DeviceType>("unknown")
  const [readings, setReadings] = useState<Reading[]>([])
  const [uplinks, setUplinks] = useState<Uplink[]>([])
  const [lastUplink, setLastUplink] = useState<Uplink | null>(null)
  const [dailyData, setDailyData] = useState<DailyConsumption[]>([])
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [days, setDays] = useState(DEFAULT_DAYS)
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    try {
      const now = new Date()
      const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()

      const [summaries, types, readingsData, uplinksData, lastUp, daily, anomalyData] = await Promise.all([
        getDeviceSummaries(),
        getDeviceTypes(),
        getReadings(devEui, from, to),
        getUplinks(devEui, from, to),
        getLastUplink(devEui),
        getDailyConsumption(devEui, days, timezone),
        getAnomalies(devEui),
      ])

      const dev = summaries.find((d) => d.dev_eui === devEui) || null
      setDevice(dev)
      setDeviceType(types[devEui] || "unknown")
      setReadings(readingsData)
      setUplinks(uplinksData)
      setLastUplink(lastUp)
      setDailyData(daily.series)
      setAnomalies(anomalyData)
    } catch (err) {
      toast.error("Fehler beim Laden der Daten")
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [devEui, days, timezone])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // SSE live updates for this device
  const handleSSE = useCallback(
    (event: SSEEvent) => {
      if (event.devEui === devEui) {
        if (event.type === "up") {
          toast.info("Neuer Uplink empfangen", {
            description: event.meterValue != null ? `Zählerstand: ${event.meterValue}` : undefined,
          })
          fetchData()
        } else if (event.type === "auto-recalibrate") {
          toast.warning("Auto-Rekalibrierung ausgelöst")
          fetchData()
        }
      }
    },
    [devEui, fetchData]
  )
  const { connected } = useSSE(handleSSE)

  const unit = DEVICE_TYPE_CONFIG[deviceType].unit

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-zinc-600 dark:text-zinc-300">Gerätedaten werden geladen...</p>
        </div>
      </div>
    )
  }

  if (!device) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 mb-4">Gerät nicht gefunden: {devEui}</p>
          <Link href="/" className="text-blue-500 hover:underline text-sm">← Zurück zur Übersicht</Link>
        </div>
      </div>
    )
  }

  const status = getDeviceStatus(device)

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <BackgroundPlus className="fixed inset-0 opacity-[0.03]" plusColor="#3b82f6" plusSize={60} fade={true} />

      <div className="relative max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft size={16} className="text-zinc-500" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800">
                <DeviceIcon type={deviceType} size={22} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {device.device_name || device.dev_eui}
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{device.dev_eui}</p>
              </div>
            </div>
            <StatusBadge status={status} />
          </div>
          <LiveIndicator connected={connected} />
        </motion.div>

        {/* KPI Cards */}
        <KPICards device={device} deviceType={deviceType} />

        {/* Controls */}
        <ControlsPanel
          days={days}
          onDaysChange={setDays}
          timezone={timezone}
          onTimezoneChange={setTimezone}
          onRefresh={fetchData}
          loading={refreshing}
        />

        {/* Last Uplink + Downlinks side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LastUplinkPayload uplink={lastUplink} />
          <DownlinkPanel devEui={devEui} />
        </div>

        {/* Charts — always 2 columns per row */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DailyConsumptionChart data={dailyData} unit={unit} />
            <MeterBatteryChart unit={unit} readings={readings} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HourlyConsumptionChart readings={readings} unit={unit} />
            <BatteryDrainChart readings={readings} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RSSIChart readings={readings} />
            <IMUChart uplinks={uplinks} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {deviceType === "electricity_sml" && <SMLPowerChart uplinks={uplinks} />}
            <AnomalyChart anomalies={anomalies} />
            {deviceType !== "electricity_sml" && <PayloadExplorer uplinks={uplinks} />}
          </div>

          {deviceType === "electricity_sml" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PayloadExplorer uplinks={uplinks} />
            </div>
          )}
        </div>

        {/* Data Management */}
        <DataManagement devEui={devEui} onDataChanged={fetchData} />
      </div>
    </div>
  )
}
