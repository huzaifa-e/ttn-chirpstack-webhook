"use client"

import { motion } from "framer-motion"
import { Clock, Battery, Radio, Gauge, Timer, Activity } from "lucide-react"
import type { DeviceSummary, DeviceType } from "@/lib/types"
import {
  formatMeterValue,
  formatBatteryMv,
  formatBatteryPercent,
  formatRSSI,
  estimateDistance,
  formatTimeAgo,
  formatInterval,
} from "@/lib/formatters"
import { BATTERY_RANGES } from "@/lib/constants"

function getBatteryColor(mv: number | null): string {
  if (mv == null) return "#6b7280"
  if (mv >= BATTERY_RANGES.good.min) return BATTERY_RANGES.good.color
  if (mv >= BATTERY_RANGES.ok.min) return BATTERY_RANGES.ok.color
  return BATTERY_RANGES.low.color
}

interface KPICardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color?: string
  delay?: number
}

function KPICard({ icon, label, value, sub, color, delay = 0 }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: color || "#6b7280" }}>{icon}</span>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{value}</div>
      {sub && <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{sub}</div>}
    </motion.div>
  )
}

export function KPICards({
  device,
  deviceType,
}: {
  device: DeviceSummary
  deviceType: DeviceType
}) {
  const batteryPct = formatBatteryPercent(device.battery_mv)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <KPICard
        icon={<Clock size={16} />}
        label="Zuletzt gesehen"
        value={formatTimeAgo(device.last_seen)}
        sub={device.last_seen ? new Date(device.last_seen).toLocaleString("de-DE") : undefined}
        delay={0}
      />
      <KPICard
        icon={<Battery size={16} />}
        label="Batterie"
        value={formatBatteryMv(device.battery_mv)}
        sub={batteryPct != null ? `${batteryPct}%` : undefined}
        color={getBatteryColor(device.battery_mv)}
        delay={0.05}
      />
      <KPICard
        icon={<Radio size={16} />}
        label="RSSI"
        value={formatRSSI(device.rssi)}
        sub={estimateDistance(device.rssi)}
        delay={0.1}
      />
      <KPICard
        icon={<Gauge size={16} />}
        label="Zählerstand"
        value={formatMeterValue(device.meter_value, deviceType)}
        sub={device.last_seen ? new Date(device.last_seen).toLocaleString("de-DE") : undefined}
        color="#3b82f6"
        delay={0.15}
      />
      <KPICard
        icon={<Timer size={16} />}
        label="Intervall"
        value={formatInterval(device.avg_interval_seconds)}
        sub={`${device.total_uplinks} Uplinks`}
        delay={0.2}
      />
      <KPICard
        icon={<Activity size={16} />}
        label="Uplinks gesamt"
        value={String(device.total_uplinks)}
        sub={device.first_seen ? `Seit ${new Date(device.first_seen).toLocaleDateString("de-DE")}` : undefined}
        delay={0.25}
      />
    </div>
  )
}
