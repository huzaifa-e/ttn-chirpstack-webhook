"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { sendRecalibrateDownlink } from "@/lib/api"

export function RecalibratePanel({ devEui, deviceUuid }: { devEui: string; deviceUuid?: string }) {
  const [fPort, setFPort] = useState(15)
  const [sending, setSending] = useState(false)

  const handleRecalibrate = async () => {
    setSending(true)
    try {
      await sendRecalibrateDownlink({ uuid: deviceUuid, devEui, fPort })
      toast.success("Rekalibrierung gesendet", {
        description: `Downlink auf fPort ${fPort}`,
      })
    } catch (err) {
      toast.error("Fehler beim Senden", { description: String(err) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Rekalibrierung</h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Sendet den Rekalibrierungs-Downlink an das aktuelle Gerät.
      </p>

      <div>
        <label className="text-[10px] text-zinc-500 block mb-1">fPort</label>
        <input
          type="number"
          min={1}
          max={255}
          value={fPort}
          onChange={(e) => setFPort(Number(e.target.value))}
          className="w-20 text-xs px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={handleRecalibrate}
        disabled={sending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-500/50 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50"
      >
        <RotateCcw size={12} />
        Rekalibrierung senden
      </button>
    </div>
  )
}
