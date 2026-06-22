"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import api from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Printer, Plus, Edit, Trash2, AlertCircle, Settings, X } from "lucide-react"
import { toast } from "sonner"
import { validateRequired } from "@/lib/validations"
import Link from "next/link"
import { printTableData } from "@/lib/print-utils"

interface OptionValue {
  option_value_id?: number
  name: string
  sort_order: number
  standard_price?: number
  wholesale_price?: number
  wholesale_price_premium?: number
  subscriber_price?: number
}

interface Option {
  option_id: number
  name: string
  option_type?: string
  values: OptionValue[]
}

export default function OptionsPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedOption, setSelectedOption] = useState<Option | null>(null)

  // Form state
  const [optionName, setOptionName] = useState("")
  const [optionType, setOptionType] = useState<string>("dropdown")
  const [optionValues, setOptionValues] = useState<OptionValue[]>([{ name: "", sort_order: 1, standard_price: 0, wholesale_price: 0, wholesale_price_premium: 0, subscriber_price: 0 }])

  // Pagination - REMOVED
  // const [currentPage, setCurrentPage] = useState(1)
  // const itemsPerPage = 20

  // Fetch options
  const { data: optionsData, isLoading, error: optionsError } = useQuery({
    queryKey: ["options", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      params.append("limit", "10000") // Fetch all
      const response = await api.get(`/admin/options?${params.toString()}`)
      return response.data
    },
    retry: 1,
  })

  const options = optionsData?.options || []
  const totalCount = optionsData?.count || 0

  // Create option mutation
  const createOptionMutation = useMutation({
    mutationFn: async (optionData: any) => {
      const response = await api.post("/admin/options", optionData)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["options"] })
      toast.success("Option created successfully!")
      setShowAddModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create option")
    },
  })

  // Update option mutation
  const updateOptionMutation = useMutation({
    mutationFn: async ({ id, ...optionData }: any) => {
      const response = await api.put(`/admin/options/${id}`, optionData)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["options"] })
      toast.success("Option updated successfully!")
      setShowEditModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update option")
    },
  })

  // Delete option mutation
  const deleteOptionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/admin/options/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["options"] })
      toast.success("Option deleted successfully!")
      setShowDeleteModal(false)
      setSelectedOption(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete option")
    },
  })

  const handleAddOption = () => {
    resetForm()
    setShowAddModal(true)
  }

  const handleEditOption = (option: Option) => {
    setSelectedOption(option)
    setOptionName(option.name)
    setOptionType(option.option_type || "dropdown")
    setOptionValues(option.values.length > 0 ? option.values.map(v => ({
      ...v,
      standard_price: v.standard_price || 0,
      wholesale_price: v.wholesale_price || 0,
      wholesale_price_premium: v.wholesale_price_premium || 0,
      subscriber_price: v.subscriber_price || 0
    })) : [{ name: "", sort_order: 1, standard_price: 0, wholesale_price: 0, wholesale_price_premium: 0, subscriber_price: 0 }])
    setShowEditModal(true)
  }

  const handleDeleteOption = (option: Option) => {
    setSelectedOption(option)
    setShowDeleteModal(true)
  }

  // Validation errors state
  const [errors, setErrors] = useState<{
    option_name?: string
    option_values?: string
  }>({})

  const handleSaveOption = () => {
    const newErrors: typeof errors = {}

    // Validate option name (required, reasonable max length)
    const nameValidation = validateRequired(optionName, "Option name", 255)
    if (!nameValidation.valid) {
      newErrors.option_name = nameValidation.error || "Option name is required"
    }

    // Filter out empty values
    const validValues = optionValues.filter(v => v.name.trim())

    if (validValues.length === 0) {
      newErrors.option_values = "At least one option value is required"
    }

    // Validate each option value name length
    for (let i = 0; i < validValues.length; i++) {
      if (validValues[i].name.length > 255) {
        newErrors.option_values = `Option value ${i + 1} must be 255 characters or less`
        break
      }
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0]
      if (firstError) toast.error(firstError)
      return
    }

    const optionData = {
      name: optionName.trim(),
      option_type: optionType,
      values: validValues.map(v => ({
        ...v,
        name: v.name.trim(),
        standard_price: v.standard_price || 0,
        wholesale_price: v.wholesale_price || (v.standard_price || 0) * 0.9,
        wholesale_price_premium: v.wholesale_price_premium || (v.standard_price || 0) * 0.8,
        subscriber_price: v.subscriber_price || null
      }))
    }

    if (selectedOption) {
      updateOptionMutation.mutate({
        id: selectedOption.option_id,
        ...optionData
      })
    } else {
      createOptionMutation.mutate(optionData)
    }
  }

  const handleConfirmDelete = () => {
    if (selectedOption) {
      deleteOptionMutation.mutate(selectedOption.option_id)
    }
  }

  const addValueField = () => {
    setOptionValues([...optionValues, { name: "", sort_order: optionValues.length + 1, standard_price: 0, wholesale_price: 0, wholesale_price_premium: 0, subscriber_price: 0 }])
  }

  const removeValueField = (index: number) => {
    if (optionValues.length > 1) {
      const newValues = optionValues.filter((_, i) => i !== index)
      // Reorder sort_order
      newValues.forEach((v, i) => v.sort_order = i + 1)
      setOptionValues(newValues)
    }
  }

  const updateValueField = (index: number, name: string) => {
    const newValues = [...optionValues]
    newValues[index].name = name
    setOptionValues(newValues)
  }

  const resetForm = () => {
    setOptionName("")
    setOptionType("dropdown")
    setOptionValues([{ name: "", sort_order: 1, standard_price: 0, wholesale_price: 0, wholesale_price_premium: 0, subscriber_price: 0 }])
    setSelectedOption(null)
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
          Manage Options
        </h1>
        <Button
          onClick={handleAddOption}
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
          Add New Options
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <Link href="/admin/categories">
          <button
            className="px-6 py-2 rounded-full text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            style={{ fontWeight: 600 }}
          >
            Categories
          </button>
        </Link>
        <button
          className="px-6 py-2 rounded-full text-sm font-medium transition-colors bg-blue-100 text-[#105a9c]"
          style={{ fontWeight: 600 }}
        >
          Options
        </button>
        <Link href="/admin/products">
          <button
            className="px-6 py-2 rounded-full text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            style={{ fontWeight: 600 }}
          >
            Products
          </button>
        </Link>
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
          onClick={() => printTableData("Options")}
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
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Sort Order (Option)
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Options Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Option Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Sort Order (Value)
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Option Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">Loading options...</td>
                </tr>
              ) : optionsError ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-red-500">
                    Error loading options. Please try again.
                  </td>
                </tr>
              ) : options.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    {searchQuery ? "No options found matching your search" : "No options found"}
                  </td>
                </tr>
              ) : (
                options.map((option: any, optionIndex: number) => {
                  const values = option.values || []
                  return values.map((value: any, valueIndex: number) => (
                    <tr key={`${option.option_id}-${valueIndex}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      {valueIndex === 0 ? (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-900" rowSpan={values.length} style={{ fontFamily: 'Albert Sans' }}>
                            {optionIndex + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900" rowSpan={values.length} style={{ fontFamily: 'Albert Sans' }}>
                            {option.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900" rowSpan={values.length} style={{ fontFamily: 'Albert Sans' }}>
                            {option.option_type === 'radio' ? 'Radio Buttons' :
                              option.option_type === 'checkbox' ? 'Checkbox' :
                                option.option_type === 'text' ? 'Text' : 'Dropdown'}
                          </td>
                        </>
                      ) : null}
                      <td className="px-4 py-3 text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                        {value.sort_order}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                        {value.name}
                      </td>
                      {valueIndex === 0 ? (
                        <td className="px-4 py-3" rowSpan={values.length}>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditOption(option)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteOption(option)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>


      {/* Add/Edit Option Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          // Blur active element to prevent validation on blur
          if (document.activeElement && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          setShowAddModal(false)
          setShowEditModal(false)
          resetForm()
        }
      }}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto" style={{ fontFamily: 'Albert Sans' }}>
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              <Settings className="h-6 w-6 text-[#105a9c]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              {selectedOption ? "Edit Option" : "Add New Option"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="optionName" className="text-sm font-medium text-gray-700">
                Option Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="optionName"
                placeholder="e.g., Size, Flavours, Dietary Requirements"
                value={optionName}
                onChange={(e) => setOptionName(e.target.value)}
                className="h-11 border-gray-300 bg-white"
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="optionType" className="text-sm font-medium text-gray-700">
                Option Type <span className="text-red-500">*</span>
              </Label>
              <select
                id="optionType"
                value={optionType}
                onChange={(e) => setOptionType(e.target.value)}
                className="w-full h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#105a9c]"
                style={{ fontFamily: 'Albert Sans' }}
              >
                <option value="dropdown">Dropdown</option>
                <option value="radio">Radio</option>
                <option value="checkbox">Checkbox</option>
                <option value="text">Text</option>
              </select>
              <p className="text-xs text-gray-500">
                Radio: Single select buttons | Checkbox: Multiple select | Dropdown: Single select dropdown | Text: Free text input
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700">
                  Option Values <span className="text-red-500">*</span>
                </Label>
                <Button
                  type="button"
                  onClick={addValueField}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Value
                </Button>
              </div>

              <div className="space-y-3">
                {optionValues.map((value, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder={`Value ${index + 1} (e.g., Small, Medium, Large)`}
                        value={value.name}
                        onChange={(e) => {
                          const newValues = [...optionValues]
                          newValues[index].name = e.target.value
                          setOptionValues(newValues)
                        }}
                        className="h-10 border-gray-300 bg-white flex-1"
                        style={{ fontFamily: 'Albert Sans' }}
                      />
                      {optionValues.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => removeValueField(index)}
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-gray-600">Standard Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={value.standard_price === 0 ? '' : value.standard_price}
                          onChange={(e) => {
                            const newValues = [...optionValues]
                            const val = e.target.value
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              newValues[index].standard_price = val === '' ? 0 : parseFloat(val) || 0
                              // Auto-calculate wholesale price (90% of standard)
                              newValues[index].wholesale_price = newValues[index].standard_price * 0.9
                              setOptionValues(newValues)
                            }
                          }}
                          className="h-8 text-sm border-gray-300 bg-white"
                          style={{ fontFamily: 'Albert Sans' }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600">Essentials Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={value.wholesale_price === 0 ? '' : value.wholesale_price}
                          onChange={(e) => {
                            const newValues = [...optionValues]
                            const val = e.target.value
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              newValues[index].wholesale_price = val === '' ? 0 : parseFloat(val) || 0
                              setOptionValues(newValues)
                            }
                          }}
                          className="h-8 text-sm border-gray-300 bg-white"
                          style={{ fontFamily: 'Albert Sans' }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600">Premium Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={value.wholesale_price_premium === 0 ? '' : value.wholesale_price_premium}
                          onChange={(e) => {
                            const newValues = [...optionValues]
                            const val = e.target.value
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              newValues[index].wholesale_price_premium = val === '' ? 0 : parseFloat(val) || 0
                              setOptionValues(newValues)
                            }
                          }}
                          className="h-8 text-sm border-gray-300 bg-white"
                          style={{ fontFamily: 'Albert Sans' }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600">Subscriber Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={value.subscriber_price === 0 ? '' : value.subscriber_price}
                          onChange={(e) => {
                            const newValues = [...optionValues]
                            const val = e.target.value
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              newValues[index].subscriber_price = val === '' ? 0 : parseFloat(val) || 0
                              setOptionValues(newValues)
                            }
                          }}
                          className="h-8 text-sm border-gray-300 bg-white"
                          style={{ fontFamily: 'Albert Sans' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowAddModal(false)
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
                onClick={handleSaveOption}
                disabled={createOptionMutation.isPending || updateOptionMutation.isPending}
                className="flex-1 bg-[#105a9c] hover:bg-[#0d4a82] text-white disabled:opacity-50"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {createOptionMutation.isPending || updateOptionMutation.isPending
                  ? "Saving..."
                  : selectedOption ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Delete Confirmation Modal */}
      < Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal} >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 700 }}>
              Delete Option
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Albert Sans' }}>
                  Are you sure you want to permanently delete this option? This action cannot be undone.
                </p>
                <p className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  {selectedOption?.name}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false)
                setSelectedOption(null)
              }}
              className="border-gray-300"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleteOptionMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              {deleteOptionMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog >
    </div >
  )
}
