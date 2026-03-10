"use client"

import type React from "react"
import { useEffect } from "react"
import { motion } from "framer-motion"
import { Plus, X } from "lucide-react"
import { AddDeviceForm } from "@/components/add-device-form"
import type { DeviceType } from "@/lib/types"

export const AddDeviceModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { dev_eui: string; name: string; device_type: DeviceType }) => Promise<void>
}> = ({ isOpen, onClose, onSubmit }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-blue-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Neues Gerät konfigurieren</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X size={18} className="text-zinc-400" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <AddDeviceForm onSubmit={onSubmit} onSuccess={onClose} />
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
