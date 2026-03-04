"use client"

import type React from "react"

interface BackgroundPlusProps {
  className?: string
  plusColor?: string
  plusSize?: number
  fade?: boolean
}

export const BackgroundPlus: React.FC<BackgroundPlusProps> = ({
  className = "",
  plusColor = "#6b7280",
  plusSize = 60,
  fade = false,
}) => {
  const patternId = `plus-pattern-${plusSize}-${plusColor.replace("#", "")}`
  const maskId = `fade-mask-${plusSize}`

  return (
    <svg className={className} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={patternId} x="0" y="0" width={plusSize} height={plusSize} patternUnits="userSpaceOnUse">
          <line
            x1={plusSize / 2}
            y1={plusSize / 2 - plusSize * 0.15}
            x2={plusSize / 2}
            y2={plusSize / 2 + plusSize * 0.15}
            stroke={plusColor}
            strokeWidth="1"
          />
          <line
            x1={plusSize / 2 - plusSize * 0.15}
            y1={plusSize / 2}
            x2={plusSize / 2 + plusSize * 0.15}
            y2={plusSize / 2}
            stroke={plusColor}
            strokeWidth="1"
          />
        </pattern>
        {fade && (
          <radialGradient id={maskId}>
            <stop offset="0%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </radialGradient>
        )}
        {fade && (
          <mask id={`${maskId}-mask`}>
            <rect width="100%" height="100%" fill={`url(#${maskId})`} />
          </mask>
        )}
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={`url(#${patternId})`}
        mask={fade ? `url(#${maskId}-mask)` : undefined}
      />
    </svg>
  )
}
