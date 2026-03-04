"use client"

import { useState } from "react"
import { Trash2, Download, Hash } from "lucide-react"
import { toast } from "sonner"
import { getTxCount, deleteDataPoint, deleteDataRange, getExportUrl } from "@/lib/api"
import type { DeleteSource } from "@/lib/types"

export function DataManagement({ devEui, onDataChanged }: { devEui: string; onDataChanged?: () => void }) {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [singleAt, setSingleAt] = useState("")
  const [source, setSource] = useState<DeleteSource>("both")
  const [txCount, setTxCount] = useState<number | null>(null)

  const setNow = (setter: (v: string) => void) => {
    setter(new Date().toISOString().slice(0, 16))
  }

  const handleCount = async () => {
    if (!from || !to) { toast.error("Bitte Zeitraum angeben"); return }
    try {
      const count = await getTxCount(devEui, new Date(from).toISOString(), new Date(to).toISOString())
      setTxCount(count)
      toast.info(`${count} Übertragungen im Zeitraum`)
    } catch (err) {
      toast.error("Fehler", { description: String(err) })
    }
  }

  const handleDeleteRange = async () => {
    if (!from || !to) { toast.error("Bitte Zeitraum angeben"); return }
    if (!confirm("Daten im Zeitraum wirklich löschen?")) return
    try {
      const result = await deleteDataRange(devEui, new Date(from).toISOString(), new Date(to).toISOString(), source)
      toast.success(`Gelöscht: ${result.readingsDeleted} Readings, ${result.uplinksDeleted} Uplinks`)
      onDataChanged?.()
    } catch (err) {
      toast.error("Fehler", { description: String(err) })
    }
  }

  const handleDeleteSingle = async () => {
    if (!singleAt) { toast.error("Bitte Zeitpunkt angeben"); return }
    if (!confirm("Datenpunkt wirklich löschen?")) return
    try {
      const result = await deleteDataPoint(devEui, new Date(singleAt).toISOString(), source)
      toast.success(`Gelöscht: ${result.readingsDeleted} Readings, ${result.uplinksDeleted} Uplinks`)
      onDataChanged?.()
    } catch (err) {
      toast.error("Fehler", { description: String(err) })
    }
  }

  const handleExport = (format: "json" | "csv") => {
    const fromISO = from ? new Date(from).toISOString() : undefined
    const toISO = to ? new Date(to).toISOString() : undefined
    window.open(getExportUrl(devEui, format, fromISO, toISO), "_blank")
  }

  return (
    <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Datenverwaltung</h3>

      {/* Source selector */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-zinc-500">Quelle:</label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as DeleteSource)}
          className="text-xs px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="both">Beide</option>
          <option value="readings">Readings</option>
          <option value="uplinks">Uplinks</option>
        </select>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">Von</label>
          <div className="flex gap-1">
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button onClick={() => setNow(setFrom)} className="text-[10px] text-blue-500 hover:underline">Jetzt</button>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">Bis</label>
          <div className="flex gap-1">
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button onClick={() => setNow(setTo)} className="text-[10px] text-blue-500 hover:underline">Jetzt</button>
          </div>
        </div>
      </div>

      {/* Range actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleCount} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          <Hash size={12} />
          Zählen{txCount != null && ` (${txCount})`}
        </button>
        <button onClick={handleDeleteRange} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
          <Trash2 size={12} />
          Bereich löschen
        </button>
      </div>

      {/* Single point delete */}
      <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50 flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">Einzelnen Punkt löschen</label>
          <input
            type="datetime-local"
            value={singleAt}
            onChange={(e) => setSingleAt(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button onClick={handleDeleteSingle} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
          <Trash2 size={12} />
          Löschen
        </button>
      </div>

      {/* Export */}
      <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50 flex gap-2">
        <button onClick={() => handleExport("json")} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          <Download size={12} />
          JSON
        </button>
        <button onClick={() => handleExport("csv")} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          <Download size={12} />
          CSV
        </button>
      </div>
    </div>
  )
}
