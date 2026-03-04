"use client"

import type { DeviceStatus } from "@/lib/types"
import { STATUS_CONFIG } from "@/lib/formatters"

export function StatusBadge({ status }: { status: DeviceStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className="relative flex h-3 w-3"
      title={config.label}
    >
      <span
        className="absolute inset-0 rounded-full opacity-30 animate-ping"
        style={{ backgroundColor: config.color }}
      />
      <span
        className="relative inline-flex rounded-full h-3 w-3"
        style={{ backgroundColor: config.color }}
      />
    </span>
  )
}
