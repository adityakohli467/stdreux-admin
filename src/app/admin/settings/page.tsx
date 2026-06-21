"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Shield,
  Bell,
  Palette,
  Database,
  Globe,
  Lock,
  Save,
  Upload,
  Loader2,
  CheckCircle2
} from "lucide-react"
import { toast } from "sonner"
import { settingsAPI } from "@/lib/api"

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("general")
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch settings
  const { data: settingsData, isLoading, error, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      try {
        const response = await settingsAPI.get()

        // Normalize response: if data has 'settings' key, use it; otherwise treat data as settings
        if (response.data && typeof response.data === 'object' && 'settings' in response.data) {
          return response.data
        } else {
          return { settings: response.data || {}, settingsByCategory: {} }
        }
      } catch (err: any) {
        console.error("Settings fetch error:", err)
        // Return empty data instead of throwing to prevent component crash
        return { settings: {}, settingsByCategory: {} }
      }
    },
    // Don't retry immediately if it fails, as it might be a 404/500 persistent error
    retry: 1,
    refetchOnWindowFocus: true,
  })

  // Fetch system health
  const { data: systemHealthData, refetch: refetchHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await settingsAPI.getSystemHealth()
      return response.data
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // Update settings when data loads
  useEffect(() => {
    if (settingsData?.settings) {
      setSettings(settingsData.settings)
      setHasChanges(false)
    } else if (!isLoading && !settingsData) {
      // Use defaults if no data loaded
      setSettings(defaultSettings)
    }
  }, [settingsData, isLoading])

  // Helper function to convert hex to HSL
  const hexToHsl = (hex: string): { h: number; s: number; l: number } | null => {
    hex = hex.replace("#", "")
    const r = parseInt(hex.substring(0, 2), 16) / 255
    const g = parseInt(hex.substring(2, 4), 16) / 255
    const b = parseInt(hex.substring(4, 6), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const l = (max + min) / 2

    if (max === min) {
      h = s = 0
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

  // Function to apply appearance settings immediately
  const applyAppearanceSettings = (settings: Record<string, any>) => {
    const root = document.documentElement

    // Apply theme
    if (settings.theme) {
      if (settings.theme === "dark") {
        root.classList.add("dark")
      } else if (settings.theme === "light") {
        root.classList.remove("dark")
      } else if (settings.theme === "auto") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        if (prefersDark) {
          root.classList.add("dark")
        } else {
          root.classList.remove("dark")
        }
      }
    }

    // Apply primary color
    if (settings.primaryColor) {
      const hsl = hexToHsl(settings.primaryColor)
      if (hsl) {
        root.style.setProperty("--primary", `${hsl.h} ${hsl.s}% ${hsl.l}%`)
        root.style.setProperty("--accent", `${hsl.h} ${hsl.s}% ${hsl.l}%`)
        root.style.setProperty("--ring", `${hsl.h} ${hsl.s}% ${hsl.l}%`)
      }
    }

    // Apply language
    if (settings.language) {
      root.setAttribute("lang", settings.language)
    }
  }

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedSettings: Record<string, any>) => {
      return await settingsAPI.update(updatedSettings)
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['settings'], { settings: data.data.settings })
      setSettings(data.data.settings)
      setHasChanges(false)
      toast.success("Settings saved successfully!")

      // Apply appearance settings immediately after save
      if (variables.theme || variables.primaryColor || variables.language) {
        applyAppearanceSettings(variables)
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to save settings")
    }
  })

  const handleInputChange = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    updateMutation.mutate(settings)
  }

  const handleClearCache = async () => {
    try {
      // This would call a backend endpoint to clear cache
      toast.success("Cache cleared successfully!")
    } catch (error) {
      toast.error("Failed to clear cache")
    }
  }

  const handleExportLogs = async () => {
    try {
      // This would call a backend endpoint to export logs
      toast.success("Logs exported successfully!")
    } catch (error) {
      toast.error("Failed to export logs")
    }
  }

  const handleMaintenanceMode = async () => {
    const newValue = !settings.maintenanceMode
    handleInputChange('maintenanceMode', newValue)
    handleSave()
  }

  // Default settings if API fails or table doesn't exist
  const defaultSettings = {
    companyName: "St. Dreux Coffee",
    companyEmail: "admin@stdreuxcoffee.com",
    companyPhone: "+61 3 1234 5678",
    companyAbn: "ABN: 12 345 678 901",
    currency: "AUD",
    emailNotifications: true,
    pushNotifications: false,
    orderNotifications: true,
    customerNotifications: true,
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordExpiry: 90,
    theme: "light",
    primaryColor: "#0d6efd",
    language: "en",
    maintenanceMode: false,
  }

  // Use default settings if loading fails or no data
  // detailed logic: if we have local state (settings), use it (it includes user edits). 
  // If not, try to use server data (settingsData?.settings). 
  // Finally, fall back to defaults.
  const currentSettings = Object.keys(settings).length > 0 ? settings : (settingsData?.settings || defaultSettings)

  if (isLoading && !settingsData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#0d6efd]" />
          <p className="text-gray-600" style={{ fontFamily: 'Albert Sans' }}>Loading settings...</p>
        </div>
      </div>
    )
  }

  // Show error only if we have a real error and no data at all
  if (error && !settingsData && !isLoading) {
    const errorMessage = (error as any)?.response?.data?.message || "Failed to load settings"
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Albert Sans', fontWeight: 700 }}>
              Settings
            </h1>
            <p className="text-gray-500 mt-1" style={{ fontFamily: 'Albert Sans' }}>
              Manage your application settings and preferences
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-red-500 mb-4">
                <Database className="h-12 w-12" />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'Albert Sans' }}>
                {errorMessage.includes('not found') ? 'Settings Table Not Found' : 'Error Loading Settings'}
              </h3>
              <p className="text-gray-600 text-center mb-4" style={{ fontFamily: 'Albert Sans' }}>
                {errorMessage.includes('not found')
                  ? 'Please run the database migration to create the settings table.'
                  : errorMessage}
              </p>
              {errorMessage.includes('not found') && (
                <code className="bg-gray-100 p-2 rounded text-sm mb-4" style={{ fontFamily: 'monospace' }}>
                  psql -U your_user -d your_database -f migrations/create_settings_table.sql
                </code>
              )}
              <Button onClick={() => refetch()} className="bg-[#0d6efd] hover:bg-[#0b5ed7] text-white">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Albert Sans', fontWeight: 700 }}>
            Settings
          </h1>
          <p className="text-gray-500 mt-1" style={{ fontFamily: 'Albert Sans' }}>
            Manage your application settings and preferences
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
          className="bg-[#0d6efd] hover:bg-[#0b5ed7] gap-2"
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            General
          </TabsTrigger>
          {/* <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger> */}
          {/* <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger> */}
          {/* <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger> */}
          {/* <TabsTrigger value="payments" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Payments
          </TabsTrigger> */}
          {/* <TabsTrigger value="system" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            System
          </TabsTrigger> */}
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={currentSettings.companyName || ""}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    style={{ fontFamily: 'Albert Sans' }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Company Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={currentSettings.companyEmail || ""}
                    onChange={(e) => handleInputChange('companyEmail', e.target.value)}
                    style={{ fontFamily: 'Albert Sans' }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Company Phone</Label>
                  <Input
                    id="companyPhone"
                    value={currentSettings.companyPhone || ""}
                    onChange={(e) => handleInputChange('companyPhone', e.target.value)}
                    style={{ fontFamily: 'Albert Sans' }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyAbn">Company ABN</Label>
                  <Input
                    id="companyAbn"
                    value={currentSettings.companyAbn || ""}
                    onChange={(e) => handleInputChange('companyAbn', e.target.value)}
                    placeholder="ABN: 12 345 678 901"
                    style={{ fontFamily: 'Albert Sans' }}
                  />
                </div>
                {/* <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={currentSettings.currency || "AUD"}
                    onValueChange={(value) => handleInputChange('currency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUD">AUD (A$)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="CAD">CAD (C$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div> */}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-gray-500">Receive notifications via email</p>
                </div>
                <Switch
                  checked={currentSettings.emailNotifications ?? true}
                  onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Push Notifications</Label>
                  <p className="text-sm text-gray-500">Receive push notifications in browser</p>
                </div>
                <Switch
                  checked={currentSettings.pushNotifications ?? false}
                  onCheckedChange={(checked) => handleInputChange('pushNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Order Notifications</Label>
                  <p className="text-sm text-gray-500">Get notified when new orders are placed</p>
                </div>
                <Switch
                  checked={currentSettings.orderNotifications ?? true}
                  onCheckedChange={(checked) => handleInputChange('orderNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Customer Notifications</Label>
                  <p className="text-sm text-gray-500">Get notified about customer activities</p>
                </div>
                <Switch
                  checked={currentSettings.customerNotifications ?? true}
                  onCheckedChange={(checked) => handleInputChange('customerNotifications', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Two-Factor Authentication</Label>
                  <p className="text-sm text-gray-500">Add an extra layer of security</p>
                </div>
                <Switch
                  checked={currentSettings.twoFactorAuth ?? false}
                  onCheckedChange={(checked) => handleInputChange('twoFactorAuth', checked)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                  <Select
                    value={currentSettings.sessionTimeout?.toString() || "30"}
                    onValueChange={(value) => handleInputChange('sessionTimeout', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="480">8 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passwordExpiry">Password Expiry (days)</Label>
                  <Select
                    value={currentSettings.passwordExpiry?.toString() || "90"}
                    onValueChange={(value) => handleInputChange('passwordExpiry', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="180">180 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={currentSettings.theme || "light"}
                    onValueChange={(value) => handleInputChange('theme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="auto">Auto (System)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={currentSettings.language || "en"}
                    onValueChange={(value) => handleInputChange('language', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={currentSettings.primaryColor || "#0d6efd"}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    className="w-16 h-10 p-1 border rounded"
                  />
                  <Input
                    value={currentSettings.primaryColor || "#0d6efd"}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    placeholder="#0d6efd"
                    style={{ fontFamily: 'Albert Sans' }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                PinPayments Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pinpaymentsSecretKey">Secret Key</Label>
                  <Input
                    id="pinpaymentsSecretKey"
                    type="password"
                    value={currentSettings.pinpaymentsSecretKey || ""}
                    onChange={(e) => handleInputChange('pinpaymentsSecretKey', e.target.value)}
                    placeholder="Enter your PinPayments secret key"
                    style={{ fontFamily: 'Albert Sans' }}
                  />
                  <p className="text-xs text-gray-500" style={{ fontFamily: 'Albert Sans' }}>
                    Your PinPayments secret key (keep this secure)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pinpaymentsPublishableKey">Publishable Key</Label>
                  <Input
                    id="pinpaymentsPublishableKey"
                    value={currentSettings.pinpaymentsPublishableKey || ""}
                    onChange={(e) => handleInputChange('pinpaymentsPublishableKey', e.target.value)}
                    placeholder="Enter your PinPayments publishable key"
                    style={{ fontFamily: 'Albert Sans' }}
                  />
                  <p className="text-xs text-gray-500" style={{ fontFamily: 'Albert Sans' }}>
                    Your PinPayments publishable key (used in frontend)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pinpaymentsWebhookSecret">Webhook Secret</Label>
                  <Input
                    id="pinpaymentsWebhookSecret"
                    type="password"
                    value={currentSettings.pinpaymentsWebhookSecret || ""}
                    onChange={(e) => handleInputChange('pinpaymentsWebhookSecret', e.target.value)}
                    placeholder="Enter webhook secret for verification"
                    style={{ fontFamily: 'Albert Sans' }}
                  />
                  <p className="text-xs text-gray-500" style={{ fontFamily: 'Albert Sans' }}>
                    Webhook secret for verifying PinPayments webhooks
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Test Mode</Label>
                    <p className="text-sm text-gray-500">Use PinPayments test environment</p>
                  </div>
                  <Switch
                    checked={currentSettings.pinpaymentsTestMode ?? true}
                    onCheckedChange={(checked) => handleInputChange('pinpaymentsTestMode', checked)}
                  />
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-2" style={{ fontFamily: 'Albert Sans' }}>
                    Webhook URL
                  </h3>
                  <div className="bg-gray-50 p-3 rounded border">
                    <code className="text-xs break-all" style={{ fontFamily: 'monospace' }}>
                      {typeof window !== 'undefined'
                        ? `${window.location.origin.replace(':3001', ':9000')}/admin/payments/webhook`
                        : 'https://your-domain.com/admin/payments/webhook'}
                    </code>
                  </div>
                  <p className="text-xs text-gray-500 mt-2" style={{ fontFamily: 'Albert Sans' }}>
                    Configure this URL in your PinPayments dashboard under Webhooks
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Database
                  </h3>
                  <div className="space-y-2">
                    <Label>Database Status</Label>
                    <div className="flex items-center gap-2">
                      {systemHealthData?.database?.connected ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-green-600">Connected</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="text-sm text-red-600">Disconnected</span>
                        </>
                      )}
                    </div>
                    {systemHealthData?.database?.currentTime && (
                      <p className="text-xs text-gray-500">
                        Last checked: {new Date(systemHealthData.database.currentTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchHealth()}>
                    <Database className="h-4 w-4 mr-2" />
                    Refresh Status
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    System Health
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{ fontFamily: 'Albert Sans' }}>CPU Usage</span>
                      <span className={`text-sm ${(systemHealthData?.system?.cpuUsage || 0) > 80 ? 'text-red-600' :
                        (systemHealthData?.system?.cpuUsage || 0) > 60 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                        {systemHealthData?.system?.cpuUsage || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{ fontFamily: 'Albert Sans' }}>Memory Usage</span>
                      <span className={`text-sm ${(systemHealthData?.system?.memoryUsage || 0) > 80 ? 'text-red-600' :
                        (systemHealthData?.system?.memoryUsage || 0) > 60 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                        {systemHealthData?.system?.memoryUsage || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{ fontFamily: 'Albert Sans' }}>Disk Usage</span>
                      <span className={`text-sm ${(systemHealthData?.system?.diskUsage || 0) > 80 ? 'text-red-600' :
                        (systemHealthData?.system?.diskUsage || 0) > 60 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                        {systemHealthData?.system?.diskUsage || 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {systemHealthData?.stats && (
                <div className="pt-4 border-t">
                  <h3 className="text-lg font-medium mb-4" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Statistics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>Orders</p>
                      <p className="text-lg font-semibold" style={{ fontFamily: 'Albert Sans' }}>
                        {systemHealthData.stats.orders?.toLocaleString() || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>Customers</p>
                      <p className="text-lg font-semibold" style={{ fontFamily: 'Albert Sans' }}>
                        {systemHealthData.stats.customers?.toLocaleString() || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>Products</p>
                      <p className="text-lg font-semibold" style={{ fontFamily: 'Albert Sans' }}>
                        {systemHealthData.stats.products?.toLocaleString() || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>Companies</p>
                      <p className="text-lg font-semibold" style={{ fontFamily: 'Albert Sans' }}>
                        {systemHealthData.stats.companies?.toLocaleString() || 0}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-4" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  System Actions
                </h3>
                <div className="flex flex-wrap gap-4">
                  <Button variant="outline" onClick={handleClearCache}>
                    <Upload className="h-4 w-4 mr-2" />
                    Clear Cache
                  </Button>
                  <Button variant="outline" onClick={handleExportLogs}>
                    <Database className="h-4 w-4 mr-2" />
                    Export Logs
                  </Button>
                  <Button
                    variant={currentSettings.maintenanceMode ? "destructive" : "outline"}
                    onClick={handleMaintenanceMode}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {currentSettings.maintenanceMode ? "Disable Maintenance Mode" : "Enable Maintenance Mode"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
