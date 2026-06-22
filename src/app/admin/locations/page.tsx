"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ValidatedInput } from "@/components/ui/validated-input"
import { ValidatedTextarea } from "@/components/ui/validated-textarea"
import { ValidationRules } from "@/lib/validation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Printer, Plus, MapPin, Edit, Trash2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { validateRequired, validateEmail, validateAustralianPhone, validateABN, validateAustralianPostcode } from "@/lib/validations"
import { formatAustralianPhone, cleanPhoneNumber, getPhonePlaceholder, getPhoneValidationError } from "@/lib/phone-mask"
import { printTableData } from "@/lib/print-utils"

interface Location {
  location_id: number
  location_name: string
  remittance_email: string
  account_name: string
  account_number: string
  contact: string
  abn: string
  company_name: string
  bsb: string
  pickup_address: string
  post_codes?: string
  location_status?: number
}

export default function LocationsPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  
  // Form state
  const [locationName, setLocationName] = useState("")
  const [remittanceEmail, setRemittanceEmail] = useState("")
  const [accountName, setAccountName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [abn, setAbn] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [bsb, setBsb] = useState("")
  const [pickupAddress, setPickupAddress] = useState("")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Fetch locations
  const { data: locationsData, isLoading } = useQuery({
    queryKey: ["locations", searchQuery, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      params.append("limit", itemsPerPage.toString())
      params.append("offset", ((currentPage - 1) * itemsPerPage).toString())
      const response = await api.get(`/admin/locations?${params.toString()}`)
      return response.data
    },
  })

  const locations = locationsData?.locations || []
  const totalCount = locationsData?.count || 0
  const totalPages = Math.ceil(totalCount / itemsPerPage)

  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: async (locationData: Partial<Location>) => {
      const response = await api.post("/admin/locations", locationData)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] })
      toast.success("Location created successfully!")
      setShowAddModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create location")
    },
  })

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, ...locationData }: Partial<Location> & { id: number }) => {
      const response = await api.put(`/admin/locations/${id}`, locationData)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] })
      toast.success("Location updated successfully!")
      setShowEditModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update location")
    },
  })

  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/admin/locations/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] })
      toast.success("Location deleted successfully!")
      setShowDeleteModal(false)
      setSelectedLocationId(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete location")
    },
  })

  const handleAddLocation = () => {
    resetForm()
    setShowAddModal(true)
  }

  const handleEditLocation = (location: Location) => {
    setSelectedLocation(location)
    setLocationName(location.location_name)
    setRemittanceEmail(location.remittance_email || "")
    setAccountName(location.account_name || "")
    setAccountNumber(location.account_number || "")
    setContactNumber(location.contact || "")
    setAbn(location.abn || "")
    setCompanyName(location.company_name || "")
    setBsb(location.bsb || "")
    setPickupAddress(location.pickup_address || "")
    setShowEditModal(true)
  }

  const handleDeleteLocation = (location: Location) => {
    setSelectedLocationId(location.location_id)
    setSelectedLocation(location)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = () => {
    if (selectedLocationId) {
      deleteLocationMutation.mutate(selectedLocationId)
    }
  }

  // Validation errors state
  const [errors, setErrors] = useState<{
    location_name?: string
    remittance_email?: string
    account_name?: string
    account_number?: string
    contact?: string
    abn?: string
    bsb?: string
    pickup_address?: string
  }>({})

  const handleSaveLocation = () => {
    const newErrors: typeof errors = {}
    
    // Validate location name (required, max 255 chars per DB schema)
    const nameValidation = validateRequired(locationName, "Location name", 255)
    if (!nameValidation.valid) {
      newErrors.location_name = nameValidation.error || "Location name is required"
    }
    
    // Validate remittance email (optional, max 255 chars, must be valid format)
    if (remittanceEmail && remittanceEmail.trim() !== '') {
      const emailValidation = validateEmail(remittanceEmail, 255)
      if (!emailValidation.valid) {
        newErrors.remittance_email = emailValidation.error || "Please enter a valid email address"
      }
    }
    
    // Validate account name (optional, max 1000 chars per DB schema)
    if (accountName && accountName.length > 1000) {
      newErrors.account_name = "Account name must be 1000 characters or less"
    }
    
    // Validate account number (optional, max 1000 chars per DB schema)
    if (accountNumber && accountNumber.length > 1000) {
      newErrors.account_number = "Account number must be 1000 characters or less"
    }
    
    // Validate contact number (optional, Australian format, max 15 chars)
    if (contactNumber && contactNumber.trim() !== '') {
      const phoneValidation = validateAustralianPhone(contactNumber)
      if (!phoneValidation.valid) {
        newErrors.contact = phoneValidation.error || "Please enter a valid Australian phone number"
      }
    }
    
    // Validate ABN (optional, 11 digits)
    if (abn && abn.trim() !== '') {
      const abnValidation = validateABN(abn)
      if (!abnValidation.valid) {
        newErrors.abn = abnValidation.error || "Please enter a valid ABN"
      }
    }
    
    // Validate BSB (optional, Australian BSB format: 6 digits, format XXX-XXX)
    if (bsb && bsb.trim() !== '') {
      const cleanedBSB = bsb.replaceAll(/[\s\-]/g, '')
      if (cleanedBSB.length !== 6) {
        newErrors.bsb = "BSB must be 6 digits (e.g., 123-456)"
      } else if (!/^\d{6}$/.test(cleanedBSB)) {
        newErrors.bsb = "BSB must contain only digits"
      } else if (bsb.length > 100) {
        newErrors.bsb = "BSB must be 100 characters or less"
      }
    }
    
    // Validate pickup address (optional, TEXT field - reasonable limit)
    if (pickupAddress && pickupAddress.length > 1000) {
      newErrors.pickup_address = "Pickup address must be 1000 characters or less"
    }
    
    setErrors(newErrors)
    
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0]
      if (firstError) toast.error(firstError)
      return
    }

    const locationData = {
      location_name: locationName.trim(),
      remittance_email: remittanceEmail.trim() || undefined,
      account_name: accountName.trim() || undefined,
      account_number: accountNumber.trim() || undefined,
      contact: cleanPhoneNumber(contactNumber) || undefined,
      abn: abn.trim() || undefined,
      company_name: companyName.trim() || undefined,
      bsb: bsb.trim() || undefined,
      pickup_address: pickupAddress.trim() || undefined,
      location_status: 1
    }

    if (selectedLocation) {
      updateLocationMutation.mutate({
        id: selectedLocation.location_id,
        ...locationData
      })
    } else {
      createLocationMutation.mutate(locationData)
    }
  }

  const resetForm = () => {
    setLocationName("")
    setRemittanceEmail("")
    setAccountName("")
    setAccountNumber("")
    setContactNumber("")
    setAbn("")
    setCompanyName("")
    setBsb("")
    setPickupAddress("")
    setSelectedLocation(null)
    setErrors({}) // Clear all validation errors
  }

  return (
    <div className="bg-gray-50 min-h-screen" style={{ fontFamily: 'Albert Sans' }}>
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
          Locations
        </h1>
        <Button 
          onClick={handleAddLocation}
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
          Add New Location
        </Button>
      </div>

      {/* Search and Print */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
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
          onClick={() => printTableData("Locations")}
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

      {/* Table */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#105a9c] border-b border-[#0d4a82] text-white">
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Location Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Remittance email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Account Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Account Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  ABN
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Company Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  BSB
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Pickup Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-500">Loading locations...</td>
                </tr>
              ) : locations.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-500">No locations found.</td>
                </tr>
              ) : (
                locations.map((location: any) => (
                  <tr key={location.location_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="text-xs text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                          {location.location_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        {location.remittance_email || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        {location.account_name || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        {location.account_number || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        {location.contact || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        {location.abn || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        {location.company_name || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        {location.bsb || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        {location.pickup_address || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditLocation(location)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(location)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
          Showing {locations.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}-{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} Entries
        </p>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="border-gray-300 bg-white"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </Button>
          <Button 
            size="sm" 
            className="bg-[#105a9c] hover:bg-[#0d4a82] text-white"
          >
            {currentPage}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-gray-300 bg-white"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Add Location Modal */}
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
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              <Plus className="h-6 w-6 text-[#105a9c]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Add New Location
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Location Name */}
            <ValidatedInput
              label="Location Name"
              placeholder="Enter Location Name"
              value={locationName}
              validationRule={ValidationRules.location.location_name}
              fieldName="Location Name"
              error={errors.location_name}
              onChange={(value, isValid) => {
                setLocationName(value)
                if (isValid) {
                  setErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.location_name
                    return newErrors
                  })
                }
              }}
              className="h-11 border-gray-300 bg-white"
            />

            {/* Remittance Email */}
            <ValidatedInput
              label="Remittance Email"
              type="email"
              placeholder="Email Address"
              value={remittanceEmail}
              validationRule={{ type: 'email' as const, maxLength: 255 }}
              fieldName="Remittance Email"
              error={errors.remittance_email}
              onChange={(value, isValid) => {
                setRemittanceEmail(value)
                if (isValid) {
                  setErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.remittance_email
                    return newErrors
                  })
                }
              }}
              className="h-11 border-gray-300 bg-white"
            />

            {/* Account Name and Number */}
            <div className="grid grid-cols-2 gap-4">
              <ValidatedInput
                label="Account Name"
                placeholder="Enter Full Name"
                value={accountName}
                validationRule={ValidationRules.user.account_name}
                fieldName="Account Name"
                onChange={(value) => setAccountName(value)}
                className="h-11 border-gray-300 bg-white"
              />
              <ValidatedInput
                label="Account Number"
                placeholder="Enter Number"
                value={accountNumber}
                validationRule={ValidationRules.user.account_number}
                fieldName="Account Number"
                onChange={(value) => setAccountNumber(value)}
                className="h-11 border-gray-300 bg-white"
              />
            </div>

            {/* Contact and ABN */}
            <div className="grid grid-cols-2 gap-4">
              <ValidatedInput
                label="Contact Number"
                type="tel"
                placeholder={getPhonePlaceholder()}
                value={contactNumber}
                validationRule={{ type: 'phone' as const, maxLength: 15 }}
                fieldName="Contact Number"
                error={errors.contact}
                onChange={(value, isValid) => {
                  const previousValue = contactNumber
                  const formatted = formatAustralianPhone(value, previousValue)
                  setContactNumber(formatted)
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.contact
                      return newErrors
                    })
                  }
                }}
                className="h-11 border-gray-300 bg-white"
              />
              <ValidatedInput
                label="ABN"
                placeholder="Enter ABN (11 digits)"
                value={abn}
                validationRule={ValidationRules.company.company_abn}
                fieldName="ABN"
                error={errors.abn}
                onChange={(value, isValid) => {
                  setAbn(value)
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.abn
                      return newErrors
                    })
                  }
                }}
                className="h-11 border-gray-300 bg-white"
              />
            </div>

            {/* Company Name and BSB */}
            <div className="grid grid-cols-2 gap-4">
              <ValidatedInput
                label="Company Name"
                placeholder="Enter Name"
                value={companyName}
                validationRule={{ maxLength: 500 }}
                fieldName="Company Name"
                onChange={(value) => setCompanyName(value)}
                className="h-11 border-gray-300 bg-white"
              />
              <ValidatedInput
                label="BSB"
                placeholder="Enter BSB"
                value={bsb}
                validationRule={ValidationRules.user.bsb}
                fieldName="BSB"
                error={errors.bsb}
                onChange={(value, isValid) => {
                  setBsb(value)
                  if (isValid) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.bsb
                      return newErrors
                    })
                  }
                }}
                className="h-11 border-gray-300 bg-white"
              />
            </div>

            {/* Pickup Address */}
            <ValidatedTextarea
              label="Pick Up Address"
              placeholder="Enter Address"
              value={pickupAddress}
              validationRule={{ type: 'text' as const, maxLength: 1000 }}
              fieldName="Pick Up Address"
              error={errors.pickup_address}
              onChange={(value, isValid) => {
                setPickupAddress(value)
                if (isValid) {
                  setErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.pickup_address
                    return newErrors
                  })
                }
              }}
              rows={3}
              className="border-gray-300 resize-none bg-white"
            />

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                variant="outline"
                className="flex-1 border-gray-300 bg-white"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveLocation}
                disabled={!locationName || createLocationMutation.isPending}
                className="flex-1 bg-[#105a9c] hover:bg-[#0d4a82] text-white disabled:opacity-50"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {createLocationMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Location Modal */}
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
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              <Edit className="h-6 w-6 text-[#105a9c]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Edit Location Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Location Name */}
            <div className="space-y-2">
              <Label htmlFor="editLocationName" className="text-sm font-medium text-gray-700">
                Location Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="editLocationName"
                placeholder="Enter Location Name"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="h-11 border-gray-300 bg-white"
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>

            {/* Remittance Email */}
            <div className="space-y-2">
              <Label htmlFor="editRemittanceEmail" className="text-sm font-medium text-gray-700">
                Remittance Email
              </Label>
              <Input
                id="editRemittanceEmail"
                type="email"
                placeholder="Email Address"
                value={remittanceEmail}
                onChange={(e) => setRemittanceEmail(e.target.value)}
                className="h-11 border-gray-300 bg-white"
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>

            {/* Account Name and Number */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editAccountName" className="text-sm font-medium text-gray-700">
                  Account Name
                </Label>
                <Input
                  id="editAccountName"
                  placeholder="Enter Full Name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="h-11 border-gray-300 bg-white"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editAccountNumber" className="text-sm font-medium text-gray-700">
                  Account Number
                </Label>
                <Input
                  id="editAccountNumber"
                  placeholder="Enter Number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="h-11 border-gray-300 bg-white"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
            </div>

            {/* Contact and ABN */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editContactNumber" className="text-sm font-medium text-gray-700">
                  Contact Number
                </Label>
                <Input
                  id="editContactNumber"
                  placeholder="Enter number"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="h-11 border-gray-300 bg-white"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editAbn" className="text-sm font-medium text-gray-700">
                  ABN
                </Label>
                <Input
                  id="editAbn"
                  placeholder="Enter ABN"
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  className="h-11 border-gray-300 bg-white"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
            </div>

            {/* Company Name and BSB */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editCompanyName" className="text-sm font-medium text-gray-700">
                  Company Name
                </Label>
                <Input
                  id="editCompanyName"
                  placeholder="Enter Name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-11 border-gray-300 bg-white"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editBsb" className="text-sm font-medium text-gray-700">
                  BSB
                </Label>
                <Input
                  id="editBsb"
                  placeholder="Enter BSB"
                  value={bsb}
                  onChange={(e) => setBsb(e.target.value)}
                  className="h-11 border-gray-300 bg-white"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
            </div>

            {/* Pickup Address */}
            <div className="space-y-2">
              <Label htmlFor="editPickupAddress" className="text-sm font-medium text-gray-700">
                Pick Up Address
              </Label>
              <Textarea
                id="editPickupAddress"
                placeholder="Enter Address"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                rows={3}
                className="border-gray-300 resize-none bg-white"
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowEditModal(false)
                  resetForm()
                }}
                variant="outline"
                className="flex-1 border-gray-300 bg-white"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveLocation}
                disabled={!locationName || updateLocationMutation.isPending}
                className="flex-1 bg-[#105a9c] hover:bg-[#0d4a82] text-white disabled:opacity-50"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {updateLocationMutation.isPending ? "Updating..." : "Update"}
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
              Delete Location
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Albert Sans' }}>
                  Are you sure you want to permanently delete this location? This action cannot be undone.
                </p>
                <p className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  {selectedLocation?.location_name}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false)
                setSelectedLocationId(null)
                setSelectedLocation(null)
              }}
              className="border-gray-300"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleteLocationMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              {deleteLocationMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
