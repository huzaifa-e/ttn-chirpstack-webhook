"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { DEVICE_TYPE_CONFIG } from "@/lib/constants"
import type { DeviceType } from "@/lib/types"

export function AddDeviceForm({
  onSubmit,
  submitLabel = "Gerät erstellen",
  onSuccess,
}: {
  onSubmit: (data: { dev_eui: string; name: string; device_type: DeviceType }) => Promise<void>
  submitLabel?: string
  onSuccess?: () => void
}) {
  const [devEui, setDevEui] = useState("")
  const [name, setName] = useState("")
  const [deviceType, setDeviceType] = useState<DeviceType>("unknown")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setError("")
  }, [devEui, name, deviceType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedEui = devEui.trim().toLowerCase()
    const trimmedName = name.trim()
    if (!trimmedEui) {
      setError("DevEUI ist erforderlich")
      return
    }
    if (!trimmedName) {
      setError("Name ist erforderlich")
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({ dev_eui: trimmedEui, name: trimmedName, device_type: deviceType })
      setDevEui("")
      setName("")
      setDeviceType("unknown")
      setError("")
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">DevEUI</label>
        <input
          type="text"
          value={devEui}
          onChange={(e) => setDevEui(e.target.value)}
          placeholder="z.B. 0011223344556677"
          className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Küche Gas Zähler"
          className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Gerätetyp</label>
        <select
          value={deviceType}
          onChange={(e) => setDeviceType(e.target.value as DeviceType)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Object.entries(DEVICE_TYPE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {submitting ? "Erstellen..." : submitLabel}
      </button>
    </form>
  )
}
