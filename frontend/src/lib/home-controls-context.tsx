"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export interface HomeControlsState {
  openAddDevice: () => void
}

interface ContextValue {
  controls: HomeControlsState | null
  setControls: (controls: HomeControlsState | null) => void
}

const HomeControlsContext = createContext<ContextValue>({
  controls: null,
  setControls: () => {},
})

export function HomeControlsProvider({ children }: { children: ReactNode }) {
  const [controls, setControls] = useState<HomeControlsState | null>(null)
  return (
    <HomeControlsContext.Provider value={{ controls, setControls }}>
      {children}
    </HomeControlsContext.Provider>
  )
}

export function useHomeControls(): HomeControlsState | null {
  return useContext(HomeControlsContext).controls
}

export function useSetHomeControls(value: HomeControlsState | null): void {
  const { setControls } = useContext(HomeControlsContext)
  useEffect(() => {
    setControls(value)
    return () => setControls(null)
  }, [value, setControls])
}
