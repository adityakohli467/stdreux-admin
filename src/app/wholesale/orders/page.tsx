"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Search, Filter, Calendar, Printer, Eye, Edit, Download, Mail, RefreshCw, Trash2, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { ordersAPI, locationsAPI, invoicesAPI } from "@/lib/api"
import { printTableData } from "@/lib/print-utils"
import { format } from "date-fns"

interface WholesaleOrder {
  order_id: number
  customer_id: number
  customer_name: string
  customer_firstname: string
  customer_lastname: string
  email: string
  telephone: string
  company: string
  company_id: number
  department: string
  department_id: number
  location_name: string
  location_id: number
  delivery_date: string | null
  delivery_time: string | null
  delivery_date_time: string | null
  delivery_address: string | null
  order_comments: string | null
  order_total: number
  amount: string
  order_status: number
  customer_type: string
  standing_order: number
  date_added: string
  date_modified: string
}

interface Location {
  location_id: number
  location_name: string
}

// Order status mapping
const orderStatusMap: Record<number, { label: string; color: string; bgColor: string }> = {
  0: { label: "Quote", color: "text-gray-700", bgColor: "bg-gray-50" },
  1: { label: "New Order", color: "text-blue-700", bgColor: "bg-blue-50" },
  2: { label: "Awaiting Approval", color: "text-yellow-700", bgColor: "bg-yellow-50" },
  3: { label: "Approved", color: "text-green-700", bgColor: "bg-green-50" },
  4: { label: "Complete", color: "text-purple-700", bgColor: "bg-purple-50" },
  5: { label: "Cancelled", color: "text-red-700", bgColor: "bg-red-50" },
  6: { label: "In Progress", color: "text-orange-700", bgColor: "bg-orange-50" },
  7: { label: "Completed", color: "text-green-700", bgColor: "bg-green-50" },
}

export default function WholesaleOrdersPage() {
  const queryClient = useQueryClient()

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null)
  const [selectedCustomerType, setSelectedCustomerType] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [showDatePicker, setShowDatePicker] = useState(false)

  // UI state
  const [selectedOrders, setSelectedOrders] = useState<number[]>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  // Fetch locations
  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await locationsAPI.list({ limit: 100 })
      return response.data
    }
  })

  const locations: Location[] = locationsData?.locations || []

  // Fetch wholesale orders
  const { data: ordersData, isLoading, error: ordersError } = useQuery({
    queryKey: ['wholesale-orders', selectedLocation, selectedStatus, selectedCustomerType, searchQuery, dateFrom, dateTo, minAmount, maxAmount, page],
    queryFn: async () => {
      const params: Record<string, any> = {
        limit,
        offset: (page - 1) * limit,
      }

      if (selectedLocation) params.location_id = selectedLocation
      if (selectedStatus !== null) params.status = selectedStatus
      if (selectedCustomerType) params.customer_type = selectedCustomerType
      if (searchQuery) params.search = searchQuery
      if (dateFrom) params.from_date = format(dateFrom, 'yyyy-MM-dd')
      if (dateTo) params.to_date = format(dateTo, 'yyyy-MM-dd 23:59:59')
      if (minAmount) params.min_amount = minAmount
      if (maxAmount) params.max_amount = maxAmount

      const response = await ordersAPI.listWholesale(params)
      return response.data
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  })

  const orders: WholesaleOrder[] = ordersData?.orders || []
  const totalCount = ordersData?.count || 0
  const totalPages = Math.ceil(totalCount / limit)

  // Get unique locations from orders
  const uniqueLocations = useMemo(() => {
    const locationMap = new Map<number, Location>()
    orders.forEach(order => {
      if (order.location_id && order.location_name) {
        locationMap.set(order.location_id, {
          location_id: order.location_id,
          location_name: order.location_name
        })
      }
    })
    return Array.from(locationMap.values())
  }, [orders])

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await ordersAPI.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] })
      queryClient.refetchQueries({ queryKey: ['wholesale-orders'] })
      toast.success("Order deleted successfully")
      setShowDeleteModal(false)
      setDeleteOrderId(null)
    },
    onError: (error: any) => {
      console.error("Delete order error:", error)
      toast.error(error.response?.data?.message || "Failed to delete order")
    }
  })

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: number }) => {
      await ordersAPI.updateStatus(id, status)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] })
      queryClient.refetchQueries({ queryKey: ['wholesale-orders'] })
      toast.success("Order status updated")
    },
    onError: (error: any) => {
      console.error("Update status error:", error)
      toast.error(error.response?.data?.message || "Failed to update status")
    }
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(orders.map(order => order.order_id))
    } else {
      setSelectedOrders([])
    }
  }

  const handleSelectOrder = (orderId: number, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId])
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId))
    }
  }

  const handleDelete = (orderId: number) => {
    setDeleteOrderId(orderId)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = () => {
    if (deleteOrderId) {
      deleteMutation.mutate(deleteOrderId)
    }
  }

  const handleClearFilters = () => {
    setSearchQuery("")
    setSelectedLocation(null)
    setSelectedStatus(null)
    setSelectedCustomerType(null)
    setDateFrom(null)
    setDateTo(null)
    setMinAmount("")
    setMaxAmount("")
    setPage(1)
  }

  const handlePrint = () => {
    printTableData("Wholesale Orders")
  }

  const handleDownloadInvoice = async (orderId: number) => {
    try {
      const response = await invoicesAPI.download(orderId)

      // Create blob from response
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const blobUrl = window.URL.createObjectURL(blob)

      // Create download link
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `invoice-${orderId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl)

      toast.success("Invoice downloaded successfully")
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to download invoice")
    }
  }

  const handleEmailInvoice = async (orderId: number) => {
    try {
      const order = orders.find(o => o.order_id === orderId)
      if (order?.email) {
        const response = await invoicesAPI.get(orderId)
        if (response.data.url) {
          window.location.href = `mailto:${order.email}?subject=Invoice for Order #${orderId}&body=Please find attached invoice for your order.`
        }
      } else {
        toast.error("Customer email not available")
      }
    } catch (error: any) {
      toast.error("Failed to get invoice")
    }
  }

  const getStatusLabel = (status: number): string => {
    return orderStatusMap[status]?.label || `Status ${status}`
  }

  const getStatusColor = (status: number): { color: string; bgColor: string } => {
    return orderStatusMap[status] || { color: "text-gray-700", bgColor: "bg-gray-50" }
  }

  const hasActiveFilters = searchQuery || selectedLocation || selectedStatus !== null || selectedCustomerType || dateFrom || dateTo || minAmount || maxAmount

  return (
    <div className="bg-gray-50 " style={{ fontFamily: 'Albert Sans' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-gray-900" style={{
          fontFamily: 'Albert Sans',
          fontWeight: 600,
          fontStyle: 'normal',
          fontSize: '40px',
          lineHeight: '20px',
          letterSpacing: '0%'
        }}>
          Wholesale Orders
        </h1>
      </div>

      {/* Search, Filters, and Print */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search Order ID, Customer ID, Status etc."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="w-[488px] h-[54px] border border-gray-200 bg-white rounded-full focus:ring-2 focus:ring-[#0d6efd] focus:border-[#0d6efd] focus:outline-none"
              style={{ fontFamily: 'Albert Sans', paddingLeft: '44px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
            />
          </div>

          <div className="relative">
            <DatePicker
              selected={dateFrom}
              onChange={(date: Date | null) => {
                setDateFrom(date)
                setPage(1)
              }}
              placeholderText="From Date"
              dateFormat="dd-MM-yyyy"
              className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d6efd]"
              wrapperClassName="w-full"
            />
          </div>

          <Button
            variant="outline"
            onClick={() => setSelectedStatus(selectedStatus === 2 ? null : 2)}
            className={`gap-2 h-11 border-gray-300 bg-white ${selectedStatus === 2 ? "text-blue-600 border-blue-600" : ""
              }`}
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
          >
            <Filter className="h-5 w-5" />
            Awaiting Approval
          </Button>

          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="h-11 border-gray-300 bg-white text-blue-600"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Clear Filters
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => {
              const min = prompt("Enter minimum amount:")
              if (min) setMinAmount(min)
            }}
            className="h-11 border-gray-300 bg-white text-blue-600"
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
          >
            Amount Filter
          </Button>

          <div className="ml-auto">
            <Button
              onClick={handlePrint}
              className="gap-2 whitespace-nowrap border-0 shadow-none"
              style={{
                fontFamily: 'Albert Sans',
                fontWeight: 600,
                fontStyle: 'normal',
                fontSize: '16px',
                lineHeight: '20px',
                letterSpacing: '0%',
                textAlign: 'center',
                color: '#0d6efd',
                backgroundColor: 'transparent',
                padding: 0,
                gap: '8px',
                opacity: 1
              }}
            >
              <Printer className="h-5 w-5 text-[#0d6efd]" />
              Print
            </Button>
          </div>
        </div>

        {/* Additional Filters Row */}
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedLocation || ""}
            onChange={(e) => {
              setSelectedLocation(e.target.value ? Number(e.target.value) : null)
              setPage(1)
            }}
            className="h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d6efd]"
            style={{ fontFamily: 'Albert Sans' }}
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.location_id} value={loc.location_id}>
                {loc.location_name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus !== null ? selectedStatus : ""}
            onChange={(e) => {
              setSelectedStatus(e.target.value ? Number(e.target.value) : null)
              setPage(1)
            }}
            className="h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d6efd]"
            style={{ fontFamily: 'Albert Sans' }}
          >
            <option value="">All Statuses</option>
            {Object.entries(orderStatusMap).map(([status, info]) => (
              <option key={status} value={status}>
                {info.label}
              </option>
            ))}
          </select>

          <select
            value={selectedCustomerType || ""}
            onChange={(e) => {
              setSelectedCustomerType(e.target.value || null)
              setPage(1)
            }}
            className="h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d6efd]"
            style={{ fontFamily: 'Albert Sans' }}
          >
            <option value="">All Customer Types</option>
            <option value="Full Service Wholesale">Full Service Wholesale</option>
            <option value="Partial Service Wholesale">Partial Service Wholesale</option>
          </select>
        </div>
      </div>

      {/* Location Tabs */}
      {uniqueLocations.length > 0 && (
        <div className="flex gap-4 mb-6 overflow-x-auto">
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedLocation(null)
              setPage(1)
            }}
            className={`whitespace-nowrap ${selectedLocation === null
              ? "text-blue-600 border-b-2 border-blue-600 rounded-none"
              : "text-gray-600"
              }`}
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
          >
            All Locations
          </Button>
          {uniqueLocations.map((location) => (
            <Button
              key={location.location_id}
              variant="ghost"
              onClick={() => {
                setSelectedLocation(location.location_id)
                setPage(1)
              }}
              className={`whitespace-nowrap ${selectedLocation === location.location_id
                ? "text-blue-600 border-b-2 border-blue-600 rounded-none"
                : "text-gray-600"
                }`}
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              {location.location_name}
            </Button>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left">
                  <Checkbox
                    checked={orders.length > 0 && selectedOrders.length === orders.length}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Order ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Customer Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Company
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Department
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Delivery Date
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Delivery Time
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-[#0d6efd]" />
                      <span className="text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
                        Loading wholesale orders...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : ordersError ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-sm text-red-600" style={{ fontFamily: 'Albert Sans' }}>
                        Error loading orders
                      </span>
                      <Button
                        onClick={() => queryClient.refetchQueries({ queryKey: ['wholesale-orders'] })}
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
                      >
                        Retry
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-sm text-gray-500" style={{ fontFamily: 'Albert Sans' }}>
                        No wholesale orders found
                      </span>
                      <span className="text-xs text-gray-400" style={{ fontFamily: 'Albert Sans' }}>
                        {hasActiveFilters
                          ? "Try clearing filters or create an order for a wholesale customer"
                          : "Create an order for a wholesale customer to see it here"}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const statusInfo = getStatusColor(order.order_status)
                  return (
                    <tr key={order.order_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <Checkbox
                          checked={selectedOrders.includes(order.order_id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.order_id, checked as boolean)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/orders/${order.order_id}`}>
                          <span className="text-sm text-blue-600 hover:text-blue-800 font-medium cursor-pointer" style={{ fontFamily: 'Albert Sans' }}>
                            #{order.order_id}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                          {order.customer_name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          {order.company}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          {order.department}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }) : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          {order.delivery_time || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900 font-medium" style={{ fontFamily: 'Albert Sans' }}>
                          ${order.order_total.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${order.order_status === 4 || order.order_status === 7 ? 'bg-green-600' :
                            order.order_status === 2 ? 'bg-yellow-600' :
                              order.order_status === 6 ? 'bg-orange-600' :
                                'bg-gray-600'
                            }`}></span>
                          {getStatusLabel(order.order_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/orders/${order.order_id}`}>
                            <button className="p-1 hover:bg-gray-100 rounded" title="View">
                              <Eye className="h-4 w-4 text-gray-600" />
                            </button>
                          </Link>
                          <Link href={`/orders/${order.order_id}/edit`}>
                            <button className="p-1 hover:bg-gray-100 rounded" title="Edit">
                              <Edit className="h-4 w-4 text-gray-600" />
                            </button>
                          </Link>
                          <button
                            onClick={() => handleDownloadInvoice(order.order_id)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Download Invoice"
                          >
                            <Download className="h-4 w-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleEmailInvoice(order.order_id)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Email Invoice"
                          >
                            <Mail className="h-4 w-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => {
                              queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] })
                              toast.success("Order refreshed")
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Refresh"
                          >
                            <RefreshCw className="h-4 w-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(order.order_id)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
          Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, totalCount)} of {totalCount} Entries
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-gray-300 bg-white"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Prev
          </Button>
          <Button
            size="sm"
            className="bg-[#0d6efd] hover:bg-[#0b5ed7] text-white"
          >
            {page}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-300 bg-white"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || totalPages === 0}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 700 }}>
              Delete Order
            </DialogTitle>
            <DialogDescription style={{ fontFamily: 'Albert Sans' }}>
              Are you sure you want to delete this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Order #{deleteOrderId}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false)
                setDeleteOrderId(null)
              }}
              className="border-gray-300"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
