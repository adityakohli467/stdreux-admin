"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Search, ArrowLeft, Save, Edit } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface StDruexOrder {
  order_id: number
  customer_name: string
  suburb_postcode: string
  suburb: string
  postcode: string
  address: string
  status: string
  order_status: number
  is_completed: number
  notes: string
  order_total: number
  delivery_date_time: string | null
  date_added: string
  products: Array<{
    product_id: number
    product_name: string
    quantity: number
    price: number
    total: number
  }>
  product_count: number
  product_summary: string
  company_name: string
  location_name: string
}

export default function StDruexOrdersPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [showPastOrders, setShowPastOrders] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null)
  const [notesValue, setNotesValue] = useState("")
  const [weightValue, setWeightValue] = useState("")
  const [page, setPage] = useState(1)
  const limit = 50

  // Fetch St Druex orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['st-druex-orders', showPastOrders, searchQuery, page],
    queryFn: async () => {
      const params: Record<string, any> = {
        limit,
        offset: (page - 1) * limit,
        past: showPastOrders,
      }
      if (searchQuery) params.search = searchQuery

      const response = await api.get(`/admin/orders/st-druex?${new URLSearchParams(params).toString()}`)
      return response.data
    },
  })

  const orders: StDruexOrder[] = ordersData?.orders || []
  const totalCount = ordersData?.count || 0
  const totalPages = Math.ceil(totalCount / limit)

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ orderId, notes, weight }: { orderId: number; notes: string; weight?: number }) => {
      await api.put(`/admin/orders/${orderId}/notes`, { notes, weight })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['st-druex-orders'] })
      toast.success("Notes updated successfully")
      setEditingOrderId(null)
      setNotesValue("")
      setWeightValue("")
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update notes")
    },
  })

  const handleEditNotes = (order: StDruexOrder) => {
    setEditingOrderId(order.order_id)
    setNotesValue(order.notes || "")
    setWeightValue("") // Weight can be added to notes if needed
  }

  const handleSaveNotes = () => {
    if (editingOrderId) {
      const weight = weightValue ? parseFloat(weightValue) : undefined
      updateNotesMutation.mutate({
        orderId: editingOrderId,
        notes: notesValue,
        weight,
      })
    }
  }

  const getStatusBadge = (order: StDruexOrder) => {
    const baseStyle = {
      fontFamily: 'Albert Sans',
      fontWeight: 600,
      fontSize: '14px',
      lineHeight: '20px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      paddingTop: '2px',
      paddingBottom: '2px',
      paddingLeft: '8px',
      paddingRight: '8px',
      borderRadius: '50px',
      height: '24px',
      whiteSpace: 'nowrap' as const,
    }

    if (order.status === 'Completed') {
      return (
        <span
          style={{
            ...baseStyle,
            backgroundColor: '#f0fdf4',
            color: '#15803d',
          }}
        >
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
          Completed
        </span>
      )
    } else if (order.status === 'Paid') {
      return (
        <span
          style={{
            ...baseStyle,
            backgroundColor: '#eff6ff',
            color: '#2563eb',
          }}
        >
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
          Paid
        </span>
      )
    } else {
      return (
        <span
          style={{
            ...baseStyle,
            backgroundColor: '#fef2f2',
            color: '#dc2626',
          }}
        >
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
          Not Paid
        </span>
      )
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1
            className="text-2xl sm:text-3xl font-bold"
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
          >
            St Druex Orders
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showPastOrders ? "default" : "outline"}
            onClick={() => {
              setShowPastOrders(!showPastOrders)
              setPage(1)
            }}
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
          >
            {showPastOrders ? "Show Active Orders" : "Show Past Orders"}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by Order ID or Customer Name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className="pl-10"
            style={{ fontFamily: 'Albert Sans' }}
          />
        </div>
      </div>

      {/* Orders Table */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-[#105a9c] border-b border-[#0d4a82] text-white">
                <th style={{ fontFamily: 'Albert Sans', fontWeight: 600 }} className="text-left px-4 py-3 text-sm text-white">
                  Order ID
                </th>
                <th style={{ fontFamily: 'Albert Sans', fontWeight: 600 }} className="text-left px-4 py-3 text-sm text-white">
                  Customer Name
                </th>
                <th style={{ fontFamily: 'Albert Sans', fontWeight: 600 }} className="text-left px-4 py-3 text-sm text-white">
                  Suburb + Postcode
                </th>
                <th style={{ fontFamily: 'Albert Sans', fontWeight: 600 }} className="text-left px-4 py-3 text-sm text-white">
                  Status
                </th>
                <th style={{ fontFamily: 'Albert Sans', fontWeight: 600 }} className="text-left px-4 py-3 text-sm text-white">
                  Notes
                </th>
                <th style={{ fontFamily: 'Albert Sans', fontWeight: 600 }} className="text-left px-4 py-3 text-sm text-white">
                  Summary
                </th>
                <th style={{ fontFamily: 'Albert Sans', fontWeight: 600 }} className="text-left px-4 py-3 text-sm text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    {Array.from({ length: 7 }).map((_, colIdx) => (
                      <td key={colIdx} className="px-4 py-4">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length > 0 ? (
                orders.map((order, index) => (
                  <tr
                    key={order.order_id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <td className="px-4 py-4">
                      <span style={{ fontFamily: 'Albert Sans' }} className="text-sm font-medium text-blue-600">
                        #{order.order_id}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span style={{ fontFamily: 'Albert Sans' }} className="text-sm text-gray-900">
                        {order.customer_name}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span style={{ fontFamily: 'Albert Sans' }} className="text-sm text-gray-600">
                        {order.suburb_postcode || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-4">{getStatusBadge(order)}</td>
                    <td className="px-4 py-4">
                      <span style={{ fontFamily: 'Albert Sans' }} className="text-sm text-gray-600 max-w-xs truncate block">
                        {order.notes || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div style={{ fontFamily: 'Albert Sans' }} className="text-sm text-gray-700">
                        <div className="font-medium">{order.product_count} Products</div>
                        <div className="text-xs text-gray-500 mt-1 max-w-md truncate">
                          {order.product_summary}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditNotes(order)}
                        style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Notes
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <span style={{ fontFamily: 'Albert Sans' }}>
                      {showPastOrders ? 'No past orders found' : 'No active orders found'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-gray-200">
            <div style={{ fontFamily: 'Albert Sans' }} className="text-sm text-gray-600">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} orders
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                Previous
              </Button>
              <span style={{ fontFamily: 'Albert Sans' }} className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Edit Notes Dialog */}
      <Dialog open={editingOrderId !== null} onOpenChange={(open) => !open && setEditingOrderId(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
              Edit Notes - Order #{editingOrderId}
            </DialogTitle>
            <DialogDescription style={{ fontFamily: 'Albert Sans' }}>
              Add comments and weight for this order. Notes will be saved in past orders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label style={{ fontFamily: 'Albert Sans', fontWeight: 600 }} className="block text-sm font-medium mb-2">
                Notes / Comments
              </label>
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Enter notes or comments..."
                rows={4}
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>
            <div>
              <label style={{ fontFamily: 'Albert Sans', fontWeight: 600 }} className="block text-sm font-medium mb-2">
                Weight (optional)
              </label>
              <Input
                type="number"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                placeholder="Enter weight..."
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingOrderId(null)
                setNotesValue("")
                setWeightValue("")
              }}
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNotes}
              disabled={updateNotesMutation.isPending}
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

