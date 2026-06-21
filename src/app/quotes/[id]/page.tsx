"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, Send } from "lucide-react"
import api, { invoicesAPI } from "@/lib/api"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { useState } from "react"

interface QuoteProduct {
  product_id: number
  product_name: string
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

interface QuoteDetails {
  order_id: number
  customer_id?: number
  firstname?: string
  lastname?: string
  email?: string
  telephone?: string
  delivery_date_time?: string
  delivery_date?: string
  delivery_time?: string
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
  products: QuoteProduct[]
  subtotal: number
  delivery_fee: number
  wholesale_discount?: number
  coupon_discount?: number
  total_discount?: number
  coupon_code?: string
  coupon_type?: string
  coupon_id?: number
  gst: number
  calculated_total: number
  order_total: number
}

// Sample data
const sampleQuote: QuoteDetails = {
  order_id: 83,
  firstname: "Johnathan",
  lastname: "Smith",
  email: "johnsmith@gmail.com",
  telephone: "(+61)8989898989",
  delivery_date_time: "2025-08-06T11:20:00",
  order_comments: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut et massa mi.",
  company_name: "Company Name",
  department_name: "Company Name",
  delivery_address: "Order Date",
  location_name: "Location Name",
  products: [
    {
      product_id: 1,
      product_name: "Sandwich",
      product_description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      quantity: 5,
      price: 12.00,
      total: 60.00,
      options: [
        { option_name: "Add-on", option_value: "Mayonnaise", option_quantity: 3, option_price: 1.00 },
        { option_name: "Add-on", option_value: "Ketchup", option_quantity: 2, option_price: 1.00 },
        { option_name: "Add-on", option_value: "Southwest", option_quantity: 5, option_price: 1.00 },
      ]
    },
    {
      product_id: 2,
      product_name: "Americano",
      product_description: "Lorem ipsum dolor sit amet, consectetur",
      quantity: 5,
      price: 12.00,
      total: 60.00,
    },
    {
      product_id: 3,
      product_name: "Cream Cheese Bagel",
      product_description: "Lorem ipsum dolor sit amet, consectetur",
      quantity: 5,
      price: 12.00,
      total: 60.00,
    },
  ],
  subtotal: 190,
  delivery_fee: 50,
  coupon_discount: 50,
  coupon_code: "Check50",
  gst: 17.27,
  calculated_total: 190,
  order_total: 190,
}

export default function QuoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const quoteId = params?.id as string | undefined
  const [downloadingInvoice, setDownloadingInvoice] = useState(false)
  const [sendingQuoteEmail, setSendingQuoteEmail] = useState(false)

  // Fetch quote from API
  const { data: quoteData, isLoading, error, isFetching } = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: async () => {
      if (!quoteId) {
        throw new Error('Quote ID is required')
      }
      const response = await api.get(`/admin/quotes/${quoteId}`)
      return response.data
    },
    enabled: !!quoteId, // Only fetch if quoteId exists
    retry: 2, // Retry twice on failure
    retryDelay: 1000, // Wait 1 second between retries
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: true, // Always refetch on mount
  })

  const quote = quoteData?.quote || sampleQuote

  // Ensure products array exists and is not null
  const safeQuote = {
    ...quote,
    products: Array.isArray(quote?.products) ? quote.products : quote?.order_products && Array.isArray(quote?.order_products) ? quote.order_products : []
  }

  const calculatedSubtotal = safeQuote.products.reduce((sum: number, product: any) => {
    // Backend now correctly calculates product.total (base price * qty + options total)
    // If product.total is available, use it directly to avoid double counting
    if (product.total !== undefined && product.total !== null) {
      return sum + Number(product.total)
    }
    
    // Fallback for older quotes before the backend fix
    const baseTotal = Number(product.price || 0) * Number(product.quantity || 1)
    let optionsTotal = 0
    if (product.options && product.options.length > 0) {
      product.options.forEach((option: any) => {
        optionsTotal += Number(option.option_quantity || 1) * Number(option.option_price || 0)
      })
    }
    return sum + baseTotal + optionsTotal
  }, 0)

  const deliveryFee = Number(safeQuote.delivery_fee || 0)
  const wholesaleDiscount = Number(safeQuote.wholesale_discount || 0)
  const couponDiscount = Number(safeQuote.coupon_discount || 0)
  const calculatedTotal = calculatedSubtotal + deliveryFee - (wholesaleDiscount + couponDiscount)

  // Show loading state instead of blank page (check both isLoading and isFetching)
  if (isLoading || isFetching) {
    return (
      <div className="flex items-center justify-center bg-gray-50 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0d6efd] mx-auto mb-4"></div>
          <p className="text-gray-600" style={{ fontFamily: 'Albert Sans' }}>Loading quote details...</p>
          {quoteId && (
            <p className="text-sm text-gray-500 mt-2" style={{ fontFamily: 'Albert Sans' }}>
              Quote ID: {quoteId}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Show error state only if there's an actual error
  if (error) {
    return (
      <div className="flex items-center justify-center bg-gray-50 min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-2" style={{ fontFamily: 'Albert Sans' }}>
            Failed to load quote details
          </p>
          {quoteId && (
            <p className="text-sm text-gray-500 mb-4" style={{ fontFamily: 'Albert Sans' }}>
              Quote ID: {quoteId}
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
    if (!safeQuote?.order_id) {
      toast.error("Order ID not found")
      return
    }

    setDownloadingInvoice(true)
    try {
      const response = await invoicesAPI.download(safeQuote.order_id)

      // Create blob from response
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const blobUrl = window.URL.createObjectURL(blob)

      // Create download link
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `quote-${safeQuote.order_id}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl)

      toast.success("Quote downloaded successfully")
    } catch (error: any) {
      console.error("Download invoice error:", error)
      const errorMessage = error.response?.data?.message || error.message || "Failed to download quote"
      toast.error(errorMessage)
    } finally {
      setDownloadingInvoice(false)
    }
  }


  const handleSendQuoteEmail = async () => {
    if (!safeQuote?.order_id) {
      toast.error("Quote ID not found")
      return
    }

    setSendingQuoteEmail(true)
    try {
      const response = await api.post(`/admin/quotes/${safeQuote.order_id}/send-email`, {
        recipient_email: safeQuote.email,
        custom_message: ""
      })

      if (response.data.success && response.data.email_sent !== false) {
        toast.success("Quote email sent successfully!", {
          description: `Sent to: ${response.data.sent_to}. Customer can review and provide feedback via the link.`,
        })
      } else if (response.data.success && response.data.email_sent === false) {
        toast.warning("Email sending failed", {
          description: response.data.email_error || response.data.message || "Please check SMTP settings.",
          duration: 10000,
        })
      } else {
        toast.error(response.data.message || "Failed to send quote email")
      }
    } catch (error: any) {
      console.error("Failed to send quote email:", error)
      const errorMessage = error.response?.data?.message || error.message || "Failed to send quote email"
      toast.error(errorMessage)
    } finally {
      setSendingQuoteEmail(false)
    }
  }

  if (error || (!isLoading && !quote)) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600" style={{ fontFamily: 'Albert Sans' }}>Failed to load quote details</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-[#0d6efd] hover:underline"
            style={{ fontFamily: 'Albert Sans' }}
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Show skeleton while loading
  if (isLoading || !quote) {
    return null // Next.js loading.tsx will handle this
  }

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
              Viewing Quote Details
            </h1>
            <p className="text-gray-600 mt-1">
              Order <span className="text-[#0d6efd] font-semibold">#{safeQuote.order_id}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="gap-2 border-gray-300 text-gray-700 hover:text-gray-900"
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            onClick={handleDownloadInvoice}
            disabled={downloadingInvoice || !safeQuote?.order_id}
          >
            <Download className="h-4 w-4" />
            {downloadingInvoice ? "Downloading..." : "Download Quote"}
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-green-500 text-green-600 hover:bg-green-500 hover:text-black"
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            onClick={handleSendQuoteEmail}
            disabled={sendingQuoteEmail || !safeQuote?.order_id}
          >
            <Send className="h-4 w-4" />
            {sendingQuoteEmail ? "Sending..." : "Send Quote Email"}
          </Button>
        </div>
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
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                      Product Description
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
                  {(safeQuote.products || []).map((product: QuoteProduct, index: number) => (
                    <tr key={index} className="border-b border-gray-100">
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
                          {product.options && product.options.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-gray-600 font-medium" style={{ fontFamily: 'Albert Sans' }}>
                                Options:
                              </p>
                              {product.options.map((option, optionIndex) => (
                                <div key={optionIndex} className="text-xs text-gray-600 ml-2" style={{ fontFamily: 'Albert Sans' }}>
                                  {option.option_name}: {option.option_value} {option.option_quantity > 1 ? `(x${option.option_quantity})` : ''}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          {product.product_description || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top text-center">
                        <div>
                          <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                            {product.quantity}
                          </p>
                          {product.options && product.options.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {product.options.map((option, optionIndex) => (
                                <p key={optionIndex} className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                                  {option.option_quantity}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-right">
                        <div>
                          <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                            ${Number(product.price).toFixed(2)}
                          </p>
                          {product.options && product.options.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {product.options.map((option, optionIndex) => (
                                <p key={optionIndex} className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                                  ${Number(option.option_price).toFixed(2)}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-right">
                        <div>
                          <p className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                            ${Number(product.total || (Number(product.price || 0) * Number(product.quantity || 1))).toFixed(2)}
                          </p>
                          {product.options && product.options.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {product.options.map((option, optionIndex) => (
                                <p key={optionIndex} className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                                  ${(Number(option.option_quantity || 1) * Number(option.option_price || 0)).toFixed(2)}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Totals */}
                  <tr className="border-b border-gray-100">
                    <td colSpan={5} className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        Sub Total
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                        ${calculatedSubtotal.toFixed(2)}
                      </span>
                    </td>
                  </tr>

                  {(safeQuote.wholesale_discount || 0) > 0 && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={5} className="px-4 py-3 text-right">
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

                  {(safeQuote.coupon_id || (safeQuote.coupon_discount && safeQuote.coupon_discount > 0)) && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={5} className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-medium text-green-600" style={{ fontFamily: 'Albert Sans' }}>
                            Coupon Discount
                          </span>
                          {safeQuote.coupon_code && (
                            <span className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Albert Sans' }}>
                              🎟️ {safeQuote.coupon_code}
                            </span>
                          )}
                          {safeQuote.coupon_id && !safeQuote.coupon_code && (
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
                    <td colSpan={5} className="px-4 py-3 text-right">
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

                  {/* <tr className="border-b border-gray-100">
                    <td colSpan={5} className="px-4 py-3 text-right">
                      <span className="text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
                        GST (10%)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
                        ${Number(safeQuote.gst || 0).toFixed(2)}
                      </span>
                    </td>
                  </tr> */}

                  <tr className="border-b border-gray-200">
                    <td colSpan={5} className="px-4 py-3 text-right">
                      <span className="text-base font-semibold text-[#0d6efd]" style={{ fontFamily: 'Albert Sans' }}>
                        Total
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-base font-bold text-[#0d6efd]" style={{ fontFamily: 'Albert Sans' }}>
                        ${calculatedTotal.toFixed(2)}
                      </span>
                    </td>
                  </tr>
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
                  <p>Company Name : {safeQuote.company_name || 'N/A'}</p>
                  {safeQuote.company_abn && (
                    <p>ABN : {safeQuote.company_abn}</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Order Comments
                </h3>
                <p className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                  {safeQuote.order_comments || 'No comments'}
                </p>
              </div>
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
              {safeQuote.company_name && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                    Company Name
                  </p>
                  <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                    {safeQuote.company_name}
                  </p>
                </div>
              )}

              {safeQuote.department_name && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                    Department
                  </p>
                  <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                    {safeQuote.department_name}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                  Customer Name
                </p>
                <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                  {safeQuote.firstname && safeQuote.lastname ? `${safeQuote.firstname} ${safeQuote.lastname}` : 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                  Customer Email
                </p>
                <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                  {safeQuote.email || 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                  Customer Phone
                </p>
                <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                  {safeQuote.telephone || 'N/A'}
                </p>
              </div>

              {safeQuote.location_name && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                    Order Location
                  </p>
                  <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                    {safeQuote.location_name}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Delivery/Pick Up Details */}
          <Card className="p-6 bg-white border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
              {safeQuote.delivery_method === 'pickup' ? 'Pick Up Details' : 'Delivery Details'}
            </h3>

            <div className="space-y-4">
              {safeQuote.delivery_date_time && (
                <>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                      Delivery Date
                    </p>
                    <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                      {(() => {
                        const date = new Date(safeQuote.delivery_date_time)
                        const day = String(date.getDate()).padStart(2, '0')
                        const month = String(date.getMonth() + 1).padStart(2, '0')
                        const year = date.getFullYear()
                        return `${day}/${month}/${year}`
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                      Delivery Time
                    </p>
                    <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                      {safeQuote.delivery_time || (() => {
                        const date = new Date(safeQuote.delivery_date_time)
                        const hours = String(date.getHours()).padStart(2, '0')
                        const minutes = String(date.getMinutes()).padStart(2, '0')
                        return `${hours}:${minutes}`
                      })()}
                    </p>
                  </div>
                </>
              )}

              {safeQuote.delivery_address && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                    Delivery Address
                  </p>
                  <p className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                    {safeQuote.delivery_address}
                  </p>
                </div>
              )}

              {safeQuote.delivery_contact && (
                <>
                  {(() => {
                    const parts = safeQuote.delivery_contact.split('|')
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

              {safeQuote.delivery_details && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1" style={{ fontFamily: 'Albert Sans' }}>
                    Delivery Notes
                  </p>
                  <p className="text-sm text-gray-900 whitespace-pre-line" style={{ fontFamily: 'Albert Sans' }}>
                    {safeQuote.delivery_details}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

