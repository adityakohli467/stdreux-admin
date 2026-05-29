"use client";

import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import { format } from "date-fns";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

interface OrderProduct {
  order_product_id: number;
  product_id: number;
  product_name: string;
  product_description?: string;
  quantity: number;
  price: number;
  total: number;
  product_comment?: string;
  is_prepared?: boolean;
  options?: Array<{
    option_name: string;
    option_value: string;
    option_quantity: number;
    option_price: number;
  }>;
}

interface OrderDetails {
  order_id: number;
  customer_order_name: string;
  customer_order_email?: string;
  customer_order_telephone?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  telephone?: string;
  date_added?: string;
  delivery_date_time?: string;
  order_comments?: string;
  order_comment?: string;
  customer_company_name?: string;
  customer_department_name?: string;
  company_name?: string;
  department_name?: string;
  location_name?: string;
  delivery_address?: string;
  order_products?: OrderProduct[];
  products?: OrderProduct[];
  order_status?: number;
  is_completed?: number;
  pickup_delivery_notes?: string;
  delivery_phone?: string;
  delivery_notes?: string;
  delivery_details?: string;
  delivery_contact?: string;
  packaging_comment?: string;
}

interface OrderDetailModalProps {
  orderId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated?: () => void;
}

export function OrderDetailModal({
  orderId,
  open,
  onOpenChange,
  onOrderUpdated,
}: OrderDetailModalProps) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && orderId) {
      fetchOrderDetails();
    } else {
      setOrder(null);
      setError(null);
      setComment("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  const fetchOrderDetails = async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/admin/orders/${orderId}`);
      if (response.data && response.data.order) {
        setOrder(response.data.order);
        setComment(response.data.order.packaging_comment || "");
      } else {
        setError("Order data not found in response");
      }
    } catch (error: any) {
      console.error("Failed to fetch order details:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch order details";
      setError(errorMessage);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };


  const handleSaveComment = async () => {
    if (!orderId) return;
    setSavingComment(true);
    try {
      await api.put(`/admin/orders/${orderId}/packaging-comment`, { packaging_comment: comment });
      toast.success("Comment saved!");
      if (onOrderUpdated) onOrderUpdated();
    } catch (error: any) {
      console.error("Failed to save comment:", error);
      toast.error(error.response?.data?.message || "Failed to save comment");
    } finally {
      setSavingComment(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }

    const printContent = printRef.current.innerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Packaging Slip - Order #${orderId}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Albert Sans', -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; color: #111; }
            .slip-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .slip-header h1 { font-size: 22px; font-weight: 700; }
            .slip-header p { font-size: 14px; color: #555; margin-top: 4px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
            .info-item label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; display: block; }
            .info-item p { font-size: 14px; font-weight: 500; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f3f4f6; text-align: left; padding: 10px 12px; font-size: 13px; font-weight: 600; border-bottom: 2px solid #ddd; }
            td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #eee; }
            .comment-section { margin-top: 16px; padding: 12px; border: 1px solid #ddd; border-radius: 6px; }
            .comment-section h3 { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
            .comment-section p { font-size: 13px; white-space: pre-line; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  if (!orderId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle
              style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
              className="text-2xl"
            >
              Packaging Slip #{orderId}
            </DialogTitle>
            {order && (
              <Button
                onClick={handlePrint}
                variant="outline"
                size="sm"
                className="gap-2"
                style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span
              style={{ fontFamily: "Albert Sans" }}
              className="ml-3 text-gray-600"
            >
              Loading order details...
            </span>
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p
              style={{ fontFamily: "Albert Sans" }}
              className="text-red-600 mb-2"
            >
              {error}
            </p>
            <p
              style={{ fontFamily: "Albert Sans" }}
              className="text-sm text-gray-500"
            >
              Order ID: {orderId}
            </p>
            <Button
              onClick={fetchOrderDetails}
              className="mt-4"
              variant="outline"
              style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
            >
              Retry
            </Button>
          </div>
        ) : order ? (
          <div className="space-y-6">
            {/* Printable Content */}
            <div ref={printRef}>
              <div className="slip-header" style={{ textAlign: "center", marginBottom: "16px", borderBottom: "2px solid #333", paddingBottom: "10px" }}>
                <h1 style={{ fontFamily: "Albert Sans", fontWeight: 700, fontSize: "22px" }}>Packaging Slip</h1>
                <p style={{ fontFamily: "Albert Sans", fontSize: "14px", color: "#555", marginTop: "4px" }}>Order #{order.order_id}</p>
              </div>

              {/* Order Info Grid */}
              <div className="info-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div className="info-item">
                  <label style={{ fontFamily: "Albert Sans", fontSize: "11px", color: "#666", textTransform: "uppercase", display: "block" }}>Customer</label>
                  <p style={{ fontFamily: "Albert Sans", fontSize: "14px", fontWeight: 500, marginTop: "2px" }}>
                    {order.customer_order_name || `${order.firstname || ""} ${order.lastname || ""}`.trim() || "N/A"}
                  </p>
                </div>
                <div className="info-item">
                  <label style={{ fontFamily: "Albert Sans", fontSize: "11px", color: "#666", textTransform: "uppercase", display: "block" }}>Phone</label>
                  <p style={{ fontFamily: "Albert Sans", fontSize: "14px", fontWeight: 500, marginTop: "2px" }}>
                    {order.customer_order_telephone || order.telephone || "N/A"}
                  </p>
                </div>
                <div className="info-item">
                  <label style={{ fontFamily: "Albert Sans", fontSize: "11px", color: "#666", textTransform: "uppercase", display: "block" }}>Order Date</label>
                  <p style={{ fontFamily: "Albert Sans", fontSize: "14px", fontWeight: 500, marginTop: "2px" }}>
                    {order.date_added ? format(new Date(order.date_added), "dd MMM, yyyy") : "N/A"}
                  </p>
                </div>
                <div className="info-item">
                  <label style={{ fontFamily: "Albert Sans", fontSize: "11px", color: "#666", textTransform: "uppercase", display: "block" }}>Delivery Date</label>
                  <p style={{ fontFamily: "Albert Sans", fontSize: "14px", fontWeight: 500, marginTop: "2px" }}>
                    {order.delivery_date_time
                      ? format(new Date(order.delivery_date_time.endsWith('Z') ? order.delivery_date_time.slice(0, -1) : order.delivery_date_time), "dd MMM, yyyy")
                      : "N/A"}
                  </p>
                </div>
                {order.company_name && (
                  <div className="info-item">
                    <label style={{ fontFamily: "Albert Sans", fontSize: "11px", color: "#666", textTransform: "uppercase", display: "block" }}>Company</label>
                    <p style={{ fontFamily: "Albert Sans", fontSize: "14px", fontWeight: 500, marginTop: "2px" }}>{order.company_name}</p>
                  </div>
                )}
                {order.delivery_address && (
                  <div className="info-item">
                    <label style={{ fontFamily: "Albert Sans", fontSize: "11px", color: "#666", textTransform: "uppercase", display: "block" }}>Delivery Address</label>
                    <p style={{ fontFamily: "Albert Sans", fontSize: "14px", fontWeight: 500, marginTop: "2px" }}>{order.delivery_address}</p>
                  </div>
                )}
              </div>

              {/* Products Table - No Description, Price, Total */}
              <Card className="bg-white border border-gray-200">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th
                            style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
                            className="text-left px-4 py-3 text-sm text-gray-700"
                          >
                            No.
                          </th>
                          <th
                            style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
                            className="text-left px-4 py-3 text-sm text-gray-700"
                          >
                            Product Name
                          </th>
                          <th
                            style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
                            className="text-center px-4 py-3 text-sm text-gray-700"
                          >
                            Quantity
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.order_products && order.order_products.length > 0 ? (
                          order.order_products.map((product, index) => (
                            <tr
                              key={product.order_product_id}
                              className="border-b border-gray-100"
                            >
                              <td className="px-4 py-4">
                                <span
                                  style={{ fontFamily: "Albert Sans" }}
                                  className="text-sm text-gray-700"
                                >
                                  {index + 1}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <div>
                                  <p
                                    style={{ fontFamily: "Albert Sans" }}
                                    className="text-sm font-medium text-gray-900"
                                  >
                                    {product.product_name}
                                  </p>
                                  {product.options && product.options.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      <p
                                        style={{ fontFamily: "Albert Sans" }}
                                        className="text-xs text-gray-600 font-medium"
                                      >
                                        Options:
                                      </p>
                                      {product.options.map((option, optIdx) => (
                                        <div
                                          key={optIdx}
                                          style={{ fontFamily: "Albert Sans" }}
                                          className="text-sm text-gray-700 ml-2"
                                        >
                                          <span>{option.option_name}: {option.option_value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {product.product_comment && (
                                    <p
                                      style={{ fontFamily: "Albert Sans" }}
                                      className="text-xs text-gray-500 mt-1 italic"
                                    >
                                      Note: {product.product_comment}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center align-top">
                                <span style={{ fontFamily: "Albert Sans" }} className="text-sm font-semibold text-gray-900">
                                  {product.quantity}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-8 text-center text-gray-500"
                            >
                              <span style={{ fontFamily: "Albert Sans" }}>
                                No products in this order
                              </span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Order Comments */}
              {(order.order_comments || order.order_comment) && (
                <div style={{ marginTop: "12px", padding: "12px", border: "1px solid #ddd", borderRadius: "6px" }}>
                  <h3 style={{ fontFamily: "Albert Sans", fontWeight: 600, fontSize: "13px", marginBottom: "6px" }}>Order Comments</h3>
                  <p style={{ fontFamily: "Albert Sans", fontSize: "13px", whiteSpace: "pre-line" }}>
                    {order.order_comments || order.order_comment}
                  </p>
                </div>
              )}

              {/* Delivery Notes */}
              {(order.pickup_delivery_notes || order.delivery_details || order.delivery_notes) && (
                <div style={{ marginTop: "12px", padding: "12px", border: "1px solid #ddd", borderRadius: "6px" }}>
                  <h3 style={{ fontFamily: "Albert Sans", fontWeight: 600, fontSize: "13px", marginBottom: "6px" }}>Delivery Notes</h3>
                  <p style={{ fontFamily: "Albert Sans", fontSize: "13px", whiteSpace: "pre-line" }}>
                    {order.pickup_delivery_notes || order.delivery_details || order.delivery_notes}
                  </p>
                </div>
              )}

              {/* Packaging Comment - printed too */}
              {comment && (
                <div className="comment-section" style={{ marginTop: "12px", padding: "12px", border: "1px solid #ddd", borderRadius: "6px" }}>
                  <h3 style={{ fontFamily: "Albert Sans", fontWeight: 600, fontSize: "13px", marginBottom: "6px" }}>Packaging Comment</h3>
                  <p style={{ fontFamily: "Albert Sans", fontSize: "13px", whiteSpace: "pre-line" }}>{comment}</p>
                </div>
              )}
            </div>

            {/* Comment Input */}
            <div className="border-t border-gray-200 pt-4">
              <h3
                style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
                className="text-sm font-semibold text-gray-900 mb-2"
              >
                Packaging Comment
              </h3>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment for this packaging slip..."
                className="mb-3"
                style={{ fontFamily: "Albert Sans" }}
                rows={3}
              />
              <Button
                onClick={handleSaveComment}
                disabled={savingComment}
                size="sm"
                style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {savingComment ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Comment
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500">
            <span style={{ fontFamily: "Albert Sans" }}>Order not found</span>
            {orderId && (
              <p
                style={{ fontFamily: "Albert Sans" }}
                className="text-sm text-gray-400 mt-2"
              >
                Order ID: {orderId}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
