"use client"

import type React from "react"
import { BackgroundPlus } from "../demos/background-plus"

export const ProfessionalCard: React.FC<{
  isActive?: boolean
  children: React.ReactNode
  className?: string
  accentColor?: string
}> = ({ isActive, children, className, accentColor }) => {
  return (
    <div className={`relative w-full ${className || ""}`}>
      <BackgroundPlus
        className="absolute inset-0 rounded-2xl opacity-5"
        plusColor={isActive ? (accentColor || "#3b82f6") : "#6b7280"}
        plusSize={40}
        fade={true}
      />
      <div className="relative rounded-2xl bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-800/50">
        <div className="relative z-10 p-4">{children}</div>
      </div>
    </div>
  )
}
