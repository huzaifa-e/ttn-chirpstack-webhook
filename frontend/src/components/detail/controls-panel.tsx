"use client"

import { RefreshCw } from "lucide-react"

interface ControlsPanelProps {
  days: number
  onDaysChange: (days: number) => void
  timezone: string
  onTimezoneChange: (tz: string) => void
  onRefresh: () => void
  loading?: boolean
}

export function ControlsPanel({ days, onDaysChange, timezone, onTimezoneChange, onRefresh, loading }: ControlsPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tage:</label>
        <input
          type="range"
          min={1}
          max={365}
          value={days}
          onChange={(e) => onDaysChange(Number(e.target.value))}
          className="w-32 accent-blue-500"
        />
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 w-8">{days}</span>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Zeitzone:</label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => onTimezoneChange(e.target.value)}
          className="text-xs px-2 py-1 w-36 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        Aktualisieren
      </button>
    </div>
  )
}
