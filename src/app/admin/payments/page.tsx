"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  DollarSign,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  TrendingUp,
  Users,
  FileText,
  Calendar as CalendarIcon
} from "lucide-react"
import { toast } from "sonner"
import { paymentsAPI } from "@/lib/api"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface Payment {
  payment_history_id: number
  order_id: number
  payment_transaction_id: string
  payment_type: string
  payment_status: string
  payment_gateway: string
  amount: number
  currency: string
  refund_amount: number
  customer_id?: number
  customer_email?: string
  card_last4?: string
  card_brand?: string
  payment_method?: string
  created_at: string
  updated_at: string
  processed_at?: string
  gateway_status?: string
  gateway_message?: string
  has_error: boolean
  order_total?: number
  order_status?: number
  customer_name?: string
  gst?: number
}

interface PaymentStatistics {
  total_transactions: number
  successful_payments: number
  failed_payments: number
  pending_payments: number
  refunded_payments: number
  total_revenue: number
  total_refunds: number
  net_revenue: number
  unique_customers: number
  unique_orders: number
}

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedGateway, setSelectedGateway] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const limit = 1000

  // Build query params
  const queryParams: any = {
    limit,
    offset: (page - 1) * limit,
  }

  if (selectedStatus !== "all") {
    queryParams.payment_status = selectedStatus
  }

  if (selectedGateway !== "all") {
    queryParams.payment_gateway = selectedGateway
  }

  if (dateFrom) {
    queryParams.date_from = dateFrom.toISOString().split('T')[0]
  }

  if (dateTo) {
    queryParams.date_to = dateTo.toISOString().split('T')[0]
  }

  if (searchQuery) {
    // Search by order ID or transaction ID
    const orderId = parseInt(searchQuery)
    if (!isNaN(orderId)) {
      queryParams.order_id = orderId
    } else {
      // Could search by transaction ID in backend
      queryParams.search = searchQuery
    }
  }

  // Fetch payment history
  const { data: paymentsData, isLoading, refetch } = useQuery({
    queryKey: ['payments', queryParams],
    queryFn: async () => {
      const response = await paymentsAPI.getHistory(queryParams)
      return response.data
    },
  })

  // Fetch statistics
  const { data: statisticsData } = useQuery({
    queryKey: ['payment-statistics', dateFrom, dateTo],
    queryFn: async () => {
      const params: any = {}
      if (dateFrom) params.date_from = dateFrom.toISOString().split('T')[0]
      if (dateTo) params.date_to = dateTo.toISOString().split('T')[0]
      const response = await paymentsAPI.getStatistics(params)
      return response.data
    },
  })

  // Fetch current month statistics
  const { data: currentMonthStatsData } = useQuery({
    queryKey: ['payment-statistics-current-month'],
    queryFn: async () => {
      const date = new Date()
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)

      const params = {
        date_from: firstDay.toISOString().split('T')[0],
        date_to: lastDay.toISOString().split('T')[0]
      }

      const response = await paymentsAPI.getStatistics(params)
      return response.data
    },
  })

  const payments: Payment[] = paymentsData?.payments || []
  const pagination = paymentsData?.pagination || { total: 0, limit: 50, offset: 0, has_more: false }
  const statistics: PaymentStatistics | null = statisticsData?.statistics || null
  const currentMonthStats: PaymentStatistics | null = currentMonthStatsData?.statistics || null

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Succeeded</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case 'refunded':
        return <Badge className="bg-blue-100 text-blue-800"><RotateCcw className="w-3 h-3 mr-1" />Refunded</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getGatewayBadge = (gateway: string) => {
    const colors: Record<string, string> = {
      netcomplete: "bg-purple-100 text-purple-800",
      pinpayments: "bg-blue-100 text-blue-800",
      securepay: "bg-gray-100 text-gray-800",
      manual: "bg-orange-100 text-orange-800",
    }
    return <Badge className={colors[gateway] || "bg-gray-100 text-gray-800"}>{gateway}</Badge>
  }

  const handleViewDetails = async (payment: Payment) => {
    setSelectedPayment(payment)
    setShowDetailsModal(true)
  }

  const handleSyncStatus = async (paymentIntentId: string, orderId?: number) => {
    const loadingToast = toast.loading("Syncing with Stripe...")
    try {
      const response = await paymentsAPI.verify({
        payment_intent_id: paymentIntentId,
        order_id: orderId
      })

      if (response.data.success) {
        toast.success(`Payment successful! Status updated.`, { id: loadingToast })
      } else {
        toast.info(`Payment status is: ${response.data.payment_intent.status}`, { id: loadingToast })
      }
      refetch()
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`, { id: loadingToast })
    }
  }

  const handleSyncRecent = async () => {
    const loadingToast = toast.loading("Reconciling recent orders with Stripe...")
    try {
      const response = await paymentsAPI.syncRecent()
      const { total_found, total_synced } = response.data
      
      if (total_synced > 0) {
        toast.success(`Successfully reconciled ${total_synced} missing payments!`, { id: loadingToast })
        refetch()
      } else if (total_found > 0) {
        toast.info(`Found ${total_found} orders but they are already in sync or couldn't be reconciled.`, { id: loadingToast })
      } else {
        toast.success(`All recent orders are already in sync.`, { id: loadingToast })
      }
    } catch (error: any) {
      console.error("Sync recent failed:", error)
      toast.error(`Sync failed: ${error.message}`, { id: loadingToast })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payment History</h1>
          <p className="text-gray-600 mt-1">View and manage all payment transactions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSyncRecent} variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Recent with Stripe
          </Button>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(statistics.total_revenue || 0)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Current Month Revenue</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(currentMonthStats?.total_revenue || 0)}</p>
                </div>
                <CalendarIcon className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Successful Payments</p>
                  <p className="text-2xl font-bold">{statistics.successful_payments || 0}</p>
                  {/* <p className="text-xs text-gray-500">of {statistics.total_transactions || 0} total</p> */}
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Failed Payments</p>
                  <p className="text-2xl font-bold text-red-600">{statistics.failed_payments || 0}</p>
                  <p className="text-xs text-gray-500">{statistics.refunded_payments || 0} refunded</p>
                </div>
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Search</Label>
              <Input
                placeholder="Order ID or Transaction ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* <div>
              <Label>Gateway</Label>
              <Select value={selectedGateway} onValueChange={setSelectedGateway}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Gateways</SelectItem>
                  <SelectItem value="netcomplete">NetComplete</SelectItem>
                  <SelectItem value="pinpayments">PinPayments</SelectItem>
                  <SelectItem value="securepay">SecurePay</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div> */}

            <div>
              <Label>Date From</Label>
              <DatePicker
                selected={dateFrom}
                onChange={(date) => setDateFrom(date)}
                dateFormat="yyyy-MM-dd"
                className="w-full px-3 py-2 border rounded-md"
                placeholderText="Select date"
              />
            </div>

            <div>
              <Label>Date To</Label>
              <DatePicker
                selected={dateTo}
                onChange={(date) => setDateTo(date)}
                dateFormat="yyyy-MM-dd"
                className="w-full px-3 py-2 border rounded-md"
                placeholderText="Select date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Loading payments...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No payments found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Transaction ID</th>
                      <th className="text-left p-3">Order ID</th>
                      <th className="text-left p-3">Customer</th>
                      <th className="text-left p-3">Amount</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Gateway</th>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.payment_history_id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {payment.payment_transaction_id.substring(0, 20)}...
                          </code>
                        </td>
                        <td className="p-3 font-medium">{payment.order_id ? `#${payment.order_id}` : 'N/A'}</td>
                        <td className="p-3">
                          {payment.customer_name || payment.customer_email || 'N/A'}
                          {payment.card_last4 && (
                            <span className="text-xs text-gray-500 ml-2">
                              •••• {payment.card_last4}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div>
                            <span className="font-bold">
                              {(() => {
                                const amount = Number(payment.amount || 0)
                                return formatCurrency(amount)
                              })()}
                            </span>
                            {payment.refund_amount > 0 && (
                              <span className="text-xs text-red-600 ml-2">
                                (Refunded: {(() => {
                                  const amount = Number(payment.refund_amount || 0)
                                  return formatCurrency(amount)
                                })()})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">{getStatusBadge(payment.payment_status)}</td>
                        <td className="p-3">{getGatewayBadge(payment.payment_gateway)}</td>
                        <td className="p-3 text-sm text-gray-600">
                          {new Date(payment.created_at).toLocaleDateString()}
                          <br />
                          <span className="text-xs">
                            {new Date(payment.created_at).toLocaleTimeString()}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDetails(payment)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                            {payment.payment_status === 'pending' && payment.payment_gateway === 'stripe' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => handleSyncStatus(payment.payment_transaction_id, payment.order_id)}
                              >
                                <RefreshCw className="w-4 h-4 mr-1" />
                                Sync
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex justify-between items-center mt-4">
                <p className="text-sm text-gray-600">
                  Total {payments.length} payments
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>
              Transaction ID: {selectedPayment?.payment_transaction_id}
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Order ID</Label>
                  <p className="font-bold">#{selectedPayment.order_id}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Status</Label>
                  <div>{getStatusBadge(selectedPayment.payment_status)}</div>
                </div>
                <div>
                  <Label className="text-gray-600">Amount</Label>
                  <p className="font-bold text-lg">
                    {(() => {
                      const amount = Number(selectedPayment.amount || 0)
                      return formatCurrency(amount)
                    })()}
                  </p>
                </div>
                {/* <div>
                  <Label className="text-gray-600">Refunded</Label>
                  <p className={selectedPayment.refund_amount > 0 ? "text-red-600 font-bold" : "text-gray-500"}>
                    {formatCurrency(selectedPayment.refund_amount)}
                  </p>
                </div> */}
                <div>
                  <Label className="text-gray-600">Gateway</Label>
                  <div>{getGatewayBadge(selectedPayment.payment_gateway)}</div>
                </div>
                <div>
                  <Label className="text-gray-600">Payment Method</Label>
                  <p>{selectedPayment.payment_method || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Customer</Label>
                  <p>{selectedPayment.customer_name || selectedPayment.customer_email || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Card</Label>
                  <p>
                    {selectedPayment.card_brand && (
                      <span className="capitalize">{selectedPayment.card_brand} </span>
                    )}
                    {selectedPayment.card_last4 ? `•••• ${selectedPayment.card_last4}` : 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-600">Created</Label>
                  <p>{new Date(selectedPayment.created_at).toLocaleString()}</p>
                </div>
                {selectedPayment.processed_at && (
                  <div>
                    <Label className="text-gray-600">Processed</Label>
                    <p>{new Date(selectedPayment.processed_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
              {selectedPayment.has_error && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <Label className="text-red-800 font-bold">Error Occurred</Label>
                  <p className="text-sm text-red-700 mt-1">
                    {selectedPayment.gateway_message || 'Payment failed'}
                  </p>
                </div>
              )}
              {selectedPayment.payment_status === 'pending' && selectedPayment.payment_gateway === 'stripe' && (
                <div className="bg-blue-50 border border-blue-200 rounded p-4 flex justify-between items-center mt-4">
                  <div>
                    <h4 className="font-bold text-blue-800 text-sm">Verify Payment Status</h4>
                    <p className="text-xs text-blue-700">If the customer has paid but the status is still pending, you can manually sync with Stripe.</p>
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-[#105a9c] hover:bg-[#0d4a82] h-9"
                    onClick={() => handleSyncStatus(selectedPayment.payment_transaction_id, selectedPayment.order_id)}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Status
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

