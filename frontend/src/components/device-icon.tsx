"use client"

import { Flame, Droplets, Zap, HelpCircle } from "lucide-react"
import type { DeviceType } from "@/lib/types"
import { DEVICE_TYPE_CONFIG } from "@/lib/constants"

const iconMap = {
  Flame,
  Droplets,
  Zap,
  HelpCircle,
}

export function DeviceIcon({ type, size = 20 }: { type: DeviceType; size?: number }) {
  const config = DEVICE_TYPE_CONFIG[type]
  const Icon = iconMap[config.icon as keyof typeof iconMap] || HelpCircle
  return <Icon size={size} style={{ color: config.color }} />
}
