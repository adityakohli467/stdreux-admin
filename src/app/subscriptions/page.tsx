"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import Link from "next/link"
import api from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Filter, Printer, Plus, Eye, Edit, Trash2, X, Check, AlertCircle, Info } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { printTableData } from "@/lib/print-utils"

interface Subscription {
  order_id: number
  customer_id: number
  customer_name: string
  sent_to_customer?: boolean
  sent_to_customer_at?: string
  company_name: string
  standing_order: number
  order_status: number
  order_total: number
  delivery_fee: number
  date_added: string
  delivery_date_time: string
  customer_order_name: string
  products: Array<{
    product_id: number
    product_name: string
    quantity: number
    price: number
    total: number
    options: Array<{
      option_name: string
      option_value: string
      option_quantity: number
    }>
  }>
}

export default function SubscriptionsPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active")
  const [searchQuery, setSearchQuery] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<"cancel" | "activate" | "delete" | null>(null)
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Fetch subscriptions
  const { data: subscriptionsData, isLoading } = useQuery({
    queryKey: ["subscriptions", activeTab, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: activeTab,
        limit: "100",
      })
      if (searchQuery) params.append("search", searchQuery)

      const response = await api.get(`/admin/subscriptions?${params}`)
      return response.data
    },
  })

  // Fetch counts for tabs
  const { data: activeCountData } = useQuery({
    queryKey: ["subscriptions-count", "active"],
    queryFn: async () => {
      const response = await api.get(`/admin/subscriptions?status=active&limit=0`)
      return response.data
    },
  })

  const { data: inactiveCountData } = useQuery({
    queryKey: ["subscriptions-count", "inactive"],
    queryFn: async () => {
      const response = await api.get(`/admin/subscriptions?status=inactive&limit=0`)
      return response.data
    },
  })

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/admin/subscriptions/${id}/cancel`, {
        cancel_comment: "Subscription cancelled by admin"
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      queryClient.invalidateQueries({ queryKey: ["subscriptions-count"] })
      toast.success("Subscription cancelled successfully!")
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to cancel subscription")
    },
  })

  // Activate subscription mutation
  const activateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/admin/subscriptions/${id}/activate`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      queryClient.invalidateQueries({ queryKey: ["subscriptions-count"] })
      toast.success("Subscription activated successfully!")
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to activate subscription")
    },
  })

  // Delete subscription mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/admin/subscriptions/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      queryClient.invalidateQueries({ queryKey: ["subscriptions-count"] })
      toast.success("Subscription deleted successfully!")
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete subscription")
    },
  })

  const subscriptions = subscriptionsData?.subscriptions || []
  const filteredSubscriptions = subscriptions

  const openModal = (type: "cancel" | "activate" | "delete", subscription: Subscription) => {
    setModalType(type)
    setSelectedSubscription(subscription)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setModalType(null)
    setSelectedSubscription(null)
  }

  const handleConfirm = () => {
    if (!selectedSubscription) return

    if (modalType === "cancel") {
      cancelMutation.mutate(selectedSubscription.order_id)
    } else if (modalType === "activate") {
      activateMutation.mutate(selectedSubscription.order_id)
    } else if (modalType === "delete") {
      deleteMutation.mutate(selectedSubscription.order_id)
    }
  }

  const getFrequencyText = (days: number) => {
    if (days === 14) return "Every 2 Weeks"
    if (days === 28) return "Every 4 Weeks"
    if (days === 56) return "Every 8 Weeks"
    return `Every ${days} days`
  }

  const isActive = (status: number) => [1, 2, 4, 7].includes(status)

  return (
    <div className="bg-gray-50 min-h-screen" style={{ fontFamily: 'Albert Sans' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-gray-900" style={{
            fontFamily: 'Albert Sans',
            fontWeight: 600,
            fontStyle: 'normal',
            fontSize: '40px',
            lineHeight: '20px',
            letterSpacing: '0%'
          }}>
            Subscriptions
          </h1>
          <div className="group relative">
            <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Subscription Info">
              <Info className="h-5 w-5" />
            </button>
            <div className="absolute left-0 top-full mt-2 w-80 p-4 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50" style={{ fontFamily: 'Albert Sans' }}>
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-gray-900">What is a Subscription?</p>
                <p className="text-gray-700">Subscriptions are recurring orders that are automatically created based on a schedule (every 2 weeks, every 4 weeks, or every 8 weeks).</p>
                <p className="font-semibold text-gray-900 mt-3">To create a subscription:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2 text-gray-700">
                  <li>Create a new order with the products you want</li>
                  <li>Set the "Standing Order" field to the frequency (14 for every 2 weeks, 28 for every 4 weeks, 56 for every 8 weeks)</li>
                  <li>Choose the delivery date and time</li>
                  <li>Save the order - it will automatically appear here as a subscription</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-[#105a9c] hover:bg-[#0d4a82] text-white whitespace-nowrap"
          style={{
            fontWeight: 600,
            width: '196px',
            height: '54px',
            paddingTop: '8px',
            paddingRight: '16px',
            paddingBottom: '8px',
            paddingLeft: '16px',
            gap: '4px',
            borderRadius: '67px',
            opacity: 1
          }}
        >
          <Plus className="h-5 w-5" />
          Add New Subscription
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === "active"
            ? "bg-blue-100 text-[#105a9c]"
            : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          style={{ fontWeight: 600 }}
        >
          Active ({activeCountData?.count || 0})
        </button>
        <button
          onClick={() => setActiveTab("inactive")}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === "inactive"
            ? "bg-blue-100 text-[#105a9c]"
            : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          style={{ fontWeight: 600 }}
        >
          Inactive ({inactiveCountData?.count || 0})
        </button>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search Order ID, Customer ID, Status etc."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[488px] h-[54px] border border-gray-200 bg-white rounded-full focus:ring-2 focus:ring-[#105a9c] focus:border-[#105a9c] focus:outline-none"
            style={{ fontFamily: 'Albert Sans', paddingLeft: '44px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
          />
        </div>
        <Button
          onClick={() => printTableData("Subscriptions")}
          className="gap-2 whitespace-nowrap border-0 shadow-none"
          style={{
            fontFamily: 'Albert Sans',
            fontWeight: 600,
            fontStyle: 'normal',
            fontSize: '16px',
            lineHeight: '20px',
            letterSpacing: '0%',
            textAlign: 'center',
            color: '#105a9c',
            backgroundColor: 'transparent',
            padding: 0,
            gap: '8px',
            opacity: 1
          }}
        >
          <Printer className="h-5 w-5 text-[#105a9c]" />
          Print
        </Button>
      </div>

      {/* Table */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#105a9c] border-b border-[#0d4a82] text-white">
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontWeight: 600 }}>Order ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontWeight: 600 }}>Customer Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontWeight: 600 }}>Company Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontWeight: 600 }}>Product Names</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontWeight: 600 }}>Options</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontWeight: 600 }}>Frequency</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontWeight: 600 }}>Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    {Array.from({ length: 9 }).map((_, colIdx) => (
                      <td key={colIdx} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">No subscriptions found</td>
                </tr>
              ) : (
                filteredSubscriptions.map((sub: Subscription) => (
                  <tr key={sub.order_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-[#105a9c]" style={{
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        fontSize: '14px',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>#{sub.order_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-900" style={{
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        fontSize: '14px',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>{sub.customer_name || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-900" style={{
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        fontSize: '14px',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>{sub.company_name || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {sub.products?.map((p, idx) => (
                          <div key={idx} className="flex items-center gap-1" style={{
                            fontFamily: 'Albert Sans',
                            fontWeight: 400,
                            fontStyle: 'normal',
                            fontSize: '14px',
                            lineHeight: '20px',
                            letterSpacing: '0%'
                          }}>
                            <span className="text-gray-900">{p.product_name}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {sub.products?.map((p, idx) => (
                          <div key={idx} className="text-gray-600" style={{
                            fontFamily: 'Albert Sans',
                            fontWeight: 400,
                            fontStyle: 'normal',
                            fontSize: '14px',
                            lineHeight: '20px',
                            letterSpacing: '0%'
                          }}>
                            {p.options?.map(o => o.option_value).join(', ') || '-'}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-900" style={{
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        fontSize: '14px',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>
                        {getFrequencyText(sub.standing_order)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isActive(sub.order_status) ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          • Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                          • Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sub.sent_to_customer ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          ✓ Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600">
                          Not Sent
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/subscriptions/${sub.order_id}`}
                          prefetch={true}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {isActive(sub.order_status) ? (
                          <button
                            onClick={() => openModal("cancel", sub)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => openModal("activate", sub)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Activate"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openModal("delete", sub)}
                          className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
          Showing 1-{filteredSubscriptions.length} of {subscriptionsData?.count || 0} Entries
        </p>
      </div>

      {/* Add Subscription Modal - Simplified */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              <Plus className="h-6 w-6 text-[#105a9c]" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 700 }}>
              Create New Subscription
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-700 text-center" style={{ fontFamily: 'Albert Sans' }}>
              To create a subscription, create a new order and set the "Standing Order" field to the desired frequency (2 weeks,4 weeks,  8 weeks).
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowAddModal(false)}
              className="border-gray-300"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowAddModal(false)
                router.push('/orders/new')
              }}
              className="bg-[#105a9c] hover:bg-[#0d4a82] text-white"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Create Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 700 }}>
              {modalType === "cancel" && "Cancel Subscription"}
              {modalType === "activate" && "Activate Subscription"}
              {modalType === "delete" && "Delete Subscription"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${modalType === "activate" ? "bg-green-100" : "bg-red-100"
                }`}>
                {modalType === "activate" ? (
                  <Check className="h-6 w-6 text-green-600" />
                ) : modalType === "cancel" ? (
                  <X className="h-6 w-6 text-red-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Albert Sans' }}>
                  {modalType === "cancel" && "Are you sure you want to cancel this subscription? This will stop future recurring orders."}
                  {modalType === "activate" && "Are you sure you want to activate this subscription? Future orders will resume."}
                  {modalType === "delete" && "Are you sure you want to permanently delete this subscription? This action cannot be undone."}
                </p>
                <p className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Order #{selectedSubscription?.order_id} - {selectedSubscription?.customer_name || selectedSubscription?.customer_order_name}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={closeModal}
              className="border-gray-300"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={cancelMutation.isPending || activateMutation.isPending || deleteMutation.isPending}
              className={`${modalType === "activate"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
                } text-white`}
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              {cancelMutation.isPending || activateMutation.isPending || deleteMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
