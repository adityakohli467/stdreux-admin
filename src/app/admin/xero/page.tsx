"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle, ExternalLink, Unplug } from "lucide-react"
import { toast } from "sonner"
import { xeroAPI } from "@/lib/api"
import { useSearchParams } from "next/navigation"

export default function XeroPage() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()

  // Check Xero connection status
  const { data: statusData, isLoading } = useQuery({
    queryKey: ["xero-status"],
    queryFn: async () => {
      const response = await xeroAPI.getStatus()
      return response.data
    },
  })

  // Handle OAuth callback if we have a code in the URL
  useEffect(() => {
    const code = searchParams.get("code")
    if (code) {
      // Send the full callback URL to the API
      const callbackUrl = window.location.href
      xeroAPI.callback(callbackUrl).then((res) => {
        if (res.data.success) {
          toast.success("Xero connected successfully!")
          queryClient.invalidateQueries({ queryKey: ["xero-status"] })
          // Clean URL
          window.history.replaceState({}, "", "/admin/xero")
        }
      }).catch((err) => {
        toast.error("Failed to connect Xero: " + (err.response?.data?.message || err.message))
      })
    }
  }, [searchParams, queryClient])

  // Connect to Xero
  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await xeroAPI.getAuthUrl()
      return response.data.url
    },
    onSuccess: (url: string) => {
      window.location.href = url
    },
    onError: (err: any) => {
      toast.error("Failed to get Xero auth URL: " + (err.response?.data?.message || err.message))
    },
  })

  // Disconnect Xero
  const disconnectMutation = useMutation({
    mutationFn: () => xeroAPI.disconnect(),
    onSuccess: () => {
      toast.success("Xero disconnected")
      queryClient.invalidateQueries({ queryKey: ["xero-status"] })
    },
    onError: (err: any) => {
      toast.error("Failed to disconnect: " + (err.response?.data?.message || err.message))
    },
  })

  const isConnected = statusData?.connected

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Xero Integration</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#13B5EA">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.243 7.5L12 8.743 13.243 7.5l1.414 1.414L13.414 10.157l1.243 1.243-1.414 1.414L12 11.571l-1.243 1.243-1.414-1.414 1.243-1.243-1.243-1.243L10.757 7.5zM7.5 10.757L8.743 12 7.5 13.243 6.086 11.829 7.5 10.757zm9 0L17.914 11.829 16.5 13.243 15.257 12 16.5 10.757zM12 13.5l1.243 1.243-1.243 1.243-1.243-1.243L12 13.5z"/>
            </svg>
            Xero Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking connection status...
            </div>
          ) : isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Connected to {statusData?.organisationName}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Paid orders can now be synced as invoices to Xero. Use the &quot;Sync to Xero&quot; button on paid orders.
              </p>
              <Button
                variant="destructive"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Unplug className="h-4 w-4 mr-2" />
                )}
                Disconnect Xero
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-5 w-5" />
                <span>Not connected</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Connect your Xero account to automatically create invoices for paid orders.
              </p>
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
              >
                {connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Connect to Xero
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
