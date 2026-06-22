"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { companiesAPI } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, Download, Loader2, Search, Save } from "lucide-react"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PricingOption {
  product_option_id: number
  option_value_id: number
  option_value_name: string
  option_base_price?: number
  option_price: number
  option_price_prefix: string
  discount_percentage: number
}

interface PricingProduct {
  product_id: number
  product_name: string
  product_code?: string | null
  category_name?: string | null
  subcategory_name?: string | null
  category_sort_order?: number
  product_price?: number
  discount_percentage?: number
  has_options?: boolean
  options?: PricingOption[]
}

// A flattened row mirroring the screenshot layout (one row per option, or one
// row per product when the product has no options).
interface FlatRow {
  key: string
  product_id: number
  option_value_id: number | null
  no: number
  category: string
  subcategory: string
  product_code: string
  product_name: string
  product_option: string
  retail_price: number
  rowSpan: number // how many option rows belong to this product (for merged cells)
  isFirstOfProduct: boolean
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompanyPricingPage() {
  const router = useRouter()
  const params = useParams()
  const queryClient = useQueryClient()
  const companyId = Number(params.id)

  const [localDiscounts, setLocalDiscounts] = useState<Record<string, number>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Company details (for the heading)
  const { data: companyData } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      const response = await companiesAPI.get(companyId)
      return response.data?.company
    },
    enabled: !!companyId,
  })

  const companyName: string = companyData?.company_name || "Company"

  // Pricing / discount data
  const { data: discountsData, isLoading, error } = useQuery({
    queryKey: ["company-product-option-discounts", companyId],
    queryFn: async () => {
      const response = await companiesAPI.getProductOptionDiscounts(companyId)
      return response.data
    },
    enabled: !!companyId,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  })

  // Seed local discount state from the loaded data
  useEffect(() => {
    if (discountsData?.products) {
      const initial: Record<string, number> = {}
      discountsData.products.forEach((product: PricingProduct) => {
        if (product.has_options && product.options && product.options.length > 0) {
          product.options.forEach((option: PricingOption) => {
            initial[`${product.product_id}_${option.option_value_id}`] = option.discount_percentage || 0
          })
        } else {
          initial[`product_${product.product_id}`] = product.discount_percentage || 0
        }
      })
      setLocalDiscounts(initial)
    }
  }, [discountsData])

  // Filter products by search
  const filteredProducts: PricingProduct[] = useMemo(() => {
    if (!discountsData?.products) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return discountsData.products
    return discountsData.products.filter((product: PricingProduct) => {
      if (product.product_name.toLowerCase().includes(q)) return true
      if ((product.product_code || "").toLowerCase().includes(q)) return true
      if ((product.category_name || "").toLowerCase().includes(q)) return true
      if ((product.subcategory_name || "").toLowerCase().includes(q)) return true
      if (product.has_options && product.options) {
        return product.options.some((o) => o.option_value_name.toLowerCase().includes(q))
      }
      return false
    })
  }, [discountsData, searchQuery])

  // Flatten into table rows (one row per option). Tracks rowSpan so the shared
  // columns (category / code / name) can be merged like the screenshot.
  const rows: FlatRow[] = useMemo(() => {
    const out: FlatRow[] = []
    let counter = 0
    filteredProducts.forEach((product) => {
      const category = product.category_name || "-"
      const subcategory = product.subcategory_name || "-"
      const code = product.product_code || "-"
      const hasOptions = product.has_options && product.options && product.options.length > 0

      if (hasOptions) {
        counter += 1
        const opts = product.options as PricingOption[]
        opts.forEach((option, idx) => {
          out.push({
            key: `${product.product_id}_${option.option_value_id}`,
            product_id: product.product_id,
            option_value_id: option.option_value_id,
            no: counter,
            category,
            subcategory,
            product_code: code,
            product_name: product.product_name,
            product_option: option.option_value_name,
            retail_price: option.option_base_price ?? option.option_price ?? 0,
            rowSpan: opts.length,
            isFirstOfProduct: idx === 0,
          })
        })
      } else {
        counter += 1
        out.push({
          key: `product_${product.product_id}`,
          product_id: product.product_id,
          option_value_id: null,
          no: counter,
          category,
          subcategory,
          product_code: code,
          product_name: product.product_name,
          product_option: "-",
          retail_price: product.product_price || 0,
          rowSpan: 1,
          isFirstOfProduct: true,
        })
      }
    })
    return out
  }, [filteredProducts])

  // Save
  const saveMutation = useMutation({
    mutationFn: async (discountsToSave: Record<string, number>) => {
      const discountsArray = Object.entries(discountsToSave)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => {
          if (key.startsWith("product_")) {
            return {
              product_id: parseInt(key.replace("product_", "")),
              option_value_id: null,
              discount_percentage: parseFloat(value.toString()),
            }
          }
          const [product_id, option_value_id] = key.split("_").map(Number)
          return {
            product_id,
            option_value_id,
            discount_percentage: parseFloat(value.toString()),
          }
        })
      return await companiesAPI.setProductOptionDiscounts(companyId, discountsArray)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["company-product-option-discounts", companyId] })
      await queryClient.refetchQueries({ queryKey: ["company-product-option-discounts", companyId] })
      toast.success("Company pricing saved successfully")
      setIsSaving(false)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to save company pricing")
      setIsSaving(false)
    },
  })

  const handleDiscountChange = (key: string, value: string) => {
    const num = parseFloat(value) || 0
    const clamped = Math.max(0, Math.min(100, num))
    setLocalDiscounts((prev) => ({ ...prev, [key]: clamped }))
  }

  const handleSave = () => {
    setIsSaving(true)
    saveMutation.mutate(localDiscounts)
  }

  const getDiscount = (key: string) => localDiscounts[key] ?? 0
  const calcTotal = (retail: number, discount: number) =>
    discount > 0 ? retail * (1 - discount / 100) : retail

  // -------------------------------------------------------------------------
  // PDF download
  // -------------------------------------------------------------------------
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
      const marginX = 32

      // Title
      doc.setFontSize(16)
      doc.setFont("helvetica", "bold")
      doc.text(companyName, marginX, 40)
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(110)
      doc.text("Company Product Pricing", marginX, 58)
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, marginX, 72)
      doc.setTextColor(0)

      const body = rows.map((row) => {
        const discount = getDiscount(row.key)
        const total = calcTotal(row.retail_price, discount)
        return [
          String(row.no),
          row.category,
          row.subcategory,
          row.product_code,
          row.product_name,
          row.product_option,
          `$${row.retail_price.toFixed(2)}`,
          discount > 0 ? `${discount}%` : "-",
          `$${total.toFixed(2)}`,
        ]
      })

      autoTable(doc, {
        startY: 88,
        head: [[
          "No",
          "Category",
          "Sub category",
          "Product code",
          "Product Name",
          "Product Option",
          "Retail Price",
          "Discount %",
          "Total",
        ]],
        body,
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 9, cellPadding: 5, valign: "middle", lineColor: [200, 200, 200], lineWidth: 0.5 },
        headStyles: { fillColor: [25, 135, 84], textColor: 255, fontStyle: "bold", halign: "center" },
        columnStyles: {
          0: { halign: "center", cellWidth: 30 },
          6: { halign: "right" },
          7: { halign: "center" },
          8: { halign: "right" },
        },
        alternateRowStyles: { fillColor: [247, 249, 248] },
      })

      doc.save(`${companyName.replace(/[^a-z0-9]+/gi, "_")}_pricing.pdf`)
      toast.success("PDF downloaded")
    } catch (e) {
      console.error("PDF generation error:", e)
      toast.error("Failed to generate PDF")
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="bg-gray-50 min-h-screen pb-24" style={{ fontFamily: "Albert Sans" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/companies")}
              className="p-2 rounded-md hover:bg-gray-200 transition-colors"
              title="Back to Companies"
            >
              <ChevronLeft className="h-5 w-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{companyName}</h1>
              <p className="text-sm text-gray-500">Company product pricing &amp; discounts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              className="border-gray-300"
              disabled={isLoading || rows.length === 0}
              style={{ fontWeight: 600 }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || saveMutation.isPending || isLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
              style={{ fontWeight: 600 }}
            >
              {isSaving || saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Pricing
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by category, code, product or option..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <div className="text-sm text-gray-600 whitespace-nowrap">
            {searchQuery ? (
              <span>
                Showing <span className="font-semibold">{filteredProducts.length}</span> of{" "}
                <span className="font-semibold">{discountsData?.products?.length || 0}</span> products
              </span>
            ) : (
              <span>
                Total: <span className="font-semibold">{discountsData?.products?.length || 0}</span> products
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            <span className="ml-3 text-gray-600">Loading products and pricing...</span>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-600 font-semibold mb-2">Error loading company pricing</p>
            <p className="text-sm text-gray-600 mb-4">
              {error instanceof Error ? error.message : "Unknown error occurred"}
            </p>
            <Button onClick={() => router.push("/companies")} variant="outline">
              Back to Companies
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-white rounded-lg border border-gray-200">
            {searchQuery ? "No products found matching your search" : "No products available"}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#198754] text-white">
                    <th className="px-3 py-3 text-left font-semibold border border-[#157347] w-12">No</th>
                    <th className="px-3 py-3 text-left font-semibold border border-[#157347]">Category</th>
                    <th className="px-3 py-3 text-left font-semibold border border-[#157347]">Sub category</th>
                    <th className="px-3 py-3 text-left font-semibold border border-[#157347]">Product code</th>
                    <th className="px-3 py-3 text-left font-semibold border border-[#157347]">Product Name</th>
                    <th className="px-3 py-3 text-left font-semibold border border-[#157347]">Product Option</th>
                    <th className="px-3 py-3 text-right font-semibold border border-[#157347]">Retail Price</th>
                    <th className="px-3 py-3 text-center font-semibold border border-[#157347]">Discount %</th>
                    <th className="px-3 py-3 text-right font-semibold border border-[#157347]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const discount = getDiscount(row.key)
                    const total = calcTotal(row.retail_price, discount)
                    return (
                      <tr key={row.key} className="hover:bg-gray-50">
                        {row.isFirstOfProduct && (
                          <>
                            <td
                              rowSpan={row.rowSpan}
                              className="px-3 py-3 text-gray-700 border border-gray-200 align-top"
                            >
                              {row.no}
                            </td>
                            <td
                              rowSpan={row.rowSpan}
                              className="px-3 py-3 text-gray-900 border border-gray-200 align-top"
                            >
                              {row.category}
                            </td>
                            <td
                              rowSpan={row.rowSpan}
                              className="px-3 py-3 text-gray-700 border border-gray-200 align-top"
                            >
                              {row.subcategory}
                            </td>
                            <td
                              rowSpan={row.rowSpan}
                              className="px-3 py-3 text-gray-700 border border-gray-200 align-top font-mono"
                            >
                              {row.product_code}
                            </td>
                            <td
                              rowSpan={row.rowSpan}
                              className="px-3 py-3 text-gray-900 font-medium border border-gray-200 align-top"
                            >
                              {row.product_name}
                            </td>
                          </>
                        )}
                        <td className="px-3 py-3 text-gray-700 border border-gray-200">
                          {row.product_option}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-900 border border-gray-200 whitespace-nowrap">
                          ${row.retail_price.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center border border-gray-200">
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={discount}
                              onChange={(e) => handleDiscountChange(row.key, e.target.value)}
                              className="w-20 text-right h-9"
                              placeholder="0"
                            />
                            <span className="text-gray-500">%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right border border-gray-200 whitespace-nowrap">
                          {discount > 0 ? (
                            <span className="font-semibold text-green-700">${total.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-900">${total.toFixed(2)}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
