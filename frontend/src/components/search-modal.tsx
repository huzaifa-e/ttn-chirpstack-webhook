"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Search } from "lucide-react"
import type { DeviceSummary, DeviceType } from "@/lib/types"
import { DeviceIcon } from "./device-icon"
import { DEVICE_TYPE_CONFIG } from "@/lib/constants"

export const SearchModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  devices: DeviceSummary[]
  deviceTypes: Record<string, DeviceType>
  onSelect: (devEui: string) => void
}> = ({ isOpen, onClose, devices, deviceTypes, onSelect }) => {
  const [query, setQuery] = useState("")

  const filtered = devices.filter((d) => {
    const q = query.toLowerCase()
    return (
      d.dev_eui.toLowerCase().includes(q) ||
      (d.device_name?.toLowerCase().includes(q) ?? false) ||
      (DEVICE_TYPE_CONFIG[deviceTypes[d.dev_eui] || "unknown"]?.label.toLowerCase().includes(q) ?? false)
    )
  })

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 p-4 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
          <Search size={16} className="text-zinc-400" />
          <input
            type="text"
            placeholder="Gerät suchen (Name, EUI, Typ)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((d) => (
              <button
                key={d.dev_eui}
                onClick={() => {
                  onSelect(d.uuid || d.dev_eui)
                  onClose()
                  setQuery("")
                }}
                className="w-full p-3 text-left flex items-center gap-3 border-b border-zinc-200 hover:bg-zinc-50 transition-colors dark:border-zinc-800 dark:hover:bg-zinc-800/50"
              >
                <DeviceIcon type={deviceTypes[d.dev_eui] || "unknown"} size={18} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {d.device_name || d.dev_eui}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {d.dev_eui}
                  </div>
                </div>
                <span className="text-xs text-zinc-400">
                  {DEVICE_TYPE_CONFIG[deviceTypes[d.dev_eui] || "unknown"].label}
                </span>
              </button>
            ))
          ) : (
            <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
              {query ? "Keine Geräte gefunden" : "Suchbegriff eingeben..."}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
