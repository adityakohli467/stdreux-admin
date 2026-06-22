"use client"

import { useEffect, useState } from "react"
import React from "react"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import api from "@/lib/api"
import { ArrowLeft, Printer, ArrowUpDown, Edit, Mail } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { printTableData } from "@/lib/print-utils"

interface OrderProduct {
  order_product_id: number
  product_name: string
  product_description?: string
  quantity: number
  product_comment?: string
  is_prepared?: boolean
  options?: Array<{
    option_name: string
    option_value: string
    option_quantity: number
    option_price: number
  }>
}

interface OrderDetails {
  order_id: number
  customer_order_name: string
  customer_order_email?: string
  customer_order_telephone?: string
  delivery_date_time?: string
  shipping_method?: number
  pickup_delivery_notes?: string
  delivery_phone?: string
  company_name?: string
  customer_company_name?: string
  customer_company_addr?: string
  delivery_address?: string
  company_address?: string
  postcode?: string
  order_comments?: string
  order_products?: OrderProduct[]
  payment_status?: string
}

export default function ProductionFormPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params?.id as string

  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [preparedItems, setPreparedItems] = useState<{ [key: number]: boolean }>({})
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false)

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails()
    }
  }, [orderId])

  const fetchOrderDetails = async () => {
    try {
      const response = await api.get(`/admin/orders/${orderId}`)
      setOrder(response.data.order)
      
      // Initialize prepared items state
      const prepared: { [key: number]: boolean } = {}
      response.data.order.order_products?.forEach((product: OrderProduct) => {
        prepared[product.order_product_id] = product.is_prepared || false
      })
      setPreparedItems(prepared)
    } catch (error) {
      console.error("Failed to fetch order details:", error)
    } finally {
      setLoading(false)
    }
  }

  const togglePrepared = async (productId: number) => {
    const newValue = !preparedItems[productId]
    setPreparedItems(prev => ({
      ...prev,
      [productId]: newValue
    }))

    try {
      await api.put(`/admin/orders/${orderId}/products/${productId}/prepared`, {
        is_prepared: newValue
      })
    } catch (error) {
      console.error("Failed to update prepared status:", error)
      // Revert on error
      setPreparedItems(prev => ({
        ...prev,
        [productId]: !newValue
      }))
    }
  }

  const handlePrint = () => {
    printTableData("Order Production")
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


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div style={{ fontFamily: 'Albert Sans' }}>Loading...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div style={{ fontFamily: 'Albert Sans' }}>Order not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 bg-gray-50 ">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 style={{
              fontFamily: 'Albert Sans',
              fontWeight: 600,
              fontSize: '32px',
            }}>
              Viewing Production Form
            </h1>
            <p style={{ fontFamily: 'Albert Sans' }} className="text-gray-600 mt-1">
              Order <span className="text-[#105a9c]">#{order.order_id}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => router.push(`/orders/${orderId}/edit`)}
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit Order
          </Button>
          {order.payment_status !== 'Paid' && order.payment_status !== 'Completed' && (
            <Button 
              variant="default" 
              onClick={handleSendPaymentLink}
              disabled={sendingPaymentLink}
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              className="gap-2 bg-[#105a9c] hover:bg-[#0d4a82]"
            >
              <Mail className="h-4 w-4" />
              {sendingPaymentLink ? 'Sending...' : 'Send Payment Link'}
            </Button>
          )} 
          <Button 
            variant="outline" 
            onClick={handlePrint}
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Order Information Section */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th colSpan={4} className="bg-blue-50 text-blue-700 px-6 py-4 text-center border-b border-blue-200" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Production
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Order Details Row */}
                <tr className="border-b border-gray-200">
                  <td colSpan={2} className="px-6 py-4" style={{ width: '50%' }}>
                    <div style={{ fontFamily: 'Albert Sans' }} className="space-y-2">
                      <div>
                        <strong className="mr-2">Order ID:</strong>
                        <span>{order.order_id}</span>
                      </div>
                      <div>
                        <strong className="mr-2">Name:</strong>
                        <span>{order.customer_order_name}</span>
                      </div>
                      {order.customer_order_email && (
                        <div>
                          <strong className="mr-2">Email:</strong>
                          <span>{order.customer_order_email}</span>
                        </div>
                      )}
                      {order.customer_order_telephone && (
                        <div>
                          <strong className="mr-2">Phone:</strong>
                          <span>{order.customer_order_telephone}</span>
                        </div>
                      )}
                      {order.delivery_date_time && (
                        <div>
                          <strong className="mr-2">Delivery Date:</strong>
                          <span>{new Date(order.delivery_date_time).toLocaleString('en-AU', { 
                            hour: 'numeric', 
                            minute: '2-digit', 
                            hour12: true,
                            weekday: 'long',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td colSpan={2} className="px-6 py-4 border-l border-gray-200" style={{ width: '50%' }}>
                    <div style={{ fontFamily: 'Albert Sans' }} className="space-y-2">
                      <div>
                        <strong className="mr-2">Shipping Method:</strong>
                        <span>{order.shipping_method === 1 ? 'Delivery' : 'Pickup'}</span>
                      </div>
                      <hr className="my-2" />
                      {order.pickup_delivery_notes && (
                        <div>
                          <strong className="mr-2">Delivery Notes:</strong>
                          <span>{order.pickup_delivery_notes}</span>
                        </div>
                      )}
                      {order.delivery_phone && (
                        <div>
                          <strong className="mr-2">Delivery Contact No:</strong>
                          <span>{order.delivery_phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                
                {/* Company Information Row */}
                {(order.company_name || order.customer_company_name) && (
                  <>
                    <tr className="bg-gray-50">
                      <th colSpan={2} className="px-6 py-3 text-left border-b border-gray-200" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                        Company Information
                      </th>
                      <th colSpan={2} className="px-6 py-3 text-left border-b border-gray-200 border-l border-gray-200" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                        Delivery/Pickup Address
                      </th>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td colSpan={2} className="px-6 py-4">
                        <div style={{ fontFamily: 'Albert Sans' }}>
                          {order.customer_company_name || order.company_name}
                          {order.customer_company_addr && (
                            <div className="mt-1 text-sm text-gray-600">
                              {order.customer_company_addr}
                            </div>
                          )}
                        </div>
                      </td>
                      <td colSpan={2} className="px-6 py-4 border-l border-gray-200">
                        <div style={{ fontFamily: 'Albert Sans' }}>
                          {order.delivery_address ? (
                            <div className="whitespace-pre-line">{order.delivery_address}</div>
                          ) : (
                            <div>{order.company_address || 'N/A'}</div>
                          )}
                          {order.postcode && (
                            <div className="mt-1">{order.postcode}</div>
                          )}
                          {order.customer_order_telephone && (
                            <div className="mt-1">
                              <i className="fa fa-phone mr-1"></i>
                              {order.customer_order_telephone}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#105a9c] border-b border-[#0d4a82]">
                  <th 
                    className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100"
                    style={{ 
                      fontFamily: 'Albert Sans', 
                      fontWeight: 600,
                      fontStyle: 'normal',
                      fontSize: '14px',
                      lineHeight: '20px',
                      letterSpacing: '0%'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Quantity
                      <ArrowUpDown className="h-3 w-3 text-gray-400" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100"
                    style={{ 
                      fontFamily: 'Albert Sans', 
                      fontWeight: 600,
                      fontStyle: 'normal',
                      fontSize: '14px',
                      lineHeight: '20px',
                      letterSpacing: '0%'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Product Name
                      <ArrowUpDown className="h-3 w-3 text-gray-400" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100"
                    style={{ 
                      fontFamily: 'Albert Sans', 
                      fontWeight: 600,
                      fontStyle: 'normal',
                      fontSize: '14px',
                      lineHeight: '20px',
                      letterSpacing: '0%'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Product Comments
                      <ArrowUpDown className="h-3 w-3 text-gray-400" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100"
                    style={{ 
                      fontFamily: 'Albert Sans', 
                      fontWeight: 600,
                      fontStyle: 'normal',
                      fontSize: '14px',
                      lineHeight: '20px',
                      letterSpacing: '0%'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Actions
                      <ArrowUpDown className="h-3 w-3 text-gray-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.order_products && order.order_products.length > 0 ? (
                  order.order_products.map((product, index) => (
                    <tr 
                      key={product.order_product_id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}
                    >
                      <td className="px-4 py-4">
                        <span style={{ 
                          fontFamily: 'Albert Sans',
                          fontWeight: 400,
                          fontStyle: 'normal',
                          fontSize: '14px',
                          lineHeight: '20px',
                          letterSpacing: '0%'
                        }} className="text-gray-900">
                          {product.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div style={{ 
                          fontFamily: 'Albert Sans',
                          fontWeight: 400,
                          fontStyle: 'normal',
                          fontSize: '14px',
                          lineHeight: '20px',
                          letterSpacing: '0%'
                        }} className="text-gray-900">
                          <div className="font-medium">{product.product_name}</div>
                          {product.product_description && (
                            <div className="text-xs text-gray-500 mt-1 whitespace-pre-line">
                              {product.product_description}
                            </div>
                          )}
                          {product.options && product.options.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {product.options.map((option, optIdx) => (
                                <div key={optIdx} className="text-xs text-gray-600 border-l-2 border-gray-300 pl-2">
                                  <div><strong>Option:</strong> {option.option_name}</div>
                                  <div><strong>Value:</strong> {option.option_value}</div>
                                  <div><strong>Quantity:</strong> {option.option_quantity}</div>
                                  <div><strong>Price:</strong> ${option.option_price.toFixed(2)}</div>
                                  <div><strong>Total:</strong> ${(option.option_price * option.option_quantity).toFixed(2)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span style={{ 
                          fontFamily: 'Albert Sans',
                          fontWeight: 400,
                          fontStyle: 'normal',
                          fontSize: '14px',
                          lineHeight: '20px',
                          letterSpacing: '0%'
                        }} className="text-gray-700 whitespace-pre-line">
                          {product.product_comment || 'Lorem ipsum dolor el emet.'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`prepared-${product.order_product_id}`}
                            checked={preparedItems[product.order_product_id] || false}
                            onCheckedChange={() => togglePrepared(product.order_product_id)}
                            className="h-5 w-5 rounded border-2 data-[state=checked]:bg-[#2563eb] data-[state=checked]:border-[#2563eb] border-gray-300"
                          />
                          <label
                            htmlFor={`prepared-${product.order_product_id}`}
                            style={{ 
                              fontFamily: 'Albert Sans', 
                              fontWeight: 600,
                              fontSize: '14px',
                              lineHeight: '20px',
                              letterSpacing: '0%',
                            }}
                            className="text-sm text-gray-700 cursor-pointer select-none"
                          >
                            Prepared
                          </label>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                      <span style={{ fontFamily: 'Albert Sans' }}>No products in this order</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Order Comments Section */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th colSpan={4} className="bg-purple-50 text-purple-700 px-6 py-4 text-center border-b border-purple-200" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Comments
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="px-6 py-4">
                  <span style={{ fontFamily: 'Albert Sans' }} className="text-sm text-gray-700 whitespace-pre-line">
                    {order.order_comments?.trim() || '\u00A0'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
        <p style={{ 
          fontFamily: 'Albert Sans',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: '20px'
        }} className="text-gray-600">
          Showing 1-{order.order_products?.length || 0} of {order.order_products?.length || 0} Entries
        </p>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled
            style={{ 
              fontFamily: 'Albert Sans', 
              fontWeight: 600,
              fontSize: '14px',
              lineHeight: '20px'
            }}
            className="h-8 px-3"
          >
            Prev
          </Button>
          <Button 
            variant="default" 
            size="sm"
            style={{ 
              fontFamily: 'Albert Sans', 
              fontWeight: 600,
              fontSize: '14px',
              lineHeight: '20px'
            }}
            className="bg-[#105a9c] hover:bg-[#0d4a82] h-8 px-3"
          >
            {order.order_products?.length || 0}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            disabled
            style={{ 
              fontFamily: 'Albert Sans', 
              fontWeight: 600,
              fontSize: '14px',
              lineHeight: '20px'
            }}
            className="h-8 px-3"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

