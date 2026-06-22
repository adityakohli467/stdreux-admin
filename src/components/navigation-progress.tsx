"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

export function NavigationProgress() {
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    // Show progress bar immediately when pathname starts changing
    setIsNavigating(true)
    
    // Hide after a short delay (navigation should be instant)
    const timer = setTimeout(() => {
      setIsNavigating(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [pathname])

  if (!isNavigating) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-transparent">
      <div 
        className="h-full bg-[#105a9c] animate-pulse"
        style={{
          width: '100%',
          animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      />
    </div>
  )
}

