"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { BackgroundPlus } from "@/demos/background-plus"
import { DeviceIcon } from "@/components/device-icon"
import { StatusBadge } from "@/components/status-badge"
import { LiveIndicator } from "@/components/live-indicator"
import { KPICards } from "@/components/detail/kpi-cards"
import { ControlsPanel } from "@/components/detail/controls-panel"
import { DataManagement } from "@/components/detail/data-management"
import { DailyConsumptionChart, MeterBatteryChart } from "@/components/detail/daily-consumption-chart"
import { HourlyConsumptionChart } from "@/components/detail/hourly-consumption-chart"
import { BatteryDrainChart } from "@/components/detail/battery-drain-chart"
import { RSSIChart } from "@/components/detail/rssi-chart"
import { IMUChart } from "@/components/detail/imu-chart"
import { SMLPowerChart } from "@/components/detail/sml-power-chart"
import { AnomalyChart } from "@/components/detail/anomaly-chart"
import { ConsumptionHeatmap } from "@/components/detail/consumption-heatmap"
import { PayloadExplorer } from "@/components/detail/payload-explorer"
import { LastUplinkPayload } from "@/components/detail/last-uplink-payload"
import { IntervalDownlinkPanel } from "@/components/detail/interval-downlink-panel"
import { RecalibratePanel } from "@/components/detail/recalibrate-panel"
import { ExportPanel } from "@/components/detail/export-panel"
import { DeleteDevicePanel } from "@/components/detail/delete-device-panel"
import { AddDeviceForm } from "@/components/add-device-form"

import {
  getDeviceSummaries,
  getReadings,
  getUplinks,
  getLastUplink,
  getDailyConsumption,
  getAnomalies,
  getConfiguredDevice,
  createConfiguredDevice,
} from "@/lib/api"
import { useSSE } from "@/lib/use-sse"
import { getDeviceStatus } from "@/lib/formatters"
import { DEVICE_TYPE_CONFIG, DEFAULT_DAYS, DEFAULT_TIMEZONE } from "@/lib/constants"
import { analyzeUplinkFailures } from "@/lib/failure-analysis"
import { useSetDeviceControls } from "@/lib/device-controls-context"
import type { DeviceSummary, DeviceType, Reading, Uplink, DailyConsumption, Anomaly, SSEEvent } from "@/lib/types"

const CONSUMPTION_DAYS = 365
const CONSUMPTION_HISTORY_DAYS = 1200

export default function DeviceDetailPage() {
  const params = useParams()
  const deviceUuid = decodeURIComponent(params.uuid as string)

  const [devEui, setDevEui] = useState<string>("")
  const [device, setDevice] = useState<DeviceSummary | null>(null)
  const [deviceType, setDeviceType] = useState<DeviceType>("unknown")
  const [readings, setReadings] = useState<Reading[]>([])
  const [consumptionReadings, setConsumptionReadings] = useState<Reading[]>([])
  const [uplinks, setUplinks] = useState<Uplink[]>([])
  const [lastUplink, setLastUplink] = useState<Uplink | null>(null)
  const [dailyData, setDailyData] = useState<DailyConsumption[]>([])
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [days, setDays] = useState(DEFAULT_DAYS)
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)
  const [activeSection, setActiveSection] = useState<"sectionCharts" | "sectionPayload" | "sectionDownlink" | "sectionRecalibrate" | "sectionDataMgmt" | "sectionExport" | "sectionAddDevice" | "sectionDeleteDevice">("sectionCharts")

  // Resolve UUID to devEui on mount (for display / SSE matching)
  useEffect(() => {
    getConfiguredDevice(deviceUuid)
      .then((cfg) => {
        setDevEui(cfg.dev_eui)
        setDeviceType(cfg.device_type)
      })
      .catch(() => {
        toast.error("Gerät nicht gefunden")
        setLoading(false)
      })
  }, [deviceUuid])

  const fetchData = useCallback(async () => {
    if (!deviceUuid) return
    setRefreshing(true)
    try {
      const now = new Date()
      const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
      const fromConsumption = new Date(now.getTime() - CONSUMPTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()

      const [summaries, readingsData, consumptionReadingsData, uplinksData, lastUp, daily, anomalyData] = await Promise.all([
        getDeviceSummaries(),
        getReadings(deviceUuid, from, to),
        getReadings(deviceUuid, fromConsumption, to),
        getUplinks(deviceUuid, from, to),
        getLastUplink(deviceUuid),
        getDailyConsumption(deviceUuid, CONSUMPTION_HISTORY_DAYS, timezone),
        getAnomalies(deviceUuid),
      ])

      const dev = summaries.find((d) => d.dev_eui === devEui || d.uuid === deviceUuid) || null
      setDevice(dev)
      setReadings(readingsData)
      setConsumptionReadings(consumptionReadingsData)
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
  }, [deviceUuid, devEui, days, timezone])

  useEffect(() => {
    if (devEui) fetchData()
  }, [devEui, fetchData])

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
  const failureAnalysis = useMemo(
    () => analyzeUplinkFailures(uplinks, device?.avg_interval_seconds ?? null),
    [uplinks, device?.avg_interval_seconds],
  )

  // Register controls into the shared sidebar context
  useSetDeviceControls(useMemo(() => ({
    days, setDays, timezone, setTimezone, refreshing, fetchData, lastUplink, devEui, deviceUuid, activeSection, setActiveSection,
  }), [days, timezone, refreshing, fetchData, lastUplink, devEui, deviceUuid, activeSection]))

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
          <p className="text-zinc-500 mb-4">Gerät nicht gefunden: {deviceUuid}</p>
          <Link href="/" className="text-blue-500 hover:underline text-sm inline-flex items-center gap-1"><ArrowLeft size={14} /> Zurück zur Übersicht</Link>
        </div>
      </div>
    )
  }

  const status = getDeviceStatus(device)

  const renderSection = () => {
    switch (activeSection) {
      case "sectionPayload":
        return <LastUplinkPayload uplink={lastUplink} />
      case "sectionDownlink":
        return <IntervalDownlinkPanel devEui={devEui} deviceUuid={deviceUuid} />
      case "sectionRecalibrate":
        return <RecalibratePanel devEui={devEui} deviceUuid={deviceUuid} />
      case "sectionDataMgmt":
        return <DataManagement devEui={deviceUuid} onDataChanged={fetchData} />
      case "sectionExport":
        return <ExportPanel devEuiOrUuid={deviceUuid} />
      case "sectionAddDevice":
        return (
          <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Gerät hinzufügen</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Erstellt ein neues konfiguriertes Gerät über die API.
            </p>
            <AddDeviceForm
              onSubmit={async (data) => {
                const created = await createConfiguredDevice(data)
                toast.success(`Gerät "${created.name}" erstellt`, {
                  description: `UUID: ${created.uuid}`,
                })
              }}
            />
          </div>
        )
      case "sectionDeleteDevice":
        return <DeleteDevicePanel deviceUuid={deviceUuid} devEui={devEui} />
      case "sectionCharts":
      default:
        return (
          <div className="space-y-6">
            <KPICards device={device} deviceType={deviceType} failureCount={failureAnalysis.failures.length} />

            <ControlsPanel
              days={days}
              onDaysChange={setDays}
              timezone={timezone}
              onTimezoneChange={setTimezone}
              onRefresh={fetchData}
              loading={refreshing}
            />

            <div className="flex justify-end">
              <Link
                href={`/device/${encodeURIComponent(deviceUuid)}/failures`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 bg-red-50/60 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-sm font-medium transition-colors"
              >
                <AlertTriangle size={16} />
                Failure-Logs öffnen ({failureAnalysis.failures.length})
              </Link>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ConsumptionHeatmap readings={consumptionReadings} unit={unit} />
                <DailyConsumptionChart data={dailyData} unit={unit} dailyWindowDays={CONSUMPTION_DAYS} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MeterBatteryChart unit={unit} readings={readings} />
                <HourlyConsumptionChart readings={consumptionReadings} unit={unit} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BatteryDrainChart readings={readings} />
                <RSSIChart readings={readings} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <IMUChart uplinks={uplinks} />
                <AnomalyChart anomalies={anomalies} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {deviceType === "electricity_sml" && <SMLPowerChart uplinks={uplinks} />}
                <PayloadExplorer uplinks={uplinks} />
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen">
      <BackgroundPlus className="fixed inset-0 opacity-[0.03]" plusColor="#3b82f6" plusSize={60} fade={true} />

      {/* Main content */}
      <div className="relative p-4 sm:p-6 lg:p-8 space-y-6">
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

        {renderSection()}
      </div>
    </div>
  )
}
