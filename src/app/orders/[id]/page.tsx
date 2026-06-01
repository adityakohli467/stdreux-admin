"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ArrowLeft, Download, Send, DollarSign, Printer, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import api, { invoicesAPI, paymentsAPI } from "@/lib/api"
import { PaymentProcessingModal } from "@/components/PaymentProcessingModal"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useState } from "react"

interface OrderProduct {
  order_product_id: number
  product_id: number
  product_name: string
  category?: string
  product_description?: string
  quantity: number
  price: number
  total: number
  product_comment?: string
  options?: Array<{
    option_name: string
    option_value: string
    option_quantity: number
    option_price: number
  }>
}

interface OrderDetails {
  order_id: number
  customer_id?: number
  firstname?: string
  lastname?: string
  email?: string
  telephone?: string
  customer_order_name?: string
  customer_order_email?: string
  customer_order_telephone?: string
  date_added?: string
  delivery_date_time?: string
  delivery_time?: string
  pickup_delivery_notes?: string
  order_comments?: string
  company_name?: string
  company_abn?: string
  department_name?: string
  company_id?: number
  department_id?: number
  delivery_address?: string
  delivery_method?: string
  delivery_contact?: string
  delivery_details?: string
  location_name?: string
  location_id?: number
  order_products?: OrderProduct[]
  products?: OrderProduct[]
  subtotal?: number
  wholesale_discount?: number
  delivery_fee?: number
  coupon_discount?: number
  total_discount?: number
  coupon_code?: string
  coupon_type?: string
  coupon_id?: number
  gst?: number
  calculated_total?: number
  order_total?: number
  customer_type?: string
  payment_status?: string
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const orderId = params?.id as string | undefined
  const [downloadingInvoice, setDownloadingInvoice] = useState(false)
  const [printingInvoice, setPrintingInvoice] = useState(false)
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false)
  const [sendingInvoice, setSendingInvoice] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [syncingPayment, setSyncingPayment] = useState(false)

  // Fetch order from API
  const { data: orderData, isLoading, error, isFetching } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) {
        throw new Error('Order ID is required')
      }
      console.log('Fetching order:', orderId)
      const response = await api.get(`/admin/orders/${orderId}`)
      console.log('Order fetched:', response.data?.order)
      return response.data
    },
    enabled: !!orderId, // Only fetch if orderId exists
    retry: 2, // Retry twice on failure
    retryDelay: 1000, // Wait 1 second between retries
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: true, // Always refetch on mount
  })

  const order = orderData?.order as OrderDetails | undefined

  // Fetch all products to match categories for GST
  const { data: allProductsData } = useQuery({
    queryKey: ['all-products-for-gst'],
    queryFn: async () => {
      const response = await api.get('/admin/products-new?limit=1000&status=1')
      return response.data
    },
    staleTime: 300000, // 5 minutes
  })

  const allProducts = allProductsData?.products || []

  // Fetch payment history
  const { data: paymentHistoryData } = useQuery({
    queryKey: ['payment-history', orderId],
    queryFn: async () => {
      if (!orderId) return { payments: [] }
      const response = await paymentsAPI.getOrderHistory(parseInt(orderId))
      return response.data
    },
    enabled: !!orderId,
  })

  const paymentHistory = paymentHistoryData?.payments || []

  // Show loading state instead of blank page (check both isLoading and isFetching)
  if (isLoading || isFetching) {
    return (
      <div className="flex items-center justify-center bg-gray-50 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0d6efd] mx-auto mb-4"></div>
          <p className="text-gray-600" style={{ fontFamily: 'Albert Sans' }}>Loading order details...</p>
          {orderId && (
            <p className="text-sm text-gray-500 mt-2" style={{ fontFamily: 'Albert Sans' }}>
              Order ID: {orderId}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Show error state only if there's an actual error (not just missing data during loading)
  if (error) {
    return (
      <div className="flex items-center justify-center bg-gray-50 min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-2" style={{ fontFamily: 'Albert Sans' }}>
            Failed to load order details
          </p>
          {orderId && (
            <p className="text-sm text-gray-500 mb-4" style={{ fontFamily: 'Albert Sans' }}>
              Order ID: {orderId}
            </p>
          )}
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-[#0d6efd] text-white rounded-lg hover:bg-[#0b5ed7] transition-colors"
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Show "not found" only if we're not loading and there's no error but also no order data
  if (!isLoading && !error && !order) {
    return (
      <div className="flex items-center justify-center bg-gray-50 min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-2" style={{ fontFamily: 'Albert Sans' }}>
            Order not found
          </p>
          {orderId && (
            <p className="text-sm text-gray-500 mb-4" style={{ fontFamily: 'Albert Sans' }}>
              Order ID: {orderId}
            </p>
          )}
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-[#0d6efd] text-white rounded-lg hover:bg-[#0b5ed7] transition-colors"
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const handleDownloadInvoice = async () => {
    if (!order || !order.order_id) {
      toast.error("Order ID not found")
      return
    }

    setDownloadingInvoice(true)
    try {
      const response = await invoicesAPI.download(order.order_id)

      // Create blob from response
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const blobUrl = window.URL.createObjectURL(blob)

      // Create download link
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `invoice-${order.order_id}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl)

      toast.success("Invoice downloaded successfully")
    } catch (error: any) {
      console.error("Download invoice error:", error)
      const errorMessage = error.response?.data?.message || error.message || "Failed to download invoice"
      toast.error(errorMessage)
    } finally {
      setDownloadingInvoice(false)
    }
  }

  const handleSendPaymentLink = async () => {
    if (!orderId) return

    setSendingPaymentLink(true)
    try {
      const response = await api.post(`/admin/orders/${orderId}/send-payment-link`)
      toast.success("Payment link email sent successfully", {
        description: `Sent to: ${response.data.sent_to?.join(', ') || 'customer'}`,
      })
    } catch (error: any) {
      console.error("Failed to send payment link:", error)
      toast.error("Failed to send payment link", {
        description: error.response?.data?.message || "Please try again later",
      })
    } finally {
      setSendingPaymentLink(false)
    }
  }

  const handlePrintInvoice = async () => {
    if (!order || !order.order_id) {
      toast.error("Order ID not found")
      return
    }

    setPrintingInvoice(true)
    try {
      const response = await invoicesAPI.download(order.order_id)

      // Create blob from response
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const blobUrl = window.URL.createObjectURL(blob)

      // Open in new window for printing
      const printWindow = window.open(blobUrl, '_blank')
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
        }
      }

      // Clean up blob URL after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl)
      }, 1000)

      toast.success("Invoice opened for printing")
    } catch (error: any) {
      console.error("Failed to print invoice:", error)
      toast.error(error.response?.data?.message || "Failed to print invoice")
    } finally {
      setPrintingInvoice(false)
    }
  }

  const handleSendInvoice = async () => {
    if (!order || !order.order_id) {
      toast.error("Order ID not found")
      return
    }

    setSendingInvoice(true)
    try {
      const response = await invoicesAPI.send(order.order_id)
      toast.success(response.data.email_sent ? "Invoice sent successfully" : "Invoice email prepared", {
        description: response.data.email_sent
          ? `Sent to: ${response.data.recipient}`
          : response.data.note || "Email service not configured",
      })
    } catch (error: any) {
      console.error("Failed to send invoice:", error)
      const errorMessage = error.response?.data?.message || error.message || "Failed to send invoice"
      toast.error(errorMessage)
    } finally {
      setSendingInvoice(false)
    }
  }

  const handleSyncPayment = async () => {
    if (!orderId) return

    setSyncingPayment(true)
    const toastId = toast.loading("Syncing payment with Stripe...")
    try {
      const response = await paymentsAPI.getStatus(parseInt(orderId))
      queryClient.invalidateQueries({ queryKey: ["order", orderId] })
      queryClient.invalidateQueries({ queryKey: ["payment-history", orderId] })
      
      toast.success("Payment status synchronized", {
        id: toastId,
        description: `Status: ${response.data.payment_status || "Completed"}`
      })
    } catch (error: any) {
      console.error("Failed to sync payment:", error)
      toast.error("Failed to sync payment", {
        id: toastId,
        description: error.response?.data?.message || error.message
      })
    } finally {
      setSyncingPayment(false)
    }
  }


  // Calculate totals if not provided - order is guaranteed to exist here
  if (!order) return null

  // Use backend calculated values if available, otherwise calculate
  const subtotal = typeof order.subtotal === 'number' ? order.subtotal : parseFloat(order.subtotal || '0')
  const wholesaleDiscount = typeof order.wholesale_discount === 'number' ? order.wholesale_discount : 0
  const couponDiscount = typeof order.coupon_discount === 'number' ? order.coupon_discount : parseFloat(String(order.coupon_discount || '0'))
  const deliveryFee = parseFloat(String(order.delivery_fee || '0'))
  const products = order.products || order.order_products || []

  // Calculate GST only for ANCILLARIES and packages (10%)
  const ancillaryGst = products.reduce((sum, p: any) => {
    // Find the original product to get categories (as order products might not have them)
    const originalProduct = allProducts.find((ap: any) => Number(ap.product_id) === Number(p.product_id));

    // Check categories from the original product or the order product itself
    const categories = originalProduct?.categories || p.categories || [];
    const categoryName = p.category || (p.categories && p.categories[0]?.category_name) || p.category_name || "";

    const isAncillaryOrPackage = categories.some((c: any) => {
      const name = (c.category_name || "").toUpperCase();
      return name === "ANCILLARIES" || name === "PACKAGES" || name === "PACKAGING";
    }) || categoryName.toUpperCase() === "ANCILLARIES" || categoryName.toUpperCase() === "PACKAGES" || categoryName.toUpperCase() === "PACKAGING";

    if (isAncillaryOrPackage) {
      return sum + (Number(p.total || 0) * 0.1);
    }
    return sum;
  }, 0);

  // Use backend total as fallback, but for display we use subtotal + delivery - discounts
  // (Not adding ancillaryGst to total as requested)
  const total = subtotal + deliveryFee - (wholesaleDiscount + couponDiscount)

  return (
    <div className="bg-gray-50 " style={{ fontFamily: 'Albert Sans' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-300 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontWeight: 700 }}>
              Viewing Order Details
            </h1>
            <p className="text-gray-600 mt-1">
              Order <span className="text-[#0d6efd] font-semibold">#{order.order_id}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="gap-2 border-gray-300 text-gray-700 hover:text-gray-900"
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            onClick={handleDownloadInvoice}
            disabled={downloadingInvoice || !order || !order.order_id}
          >
            <Download className="h-4 w-4" />
            {downloadingInvoice ? "Downloading..." : "Download Tax Invoice"}
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-gray-300 text-gray-700 hover:text-gray-900"
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            onClick={handlePrintInvoice}
            disabled={printingInvoice || !order || !order.order_id}
          >
            <Printer className="h-4 w-4" />
            {printingInvoice ? "Printing..." : "Print Tax Invoice"}
          </Button>
          {order.payment_status !== 'Paid' && order.payment_status !== 'Completed' && (
            <Button
              className="bg-[#0d6efd] hover:bg-[#0b5ed7] text-white gap-2"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              onClick={handleSendPaymentLink}
              disabled={sendingPaymentLink}
            >
              <Send className="h-4 w-4" />
              {sendingPaymentLink ? "Sending..." : "Send Payment Link"}
            </Button>
          )} 
         {/* {orderId && (
            <Button
              variant="outline"
              className="gap-2 border-gray-300 text-gray-700 hover:text-gray-900"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              onClick={() => setShowPaymentModal(true)}
            >
              <DollarSign className="h-4 w-4" />
              Process Payment
            </Button>
          )}  */}
          {/* <Button
            variant="outline"
            className="gap-2 border-blue-300 text-blue-700 hover:text-blue-900 bg-blue-50"
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            onClick={handleSyncPayment}
            disabled={syncingPayment || !order || !order.order_id}
          >
            <RefreshCw className={`h-4 w-4 ${syncingPayment ? 'animate-spin' : ''}`} />
            {syncingPayment ? "Syncing..." : "Sync Stripe Payment"}
          </Button> */}
          <Button
            variant="outline"
            className="gap-2 border-gray-300 text-gray-700 hover:text-gray-900"
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            onClick={handleSendInvoice}
            disabled={sendingInvoice || !order || !order.order_id}
          >
            <Send className="h-4 w-4" />
            {sendingInvoice ? "Sending..." : "Send Invoice"}
          </Button>
        </div>
      </div>

      {/* Order Date & Delivery Date */}
      <div className="flex flex-wrap gap-6 mb-6">
        <div>
          <span className="text-xs font-medium text-gray-500" style={{ fontFamily: 'Albert Sans' }}>Order Date</span>
          <p className="text-sm font-medium text-gray-900 mt-1" style={{ fontFamily: 'Albert Sans' }}>
            {order.date_added ? format(new Date(order.date_added), 'dd MMM, yyyy') : 'N/A'}
          </p>
        </div>
        {order.delivery_date_time && (
          <div>
            <span className="text-xs font-medium text-gray-500" style={{ fontFamily: 'Albert Sans' }}>Delivery Date</span>
            <p className="text-sm font-medium text-gray-900 mt-1" style={{ fontFamily: 'Albert Sans' }}>
              {format(new Date(order.delivery_date_time.endsWith('Z') ? order.delivery_date_time.slice(0, -1) : order.delivery_date_time), 'dd MMM, yyyy')}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Products Table */}
        <div className="lg:col-span-2">
          <Card className="p-6 bg-white border-gray-200">
            {/* Products Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                      No.
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                      Product Name
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                      Price
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                      Total Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products && products.length > 0 ? (
                    products.map((product: OrderProduct, index: number) => {
                      const totalWithOptions = parseFloat(product.total?.toString() || '0')
                      const hasOptions = product.options && product.options.length > 0

                      return (
                        <tr key={product.order_product_id} className="border-b border-gray-100">
                          <td className="px-4 py-4 align-top">
                            <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div>
                              <p className="text-sm font-medium text-gray-900 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                                {product.product_name}
                              </p>
                              {product.product_comment && (
                                <p className="text-xs text-gray-600 italic mt-1" style={{ fontFamily: 'Albert Sans' }}>
                                  Note: {product.product_comment}
                                </p>
                              )}
                              {hasOptions && (
                                <div className="mt-2 space-y-1">
                                  {product.options!.map((option, optionIndex) => (
                                    <p key={optionIndex} className="text-sm text-gray-700 ml-2" style={{ fontFamily: 'Albert Sans' }}>
                                      {option.option_name}: {option.option_value}
                                      {option.option_quantity > 1 && ` (×${option.option_quantity})`}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-center">
                            <div>
                              <p className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                                {product.quantity}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-right">
                            <div>
                              <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                                ${(Number(product.price) > 0 ? Number(product.price) : (product.quantity > 0 ? totalWithOptions / product.quantity : 0)).toFixed(2)}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-right">
                            <div>
                              <p className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                                ${totalWithOptions.toFixed(2)}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        <span style={{ fontFamily: 'Albert Sans' }}>No products in this order</span>
                      </td>
                    </tr>
                  )}

                  {/* Totals */}
                  <tr className="border-b border-gray-100">
                    <td colSpan={4} className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        Sub Total
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                        ${subtotal.toFixed(2)}
                      </span>
                    </td>
                  </tr>

                  {wholesaleDiscount > 0 && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={4} className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-green-600" style={{ fontFamily: 'Albert Sans' }}>
                          Wholesale Discount
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-green-600" style={{ fontFamily: 'Albert Sans' }}>
                          -${wholesaleDiscount.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )}

                  {(couponDiscount > 0 || (order.coupon_id && couponDiscount === 0)) && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={4} className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-medium text-green-600" style={{ fontFamily: 'Albert Sans' }}>
                            Coupon Discount
                          </span>
                          {order.coupon_code && (
                            <span className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Albert Sans' }}>
                              🎟️ {order.coupon_code}
                            </span>
                          )}
                          {order.coupon_id && !order.coupon_code && (
                            <span className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Albert Sans' }}>
                              🎟️ Coupon Applied (Deleted)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-green-600" style={{ fontFamily: 'Albert Sans' }}>
                          -${couponDiscount.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )}

                  <tr className="border-b border-gray-100">
                    <td colSpan={4} className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        Delivery Fee
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                        ${deliveryFee.toFixed(2)}
                      </span>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-100">
                    <td colSpan={4} className="px-4 py-3 text-right">
                      <span className="text-base font-semibold text-[#0d6efd]" style={{ fontFamily: 'Albert Sans' }}>
                        Total
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-base font-bold text-[#0d6efd]" style={{ fontFamily: 'Albert Sans' }}>
                        ${total.toFixed(2)}
                      </span>
                    </td>
                  </tr>

                  {ancillaryGst > 0 && (
                    <tr className="border-b border-gray-200">
                      <td colSpan={4} className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
                          GST
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
                          ${ancillaryGst.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Company Details and Order Comments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-6 border-t border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Company Details
                </h3>
                <div className="space-y-1 text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                  <p>Company Name : {order.company_name || 'N/A'}</p>
                  {order.company_abn && (
                    <p>ABN : {order.company_abn}</p>
                  )}
                </div>
              </div>
              {/* <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Order Comments
                </h3>
                <p className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                  {order.order_comments || 'No comments'}
                </p>
              </div> */}
            </div>
          </Card>
        </div>

        {/* Right: Order Details & Delivery Details */}
        <div className="lg:col-span-1 space-y-6">
          {/* Customer Details */}
          <Card className="p-6 bg-white border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                Customer Details
              </h3>
            </div>

            <div className="space-y-4">
              {order.company_name && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                    Company Name
                  </p>
                  <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                    {order.company_name}
                  </p>
                </div>
              )}

              {order.department_name && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                    Department
                  </p>
                  <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                    {order.department_name}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                  Customer Name
                </p>
                <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                  {order.firstname && order.lastname ? `${order.firstname} ${order.lastname}` : order.customer_order_name || 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                  Customer Email
                </p>
                <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                  {order.email || order.customer_order_email || 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                  Customer Phone
                </p>
                <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                  {order.telephone || order.customer_order_telephone || 'N/A'}
                </p>
              </div>

              {order.location_name && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                    Order Location
                  </p>
                  <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                    {order.location_name}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Delivery/Pick Up Details */}
          <Card className="p-6 bg-white border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
              {order.delivery_method === 'pickup' ? 'Pick Up Details' : 'Delivery Details'}
            </h3>

            <div className="space-y-4">
              {order.delivery_date_time && (
                <>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                      Delivery Date
                    </p>
                    <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                      {format(new Date(order.delivery_date_time.endsWith('Z') ? order.delivery_date_time.slice(0, -1) : order.delivery_date_time), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                      Delivery Time
                    </p>
                    <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                      {order.delivery_time || format(new Date(order.delivery_date_time.endsWith('Z') ? order.delivery_date_time.slice(0, -1) : order.delivery_date_time), 'HH:mm')}
                    </p>
                  </div>
                </>
              )}

              {order.delivery_address && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                    Delivery Address
                  </p>
                  <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                    {order.delivery_address}
                  </p>
                </div>
              )}

              {order.delivery_contact && (
                <>
                  {(() => {
                    const parts = order.delivery_contact.split('|')
                    const contactName = parts[0]?.trim() || ''
                    const contactNumber = parts[1]?.trim() || ''
                    return (
                      <>
                        {contactName && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                              Delivery Contact
                            </p>
                            <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                              {contactName}
                            </p>
                          </div>
                        )}
                        {contactNumber && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                              Delivery Contact Number
                            </p>
                            <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                              {contactNumber}
                            </p>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </>
              )}

              {(order.pickup_delivery_notes || order.delivery_details) && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                    Delivery Notes
                  </p>
                  <p className="text-sm text-gray-900 whitespace-pre-line" style={{ fontFamily: 'Albert Sans' }}>
                    {order.pickup_delivery_notes || order.delivery_details}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Payment Processing Modal */}
      {orderId && (
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Process Payment</DialogTitle>
              <DialogDescription>
                Process payment for order #{orderId}
              </DialogDescription>
            </DialogHeader>
            <PaymentProcessingModal
              orderId={parseInt(orderId)}
              onSuccess={() => {
                setShowPaymentModal(false)
                queryClient.invalidateQueries({ queryKey: ['order', orderId] })
                toast.success("Payment processed successfully")
              }}
              onClose={() => setShowPaymentModal(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Payment History Section */}
      {paymentHistory.length > 0 && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
              Payment History
            </h3>
            <div className="space-y-3">
              {paymentHistory.map((payment: any) => (
                <div key={payment.payment_history_id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {payment.payment_transaction_id.substring(0, 30)}...
                        </code>
                        <Badge variant={payment.payment_status === 'succeeded' ? 'default' : 'secondary'}>
                          {payment.payment_status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>Gateway: {payment.payment_gateway}</div>
                        <div>Amount: ${(parseFloat(payment.amount || 0) * (total ? (total - ancillaryGst) / total : 1)).toFixed(2)}</div>
                        {payment.refund_amount > 0 && (
                          <div className="text-red-600">
                            Refunded: ${parseFloat(payment.refund_amount || 0).toFixed(2)}
                          </div>
                        )}
                        <div>Date: {new Date(payment.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

