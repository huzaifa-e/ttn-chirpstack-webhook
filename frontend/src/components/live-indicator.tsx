"use client"

export function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {connected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connected ? "bg-emerald-500" : "bg-zinc-400"}`}
        />
      </span>
      <span className={`text-xs font-medium ${connected ? "text-emerald-500" : "text-zinc-400"}`}>
        {connected ? "Live" : "Offline"}
      </span>
    </div>
  )
}
