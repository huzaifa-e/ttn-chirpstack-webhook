"use client"

import { Download } from "lucide-react"
import { getExportUrl } from "@/lib/api"

export function ExportPanel({ devEuiOrUuid }: { devEuiOrUuid: string }) {
  const handleExport = (format: "json" | "csv") => {
    window.open(getExportUrl(devEuiOrUuid, format), "_blank")
  }

  return (
    <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Export</h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Exportiert die Uplink-Daten des aktuellen Geräts als JSON oder CSV.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => handleExport("json")}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <Download size={12} />
          JSON
        </button>
        <button
          onClick={() => handleExport("csv")}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <Download size={12} />
          CSV
        </button>
      </div>
    </div>
  )
}
