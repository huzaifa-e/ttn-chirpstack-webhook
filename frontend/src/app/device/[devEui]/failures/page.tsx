"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"

import { BackgroundPlus } from "@/demos/background-plus"
import { getDeviceSummaries, getUplinks } from "@/lib/api"
import { analyzeUplinkFailures, type UploadFailureLog } from "@/lib/failure-analysis"
import { DEFAULT_DAYS } from "@/lib/constants"

function formatSec(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

function HexChip({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-700 dark:text-zinc-300">{value ?? "—"}</span>
    </span>
  )
}

function FailureRow({ log }: { log: UploadFailureLog }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-950/70">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-4 flex flex-col gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {new Date(log.at).toLocaleString("de-DE")}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
              +{formatSec(log.exceededBySec)}
            </span>
            {open ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="text-zinc-500">Erwartet: <span className="text-zinc-700 dark:text-zinc-300">{formatSec(log.expectedIntervalSec)}</span></div>
          <div className="text-zinc-500">Ist: <span className="text-zinc-700 dark:text-zinc-300">{formatSec(log.actualIntervalSec)}</span></div>
          <div className="text-zinc-500">Vorher: <span className="text-zinc-700 dark:text-zinc-300">{new Date(log.previousAt).toLocaleTimeString("de-DE")}</span></div>
          <div className="text-zinc-500">Gerät: <span className="text-zinc-700 dark:text-zinc-300 font-mono">{log.devEui}</span></div>
        </div>

        <div className="flex flex-wrap gap-2">
          <HexChip label="ERR" value={log.errorEventHex} />
          <HexChip label="WARN" value={log.warningEventHex} />
          <HexChip label="INFO" value={log.infoEventHex} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-100 dark:border-zinc-800/80 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
              <div className="text-[11px] uppercase text-zinc-500 mb-1">Error Event</div>
              <div className="font-mono text-zinc-800 dark:text-zinc-200">{log.decodedErrorEvent?.codeHex ?? "—"}</div>
              <div className="text-zinc-700 dark:text-zinc-300 mt-1">{log.decodedErrorEvent?.name ?? "No code"}</div>
              <div className="text-zinc-500 mt-1">{log.decodedErrorEvent?.description ?? "No mapped error event"}</div>
            </div>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
              <div className="text-[11px] uppercase text-zinc-500 mb-1">Warning Event</div>
              <div className="font-mono text-zinc-800 dark:text-zinc-200">{log.decodedWarningEvent?.codeHex ?? "—"}</div>
              <div className="text-zinc-700 dark:text-zinc-300 mt-1">{log.decodedWarningEvent?.name ?? "No code"}</div>
              <div className="text-zinc-500 mt-1">{log.decodedWarningEvent?.description ?? "No mapped warning event"}</div>
            </div>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
              <div className="text-[11px] uppercase text-zinc-500 mb-1">Info Event</div>
              <div className="font-mono text-zinc-800 dark:text-zinc-200">{log.decodedInfoEvent?.codeHex ?? "—"}</div>
              <div className="text-zinc-700 dark:text-zinc-300 mt-1">{log.decodedInfoEvent?.name ?? "No code"}</div>
              <div className="text-zinc-500 mt-1">{log.decodedInfoEvent?.description ?? "No mapped info event"}</div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <div className="text-[11px] uppercase text-zinc-500 mb-2">Error Bitmask Flags</div>
            {!log.decodedErrorFlags.length ? (
              <div className="text-xs text-zinc-500">No active error flags decoded from error_event_hex.</div>
            ) : (
              <div className="space-y-2">
                {log.decodedErrorFlags.map((flag) => (
                  <div key={`${log.id}-${flag.bit}`} className="text-xs border-b border-zinc-100 dark:border-zinc-800 pb-1 last:border-b-0">
                    <div className="font-mono text-zinc-800 dark:text-zinc-200">bit {flag.bit} · {flag.maskHex}</div>
                    <div className="text-zinc-700 dark:text-zinc-300">{flag.name}</div>
                    <div className="text-zinc-500">{flag.category}: {flag.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DeviceFailuresPage() {
  const params = useParams()
  const devEui = decodeURIComponent(params.devEui as string)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expectedIntervalSec, setExpectedIntervalSec] = useState<number>(120)
  const [logs, setLogs] = useState<UploadFailureLog[]>([])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const now = new Date()
        const from = new Date(now.getTime() - DEFAULT_DAYS * 24 * 60 * 60 * 1000).toISOString()
        const to = now.toISOString()

        const [summaries, uplinks] = await Promise.all([
          getDeviceSummaries(),
          getUplinks(devEui, from, to, 5000),
        ])

        if (cancelled) return

        const summary = summaries.find((s) => s.dev_eui === devEui) ?? null
        const analysis = analyzeUplinkFailures(uplinks, summary?.avg_interval_seconds ?? null)
        setExpectedIntervalSec(analysis.expectedIntervalSec)
        setLogs(analysis.failures.slice().reverse())
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load failure logs")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [devEui])

  const totalExceededSec = useMemo(() => logs.reduce((sum, r) => sum + r.exceededBySec, 0), [logs])

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <BackgroundPlus className="fixed inset-0 opacity-[0.03]" plusColor="#ef4444" plusSize={60} fade={true} />

      <div className="relative max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/device/${encodeURIComponent(devEui)}`}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft size={16} className="text-zinc-500" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                Upload Failure-Logs
              </h1>
              <p className="text-xs text-zinc-500 font-mono">{devEui}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-950/70 p-4">
            <div className="text-xs text-zinc-500 uppercase">Fehleranzahl</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{logs.length}</div>
          </div>
          <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-950/70 p-4">
            <div className="text-xs text-zinc-500 uppercase">Erwartetes Intervall</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatSec(expectedIntervalSec)}</div>
          </div>
          <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-950/70 p-4">
            <div className="text-xs text-zinc-500 uppercase">Gesamte Verzögerung</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatSec(totalExceededSec)}</div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 p-8 text-center text-zinc-500">
            Lade Failure-Logs...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 p-8 text-center text-zinc-500">
            Keine Upload-Fehler im gewählten Zeitraum ({DEFAULT_DAYS} Tage).
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <FailureRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
