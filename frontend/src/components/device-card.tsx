"use client"

import type React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Battery, Radio, Clock, Activity, Timer } from "lucide-react"
import { ProfessionalCard } from "./professional-card"
import { SparklineChart } from "./sparkline-chart"
import { DeviceIcon } from "./device-icon"
import { StatusBadge } from "./status-badge"
import type { DeviceSummary, DeviceType } from "@/lib/types"
import { DEVICE_TYPE_CONFIG } from "@/lib/constants"
import {
  formatMeterValue,
  formatBatteryMv,
  formatBatteryPercent,
  formatRSSI,
  estimateDistance,
  formatTimeAgo,
  formatInterval,
  estimateBatteryLifetime,
  getDeviceStatus,
} from "@/lib/formatters"
import { setDeviceType } from "@/lib/api"

export const DeviceCard: React.FC<{
  device: DeviceSummary
  deviceType: DeviceType
  sparklineData?: number[]
  delay?: number
  onTypeChange?: (devEui: string, newType: DeviceType) => void
}> = ({ device, deviceType, sparklineData = [], delay = 0, onTypeChange }) => {
  const [isActive, setIsActive] = useState(false)
  const [currentType, setCurrentType] = useState(deviceType)
  const status = getDeviceStatus(device)
  const batteryPct = formatBatteryPercent(device.battery_mv)
  const config = DEVICE_TYPE_CONFIG[currentType]

  const handleTypeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as DeviceType
    setCurrentType(newType)
    try {
      await setDeviceType(device.dev_eui, newType)
      onTypeChange?.(device.dev_eui, newType)
    } catch {
      setCurrentType(deviceType) // revert on error
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 30 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      className="relative group"
    >
      <Link href={`/device/${encodeURIComponent(device.dev_eui)}`}>
        <ProfessionalCard isActive={isActive} accentColor={config.color}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.div
                className="relative w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800"
                whileHover={{ rotate: 5, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <DeviceIcon type={currentType} size={22} />
              </motion.div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {device.device_name || device.dev_eui}
                </h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono tracking-wider truncate">
                  {device.dev_eui}
                </p>
              </div>
            </div>
            <StatusBadge status={status} />
          </div>

          {/* Meter Value */}
          <div className="mb-3">
            <motion.div
              className="text-2xl font-bold text-zinc-900 dark:text-zinc-100"
              animate={{ scale: isActive ? 1.03 : 1 }}
              transition={{ duration: 0.2 }}
            >
              {formatMeterValue(device.meter_value, currentType)}
            </motion.div>
          </div>

          {/* Sparkline */}
          {sparklineData.length > 1 && (
            <div className="mb-3 rounded-lg border border-zinc-200/50 dark:border-zinc-700/50 bg-gradient-to-br from-zinc-50/50 to-white dark:from-zinc-900/50 dark:to-zinc-800/50 overflow-hidden">
              <SparklineChart data={sparklineData} positive={true} height={80} />
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Battery size={12} className="text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400">Batterie</span>
              <span className="ml-auto font-semibold text-zinc-900 dark:text-zinc-100">
                {formatBatteryMv(device.battery_mv)}
                {batteryPct != null && <span className="text-zinc-400 ml-0.5">({batteryPct}%)</span>}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Radio size={12} className="text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400">RSSI</span>
              <span className="ml-auto font-semibold text-zinc-900 dark:text-zinc-100">
                {formatRSSI(device.rssi)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Timer size={12} className="text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400">Intervall</span>
              <span className="ml-auto font-semibold text-zinc-900 dark:text-zinc-100">
                {formatInterval(device.avg_interval_seconds)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400">Zuletzt</span>
              <span className="ml-auto font-semibold text-zinc-900 dark:text-zinc-100">
                {formatTimeAgo(device.last_seen)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity size={12} className="text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400">Uplinks</span>
              <span className="ml-auto font-semibold text-zinc-900 dark:text-zinc-100">
                {device.total_uplinks}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Radio size={12} className="text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400">Distanz</span>
              <span className="ml-auto font-semibold text-zinc-900 dark:text-zinc-100">
                {estimateDistance(device.rssi)}
              </span>
            </div>
          </div>

          {/* Battery lifetime */}
          <div className="mt-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50 text-xs text-zinc-500 dark:text-zinc-400">
            Batterie-Laufzeit: <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {estimateBatteryLifetime(device.battery_mv, device.avg_interval_seconds)}
            </span>
          </div>

          {/* Device type selector */}
          <div className="mt-2" onClick={(e) => e.preventDefault()}>
            <select
              value={currentType}
              onChange={handleTypeChange}
              className="w-full text-xs px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Object.entries(DEVICE_TYPE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
        </ProfessionalCard>
      </Link>
    </motion.div>
  )
}
