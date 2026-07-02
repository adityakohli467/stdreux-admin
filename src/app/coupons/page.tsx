"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { couponsAPI } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ValidatedInput } from "@/components/ui/validated-input"
import { ValidationRules } from "@/lib/validation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Printer, Plus, Edit2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { validateRequired, validateNumber } from "@/lib/validations"
import { printTableData } from "@/lib/print-utils"

interface Coupon {
  coupon_id: number
  coupon_code: string
  coupon_description: string
  coupon_discount: number
  type: string
  status: number
  show_on_storefront: boolean
  customer_types?: string | string[] | null
  expiry_date?: string | null
  recurrence?: string | null
  categories?: string | string[] | null
}

const CUSTOMER_TYPE_OPTIONS = [
  { value: "retail", label: "Retail" },
  { value: "vip", label: "VIP" },
  { value: "wholesale", label: "Wholesale" },
]

const RECURRENCE_OPTIONS = [
  { value: "once", label: "Only once" },
  { value: "multiple", label: "Multiple times" },
]

// Normalize the stored customer_types value (comma string or array) into an array.
const parseCustomerTypes = (value: string | string[] | null | undefined): string[] => {
  if (!value) return []
  const arr = Array.isArray(value) ? value : value.split(",")
  const allowed = CUSTOMER_TYPE_OPTIONS.map((o) => o.value)
  return arr
    .map((s) => String(s).trim().toLowerCase())
    .filter((s) => allowed.includes(s))
}

// Normalize the stored categories value (comma string or array) into an array of ids.
const parseCategories = (value: string | string[] | null | undefined): string[] => {
  if (!value) return []
  const arr = Array.isArray(value) ? value : value.split(",")
  return arr.map((s) => String(s).trim()).filter((s) => s.length > 0)
}

// Convert a stored date value into the yyyy-MM-dd format expected by <input type="date">.
const formatDateForInput = (value: string | null | undefined): string => {
  if (!value) return ""
  const str = String(value)
  // Already in yyyy-MM-dd or ISO form; take the date portion.
  return str.slice(0, 10)
}

export default function CouponsPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"Active" | "Inactive">("Active")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"delete" | "activate" | "deactivate" | null>(null)
  const [confirmCouponId, setConfirmCouponId] = useState<number | null>(null)
  const [confirmCouponCode, setConfirmCouponCode] = useState("")
  
  // Form state
  const [couponCode, setCouponCode] = useState("")
  const [couponDescription, setCouponDescription] = useState("")
  const [discountAmount, setDiscountAmount] = useState("")
  const [discountType, setDiscountType] = useState("")
  const [showOnStorefront, setShowOnStorefront] = useState(false)
  const [customerTypes, setCustomerTypes] = useState<string[]>([])
  const [expiryDate, setExpiryDate] = useState("")
  const [recurrence, setRecurrence] = useState("multiple")
  const [categories, setCategories] = useState<string[]>([])
  
  // Validation errors state
  const [formErrors, setFormErrors] = useState<{
    coupon_code?: string
    coupon_discount?: string
    type?: string
    coupon_description?: string
  }>({})

  // Fetch coupons
  const { data: couponsData, isLoading, error: couponsError } = useQuery({
    queryKey: ["coupons", activeTab],
    queryFn: async () => {
      const params = {
        status: activeTab === "Active" ? "1" : "0",
      }
      const response = await couponsAPI.list(params)
      return response.data
    },
    retry: 1,
  })

  // Fetch categories for the "Category applicable" multi-select
  const { data: categoriesData } = useQuery({
    queryKey: ["coupon-categories-all"],
    queryFn: async () => {
      const response = await api.get("/admin/categories?limit=1000")
      return response.data
    },
    retry: 1,
  })

  // Fetch active count
  const { data: activeCountData } = useQuery({
    queryKey: ["coupons-count", "active"],
    queryFn: async () => {
      const response = await couponsAPI.list({ status: "1" })
      return response.data
    },
    retry: 1,
  })

  // Fetch inactive count
  const { data: inactiveCountData } = useQuery({
    queryKey: ["coupons-count", "inactive"],
    queryFn: async () => {
      const response = await couponsAPI.list({ status: "0" })
      return response.data
    },
    retry: 1,
  })

  // Create coupon mutation
  const createCouponMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await couponsAPI.create(data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] })
      queryClient.invalidateQueries({ queryKey: ["coupons-count"] })
      toast.success("Coupon created successfully!")
      setShowAddModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create coupon")
    },
  })

  // Update coupon mutation
  const updateCouponMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await couponsAPI.update(id, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] })
      queryClient.invalidateQueries({ queryKey: ["coupons-count"] })
      toast.success("Coupon updated successfully!")
      setShowEditModal(false)
      setSelectedCoupon(null)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update coupon")
    },
  })

  // Delete coupon mutation
  const deleteCouponMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await couponsAPI.delete(id)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] })
      queryClient.invalidateQueries({ queryKey: ["coupons-count"] })
      toast.success("Coupon deleted successfully!")
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete coupon")
    },
  })

  // Toggle status mutation (activate/deactivate)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, coupon, newStatus }: { id: number; coupon: Coupon; newStatus: number }) => {
      const response = await couponsAPI.update(id, {
        ...coupon,
        status: newStatus,
      })
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] })
      queryClient.invalidateQueries({ queryKey: ["coupons-count"] })
      toast.success(`Coupon ${variables.newStatus === 1 ? "activated" : "deactivated"} successfully!`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update coupon status")
    },
  })

  // Toggle storefront visibility mutation
  const toggleStorefrontMutation = useMutation({
    mutationFn: async ({ id, coupon, newStorefront }: { id: number; coupon: Coupon; newStorefront: boolean }) => {
      const response = await couponsAPI.update(id, {
        ...coupon,
        show_on_storefront: newStorefront,
      })
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] })
      toast.success(`Coupon visibility ${variables.newStorefront ? "enabled" : "disabled"} for storefront!`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update storefront visibility")
    },
  })

  const coupons = couponsData?.coupons || []

  const categoryOptions = categoriesData?.categories || []

  // Filter coupons by search query
  const filteredCoupons = coupons.filter((coupon: Coupon) =>
    coupon.coupon_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coupon.coupon_description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddCoupon = () => {
    setShowAddModal(true)
  }

  const handleEditCoupon = (coupon: Coupon) => {
    setSelectedCoupon(coupon)
    setCouponCode(coupon.coupon_code)
    setCouponDescription(coupon.coupon_description)
    setDiscountAmount(coupon.coupon_discount.toString())
    setDiscountType(coupon.type)
    setShowOnStorefront(!!coupon.show_on_storefront)
    setCustomerTypes(parseCustomerTypes(coupon.customer_types))
    setExpiryDate(formatDateForInput(coupon.expiry_date))
    setRecurrence(coupon.recurrence === "once" ? "once" : "multiple")
    setCategories(parseCategories(coupon.categories))
    setShowEditModal(true)
  }


  const handleSaveCoupon = () => {
    const newErrors: typeof formErrors = {}
    
    // Validate coupon code (required, reasonable max length)
    const codeValidation = validateRequired(couponCode, "Coupon code", 50)
    if (!codeValidation.valid) {
      newErrors.coupon_code = codeValidation.error || "Coupon code is required"
    }
    
    // Validate discount amount (required)
    if (!discountAmount || discountAmount.trim() === '') {
      newErrors.coupon_discount = "Discount amount is required"
    } else {
      const discountValidation = validateNumber(discountAmount, "Discount amount", {
        required: true,
        min: 0,
        max: discountType === 'P' ? 100 : 999999999999.9999, // Percentage max 100%, Fixed max DECIMAL(15,4)
        allowDecimals: true
      })
      if (!discountValidation.valid) {
        newErrors.coupon_discount = discountValidation.error || "Invalid discount amount"
      }
    }
    
    // Validate discount type (required)
    if (!discountType || discountType === '') {
      newErrors.type = "Discount type is required"
    }
    
    // Validate description (optional, reasonable limit)
    if (couponDescription && couponDescription.length > 1000) {
      newErrors.coupon_description = "Description must be 1000 characters or less"
    }
    
    setFormErrors(newErrors)
    
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0]
      if (firstError) toast.error(firstError)
      return
    }

    const data = {
      coupon_code: couponCode.trim().toUpperCase(),
      coupon_description: couponDescription.trim() || null,
      coupon_discount: Number.parseFloat(discountAmount),
      type: discountType,
      status: 1,
      show_on_storefront: showOnStorefront,
      customer_types: customerTypes,
      expiry_date: expiryDate.trim() || null,
      recurrence: recurrence,
      categories: categories,
    }

    if (selectedCoupon) {
      updateCouponMutation.mutate({ id: selectedCoupon.coupon_id, data })
    } else {
      createCouponMutation.mutate(data)
    }
  }

  const handleDelete = (coupon: Coupon) => {
    setConfirmCouponId(coupon.coupon_id)
    setConfirmCouponCode(coupon.coupon_code)
    setConfirmAction("delete")
    setShowConfirmModal(true)
  }

  const handleToggleStatus = (coupon: Coupon) => {
    setConfirmCouponId(coupon.coupon_id)
    setConfirmCouponCode(coupon.coupon_code)
    setConfirmAction(coupon.status === 1 ? "deactivate" : "activate")
    setShowConfirmModal(true)
  }

  const handleToggleStorefront = (coupon: Coupon) => {
    toggleStorefrontMutation.mutate({
      id: coupon.coupon_id,
      coupon: coupon,
      newStorefront: !coupon.show_on_storefront
    })
  }

  const handleConfirmAction = () => {
    if (!confirmCouponId) return

    if (confirmAction === "delete") {
      deleteCouponMutation.mutate(confirmCouponId)
    } else if (confirmAction === "activate" || confirmAction === "deactivate") {
      const coupon = coupons.find((c: Coupon) => c.coupon_id === confirmCouponId)
      if (coupon) {
        const newStatus = confirmAction === "activate" ? 1 : 0
        toggleStatusMutation.mutate({ id: confirmCouponId, coupon, newStatus })
      }
    }
    
    setShowConfirmModal(false)
    setConfirmCouponId(null)
    setConfirmCouponCode("")
    setConfirmAction(null)
  }

  const handleCancelConfirm = () => {
    setShowConfirmModal(false)
    setConfirmCouponId(null)
    setConfirmCouponCode("")
    setConfirmAction(null)
  }

  const resetForm = () => {
    setCouponCode("")
    setCouponDescription("")
    setDiscountAmount("")
    setDiscountType("")
    setShowOnStorefront(false)
    setCustomerTypes([])
    setExpiryDate("")
    setRecurrence("multiple")
    setCategories([])
  }

  const getDiscountDisplay = (coupon: Coupon) => {
    if (coupon.type === "P") {
      return `${coupon.coupon_discount}%`
    }
    return `$${parseFloat(coupon.coupon_discount.toString()).toFixed(2)}`
  }

  const getDiscountTypeDisplay = (type: string) => {
    return type === "P" ? "Percentage" : "Fixed Amount"
  }

  return (
    <div className="bg-gray-50 min-h-screen w-full overflow-x-hidden" style={{ fontFamily: 'Albert Sans', maxWidth: '100%' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-gray-900 text-2xl sm:text-3xl lg:text-4xl flex-shrink-0" style={{ 
          fontFamily: 'Albert Sans',
          fontWeight: 600,
          fontStyle: 'normal',
          lineHeight: '1.2',
          letterSpacing: '0%'
        }}>
          Manage Coupons
        </h1>
        <Button 
          onClick={handleAddCoupon}
          className="bg-[#105a9c] hover:bg-[#0d4a82] text-white whitespace-nowrap w-full sm:w-auto flex-shrink-0"
          style={{ 
            fontWeight: 600,
            minWidth: 'auto',
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
          Add Coupon
        </Button>
      </div>

      {/* Search and Print */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-stretch sm:items-center">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search coupons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[54px] border border-gray-200 bg-white rounded-full focus:ring-2 focus:ring-[#105a9c] focus:border-[#105a9c] focus:outline-none"
            style={{ fontFamily: 'Albert Sans', paddingLeft: '44px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
          />
        </div>
        <div className="ml-auto flex-shrink-0">
          <Button 
            onClick={() => printTableData("Coupons")}
            className="gap-2 whitespace-nowrap border-0 shadow-none w-full sm:w-auto"
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
      </div>

      {/* Active/Inactive Tabs */}
      <div className="flex gap-4 sm:gap-6 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("Active")}
          className={`pb-3 text-xs sm:text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "Active"
              ? "border-[#105a9c] text-[#105a9c]"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          Active ({activeCountData?.coupons?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("Inactive")}
          className={`pb-3 text-xs sm:text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "Inactive"
              ? "border-[#105a9c] text-[#105a9c]"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          Inactive ({inactiveCountData?.coupons?.length || 0})
        </button>
      </div>

      {/* Table */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white w-full">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full min-w-[400px] sm:min-w-[500px]">
              <thead>
                <tr className="bg-[#105a9c] border-b border-[#0d4a82] text-white">
                  <th className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Coupon Code
                  </th>
                  <th className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap hidden md:table-cell" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Coupon Description
                  </th>
                  <th className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Discount
                  </th>
                  <th className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap hidden lg:table-cell" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Discount Type
                  </th>
                  <th className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Storefront
                  </th>
                  <th className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Status
                  </th>
                  <th className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Actions
                  </th>
                </tr>
              </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    {Array.from({ length: 6 }).map((_, colIdx) => (
                      <td key={colIdx} className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : couponsError ? (
                <tr>
                  <td colSpan={6} className="px-2 sm:px-3 md:px-6 py-6 sm:py-8 text-center text-red-500 text-xs sm:text-sm">
                    Error loading coupons. Please try again.
                  </td>
                </tr>
              ) : filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 sm:px-3 md:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                    {searchQuery ? "No coupons found matching your search" : "No coupons found"}
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((coupon: Coupon) => (
                  <tr key={coupon.coupon_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm text-gray-900 font-medium" style={{ fontFamily: 'Albert Sans' }}>
                        {coupon.coupon_code}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 hidden md:table-cell">
                      <span className="text-xs sm:text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        {coupon.coupon_description || '-'}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm text-gray-700 font-medium" style={{ fontFamily: 'Albert Sans' }}>
                        {getDiscountDisplay(coupon)}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 hidden lg:table-cell">
                      <span className="text-xs sm:text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        {getDiscountTypeDisplay(coupon.type)}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-center">
                      <input
                        type="checkbox"
                        checked={!!coupon.show_on_storefront}
                        onChange={() => handleToggleStorefront(coupon)}
                        className="h-5 w-5 rounded border-gray-300 text-[#105a9c] focus:ring-[#105a9c] cursor-pointer"
                        title={coupon.show_on_storefront ? "Visible on Storefront" : "Hidden from Storefront"}
                      />
                    </td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                      <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium ${
                        coupon.status === 1 
                          ? "bg-green-50 text-green-700" 
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        <span className="hidden sm:inline">•</span> {coupon.status === 1 ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button
                          onClick={() => handleEditCoupon(coupon)}
                          className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 whitespace-nowrap"
                          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
                        >
                          <Edit2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => handleToggleStatus(coupon)}
                          className={`text-xs sm:text-sm font-medium whitespace-nowrap ${
                            coupon.status === 1 
                              ? "text-gray-700 hover:text-gray-900" 
                              : "text-green-600 hover:text-green-800"
                          }`}
                          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
                        >
                          {coupon.status === 1 ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => handleDelete(coupon)}
                          className="text-xs sm:text-sm text-red-600 hover:text-red-800 font-medium p-1 flex-shrink-0"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
        <p className="text-xs sm:text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
          Showing {filteredCoupons.length} of {coupons.length} Entries
        </p>
      </div>

      {/* Add/Edit Coupon Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          // Blur active element to prevent validation on blur
          if (document.activeElement && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          setShowAddModal(false)
          setShowEditModal(false)
          setSelectedCoupon(null)
          resetForm()
        }
      }}>
        <DialogContent className="w-[95vw] sm:w-full max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto bg-white" style={{ fontFamily: 'Albert Sans' }}>
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              {selectedCoupon ? <Edit2 className="h-6 w-6 text-[#105a9c]" /> : <Plus className="h-6 w-6 text-[#105a9c]" />}
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              {selectedCoupon ? "Edit Coupon" : "Add New Coupon"}
            </DialogTitle>
            <p className="text-center text-sm text-gray-600 mt-2">
              Fill in the details below.
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Coupon Code */}
            <ValidatedInput
              label="Coupon Code"
              placeholder="Enter coupon code"
              value={couponCode}
              validationRule={ValidationRules.coupon.coupon_code}
              fieldName="Coupon Code"
              error={formErrors.coupon_code}
              onChange={(value, isValid) => {
                setCouponCode(value)
                if (isValid) {
                  setFormErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.coupon_code
                    return newErrors
                  })
                }
              }}
              className="h-11 border-gray-300 bg-white"
            />

            {/* Coupon Description */}
            <ValidatedInput
              label="Coupon Description"
              placeholder="Enter description"
              value={couponDescription}
              validationRule={{ maxLength: 255 }}
              fieldName="Coupon Description"
              onChange={(value) => setCouponDescription(value)}
              className="h-11 border-gray-300 bg-white"
            />

            {/* Discount Amount */}
            <ValidatedInput
              label="Discount Amount"
              type="number"
              step="0.01"
              placeholder="Enter amount"
              value={discountAmount}
              validationRule={ValidationRules.coupon.coupon_discount}
              fieldName="Discount Amount"
              error={formErrors.coupon_discount}
              onChange={(value, isValid) => {
                setDiscountAmount(value)
                if (isValid) {
                  setFormErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.coupon_discount
                    return newErrors
                  })
                }
              }}
              className="h-11 border-gray-300 bg-white"
            />

            {/* Discount Type */}
            <div className="space-y-2">
              <Label htmlFor="discountType" className="text-sm font-medium text-gray-700">
                Discount Type <span className="text-red-500">*</span>
              </Label>
              <select
                id="discountType"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="w-full h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#105a9c]"
                style={{ fontFamily: 'Albert Sans' }}
              >
                <option value="">Select type</option>
                <option value="P">Percentage Discount</option>
                <option value="F">Fixed Discount</option>
              </select>
            </div>

            {/* Customer Type (multi-select) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Customer Type
              </Label>
              <p className="text-xs text-gray-500">
                Select which customer types can use this coupon. Leave all
                unchecked to make it available to everyone.
              </p>
              <div className="flex flex-wrap gap-2">
                {CUSTOMER_TYPE_OPTIONS.map((option) => {
                  const checked = customerTypes.includes(option.value)
                  return (
                    <label
                      key={option.value}
                      className={`flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm ${
                        checked
                          ? "border-[#105a9c] bg-blue-50 text-[#105a9c]"
                          : "border-gray-300 bg-white text-gray-700"
                      }`}
                      style={{ fontFamily: "Albert Sans" }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setCustomerTypes((prev) =>
                            e.target.checked
                              ? [...prev, option.value]
                              : prev.filter((v) => v !== option.value),
                          )
                        }}
                        className="rounded border-gray-300"
                      />
                      {option.label}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <Label htmlFor="expiryDate" className="text-sm font-medium text-gray-700">
                Expiry Date
              </Label>
              <p className="text-xs text-gray-500">
                Leave blank for no expiry.
              </p>
              <Input
                id="expiryDate"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="h-11 border-gray-300 bg-white"
                style={{ fontFamily: "Albert Sans" }}
              />
            </div>

            {/* Recurrence */}
            <div className="space-y-2">
              <Label htmlFor="recurrence" className="text-sm font-medium text-gray-700">
                Recurrence
              </Label>
              <select
                id="recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className="w-full h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#105a9c]"
                style={{ fontFamily: "Albert Sans" }}
              >
                {RECURRENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category applicable (multi-select) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Category Applicable
              </Label>
              <p className="text-xs text-gray-500">
                Select which categories this coupon applies to. Leave all
                unchecked to make it available for all categories.
              </p>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {categoryOptions.map((category: { category_id: number; category_name: string }) => {
                  const value = String(category.category_id)
                  const checked = categories.includes(value)
                  return (
                    <label
                      key={value}
                      className={`flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm ${
                        checked
                          ? "border-[#105a9c] bg-blue-50 text-[#105a9c]"
                          : "border-gray-300 bg-white text-gray-700"
                      }`}
                      style={{ fontFamily: "Albert Sans" }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setCategories((prev) =>
                            e.target.checked
                              ? [...prev, value]
                              : prev.filter((v) => v !== value),
                          )
                        }}
                        className="rounded border-gray-300"
                      />
                      {category.category_name}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowAddModal(false)
                  setShowEditModal(false)
                  setSelectedCoupon(null)
                  resetForm()
                }}
                variant="outline"
                className="flex-1 border-gray-300 bg-white"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCoupon}
                disabled={!couponCode || !discountAmount || !discountType || createCouponMutation.isPending || updateCouponMutation.isPending}
                className="flex-1 bg-[#105a9c] hover:bg-[#0d4a82] text-white disabled:opacity-50"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {createCouponMutation.isPending || updateCouponMutation.isPending ? "Saving..." : "Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="w-[95vw] sm:w-full max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 700 }}>
              {confirmAction === "delete" && "Delete Coupon"}
              {confirmAction === "activate" && "Activate Coupon"}
              {confirmAction === "deactivate" && "Deactivate Coupon"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                confirmAction === "delete" ? "bg-red-100" : "bg-yellow-100"
              }`}>
                {confirmAction === "delete" ? (
                  <Trash2 className="h-6 w-6 text-red-600" />
                ) : (
                  <span className="text-2xl">{confirmAction === "activate" ? "✓" : "✕"}</span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Albert Sans' }}>
                  {confirmAction === "delete" && "Are you sure you want to permanently delete this coupon? This action cannot be undone."}
                  {confirmAction === "activate" && "Are you sure you want to activate this coupon?"}
                  {confirmAction === "deactivate" && "Are you sure you want to deactivate this coupon?"}
                </p>
                <p className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  {confirmCouponCode}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleCancelConfirm}
              className="border-gray-300 w-full sm:w-auto"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              className={`w-full sm:w-auto ${
                confirmAction === "delete" 
                  ? "bg-red-600 hover:bg-red-700" 
                  : confirmAction === "activate"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-yellow-600 hover:bg-yellow-700"
              } text-white`}
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              {confirmAction === "delete" && "Delete"}
              {confirmAction === "activate" && "Activate"}
              {confirmAction === "deactivate" && "Deactivate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
