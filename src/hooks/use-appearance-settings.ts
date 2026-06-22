"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { settingsAPI } from "@/lib/api"

/**
 * Hook to apply appearance settings (theme, primary color, language)
 */
export function useAppearanceSettings() {
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      try {
        const response = await settingsAPI.get()
        return response.data
      } catch (err) {
        return { settings: {} }
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  useEffect(() => {
    if (!settingsData?.settings) return

    const settings = settingsData.settings
    const root = document.documentElement

    // Apply theme
    const theme = settings.theme || "light"
    const applyTheme = () => {
      if (theme === "dark") {
        root.classList.add("dark")
      } else if (theme === "light") {
        root.classList.remove("dark")
      } else if (theme === "auto") {
        // Auto theme based on system preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        if (prefersDark) {
          root.classList.add("dark")
        } else {
          root.classList.remove("dark")
        }
      }
    }
    
    applyTheme()
    
    // Listen for system theme changes if auto mode is enabled
    if (theme === "auto") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = () => applyTheme()
      mediaQuery.addEventListener("change", handleChange)
      
      return () => {
        mediaQuery.removeEventListener("change", handleChange)
      }
    }

    // Apply primary color
    const primaryColor = settings.primaryColor || "#105a9c"
    if (primaryColor) {
      // Convert hex to HSL for CSS variables
      const hsl = hexToHsl(primaryColor)
      if (hsl) {
        root.style.setProperty("--primary", `${hsl.h} ${hsl.s}% ${hsl.l}%`)
        root.style.setProperty("--accent", `${hsl.h} ${hsl.s}% ${hsl.l}%`)
        root.style.setProperty("--ring", `${hsl.h} ${hsl.s}% ${hsl.l}%`)
      }
    }

    // Apply language
    const language = settings.language || "en"
    root.setAttribute("lang", language)
  }, [settingsData])
}

/**
 * Convert hex color to HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  // Remove # if present
  hex = hex.replace("#", "")
  
  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max === min) {
    h = s = 0 // achromatic
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

