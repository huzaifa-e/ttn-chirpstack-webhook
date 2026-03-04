"use client"

import { motion } from "framer-motion"
import type { DeviceStatus } from "@/lib/types"
import { STATUS_CONFIG } from "@/lib/formatters"

interface OverviewStatsProps {
  counts: Record<DeviceStatus | "total", number>
}

export function OverviewStats({ counts }: OverviewStatsProps) {
  const items: { key: DeviceStatus | "total"; label: string; color: string }[] = [
    { key: "total", label: "Gesamt", color: "#3b82f6" },
    { key: "active", label: STATUS_CONFIG.active.label, color: STATUS_CONFIG.active.color },
    { key: "warning", label: STATUS_CONFIG.warning.label, color: STATUS_CONFIG.warning.color },
    { key: "offline", label: STATUS_CONFIG.offline.label, color: STATUS_CONFIG.offline.color },
    { key: "inactive", label: STATUS_CONFIG.inactive.label, color: STATUS_CONFIG.inactive.color },
  ]

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200/50 bg-white/80 dark:border-zinc-800/50 dark:bg-zinc-900/80 backdrop-blur-sm"
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.label}</span>
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{counts[item.key]}</span>
        </motion.div>
      ))}
    </div>
  )
}
