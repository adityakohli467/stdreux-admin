"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { notificationsAPI } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Bell, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  AlertCircle, 
  Check, 
  Trash2,
  ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function NotificationsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  // Fetch notifications
  const { data: notificationsData, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', 'all', page, limit],
    queryFn: async () => {
      const offset = (page - 1) * limit
      const response = await notificationsAPI.list({ limit, offset })
      return response.data
    }
  })

  // Mark single as read
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationsAPI.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Notification marked as read')
    }
  })

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsAPI.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('All notifications marked as read')
    }
  })

  const notifications = notificationsData?.notifications || []
  const count = notificationsData?.count || 0
  const totalPages = Math.ceil(count / limit) || 1

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-GB", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    })
  }

  const handleNotificationClick = (notification: any) => {
    // Mark as read
    if (!notification.read_status) {
      markAsReadMutation.mutate(notification.id)
    }

    // Navigate based on notification type
    if ((notification.notification_type === 'order' || (!notification.notification_type && notification.order_id)) && notification.order_id) {
      router.push(`/orders/${notification.order_id}`)
    } else if (notification.notification_type === 'contact_inquiry' && notification.contact_inquiry_id) {
      router.push(`/contact-inquiries/${notification.contact_inquiry_id}`)
    } else if (notification.notification_type === 'wholesale_enquiry' && notification.wholesale_enquiry_id) {
      router.push(`/wholesale-enquiries/${notification.wholesale_enquiry_id}`)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#212529]">Notifications</h1>
          <p className="text-gray-600">Catch up on everything that's happened</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending || count === 0}
            className="gap-2"
          >
            <Check className="w-4 h-4" />
            Mark all as read
          </Button>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            Refresh
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-[0px_4px_15px_rgba(0,0,0,0.05)] bg-white rounded-xl">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#105a9c]" />
            <p className="text-gray-500 font-medium">Loading your notifications...</p>
          </div>
        ) : error ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4">
            <AlertCircle className="w-12 h-12 text-red-500 opacity-20" />
            <p className="text-red-600 font-semibold">Failed to load notifications</p>
            <Button variant="outline" onClick={() => refetch()} size="sm">Try Again</Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-2">
              <Bell className="w-8 h-8 text-blue-200" />
            </div>
            <h3 className="text-xl font-bold text-[#212529]">All caught up!</h3>
            <p className="text-gray-500 max-w-xs">You don't have any notifications at the moment.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification: any) => (
              <div 
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  "p-6 flex flex-col sm:flex-row items-start gap-4 hover:bg-gray-50/80 transition-colors cursor-pointer group relative",
                  !notification.read_status && "bg-blue-50/30"
                )}
              >
                {!notification.read_status && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#105a9c]" />
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-bold text-[#212529]">
                      {notification.notification_type === 'order' && 'New Order'}
                      {notification.notification_type === 'contact_inquiry' && 'Contact Inquiry'}
                      {notification.notification_type === 'wholesale_enquiry' && 'Wholesale Enquiry'}
                      {notification.notification_type === 'newsletter_subscription' && 'Newsletter Subscription'}
                      {!notification.notification_type && 'System Notification'}
                    </span>
                    <Badge variant="outline" className="font-normal text-[10px] uppercase tracking-wider text-gray-400">
                      {formatTime(notification.created_at)}
                    </Badge>
                    {!notification.read_status && (
                      <Badge className="bg-[#105a9c] text-white hover:bg-[#0d4a82]">New</Badge>
                    )}
                  </div>
                  <p className="text-[#424242] text-[15px] leading-relaxed mb-3">
                    {notification.description}
                  </p>
                  
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-[#105a9c] hover:text-[#0d4a82] hover:bg-blue-50 p-0 px-2 font-medium flex items-center gap-1"
                    >
                      View Details
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                    
                    {!notification.read_status && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsReadMutation.mutate(notification.id)
                        }}
                        className="h-8 text-gray-400 hover:text-green-600 hover:bg-green-50 p-0 px-2 font-medium flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Mark as read
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, count)} of {count} notifications
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-sm font-medium px-4">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
