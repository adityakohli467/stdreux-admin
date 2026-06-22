"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ValidatedInput } from "@/components/ui/validated-input"
import { ValidatedTextarea } from "@/components/ui/validated-textarea"
import { ValidationRules } from "@/lib/validation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Printer, Plus, Edit, Mail, Trash2, Archive, RotateCw, DollarSign, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { customersAPI, companiesAPI, locationsAPI } from "@/lib/api"
import { validateRequired, validateEmail, validateAustralianPhone } from "@/lib/validations"
import { formatAustralianPhone, cleanPhoneNumber, getPhonePlaceholder, getPhoneValidationError } from "@/lib/phone-mask"
import { printTableData } from "@/lib/print-utils"

interface WholesaleCustomer {
  customer_id: number
  customer_name: string
  firstname: string
  lastname: string
  contact: string
  email: string
  address: string
  customer_type: "Full Service Wholesale" | "Partial Service Wholesale" | string
  status: number
  archived: boolean
  company?: string
  company_id?: number
  department?: string
  department_id?: number
  location?: string
  opening_date?: string
  customer_notes?: string
  customer_cost_centre?: string
}

interface Company {
  company_id: number
  company_name: string
}

interface Location {
  location_id: number
  location_name: string
}

export default function WholesaleCustomersPage() {
  const queryClient = useQueryClient()
  
  const [activeCustomerType, setActiveCustomerType] = useState<"Full Service Wholesale" | "Partial Service Wholesale">("Full Service Wholesale")
  const [activeStatusTab, setActiveStatusTab] = useState<"Active" | "Archived">("Active")
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<WholesaleCustomer | null>(null)
  const [deleteCustomerId, setDeleteCustomerId] = useState<number | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    contact: "",
    email: "",
    address: "",
    company_id: "",
    location: "",
    opening_date: "",
    customer_type: "Full Service Wholesale",
    customer_notes: "",
    customer_cost_centre: "",
  })

  // Fetch companies
  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const response = await companiesAPI.list({ limit: 100 })
      return response.data
    }
  })

  const companies: Company[] = companiesData?.companies || []

  // Fetch wholesale customers
  const { data: customersData, isLoading, error: customersError } = useQuery({
    queryKey: ['wholesale-customers', activeCustomerType, activeStatusTab, searchQuery],
    queryFn: async () => {
      const params: Record<string, any> = {
        limit: 100,
        offset: 0,
        customer_type: activeCustomerType,
        archived: activeStatusTab === "Archived",
      }
      if (searchQuery) params.search = searchQuery
      
      const response = await customersAPI.listWholesale(params)
      return response.data
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  })

  const customers: WholesaleCustomer[] = customersData?.customers || []

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await customersAPI.create(data)
    },
    onSuccess: (response, variables) => {
      // Switch to the appropriate tab based on created customer type
      if (variables.customer_type === "Partial Service Wholesale") {
        setActiveCustomerType("Partial Service Wholesale")
      } else if (variables.customer_type === "Full Service Wholesale") {
        setActiveCustomerType("Full Service Wholesale")
      }
      
      // Invalidate all wholesale-customers queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['wholesale-customers'] })
      // Also refetch immediately to show the new customer
      queryClient.refetchQueries({ queryKey: ['wholesale-customers'] })
      toast.success("Customer created successfully")
      setShowAddModal(false)
      resetForm()
    },
    onError: (error: any) => {
      console.error("Create customer error:", error)
      toast.error(error.response?.data?.message || "Failed to create customer")
    }
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await customersAPI.update(id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-customers'] })
      queryClient.refetchQueries({ queryKey: ['wholesale-customers'] })
      toast.success("Customer updated successfully")
      setShowEditModal(false)
      setSelectedCustomer(null)
      resetForm()
    },
    onError: (error: any) => {
      console.error("Update customer error:", error)
      toast.error(error.response?.data?.message || "Failed to update customer")
    }
  })

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      return await customersAPI.archive(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-customers'] })
      queryClient.refetchQueries({ queryKey: ['wholesale-customers'] })
      toast.success("Customer archived successfully")
    },
    onError: (error: any) => {
      console.error("Archive customer error:", error)
      toast.error(error.response?.data?.message || "Failed to archive customer")
    }
  })

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      return await customersAPI.restore(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-customers'] })
      queryClient.refetchQueries({ queryKey: ['wholesale-customers'] })
      toast.success("Customer restored successfully")
    },
    onError: (error: any) => {
      console.error("Restore customer error:", error)
      toast.error(error.response?.data?.message || "Failed to restore customer")
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await customersAPI.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-customers'] })
      queryClient.refetchQueries({ queryKey: ['wholesale-customers'] })
      toast.success("Customer deleted successfully")
      setShowDeleteModal(false)
      setDeleteCustomerId(null)
    },
    onError: (error: any) => {
      console.error("Delete customer error:", error)
      toast.error(error.response?.data?.message || "Failed to delete customer")
    }
  })

  const resetForm = () => {
    setFormData({
      firstname: "",
      lastname: "",
      contact: "",
      email: "",
      address: "",
      company_id: "",
      location: "",
      opening_date: "",
      customer_type: activeCustomerType,
      customer_notes: "",
      customer_cost_centre: "",
    })
    setErrors({}) // Clear all validation errors
  }

  const handleEdit = (customer: WholesaleCustomer) => {
    setSelectedCustomer(customer)
    setFormData({
      firstname: customer.firstname || "",
      lastname: customer.lastname || "",
      contact: customer.contact || "",
      email: customer.email || "",
      address: customer.address || "",
      company_id: customer.company_id?.toString() || "",
      location: customer.location || "",
      opening_date: customer.opening_date || "",
      customer_type: customer.customer_type || activeCustomerType,
      customer_notes: customer.customer_notes || "",
      customer_cost_centre: customer.customer_cost_centre || "",
    })
    setShowEditModal(true)
  }

  // Validation errors state
  const [errors, setErrors] = useState<{
    firstname?: string
    lastname?: string
    email?: string
    contact?: string
    address?: string
    customer_cost_centre?: string
    customer_notes?: string
  }>({})

  const validateWholesaleForm = (): boolean => {
    const newErrors: typeof errors = {}
    
    // Validate firstname (required, max 255 chars)
    const firstnameValidation = validateRequired(formData.firstname, "First name", 255)
    if (!firstnameValidation.valid) {
      newErrors.firstname = firstnameValidation.error || "First name is required"
    }
    
    // Validate lastname (optional, max 255 chars)
    if (formData.lastname && formData.lastname.trim() !== "") {
      const lastnameValidation = validateRequired(formData.lastname, "Last name", 255)
      if (!lastnameValidation.valid) {
        newErrors.lastname = lastnameValidation.error || "Last name is invalid"
      }
    }
    
    // Validate email (required, max 255 chars, must be valid format)
    if (!formData.email || formData.email.trim() === '') {
      newErrors.email = "Email is required"
    } else {
      const emailValidation = validateEmail(formData.email, 255)
      if (!emailValidation.valid) {
        newErrors.email = emailValidation.error || "Please enter a valid email address"
      }
    }
    
    // Validate contact (required, Australian format, max 15 chars)
    if (!formData.contact || formData.contact.trim() === '') {
      newErrors.contact = "Contact number is required"
    } else {
      const phoneValidation = validateAustralianPhone(formData.contact)
      if (!phoneValidation.valid) {
        newErrors.contact = phoneValidation.error || "Please enter a valid Australian phone number"
      }
    }
    
    // Validate address (optional, reasonable limit)
    if (formData.address && formData.address.length > 1000) {
      newErrors.address = "Address must be 1000 characters or less"
    }
    
    // Validate cost centre (optional, max 255 chars)
    if (formData.customer_cost_centre && formData.customer_cost_centre.length > 255) {
      newErrors.customer_cost_centre = "Cost centre must be 255 characters or less"
    }
    
    // Validate notes (optional, reasonable limit)
    if (formData.customer_notes && formData.customer_notes.length > 5000) {
      newErrors.customer_notes = "Notes must be 5000 characters or less"
    }
    
    setErrors(newErrors)
    
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0]
      if (firstError) toast.error(firstError)
      return false
    }
    
    return true
  }

  const handleSave = () => {
    if (!validateWholesaleForm()) return

    const customerData = {
      firstname: formData.firstname.trim(),
      lastname: formData.lastname.trim(),
      email: formData.email.trim(),
      telephone: cleanPhoneNumber(formData.contact),
      customer_address: formData.address.trim() || null,
      customer_type: formData.customer_type,
      company_id: formData.company_id ? Number(formData.company_id) : null,
      estimated_opening_date: formData.opening_date || null,
      customer_notes: formData.customer_notes.trim() || null,
      customer_cost_centre: formData.customer_cost_centre.trim() || null,
      status: 1,
      archived: false,
    }

    createMutation.mutate(customerData)
  }

  const handleUpdate = () => {
    if (!validateWholesaleForm()) return

    if (!selectedCustomer) return

    const customerData = {
      firstname: formData.firstname.trim(),
      lastname: formData.lastname.trim(),
      email: formData.email.trim(),
      telephone: cleanPhoneNumber(formData.contact),
      customer_address: formData.address.trim() || null,
      customer_type: formData.customer_type,
      company_id: formData.company_id ? Number(formData.company_id) : null,
      estimated_opening_date: formData.opening_date || null,
      customer_notes: formData.customer_notes.trim() || null,
      customer_cost_centre: formData.customer_cost_centre.trim() || null,
      status: selectedCustomer.status,
      archived: selectedCustomer.archived,
    }

    updateMutation.mutate({ id: selectedCustomer.customer_id, data: customerData })
  }

  const handleArchive = (customer: WholesaleCustomer) => {
    archiveMutation.mutate(customer.customer_id)
  }

  const handleRestore = (customer: WholesaleCustomer) => {
    restoreMutation.mutate(customer.customer_id)
  }

  const handleDelete = (customerId: number) => {
    setDeleteCustomerId(customerId)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = () => {
    if (deleteCustomerId) {
      deleteMutation.mutate(deleteCustomerId)
    }
  }

  const handlePrint = () => {
    printTableData("Wholesale Customers")
  }

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
          Wholesale Customers
        </h1>
        <Button 
          onClick={() => {
            resetForm()
            // Sync customer_type with active tab when opening modal
            setFormData(prev => ({ ...prev, customer_type: activeCustomerType }))
            setShowAddModal(true)
          }}
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
          Add New Customer
        </Button>
      </div>

      {/* Customer Type Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeCustomerType === "Full Service Wholesale" ? "default" : "outline"}
          onClick={() => {
            setActiveCustomerType("Full Service Wholesale")
            setFormData({ ...formData, customer_type: "Full Service Wholesale" })
          }}
          className={`rounded-full px-6 py-2 ${
            activeCustomerType === "Full Service Wholesale"
              ? "bg-blue-100 text-blue-700 border-blue-300"
              : "bg-white text-gray-700 border-gray-300"
          }`}
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          Full Service Wholesalers
        </Button>
        <Button
          variant={activeCustomerType === "Partial Service Wholesale" ? "default" : "outline"}
          onClick={() => {
            setActiveCustomerType("Partial Service Wholesale")
            setFormData({ ...formData, customer_type: "Partial Service Wholesale" })
          }}
          className={`rounded-full px-6 py-2 ${
            activeCustomerType === "Partial Service Wholesale"
              ? "bg-blue-100 text-blue-700 border-blue-300"
              : "bg-white text-gray-700 border-gray-300"
          }`}
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          Partial Service Wholesalers
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeStatusTab === "Active" ? "default" : "outline"}
          onClick={() => setActiveStatusTab("Active")}
          className={`rounded-full px-6 py-2 ${
            activeStatusTab === "Active"
              ? "bg-blue-100 text-blue-700 border-blue-300"
              : "bg-white text-gray-700 border-gray-300"
          }`}
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          Active
        </Button>
        <Button
          variant={activeStatusTab === "Archived" ? "default" : "outline"}
          onClick={() => setActiveStatusTab("Archived")}
          className={`rounded-full px-6 py-2 ${
            activeStatusTab === "Archived"
              ? "bg-blue-100 text-blue-700 border-blue-300"
              : "bg-white text-gray-700 border-gray-300"
          }`}
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          Archived
        </Button>
      </div>

      {/* Search, Filter, and Print */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center">
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
          variant="outline" 
          className="gap-2 h-11 border-gray-300 bg-white"
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          <Filter className="h-5 w-5" />
          Filter
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

      {/* Table */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#105a9c] border-b border-[#0d4a82]">
                <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Customer Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Email
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Address
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Company
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-[#105a9c]" />
                      <span className="text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
                        Loading customers...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : customersError ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-sm text-red-600" style={{ fontFamily: 'Albert Sans' }}>
                        Error loading customers
                      </span>
                      <Button
                        onClick={() => queryClient.refetchQueries({ queryKey: ['wholesale-customers'] })}
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
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-sm text-gray-500" style={{ fontFamily: 'Albert Sans' }}>
                        No {activeCustomerType} customers found
                      </span>
                      <span className="text-xs text-gray-400" style={{ fontFamily: 'Albert Sans' }}>
                        {activeStatusTab === "Archived" 
                          ? "Try switching to Active tab or add a new customer"
                          : "Click 'Add New Customer' to create one"}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.customer_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-gray-900 whitespace-pre-line" style={{ 
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        fontSize: '14px',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>
                        {customer.customer_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-700" style={{ 
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        fontSize: '14px',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>
                        {customer.contact}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-700" style={{ 
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        fontSize: '14px',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>
                        {customer.email}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <span className="text-gray-700 line-clamp-2" style={{ 
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        fontSize: '14px',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>
                        {customer.address}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-700" style={{ 
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        fontSize: '14px',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>
                        {customer.company || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {customer.archived ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                          Archived
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4 text-gray-600" />
                        </button>
                        <a href={`mailto:${customer.email}`}>
                          <button className="p-1 hover:bg-gray-100 rounded" title="Email">
                            <Mail className="h-4 w-4 text-gray-600" />
                          </button>
                        </a>
                        <button 
                          onClick={() => handleDelete(customer.customer_id)}
                          className="p-1 hover:bg-gray-100 rounded" 
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                        {customer.archived ? (
                          <button 
                            onClick={() => handleRestore(customer)}
                            className="p-1 hover:bg-gray-100 rounded" 
                            title="Restore"
                          >
                            <RotateCw className="h-4 w-4 text-gray-600" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleArchive(customer)}
                            className="p-1 hover:bg-gray-100 rounded" 
                            title="Archive"
                          >
                            <Archive className="h-4 w-4 text-gray-600" />
                          </button>
                        )}
                        <Link href="/wholesale">
                          <button className="p-1 hover:bg-gray-100 rounded" title="View Pricing">
                            <DollarSign className="h-4 w-4 text-green-600" />
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Customer Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => {
        if (!open) {
          // Blur active element to prevent validation on blur
          if (document.activeElement && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          resetForm() // Clear form and errors when closing
        }
        setShowAddModal(open)
      }}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto" style={{ fontFamily: 'Albert Sans' }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-center">Add New Customer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <ValidatedInput
                label="First Name"
                value={formData.firstname}
                validationRule={ValidationRules.customer.firstname}
                fieldName="First Name"
                error={errors.firstname}
                onChange={(value, isValid) => {
                  setFormData({ ...formData, firstname: value })
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.firstname
                      return newErrors
                    })
                  }
                }}
                className="border-gray-300"
              />
              <ValidatedInput
                label="Last Name"
                value={formData.lastname}
                validationRule={ValidationRules.customer.lastname}
                fieldName="Last Name"
                error={errors.lastname}
                onChange={(value, isValid) => {
                  setFormData({ ...formData, lastname: value })
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.lastname
                      return newErrors
                    })
                  }
                }}
                className="border-gray-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ValidatedInput
                label="Contact"
                type="tel"
                placeholder={getPhonePlaceholder()}
                value={formData.contact}
                validationRule={ValidationRules.customer.telephone}
                fieldName="Contact"
                error={errors.contact}
                onChange={(value, isValid) => {
                  const previousValue = formData.contact
                  const formatted = formatAustralianPhone(value, previousValue)
                  setFormData({ ...formData, contact: formatted })
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.contact
                      return newErrors
                    })
                  }
                }}
                className="border-gray-300"
              />
              <ValidatedInput
                label="Email"
                type="email"
                value={formData.email}
                validationRule={ValidationRules.customer.email}
                fieldName="Email"
                error={errors.email}
                onChange={(value, isValid) => {
                  setFormData({ ...formData, email: value })
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.email
                      return newErrors
                    })
                  }
                }}
                className="border-gray-300"
              />
            </div>

            <ValidatedTextarea
              label="Address"
              value={formData.address}
              validationRule={ValidationRules.customer.customer_address}
              fieldName="Address"
              error={errors.address}
              onChange={(value, isValid) => {
                setFormData({ ...formData, address: value })
                if (isValid) {
                  setErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.address
                    return newErrors
                  })
                }
              }}
              className="border-gray-300 resize-none"
              rows={3}
              placeholder="Enter customer address"
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <Select value={formData.company_id || undefined} onValueChange={(value) => setFormData({ ...formData, company_id: value === "none" ? "" : value })}>
                  <SelectTrigger className="border-gray-300">
                    <SelectValue placeholder="Select Company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.company_id} value={company.company_id.toString()}>
                        {company.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer Type *</Label>
                <Select value={formData.customer_type} onValueChange={(value) => setFormData({ ...formData, customer_type: value })}>
                  <SelectTrigger className="border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full Service Wholesale">Full Service Wholesale</SelectItem>
                    <SelectItem value="Partial Service Wholesale">Partial Service Wholesale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ValidatedInput
                label="Cost Centre"
                value={formData.customer_cost_centre}
                validationRule={ValidationRules.customer.customer_cost_centre}
                fieldName="Cost Centre"
                error={errors.customer_cost_centre}
                onChange={(value, isValid) => {
                  setFormData({ ...formData, customer_cost_centre: value })
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.customer_cost_centre
                      return newErrors
                    })
                  }
                }}
                className="border-gray-300"
              />
              <div className="space-y-2">
                <Label>Estimated Opening Date</Label>
                <Input
                  type="date"
                  value={formData.opening_date}
                  onChange={(e) => setFormData({ ...formData, opening_date: e.target.value })}
                  className="border-gray-300"
                />
              </div>
            </div>

            <ValidatedTextarea
              label="Notes"
              value={formData.customer_notes}
              validationRule={ValidationRules.customer.customer_notes}
              fieldName="Notes"
              error={errors.customer_notes}
              onChange={(value, isValid) => {
                setFormData({ ...formData, customer_notes: value })
                if (isValid) {
                  setErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.customer_notes
                    return newErrors
                  })
                }
              }}
              className="border-gray-300 resize-none"
              rows={3}
              placeholder="Additional notes..."
            />

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                variant="outline"
                className="flex-1 border-gray-300"
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 bg-[#105a9c] hover:bg-[#0d4a82] text-white"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        if (!open) {
          // Blur active element to prevent validation on blur
          if (document.activeElement && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          resetForm() // Clear form and errors when closing
        }
        setShowEditModal(open)
      }}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto" style={{ fontFamily: 'Albert Sans' }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-center">Edit Customer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <ValidatedInput
                label="First Name"
                value={formData.firstname}
                validationRule={ValidationRules.customer.firstname}
                fieldName="First Name"
                error={errors.firstname}
                onChange={(value, isValid) => {
                  setFormData({ ...formData, firstname: value })
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.firstname
                      return newErrors
                    })
                  }
                }}
                className="border-gray-300"
              />
              <ValidatedInput
                label="Last Name"
                value={formData.lastname}
                validationRule={ValidationRules.customer.lastname}
                fieldName="Last Name"
                error={errors.lastname}
                onChange={(value, isValid) => {
                  setFormData({ ...formData, lastname: value })
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.lastname
                      return newErrors
                    })
                  }
                }}
                className="border-gray-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ValidatedInput
                label="Contact"
                type="tel"
                placeholder={getPhonePlaceholder()}
                value={formData.contact}
                validationRule={ValidationRules.customer.telephone}
                fieldName="Contact"
                error={errors.contact}
                onChange={(value, isValid) => {
                  const previousValue = formData.contact
                  const formatted = formatAustralianPhone(value, previousValue)
                  setFormData({ ...formData, contact: formatted })
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.contact
                      return newErrors
                    })
                  }
                }}
                className="border-gray-300"
              />
              <ValidatedInput
                label="Email"
                type="email"
                value={formData.email}
                validationRule={ValidationRules.customer.email}
                fieldName="Email"
                error={errors.email}
                onChange={(value, isValid) => {
                  setFormData({ ...formData, email: value })
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.email
                      return newErrors
                    })
                  }
                }}
                className="border-gray-300"
              />
            </div>

            <ValidatedTextarea
              label="Address"
              value={formData.address}
              validationRule={ValidationRules.customer.customer_address}
              fieldName="Address"
              error={errors.address}
              onChange={(value, isValid) => {
                setFormData({ ...formData, address: value })
                if (isValid) {
                  setErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.address
                    return newErrors
                  })
                }
              }}
              className="border-gray-300 resize-none"
              rows={3}
              placeholder="Enter customer address"
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <Select value={formData.company_id || undefined} onValueChange={(value) => setFormData({ ...formData, company_id: value === "none" ? "" : value })}>
                  <SelectTrigger className="border-gray-300">
                    <SelectValue placeholder="Select Company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.company_id} value={company.company_id.toString()}>
                        {company.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer Type *</Label>
                <Select value={formData.customer_type} onValueChange={(value) => setFormData({ ...formData, customer_type: value })}>
                  <SelectTrigger className="border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full Service Wholesale">Full Service Wholesale</SelectItem>
                    <SelectItem value="Partial Service Wholesale">Partial Service Wholesale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ValidatedInput
                label="Cost Centre"
                value={formData.customer_cost_centre}
                validationRule={ValidationRules.customer.customer_cost_centre}
                fieldName="Cost Centre"
                error={errors.customer_cost_centre}
                onChange={(value, isValid) => {
                  setFormData({ ...formData, customer_cost_centre: value })
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.customer_cost_centre
                      return newErrors
                    })
                  }
                }}
                className="border-gray-300"
              />
              <div className="space-y-2">
                <Label>Estimated Opening Date</Label>
                <Input
                  type="date"
                  value={formData.opening_date}
                  onChange={(e) => setFormData({ ...formData, opening_date: e.target.value })}
                  className="border-gray-300"
                />
              </div>
            </div>

            <ValidatedTextarea
              label="Notes"
              value={formData.customer_notes}
              validationRule={ValidationRules.customer.customer_notes}
              fieldName="Notes"
              error={errors.customer_notes}
              onChange={(value, isValid) => {
                setFormData({ ...formData, customer_notes: value })
                if (isValid) {
                  setErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.customer_notes
                    return newErrors
                  })
                }
              }}
              className="border-gray-300 resize-none"
              rows={3}
              placeholder="Additional notes..."
            />

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedCustomer(null)
                  resetForm()
                }}
                variant="outline"
                className="flex-1 border-gray-300"
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                className="flex-1 bg-[#105a9c] hover:bg-[#0d4a82] text-white"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                    Updating...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 700 }}>
              Delete Customer
            </DialogTitle>
            <DialogDescription style={{ fontFamily: 'Albert Sans' }}>
              Are you sure you want to delete this customer? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Customer #{deleteCustomerId}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false)
                setDeleteCustomerId(null)
              }}
              className="border-gray-300"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              disabled={deleteMutation.isPending}
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
