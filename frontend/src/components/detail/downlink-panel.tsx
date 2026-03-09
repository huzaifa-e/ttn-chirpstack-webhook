"use client"

import { useState } from "react"
import { Send, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { sendIntervalDownlink, sendRecalibrateDownlink } from "@/lib/api"

export function DownlinkPanel({ devEui, deviceUuid }: { devEui: string; deviceUuid?: string }) {
  const [intervalValue, setIntervalValue] = useState(15)
  const [intervalUnit, setIntervalUnit] = useState<"s" | "m" | "h">("m")
  const [fPort, setFPort] = useState(15)
  const [sending, setSending] = useState(false)

  const getSeconds = () => {
    switch (intervalUnit) {
      case "s": return intervalValue
      case "m": return intervalValue * 60
      case "h": return intervalValue * 3600
    }
  }

  const handleSendInterval = async () => {
    setSending(true)
    try {
      await sendIntervalDownlink({ uuid: deviceUuid, devEui, seconds: getSeconds(), fPort })
      toast.success("Intervall-Downlink gesendet", {
        description: `${intervalValue}${intervalUnit} auf fPort ${fPort}`,
      })
    } catch (err) {
      toast.error("Fehler beim Senden", { description: String(err) })
    } finally {
      setSending(false)
    }
  }

  const handleRecalibrate = async () => {
    setSending(true)
    try {
      await sendRecalibrateDownlink({ uuid: deviceUuid, devEui, fPort })
      toast.success("Rekalibrierung gesendet")
    } catch (err) {
      toast.error("Fehler beim Senden", { description: String(err) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Downlinks</h3>

      {/* Interval setter */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">Intervall</label>
          <input
            type="number"
            min={1}
            value={intervalValue}
            onChange={(e) => setIntervalValue(Number(e.target.value))}
            className="w-20 text-xs px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">Einheit</label>
          <select
            value={intervalUnit}
            onChange={(e) => setIntervalUnit(e.target.value as "s" | "m" | "h")}
            className="text-xs px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="s">Sekunden</option>
            <option value="m">Minuten</option>
            <option value="h">Stunden</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">fPort</label>
          <input
            type="number"
            min={1}
            max={255}
            value={fPort}
            onChange={(e) => setFPort(Number(e.target.value))}
            className="w-16 text-xs px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleSendInterval}
          disabled={sending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Send size={12} />
          Senden
        </button>
      </div>

      {/* Recalibrate */}
      <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50">
        <button
          onClick={handleRecalibrate}
          disabled={sending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-500/50 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50"
        >
          <RotateCcw size={12} />
          Rekalibrieren
        </button>
      </div>
    </div>
  )
}
