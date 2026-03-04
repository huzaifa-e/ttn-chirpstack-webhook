"use client"

import type { Uplink } from "@/lib/types"

export function LastUplinkPayload({ uplink }: { uplink: Uplink | null }) {
  if (!uplink) {
    return (
      <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-4">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Letzter Uplink-Payload</h3>
        <p className="text-xs text-zinc-400">Kein Uplink vorhanden</p>
      </div>
    )
  }

  const payload = uplink.decoded_json || uplink.payload_json

  return (
    <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-4">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Letzter Uplink-Payload</h3>
      <p className="text-[10px] text-zinc-400 mb-2">
        {new Date(uplink.at).toLocaleString("de-DE")} · {uplink.provider || "unknown"}
      </p>
      <pre className="text-xs bg-zinc-50 dark:bg-zinc-900 rounded-lg p-3 overflow-x-auto max-h-48 text-zinc-700 dark:text-zinc-300 font-mono">
        {payload ? JSON.stringify(payload, null, 2) : "—"}
      </pre>
    </div>
  )
}
