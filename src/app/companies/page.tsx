"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { companiesAPI } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ValidatedInput } from "@/components/ui/validated-input"
import { ValidatedTextarea } from "@/components/ui/validated-textarea"
import { ValidationRules } from "@/lib/validation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Printer, Plus, Edit, Trash2, Loader2, AlertTriangle, DollarSign } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { validateRequired, validateAustralianPhone, validateABN } from "@/lib/validations"
import { formatAustralianPhone, cleanPhoneNumber, getPhonePlaceholder, getPhoneValidationError } from "@/lib/phone-mask"
import { printTableData } from "@/lib/print-utils"

interface Company {
  company_id: number
  company_name: string
  company_phone: string
  company_address: string
  company_abn?: string
  pay_later?: boolean
}

// Phone formatting function from PHP
const formatPhone = (phone: string): string => {
  if (!phone) return ""
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "")
  
  // Match patterns from PHP
  let matches
  
  // Pattern: 4-3-3 (e.g., 0412 345 678)
  matches = cleaned.match(/^(\d{4})(\d{3})(\d{3})$/)
  if (matches) return `${matches[1]} ${matches[2]} ${matches[3]}`
  
  // Pattern: 3-3-3 (e.g., 412 345 678)
  matches = cleaned.match(/^(\d{3})(\d{3})(\d{3})$/)
  if (matches) return `${matches[1]} ${matches[2]} ${matches[3]}`
  
  // Pattern: 2-2-2 (e.g., 41 23 45)
  matches = cleaned.match(/^(\d{2})(\d{2})(\d{2})$/)
  if (matches) return `${matches[1]} ${matches[2]} ${matches[3]}`
  
  // Pattern: 4-4 (e.g., 4123 4567)
  matches = cleaned.match(/^(\d{4})(\d{4})$/)
  if (matches) return `${matches[1]} ${matches[2]}`
  
  // Default: return as is
  return phone
}

export default function CompaniesPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("Companies")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [companyToDelete, setCompanyToDelete] = useState<{ id: number, name: string } | null>(null)
  const [isClosingModal, setIsClosingModal] = useState(false)
  
  // Form state
  const [companyName, setCompanyName] = useState("")
  const [abn, setAbn] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [payLater, setPayLater] = useState(false)

  // Fetch companies from API
  const { data: companiesData, isPending, error } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      try {
        const response = await companiesAPI.list()
        return response.data
      } catch (error: any) {
        console.error("Error fetching companies:", error)
        toast.error("Failed to load companies")
        throw error
      }
    }
  })

  const allCompanies = (companiesData as any)?.companies || []

  // Frontend search across all fields
  const companies = useMemo(() => {
    if (!searchQuery.trim()) return allCompanies

    const query = searchQuery.toLowerCase()
    return allCompanies.filter((company: Company) => {
      return (
        company.company_name?.toLowerCase().includes(query) ||
        company.company_phone?.toLowerCase().includes(query) ||
        company.company_address?.toLowerCase().includes(query) ||
        company.company_abn?.toLowerCase().includes(query) ||
        formatPhone(company.company_phone)?.toLowerCase().includes(query)
      )
    })
  }, [allCompanies, searchQuery])

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: (data: any) => companiesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success("Company added successfully!")
      setShowAddModal(false)
      resetForm()
    },
    onError: (error: any) => {
      console.error("Error creating company:", error)
      toast.error("Failed to add company")
    }
  })

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => 
      companiesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success("Company updated successfully!")
      setShowEditModal(false)
      resetForm()
    },
    onError: (error: any) => {
      console.error("Error updating company:", error)
      toast.error("Failed to update company")
    }
  })

  // Delete company mutation
  const deleteCompanyMutation = useMutation({
    mutationFn: (id: number) => companiesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success("Company deleted successfully!")
    },
    onError: (error: any) => {
      console.error("Error deleting company:", error)
      toast.error("Failed to delete company")
    }
  })

  const handleAddCompany = () => {
    resetForm()
    setShowAddModal(true)
  }

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company)
    setCompanyName(company.company_name)
    setAbn(company.company_abn || "")
    setPhone(company.company_phone)
    setAddress(company.company_address || "")
    setPayLater(company.pay_later === true)
    setShowEditModal(true)
  }

  const handleManageDiscounts = (company: Company) => {
    setSelectedCompany(company)
    setShowDiscountModal(true)
  }

  // Validation errors state
  const [errors, setErrors] = useState<{
    company_name?: string
    company_phone?: string
    company_abn?: string
    company_address?: string
  }>({})

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}
    
    // Validate company name (required, max 255 chars per DB schema)
    const nameValidation = validateRequired(companyName, "Company name", 255)
    if (!nameValidation.valid) {
      newErrors.company_name = nameValidation.error || "Company name is required"
    }
    
    // Validate phone (required, Australian format, max 15 chars per DB schema)
    if (!phone.trim()) {
      newErrors.company_phone = "Phone number is required"
    } else {
      const phoneValidation = validateAustralianPhone(phone)
      if (!phoneValidation.valid) {
        newErrors.company_phone = phoneValidation.error || "Please enter a valid Australian phone number"
      }
    }
    
    // Validate ABN (optional, 11 digits, max 15 chars per DB schema)
    if (abn && abn.trim() !== '') {
      const abnValidation = validateABN(abn)
      if (!abnValidation.valid) {
        newErrors.company_abn = abnValidation.error || "Please enter a valid ABN"
      }
    }
    
    // Validate address (optional, TEXT field - reasonable limit)
    if (address && address.length > 1000) {
      newErrors.company_address = "Address must be 1000 characters or less"
    }
    
    setErrors(newErrors)
    
    if (Object.keys(newErrors).length > 0) {
      // Show first error as toast
      const firstError = Object.values(newErrors)[0]
      if (firstError) toast.error(firstError)
      return false
    }
    
    return true
  }

  const handleSaveNewCompany = () => {
    if (!validateForm()) return
    
    createCompanyMutation.mutate({
      company_name: companyName.trim(),
      company_abn: abn.trim() || null,
      company_phone: cleanPhoneNumber(phone), // Clean and format before saving
      company_address: address.trim() || null,
      company_status: 1,
      pay_later: payLater
    })
  }

  const handleUpdateCompany = () => {
    if (!validateForm()) return
    if (!selectedCompany) return
    
    updateCompanyMutation.mutate({
      id: selectedCompany.company_id,
      data: {
        company_name: companyName.trim(),
        company_abn: abn.trim() || null,
        company_phone: cleanPhoneNumber(phone), // Clean and format before saving
        company_address: address.trim() || null,
        pay_later: payLater,
      }
    })
  }

  const handleDeleteCompany = (companyId: number, companyName: string) => {
    setCompanyToDelete({ id: companyId, name: companyName })
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    if (companyToDelete) {
      deleteCompanyMutation.mutate(companyToDelete.id)
      setShowDeleteModal(false)
      setCompanyToDelete(null)
    }
  }

  const handlePrint = () => {
    printTableData("Companies")
  }

  const resetForm = () => {
    setCompanyName("")
    setAbn("")
    setPhone("")
    setAddress("")
    setPayLater(false)
    setSelectedCompany(null)
    setErrors({}) // Clear all validation errors
  }

  return (
    <div className="bg-[#f8f9fa] w-full max-w-full overflow-x-hidden" style={{ fontFamily: 'Albert Sans' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[#1a1a1a]" style={{ 
          fontFamily: 'Albert Sans',
          fontWeight: 600,
          fontStyle: 'normal',
          fontSize: '40px',
          lineHeight: '20px',
          letterSpacing: '0%'
        }}>
          Companies
        </h1>
        <Button 
          onClick={handleAddCompany}
          className="no-print bg-[#0d6efd] hover:bg-[#0b5ed7] text-white whitespace-nowrap"
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
          Add New Company
        </Button>
      </div>

      {/* Tabs */}
      <div className="no-print flex gap-2 mb-6">
        <Link href="/companies">
          <button
            className={`px-10 py-3 rounded-full text-[15px] font-medium transition-all ${
              activeTab === "Companies"
                ? "bg-[#e7f1ff] text-[#0d6efd] border-2 border-[#0d6efd]"
                : "bg-white text-[#6c757d] border-2 border-[#e9ecef] hover:border-[#dee2e6]"
            }`}
            style={{ fontFamily: 'Albert Sans', fontWeight: 500 }}
          >
            Companies
          </button>
        </Link>
      </div>

      {/* Search and Print */}
      <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search Order ID, Customer ID, Status etc."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-[488px] h-[54px] border border-gray-200 bg-white rounded-full focus:ring-2 focus:ring-[#0d6efd] focus:border-[#0d6efd] focus:outline-none"
            style={{ fontFamily: 'Albert Sans', paddingLeft: '44px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
          />
        </div>
        <Button 
          onClick={handlePrint}
          className="gap-2 whitespace-nowrap border-0 shadow-none w-full sm:w-auto flex-shrink-0"
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

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden rounded-xl bg-white">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-white border-b-2 border-[#0d6efd]">
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-[#212529] whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600, lineHeight: '20px', letterSpacing: '0%' }}>
                    Company Name
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-[#212529] whitespace-nowrap hidden md:table-cell" style={{ fontFamily: 'Albert Sans', fontWeight: 600, lineHeight: '20px', letterSpacing: '0%' }}>
                    Address
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-[#212529] whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600, lineHeight: '20px', letterSpacing: '0%' }}>
                    Contact
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-[#212529] whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600, lineHeight: '20px', letterSpacing: '0%' }}>
                    Actions
                  </th>
                </tr>
              </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-[#0d6efd]" />
                      <span className="text-[14px] text-[#6c757d]" style={{ fontFamily: 'Albert Sans' }}>
                        Loading companies...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <span className="text-[14px] text-[#adb5bd]" style={{ fontFamily: 'Albert Sans' }}>
                      No companies found
                    </span>
                  </td>
                </tr>
              ) : (
                companies.map((company: Company) => (
                  <tr key={company.company_id} className="border-b border-[#f1f3f5] hover:bg-[#f8f9fa] transition-colors">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm text-[#212529] font-normal" style={{ fontFamily: 'Albert Sans' }}>
                        {company.company_name}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                      <span className="text-xs sm:text-sm text-[#495057]" style={{ fontFamily: 'Albert Sans' }}>
                        {company.company_address && company.company_address !== 'null' ? company.company_address : '-'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm text-[#495057]" style={{ fontFamily: 'Albert Sans' }}>
                        {formatPhone(company.company_phone)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button 
                          onClick={() => handleManageDiscounts(company)}
                          className="p-2 text-[#198754] hover:bg-[#d1e7dd] rounded-md transition-colors" 
                          title="Company Pricing"
                        >
                          <DollarSign className="h-[18px] w-[18px]" />
                        </button>
                        <button 
                          onClick={() => handleEditCompany(company)}
                          className="p-2 text-[#0d6efd] hover:bg-[#e7f1ff] rounded-md transition-colors" 
                          title="Edit"
                        >
                          <Edit className="h-[18px] w-[18px]" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCompany(company.company_id, company.company_name)}
                          disabled={deleteCompanyMutation.isPending}
                          className="p-2 text-[#dc3545] hover:bg-[#f8d7da] rounded-md transition-colors disabled:opacity-50" 
                          title="Delete"
                        >
                          <Trash2 className="h-[18px] w-[18px]" />
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
      {!isPending && companies.length > 0 && (
        <div className="no-print flex items-center justify-between mt-6 px-2">
          <p className="text-[14px] text-[#6c757d]" style={{ fontFamily: 'Albert Sans' }}>
            Showing 1-{companies.length} of {companies.length} Entries
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="border-[#dee2e6] text-[#6c757d] hover:bg-[#f8f9fa] px-4 h-9 rounded-md text-[14px]" 
              disabled
              style={{ fontFamily: 'Albert Sans', fontWeight: 500 }}
            >
              Prev
            </Button>
            <Button 
              size="sm" 
              className="bg-[#0d6efd] hover:bg-[#0b5ed7] text-white px-4 h-9 rounded-md text-[14px] min-w-[40px]"
              style={{ fontFamily: 'Albert Sans', fontWeight: 500 }}
            >
              1
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-[#dee2e6] text-[#6c757d] hover:bg-[#f8f9fa] px-4 h-9 rounded-md text-[14px]" 
              disabled
              style={{ fontFamily: 'Albert Sans', fontWeight: 500 }}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => {
        if (!open) {
          // Immediately clear errors and set closing flag to prevent validation
          setIsClosingModal(true)
          setErrors({})
          resetForm()
          setShowAddModal(false)
          // Reset flag after modal closes
          setTimeout(() => setIsClosingModal(false), 200)
        } else {
          setShowAddModal(open)
        }
      }}>
        <DialogContent 
          className="w-[95vw] sm:w-full max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto" 
          style={{ fontFamily: 'Albert Sans' }}
          onCloseClick={() => {
            // Immediately prevent validation when X button is clicked
            setIsClosingModal(true)
            setErrors({})
          }}
          onInteractOutside={(e) => {
            // Prevent validation when clicking outside
            setIsClosingModal(true)
            setErrors({})
          }}
          onEscapeKeyDown={(e) => {
            // Prevent validation when pressing Escape
            setIsClosingModal(true)
            setErrors({})
          }}
        >
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              <Plus className="h-6 w-6 text-[#0d6efd]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Add Company
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Company Name */}
            <ValidatedInput
              label="Company Name"
              placeholder="Name"
              value={companyName}
              validationRule={ValidationRules.company.company_name}
              fieldName="Company Name"
              skipValidation={isClosingModal}
              onChange={(value, isValid) => {
                setCompanyName(value)
                if (isValid) {
                  setErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.company_name
                    return newErrors
                  })
                }
              }}
              className="h-11 border-gray-300"
            />

            {/* ABN */}
            <ValidatedInput
              label="ABN"
              placeholder="Enter ABN (11 digits)"
              value={abn}
              validationRule={ValidationRules.company.company_abn}
              fieldName="ABN"
              skipValidation={isClosingModal}
              onChange={(value, isValid) => {
                setAbn(value)
                if (isValid) {
                  setErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.company_abn
                    return newErrors
                  })
                }
              }}
              className="h-11 border-gray-300"
            />

            {/* Phone */}
            <ValidatedInput
              label="Phone"
              type="tel"
              placeholder={getPhonePlaceholder()}
              value={phone}
              validationRule={ValidationRules.company.company_phone}
              fieldName="Phone"
              error={errors.company_phone}
              skipValidation={isClosingModal}
              onChange={(value, isValid) => {
                const previousValue = phone
                const formatted = formatAustralianPhone(value, previousValue)
                setPhone(formatted)
                if (isValid) {
                  setErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.company_phone
                    return newErrors
                  })
                }
              }}
              className="h-11 border-gray-300"
            />

            {/* Address */}
            <ValidatedTextarea
              label="Address"
              placeholder="Enter address"
              value={address}
              validationRule={ValidationRules.company.company_address}
              fieldName="Address"
              skipValidation={isClosingModal}
              onChange={(value) => setAddress(value)}
              rows={3}
              className="border-gray-300 resize-none"
            />

            {/* Pay Later */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <Label htmlFor="add-pay-later" className="text-sm font-medium text-gray-700">
                  Enable Pay Later
                </Label>
                <p className="text-xs text-gray-500">
                  Any customer from this company can checkout without paying.
                </p>
              </div>
              <Switch id="add-pay-later" checked={payLater} onCheckedChange={setPayLater} />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onMouseDown={(e) => {
                  // Prevent blur events from triggering validation
                  e.preventDefault()
                  setIsClosingModal(true)
                  setErrors({}) // Clear errors immediately
                }}
                onClick={(e) => {
                  e.preventDefault()
                  setIsClosingModal(true)
                  setErrors({}) // Clear errors immediately
                  resetForm()
                  setShowAddModal(false)
                  setTimeout(() => setIsClosingModal(false), 100)
                }}
                variant="outline"
                className="flex-1 border-gray-300"
                disabled={createCompanyMutation.isPending}
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveNewCompany}
                disabled={createCompanyMutation.isPending}
                className="flex-1 bg-[#0d6efd] hover:bg-[#0b5ed7] text-white"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {createCompanyMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Add'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Company Modal */}
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
        <DialogContent className="w-[95vw] sm:w-full max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto" style={{ fontFamily: 'Albert Sans' }}>
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              <Edit className="h-6 w-6 text-[#0d6efd]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Edit Company Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="editCompanyName" className="text-sm font-medium text-gray-700">
                Company Name
              </Label>
              <Input
                id="editCompanyName"
                placeholder="Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="h-11 border-gray-300"
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>

            {/* ABN */}
            <div className="space-y-2">
              <Label htmlFor="editAbn" className="text-sm font-medium text-gray-700">
                ABN
              </Label>
              <Input
                id="editAbn"
                placeholder="Enter ABN"
                value={abn}
                onChange={(e) => setAbn(e.target.value)}
                className="h-11 border-gray-300"
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="editPhone" className="text-sm font-medium text-gray-700">
                Phone
              </Label>
              <Input
                id="editPhone"
                placeholder="Enter number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 border-gray-300"
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="editAddress" className="text-sm font-medium text-gray-700">
                Address
              </Label>
              <Textarea
                id="editAddress"
                placeholder="Enter address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="border-gray-300 resize-none"
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>

            {/* Pay Later */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <Label htmlFor="edit-pay-later" className="text-sm font-medium text-gray-700">
                  Enable Pay Later
                </Label>
                <p className="text-xs text-gray-500">
                  Any customer from this company can checkout without paying.
                </p>
              </div>
              <Switch id="edit-pay-later" checked={payLater} onCheckedChange={setPayLater} />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowEditModal(false)
                  resetForm()
                }}
                variant="outline"
                className="flex-1 border-gray-300"
                disabled={updateCompanyMutation.isPending}
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                Close
              </Button>
              <Button
                onClick={handleUpdateCompany}
                disabled={updateCompanyMutation.isPending}
                className="flex-1 bg-[#0d6efd] hover:bg-[#0b5ed7] text-white"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {updateCompanyMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
      </div>
        </DialogContent>
      </Dialog>

      {/* Company Pricing (Discounts) Modal */}
      <Dialog open={showDiscountModal} onOpenChange={(open) => {
        setShowDiscountModal(open)
        if (!open) setSelectedCompany(null)
      }}>
        <DialogContent className="w-[95vw] sm:w-full max-w-5xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto" style={{ fontFamily: 'Albert Sans' }}>
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto mb-4">
              <DollarSign className="h-6 w-6 text-[#198754]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Company Pricing{selectedCompany ? ` — ${selectedCompany.company_name}` : ''}
            </DialogTitle>
          </DialogHeader>
          {selectedCompany && (
            <CompanyProductOptionDiscountsContent
              companyId={selectedCompany.company_id}
              onClose={() => {
                setShowDiscountModal(false)
                setSelectedCompany(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>        <DialogContent className="w-[95vw] sm:w-full max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto" style={{ fontFamily: 'Albert Sans' }}>
          <DialogHeader>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-[#dc3545]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold text-gray-900">
              Delete Company
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-center text-[14px] text-[#6c757d]" style={{ fontFamily: 'Albert Sans' }}>
              Are you sure you want to delete <span className="font-semibold text-gray-900">"{companyToDelete?.name}"</span>?
            </p>
            <p className="text-center text-[13px] text-[#dc3545]" style={{ fontFamily: 'Albert Sans' }}>
              This action cannot be undone.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowDeleteModal(false)
                  setCompanyToDelete(null)
                }}
                variant="outline"
                className="flex-1 border-[#dee2e6] hover:bg-[#f8f9fa]"
                disabled={deleteCompanyMutation.isPending}
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={deleteCompanyMutation.isPending}
                className="flex-1 bg-[#dc3545] hover:bg-[#c82333] text-white"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {deleteCompanyMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Company-level pricing editor (mirrors the customer-level discount editor)
// ---------------------------------------------------------------------------

interface CompanyProductOptionDiscountsContentProps {
  companyId?: number
  onClose: () => void
}

interface CompanyProductOption {
  product_option_id: number
  option_value_id: number
  option_value_name: string
  option_base_price?: number
  option_price: number
  option_price_prefix: string
  discount_percentage: number
  company_product_option_discount_id?: number
}

interface CompanyProductWithOptions {
  product_id: number
  product_name: string
  options?: CompanyProductOption[]
  has_options?: boolean
  product_price?: number
  discount_percentage?: number
  company_product_discount_id?: number
}

function CompanyProductOptionDiscountsContent({
  companyId,
  onClose,
}: CompanyProductOptionDiscountsContentProps) {
  const queryClient = useQueryClient()
  const [localDiscounts, setLocalDiscounts] = useState<Record<string, number>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const { data: discountsData, isLoading, error } = useQuery({
    queryKey: ["company-product-option-discounts", companyId],
    queryFn: async () => {
      if (!companyId) return null
      const response = await companiesAPI.getProductOptionDiscounts(companyId)
      return response.data
    },
    enabled: !!companyId,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  })

  useEffect(() => {
    if (discountsData?.products) {
      const initialDiscounts: Record<string, number> = {}
      discountsData.products.forEach((product: CompanyProductWithOptions) => {
        if (product.has_options && product.options && product.options.length > 0) {
          product.options.forEach((option: CompanyProductOption) => {
            const key = `${product.product_id}_${option.option_value_id}`
            initialDiscounts[key] = option.discount_percentage || 0
          })
        } else {
          const key = `product_${product.product_id}`
          initialDiscounts[key] = product.discount_percentage || 0
        }
      })
      setLocalDiscounts(initialDiscounts)
    }
  }, [discountsData])

  const saveMutation = useMutation({
    mutationFn: async (discountsToSave: Record<string, number>) => {
      if (!companyId) return
      const discountsArray = Object.entries(discountsToSave)
        .filter(([_, value]) => value > 0)
        .map(([key, value]) => {
          if (key.startsWith("product_")) {
            const product_id = parseInt(key.replace("product_", ""))
            return {
              product_id,
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
      console.error("Save company discounts error:", err)
      toast.error(err.response?.data?.message || "Failed to save company pricing")
      setIsSaving(false)
    },
  })

  const handleDiscountChange = (productId: number, optionValueId: number | null, value: string) => {
    const key = optionValueId !== null ? `${productId}_${optionValueId}` : `product_${productId}`
    const numValue = parseFloat(value) || 0
    const clampedValue = Math.max(0, Math.min(100, numValue))
    setLocalDiscounts((prev) => ({ ...prev, [key]: clampedValue }))
  }

  const handleSave = () => {
    setIsSaving(true)
    saveMutation.mutate(localDiscounts)
  }

  const filteredProducts = useMemo(() => {
    if (!discountsData?.products) return []
    const query = searchQuery.toLowerCase()
    return discountsData.products.filter((product: CompanyProductWithOptions) => {
      if (product.product_name.toLowerCase().includes(query)) return true
      if (product.has_options && product.options) {
        return product.options.some((option: CompanyProductOption) =>
          option.option_value_name.toLowerCase().includes(query)
        )
      }
      return false
    })
  }, [discountsData, searchQuery])

  if (!companyId) {
    return <div className="text-center py-8 text-gray-500">No company selected</div>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading products and pricing...</span>
      </div>
    )
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-2 font-semibold">Error loading company pricing</p>
        <p className="text-sm text-gray-600 mb-4">{errorMessage}</p>
        <Button onClick={onClose} variant="outline">Close</Button>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Input
          placeholder="Search products or options..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
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

      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? "No products found matching your search" : "No products available"}
          </div>
        ) : (
          filteredProducts.map((product: CompanyProductWithOptions) => {
            const hasOptions = product.has_options && product.options && product.options.length > 0
            return (
              <Card key={product.product_id} className="p-4">
                <h3 className="font-semibold text-lg mb-3 text-gray-900">{product.product_name}</h3>
                {hasOptions ? (
                  <div className="space-y-3">
                    {product.options!.map((option: CompanyProductOption) => {
                      const key = `${product.product_id}_${option.option_value_id}`
                      const discountValue = localDiscounts[key] || 0
                      const basePrice = option.option_base_price || option.option_price
                      const finalPrice = discountValue > 0 ? basePrice * (1 - discountValue / 100) : basePrice
                      return (
                        <div key={option.option_value_id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{option.option_value_name}</div>
                            <div className="text-sm text-gray-600">
                              {discountValue > 0 ? (
                                <>
                                  <span className="line-through text-gray-500">
                                    Price: {option.option_price_prefix}${basePrice.toFixed(2)}
                                  </span>
                                  <span className="ml-2 text-green-600 font-semibold">
                                    → {option.option_price_prefix}${finalPrice.toFixed(2)} ({discountValue}% off)
                                  </span>
                                </>
                              ) : (
                                <span>Price: {option.option_price_prefix}${basePrice.toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={discountValue}
                              onChange={(e) => handleDiscountChange(product.product_id, option.option_value_id, e.target.value)}
                              className="w-24 text-right"
                              placeholder="0"
                            />
                            <span className="text-sm text-gray-600 w-8">%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Product Price</div>
                      <div className="text-sm text-gray-600">
                        {(() => {
                          const key = `product_${product.product_id}`
                          const discountValue = localDiscounts[key] || 0
                          const basePrice = product.product_price || 0
                          const finalPrice = discountValue > 0 ? basePrice * (1 - discountValue / 100) : basePrice
                          return discountValue > 0 ? (
                            <>
                              <span className="line-through text-gray-500">Price: ${basePrice.toFixed(2)}</span>
                              <span className="ml-2 text-green-600 font-semibold">
                                → ${finalPrice.toFixed(2)} ({discountValue}% off)
                              </span>
                            </>
                          ) : (
                            <span>Price: ${basePrice.toFixed(2)}</span>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={localDiscounts[`product_${product.product_id}`] || 0}
                        onChange={(e) => handleDiscountChange(product.product_id, null, e.target.value)}
                        className="w-24 text-right"
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-600 w-8">%</span>
                    </div>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t">
        <Button onClick={onClose} variant="outline" className="flex-1 border-gray-300" style={{ fontFamily: "Albert Sans", fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || saveMutation.isPending}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
        >
          {isSaving || saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save Company Pricing"
          )}
        </Button>
      </div>
    </div>
  )
}
