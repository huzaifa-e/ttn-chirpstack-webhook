"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deleteConfiguredDevice, deleteDevice } from "@/lib/api"

export function DeleteDevicePanel({
  deviceUuid,
  devEui,
}: {
  deviceUuid: string
  devEui: string
}) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteConfiguredDevice(deviceUuid)
      await deleteDevice(devEui)
      toast.success("Gerät gelöscht")
      router.push("/")
    } catch (err) {
      console.error("Failed to delete device:", err)
      toast.error("Fehler beim Löschen des Geräts", { description: String(err) })
    } finally {
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="rounded-xl border border-red-200/60 dark:border-red-900/60 bg-white/80 dark:bg-zinc-950/80 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">Gerät löschen</h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Löscht das konfigurierte Gerät und alle zugehörigen Daten unwiderruflich.
      </p>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
        >
          <Trash2 size={12} />
          Gerät löschen
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-red-600 dark:text-red-400">
            Wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleting ? "Lösche..." : "Ja, löschen"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
