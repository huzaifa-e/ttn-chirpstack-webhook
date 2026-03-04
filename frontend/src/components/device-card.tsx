"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Battery, Clock, Activity, Radio, Timer, MapPin } from "lucide-react"
import { ProfessionalCard } from "./professional-card"
import { DeviceIcon } from "./device-icon"
import { StatusBadge } from "./status-badge"
import type { DeviceSummary, DeviceType } from "@/lib/types"
import { DEVICE_TYPE_CONFIG } from "@/lib/constants"
import {
  formatMeterValueRaw,
  formatBatteryMv,
  formatRSSI,
  estimateDistance,
  formatInterval,
  formatTimeAgo,
  getDeviceStatus,
} from "@/lib/formatters"
import { setDeviceType } from "@/lib/api"

/** Tiny inline SVG line chart for Zählerstand history */
const MiniLineChart: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = ({
  data,
  color,
  width = 90,
  height = 36,
}) => {
  const path = useMemo(() => {
    if (data.length < 2) return ""
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const pad = 2
    const w = width - pad * 2
    const h = height - pad * 2
    return data
      .map((v, i) => {
        const x = pad + (i / (data.length - 1)) * w
        const y = pad + h - ((v - min) / range) * h
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(" ")
  }, [data, width, height])

  const gradId = `ml-${color.replace("#", "")}`

  const fillPath = useMemo(() => {
    if (data.length < 2) return ""
    const pad = 2
    const w = width - pad * 2
    return `${path} L ${(pad + w).toFixed(1)} ${(height - pad).toFixed(1)} L ${pad} ${(height - pad).toFixed(1)} Z`
  }, [path, data.length, width, height])

  if (data.length < 2) return null

  return (
    <svg width={width} height={height} className="shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

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

          {/* Meter Value (Zählerstand) + mini line chart */}
          <div className="flex items-end justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Zählerstand</p>
              <motion.div
                className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight"
                animate={{ scale: isActive ? 1.03 : 1 }}
                transition={{ duration: 0.2 }}
              >
                {device.meter_value_raw ?? formatMeterValueRaw(device.meter_value)}
              </motion.div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{config.unit}</p>
            </div>
            {sparklineData.length > 2 && (
              <MiniLineChart data={sparklineData} color={config.color} />
            )}
          </div>

          {/* Key Metrics - clean 3-column row */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Battery size={11} className="text-zinc-400" />
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Batterie</span>
              </div>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {formatBatteryMv(device.battery_mv)}
              </span>
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

          {/* Secondary Metrics - RSSI, Distance, Interval */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Radio size={11} className="text-zinc-400" />
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">RSSI</span>
              </div>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {formatRSSI(device.rssi)}
              </span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <MapPin size={11} className="text-zinc-400" />
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Distanz</span>
              </div>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {estimateDistance(device.rssi)}
              </span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Timer size={11} className="text-zinc-400" />
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Intervall</span>
              </div>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {formatInterval(device.avg_interval_seconds)}
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
