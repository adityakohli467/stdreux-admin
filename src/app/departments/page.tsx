"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { companiesAPI } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ValidatedInput } from "@/components/ui/validated-input"
import { ValidatedTextarea } from "@/components/ui/validated-textarea"
import { ValidationRules } from "@/lib/validation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Printer, Plus, Edit, Trash2, Loader2, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { validateRequired } from "@/lib/validations"
import { printTableData } from "@/lib/print-utils"

interface Department {
  department_id: number
  department_name: string
  company_name: string
  company_id: number
  department_comments?: string
}

const sampleDepartments: Department[] = [
  { department_id: 1, department_name: "Human Resources", company_name: "Airtel", company_id: 1 },
  { department_id: 2, department_name: "Customer Servive", company_name: "Vodafone", company_id: 2 },
  { department_id: 3, department_name: "Sales", company_name: "Antimatter Collective", company_id: 3 },
  { department_id: 4, department_name: "Human Resources", company_name: "HCL", company_id: 4 },
  { department_id: 5, department_name: "Human Resources", company_name: "Swiggy", company_id: 5 },
  { department_id: 6, department_name: "Customer Servive", company_name: "Microsoft", company_id: 6 },
  { department_id: 7, department_name: "Customer Servive", company_name: "Accenture", company_id: 7 },
  { department_id: 8, department_name: "Customer Servive", company_name: "Zenn", company_id: 8 },
]

const sampleCompanies = [
  { company_id: 1, company_name: "Airtel" },
  { company_id: 2, company_name: "Vodafone" },
  { company_id: 3, company_name: "Antimatter Collective" },
  { company_id: 4, company_name: "HCL" },
  { company_id: 5, company_name: "Swiggy" },
  { company_id: 6, company_name: "Microsoft" },
  { company_id: 7, company_name: "Accenture" },
  { company_id: 8, company_name: "Zenn" },
]

export default function DepartmentsPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("Departments")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [departmentToDelete, setDepartmentToDelete] = useState<{ id: number, name: string } | null>(null)
  const [isClosingModal, setIsClosingModal] = useState(false)
  
  // Form state
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [departmentName, setDepartmentName] = useState("")
  const [comments, setComments] = useState("")

  // Fetch companies from API
  const { data: companiesData, isPending: loadingCompanies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const response = await companiesAPI.list()
      return response.data
    }
  })

  // Fetch departments from API
  const { data: departmentsData, isPending: loadingDepartments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await companiesAPI.getDepartments()
      return response.data
    }
  })

  const companies = companiesData?.companies || []
  const allDepartments = departmentsData?.departments || []

  // Frontend search across all fields
  const departments = useMemo(() => {
    if (!searchQuery.trim()) return allDepartments

    const query = searchQuery.toLowerCase()
    return allDepartments.filter((department: Department) => {
      return (
        department.department_name?.toLowerCase().includes(query) ||
        department.company_name?.toLowerCase().includes(query)
      )
    })
  }, [allDepartments, searchQuery])

  const handleAddDepartment = () => {
    resetForm()
    setShowAddModal(true)
  }

  const handleEditDepartment = (department: Department) => {
    setSelectedDepartment(department)
    setSelectedCompanyId(department.company_id.toString())
    setDepartmentName(department.department_name)
    setComments(department.department_comments || "")
    setShowEditModal(true)
  }

  // Create department mutation
  const createDepartmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await companiesAPI.createDepartment(data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast.success("Department added successfully!")
      setShowAddModal(false)
      resetForm()
    },
    onError: (error: any) => {
      console.error("Error creating department:", error)
      const errorMessage = error.response?.data?.message || error.message || "Failed to add department"
      toast.error(errorMessage)
    }
  })

  // Update department mutation
  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const response = await companiesAPI.updateDepartment(id, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast.success("Department updated successfully!")
      setShowEditModal(false)
      resetForm()
    },
    onError: (error: any) => {
      console.error("Error updating department:", error)
      const errorMessage = error.response?.data?.message || error.message || "Failed to update department"
      toast.error(errorMessage)
    }
  })

  // Validation errors state
  const [errors, setErrors] = useState<{
    company_id?: string
    department_name?: string
    department_comments?: string
  }>({})

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}
    
    // Validate company selection (required)
    if (!selectedCompanyId || selectedCompanyId === '') {
      newErrors.company_id = "Please select a company"
    }
    
    // Validate department name (required, max 255 chars per DB schema)
    const nameValidation = validateRequired(departmentName, "Department name", 255)
    if (!nameValidation.valid) {
      newErrors.department_name = nameValidation.error || "Department name is required"
    }
    
    // Validate comments (optional, TEXT field - reasonable limit)
    if (comments && comments.length > 5000) {
      newErrors.department_comments = "Comments must be 5000 characters or less"
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

  const handleSaveNewDepartment = () => {
    // Clear previous errors
    setErrors({})
    
    // Validate form
    if (!validateForm()) return
    
    // Ensure we have valid values
    if (!selectedCompanyId || !departmentName.trim()) {
      toast.error("Please fill in all required fields")
      return
    }
    
    createDepartmentMutation.mutate({
      department_name: departmentName.trim(),
      company_id: parseInt(selectedCompanyId),
      comments: comments.trim() || null
    })
  }

  const handleUpdateDepartment = () => {
    // Clear previous errors
    setErrors({})
    
    // Validate form
    if (!validateForm()) return
    
    if (!selectedDepartment) {
      toast.error("Department not selected")
      return
    }
    
    // Ensure we have valid values
    if (!selectedCompanyId || !departmentName.trim()) {
      toast.error("Please fill in all required fields")
      return
    }
    
    updateDepartmentMutation.mutate({
      id: selectedDepartment.department_id,
      data: {
        department_name: departmentName.trim(),
        company_id: parseInt(selectedCompanyId),
        comments: comments.trim() || null
      }
    })
  }

  const handleDeleteDepartment = (departmentId: number, departmentName: string) => {
    setDepartmentToDelete({ id: departmentId, name: departmentName })
    setShowDeleteModal(true)
  }

  // Delete department mutation
  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await companiesAPI.deleteDepartment(id)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast.success("Department deleted successfully!")
      setShowDeleteModal(false)
      setDepartmentToDelete(null)
    },
    onError: (error: any) => {
      console.error("Error deleting department:", error)
      const errorMessage = error.response?.data?.message || error.message || "Failed to delete department"
      toast.error(errorMessage)
    }
  })

  const confirmDelete = () => {
    if (departmentToDelete) {
      deleteDepartmentMutation.mutate(departmentToDelete.id)
    }
  }

  const handlePrint = () => {
    printTableData("Departments")
  }

  const resetForm = () => {
    setSelectedCompanyId("")
    setDepartmentName("")
    setComments("")
    setSelectedDepartment(null)
    setErrors({}) // Clear all validation errors
  }

  return (
    <div className="bg-[#f8f9fa] min-h-screen overflow-x-hidden" style={{ fontFamily: 'Albert Sans' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <h1 className="text-[#1a1a1a] text-2xl sm:text-3xl lg:text-4xl" style={{ 
          fontFamily: 'Albert Sans',
          fontWeight: 600,
          fontStyle: 'normal',
          lineHeight: '1.2',
          letterSpacing: '0%'
        }}>
          Departments
        </h1>
        <Button 
          onClick={handleAddDepartment}
          className="no-print bg-[#105a9c] hover:bg-[#0d4a82] text-white whitespace-nowrap w-full sm:w-auto"
          style={{ 
            fontWeight: 600,
            minWidth: '196px',
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
          Add New Department
        </Button>
      </div>

      {/* Tabs */}
      <div className="no-print flex gap-2 sm:gap-3 mb-6 flex-wrap">
        <Link href="/companies" className="flex-1 sm:flex-initial">
          <button
            className="w-full sm:w-auto px-6 sm:px-10 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm lg:text-[15px] font-medium transition-all bg-white text-[#6c757d] border-2 border-[#e9ecef] hover:border-[#dee2e6]"
            style={{ fontFamily: 'Albert Sans', fontWeight: 500 }}
          >
            Companies
          </button>
        </Link>
        <Link href="/departments" className="flex-1 sm:flex-initial">
          <button
            className={`w-full sm:w-auto px-6 sm:px-10 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm lg:text-[15px] font-medium transition-all ${
              activeTab === "Departments"
                ? "bg-[#e7f1ff] text-[#105a9c] border-2 border-[#105a9c]"
                : "bg-white text-[#6c757d] border-2 border-[#e9ecef] hover:border-[#dee2e6]"
            }`}
            style={{ fontFamily: 'Albert Sans', fontWeight: 500 }}
          >
            Departments
          </button>
        </Link>
      </div>

      {/* Search and Print */}
      <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search departments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-[488px] h-[54px] border border-gray-200 bg-white rounded-full focus:ring-2 focus:ring-[#105a9c] focus:border-[#105a9c] focus:outline-none"
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
      <Card className="border-0 shadow-sm overflow-hidden rounded-xl bg-white">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="bg-white border-b-2 border-[#105a9c]">
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-[#212529] whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600, lineHeight: '20px', letterSpacing: '0%' }}>
                    Department Name
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-[#212529] whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600, lineHeight: '20px', letterSpacing: '0%' }}>
                    Company Name
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-[#212529] whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600, lineHeight: '20px', letterSpacing: '0%' }}>
                    Actions
                  </th>
                </tr>
              </thead>
            <tbody>
              {loadingDepartments ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-[#105a9c]" />
                      <span className="text-[14px] text-[#6c757d]" style={{ fontFamily: 'Albert Sans' }}>
                        Loading departments...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center">
                    <span className="text-[14px] text-[#adb5bd]" style={{ fontFamily: 'Albert Sans' }}>
                      No departments found
                    </span>
                  </td>
                </tr>
              ) : (
                departments.map((department: Department, index: number) => (
                  <tr key={index} className="border-b border-[#f1f3f5] hover:bg-[#f8f9fa] transition-colors">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm text-[#212529] font-normal" style={{ fontFamily: 'Albert Sans' }}>
                        {department.department_name}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm text-[#495057]" style={{ fontFamily: 'Albert Sans' }}>
                        {department.company_name}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button 
                          onClick={() => handleEditDepartment(department)}
                          className="p-2 text-[#105a9c] hover:bg-[#e7f1ff] rounded-md transition-colors" 
                          title="Edit"
                        >
                          <Edit className="h-[18px] w-[18px]" />
                        </button>
                        <button 
                          onClick={() => handleDeleteDepartment(department.department_id, department.department_name)}
                          disabled={deleteDepartmentMutation.isPending}
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
      {!loadingDepartments && departments.length > 0 && (
        <div className="no-print flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 px-2">
          <p className="text-xs sm:text-sm text-[#6c757d]" style={{ fontFamily: 'Albert Sans' }}>
            Showing 1-{departments.length} of {departments.length} Entries
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
              className="bg-[#105a9c] hover:bg-[#0d4a82] text-white px-4 h-9 rounded-md text-[14px] min-w-[40px]"
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

      {/* Add Department Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => {
        if (!open) {
          setIsClosingModal(true)
          setErrors({})
          resetForm()
          setShowAddModal(false)
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
            setIsClosingModal(true)
            setErrors({})
          }}
          onEscapeKeyDown={(e) => {
            setIsClosingModal(true)
            setErrors({})
          }}
        >
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              <Plus className="h-6 w-6 text-[#105a9c]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Add Departments
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Select Company */}
            <div className="space-y-2">
              <Label htmlFor="selectCompany" className="text-sm font-medium text-gray-700">
                Select Company <span className="text-red-500">*</span>
              </Label>
              {loadingCompanies ? (
                <div className="w-full h-11 rounded-md border border-gray-300 bg-white px-3 py-2 flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-gray-500">Loading companies...</span>
                </div>
              ) : (
                <>
                  <select
                    id="selectCompany"
                    value={selectedCompanyId}
                    onChange={(e) => {
                      setSelectedCompanyId(e.target.value)
                      if (errors.company_id) {
                        setErrors({ ...errors, company_id: undefined })
                      }
                    }}
                    className={`w-full h-11 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#105a9c] ${
                      errors.company_id ? 'border-red-500' : 'border-gray-300'
                    } bg-white`}
                    style={{ fontFamily: 'Albert Sans' }}
                  >
                    <option value="">Select</option>
                    {companies.map((company: any) => (
                      <option key={company.company_id} value={company.company_id}>
                        {company.company_name}
                      </option>
                    ))}
                  </select>
                  {errors.company_id && (
                    <p className="text-sm text-red-600">{errors.company_id}</p>
                  )}
                </>
              )}
            </div>

            {/* Department Name */}
            <div className="space-y-2">
              <Label htmlFor="departmentName" className="text-sm font-medium text-gray-700">
                Department Name
              </Label>
              <ValidatedInput
                id="departmentName"
                label=""
                placeholder="Name"
                value={departmentName}
                validationRule={ValidationRules.department.department_name}
                fieldName="Department Name"
                skipValidation={isClosingModal}
                onChange={(value) => setDepartmentName(value)}
                className="h-11 border-gray-300"
              />
              {errors.department_name && (
                <p className="text-sm text-red-600">{errors.department_name}</p>
              )}
            </div>

            {/* Comments */}
            <ValidatedTextarea
              label="Comments"
              placeholder="Enter comments"
              value={comments}
              validationRule={ValidationRules.department.department_comments}
              fieldName="Comments"
              skipValidation={isClosingModal}
              onChange={(value) => setComments(value)}
              rows={3}
              className="border-gray-300 resize-none"
            />

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsClosingModal(true)
                  setErrors({})
                }}
                onClick={(e) => {
                  e.preventDefault()
                  setIsClosingModal(true)
                  setErrors({})
                  resetForm()
                  setShowAddModal(false)
                  setTimeout(() => setIsClosingModal(false), 100)
                }}
                variant="outline"
                className="flex-1 border-gray-300"
                disabled={createDepartmentMutation.isPending}
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveNewDepartment}
                disabled={createDepartmentMutation.isPending || !selectedCompanyId || !departmentName}
                className="flex-1 bg-[#105a9c] hover:bg-[#0d4a82] text-white disabled:opacity-50"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {createDepartmentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
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

      {/* Edit Department Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        if (!open) {
          setIsClosingModal(true)
          setErrors({})
          resetForm()
          setShowEditModal(false)
          setTimeout(() => setIsClosingModal(false), 200)
        } else {
          setShowEditModal(open)
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
            setIsClosingModal(true)
            setErrors({})
          }}
          onEscapeKeyDown={(e) => {
            setIsClosingModal(true)
            setErrors({})
          }}
        >
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              <Edit className="h-6 w-6 text-[#105a9c]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Update Departments
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Select Company */}
            <div className="space-y-2">
              <Label htmlFor="editSelectCompany" className="text-sm font-medium text-gray-700">
                Select Company <span className="text-red-500">*</span>
              </Label>
              {loadingCompanies ? (
                <div className="w-full h-11 rounded-md border border-gray-300 bg-white px-3 py-2 flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-gray-500">Loading companies...</span>
                </div>
              ) : (
                <>
                  <select
                    id="editSelectCompany"
                    value={selectedCompanyId}
                    onChange={(e) => {
                      setSelectedCompanyId(e.target.value)
                      if (errors.company_id) {
                        setErrors({ ...errors, company_id: undefined })
                      }
                    }}
                    className={`w-full h-11 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#105a9c] ${
                      errors.company_id ? 'border-red-500' : 'border-gray-300'
                    } bg-white`}
                    style={{ fontFamily: 'Albert Sans' }}
                  >
                    <option value="">Select</option>
                    {companies.map((company: any) => (
                      <option key={company.company_id} value={company.company_id}>
                        {company.company_name}
                      </option>
                    ))}
                  </select>
                  {errors.company_id && (
                    <p className="text-sm text-red-600">{errors.company_id}</p>
                  )}
                </>
              )}
            </div>

            {/* Department Name */}
            <div className="space-y-2">
              <Label htmlFor="editDepartmentName" className="text-sm font-medium text-gray-700">
                Department Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="editDepartmentName"
                placeholder="Name"
                value={departmentName}
                onChange={(e) => {
                  setDepartmentName(e.target.value)
                  if (errors.department_name) {
                    setErrors({ ...errors, department_name: undefined })
                  }
                }}
                className={`h-11 ${
                  errors.department_name ? 'border-red-500' : 'border-gray-300'
                }`}
                style={{ fontFamily: 'Albert Sans' }}
              />
              {errors.department_name && (
                <p className="text-sm text-red-600">{errors.department_name}</p>
              )}
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label htmlFor="editComments" className="text-sm font-medium text-gray-700">
                Comments
              </Label>
              <Textarea
                id="editComments"
                placeholder=""
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className="border-gray-300 resize-none"
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsClosingModal(true)
                  setErrors({})
                }}
                onClick={(e) => {
                  e.preventDefault()
                  setIsClosingModal(true)
                  setErrors({})
                  resetForm()
                  setShowEditModal(false)
                  setTimeout(() => setIsClosingModal(false), 100)
                }}
                variant="outline"
                className="flex-1 border-gray-300"
                disabled={updateDepartmentMutation.isPending}
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateDepartment}
                disabled={updateDepartmentMutation.isPending}
                className="flex-1 bg-[#105a9c] hover:bg-[#0d4a82] text-white"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {updateDepartmentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
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

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="w-[95vw] sm:w-full max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto" style={{ fontFamily: 'Albert Sans' }}>
          <DialogHeader>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-[#dc3545]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold text-gray-900">
              Delete Department
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-center text-[14px] text-[#6c757d]" style={{ fontFamily: 'Albert Sans' }}>
              Are you sure you want to delete <span className="font-semibold text-gray-900">"{departmentToDelete?.name}"</span>?
            </p>
            <p className="text-center text-[13px] text-[#dc3545]" style={{ fontFamily: 'Albert Sans' }}>
              This action cannot be undone.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDepartmentToDelete(null)
                }}
                variant="outline"
                className="flex-1 border-[#dee2e6] hover:bg-[#f8f9fa]"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={deleteDepartmentMutation.isPending}
                className="flex-1 bg-[#dc3545] hover:bg-[#c82333] text-white disabled:opacity-50"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {deleteDepartmentMutation.isPending ? (
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

