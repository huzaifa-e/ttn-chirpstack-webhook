"use client"

import type { DeviceStatus } from "@/lib/types"
import { STATUS_CONFIG } from "@/lib/formatters"

export function StatusBadge({ status }: { status: DeviceStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor}`}
      style={{ color: config.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  )
}
