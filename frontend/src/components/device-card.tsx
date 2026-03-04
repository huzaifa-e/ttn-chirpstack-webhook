"use client"

import type React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Battery, Clock, Activity } from "lucide-react"
import { ProfessionalCard } from "./professional-card"
import { ConsumptionSparkline } from "./consumption-sparkline"
import { DeviceIcon } from "./device-icon"
import { StatusBadge } from "./status-badge"
import type { DeviceSummary, DeviceType } from "@/lib/types"
import { DEVICE_TYPE_CONFIG } from "@/lib/constants"
import {
  formatMeterValue,
  formatBatteryPercent,
  formatTimeAgo,
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

  // Battery bar color
  const batteryColor =
    batteryPct == null ? "#6b7280" :
    batteryPct > 60 ? "#10b981" :
    batteryPct > 25 ? "#eab308" : "#ef4444"

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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                className="relative w-11 h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800"
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

          {/* Meter Value (Zählerstand) */}
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Zählerstand</p>
            <motion.div
              className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight"
              animate={{ scale: isActive ? 1.03 : 1 }}
              transition={{ duration: 0.2 }}
            >
              {formatMeterValue(device.meter_value, currentType)}
            </motion.div>
          </div>

          {/* Consumption Mini Chart */}
          {sparklineData.length > 2 && (
            <div className="mb-4 rounded-lg border border-zinc-200/50 dark:border-zinc-700/50 bg-gradient-to-br from-zinc-50/50 to-white dark:from-zinc-900/50 dark:to-zinc-800/50 p-2">
              <ConsumptionSparkline
                meterValues={sparklineData}
                height={52}
                barColor={config.color}
              />
            </div>
          )}

          {/* Key Metrics - clean 3-column row */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Battery size={11} className="text-zinc-400" />
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Batterie</span>
              </div>
              <div className="relative">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {batteryPct != null ? `${batteryPct}%` : "—"}
                </span>
                {batteryPct != null && (
                  <div className="mt-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${batteryPct}%`, backgroundColor: batteryColor }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock size={11} className="text-zinc-400" />
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Zuletzt</span>
              </div>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {formatTimeAgo(device.last_seen)}
              </span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Activity size={11} className="text-zinc-400" />
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Uplinks</span>
              </div>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {device.total_uplinks}
              </span>
            </div>
          </div>

          {/* Device type selector */}
          <div className="pt-3 border-t border-zinc-200/50 dark:border-zinc-700/50" onClick={(e) => e.preventDefault()}>
            <select
              value={currentType}
              onChange={handleTypeChange}
              className="w-full text-xs px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
