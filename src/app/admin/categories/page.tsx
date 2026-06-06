"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import api from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ValidatedInput } from "@/components/ui/validated-input"
import { ValidationRules } from "@/lib/validation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Printer, Plus, Edit, Trash2, AlertCircle, FolderOpen, GripVertical, ChevronUp, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { validateRequired } from "@/lib/validations"
import { printTableData } from "@/lib/print-utils"

interface Category {
  category_id: number
  category_name: string
  parent_category_id?: number | null
  parent_category_name?: string | null
  sort_order?: number
  gst_free?: boolean
}

export default function CategoriesPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"products" | "categories">("categories")
  const [categoryView, setCategoryView] = useState<"all" | "main" | "sub">("all") // Filter: all, main categories only, subcategories only
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [isSubcategory, setIsSubcategory] = useState(false) // Track if adding subcategory
  const [showCategoryReorder, setShowCategoryReorder] = useState(false)
  const [draggedCategory, setDraggedCategory] = useState<number | null>(null)
  const [reorderCategories, setReorderCategories] = useState<Category[]>([])

  // Form state
  const [categoryName, setCategoryName] = useState("")
  const [parentCategoryId, setParentCategoryId] = useState<number | null>(null)
  const [gstFree, setGstFree] = useState(false)

  // Fetch all categories (source of truth for list and parent selection)
  const { data: allCategoriesData, isLoading } = useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => {
      const response = await api.get("/admin/categories?limit=1000")
      return response.data
    },
  })

  const rawCategories = allCategoriesData?.categories || []
  const mainCategories = rawCategories.filter((cat: any) => !cat.parent_category_id)

  // Pagination state - REMOVED
  // const [currentPage, setCurrentPage] = useState(1)
  // const itemsPerPage = 20

  // Filter, Sort, and Paginate Categories (Client-side)
  let processedCategories = [...rawCategories]

  // 1. Filter by View Mode
  if (categoryView === "main") {
    processedCategories = processedCategories.filter((cat: Category) => !cat.parent_category_id)
  } else if (categoryView === "sub") {
    processedCategories = processedCategories.filter((cat: Category) => cat.parent_category_id)
  }

  // 2. Filter by Search Query
  if (searchQuery) {
    const query = searchQuery.toLowerCase()
    processedCategories = processedCategories.filter((cat: Category) =>
      cat.category_name.toLowerCase().includes(query) ||
      cat.category_id.toString().includes(query) ||
      (cat.parent_category_name && cat.parent_category_name.toLowerCase().includes(query))
    )
  }

  // 3. Sort by sort_order (Hierarchical)
  // Use String keys to handle potential type mismatches (number vs string) from API
  const categoryMap = new Map<string, Category>();
  rawCategories.forEach((cat: Category) => {
    categoryMap.set(String(cat.category_id), cat);
  });

  processedCategories.sort((a: Category, b: Category) => {
    // Helper to get the top-level parent (root)
    const getRoot = (cat: Category): Category => {
      if (!cat.parent_category_id) return cat;
      const parent = categoryMap.get(String(cat.parent_category_id));
      return parent || cat;
    }

    const rootA = getRoot(a)
    const rootB = getRoot(b)

    // Compare by Root Parent's sort_order properties
    // Default to a high number (instead of 0) so unordered items go to the bottom, 
    // unless 0 is explicitly a valid high priority. Assuming 1-based indexing for user reordering usually.
    // If the valid sort orders are > 0, then 0 is indeed "first". 
    // If we want unordered items to be last, we should treat null/0 as Infinity. 
    // But typically in this system, if the user hasn't ordered them, they might be 0.
    // Let's stick to the previous logic but with fixed mapping.
    const orderA = rootA.sort_order || 0
    const orderB = rootB.sort_order || 0

    if (orderA !== orderB) return orderA - orderB

    // If same root (e.g. one is parent, one is child; or both children of same parent)
    if (rootA.category_id === rootB.category_id) {
      // Parent always comes before its children
      if (a.category_id === rootA.category_id) return -1
      if (b.category_id === rootB.category_id) return 1

      // If sorting subcategories is needed, we can use their own sort_order if available
      // For now, sorting by ID
      return a.category_id - b.category_id
    }

    // Fallback for stable sort between different roots
    return rootA.category_id - rootB.category_id
  })

  // 4. Pagination - REMOVED
  // const totalCount = processedCategories.length
  // const totalPages = Math.ceil(totalCount / itemsPerPage)

  // Use all categories directly
  const categories = processedCategories

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: any) => {
      const response = await api.post("/admin/categories", categoryData)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories-all"] }) // Only need to invalidate this one now
      toast.success(isSubcategory ? "Subcategory created successfully!" : "Main category created successfully!")
      setShowAddModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create category")
    },
  })

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...categoryData }: any) => {
      const response = await api.put(`/admin/categories/${id}`, categoryData)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories-all"] })
      toast.success("Category updated successfully!")
      setShowEditModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update category")
    },
  })

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/admin/categories/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories-all"] })
      toast.success("Category deleted successfully!")
      setShowDeleteModal(false)
      setSelectedCategory(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete category")
    },
  })

  const handleAddCategory = (isSubcategory: boolean = false) => {
    setCategoryName("")
    setParentCategoryId(null)
    setIsSubcategory(isSubcategory)
    setShowAddModal(true)
  }

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category)
    setCategoryName(category.category_name)
    setParentCategoryId(category.parent_category_id || null)
    setGstFree(category.gst_free || false)
    setShowEditModal(true)
  }

  const handleDeleteCategory = (category: Category) => {
    setSelectedCategory(category)
    setShowDeleteModal(true)
  }

  // Validation errors state
  const [errors, setErrors] = useState<{
    category_name?: string
  }>({})

  const handleSaveCategory = () => {
    const newErrors: typeof errors = {}

    // Validate category name (required, max 255 chars per DB schema)
    const nameValidation = validateRequired(categoryName, "Category name", 255)
    if (!nameValidation.valid) {
      newErrors.category_name = nameValidation.error || "Category name is required"
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0]
      if (firstError) toast.error(firstError)
      return
    }

    const categoryData = {
      category_name: categoryName.trim(),
      parent_category_id: parentCategoryId || null,
      gst_free: gstFree,
    }

    if (selectedCategory) {
      updateCategoryMutation.mutate({
        id: selectedCategory.category_id,
        ...categoryData
      })
    } else {
      createCategoryMutation.mutate(categoryData)
    }
  }

  const handleConfirmDelete = () => {
    if (selectedCategory) {
      deleteCategoryMutation.mutate(selectedCategory.category_id)
    }
  }

  const resetForm = () => {
    setCategoryName("")
    setParentCategoryId(null)
    setGstFree(false)
    setIsSubcategory(false)
    setSelectedCategory(null)
    setErrors({}) // Clear all validation errors
  }

  // Categories Reorder Logic
  const handleOpenReorderModal = () => {
    setReorderCategories([...mainCategories])
    setShowCategoryReorder(true)
  }

  const handleDragStart = (e: React.DragEvent, categoryId: number) => {
    setDraggedCategory(categoryId)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", categoryId.toString())
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleCategoryDrop = (e: React.DragEvent, targetCategoryId: number) => {
    e.preventDefault()
    if (draggedCategory === targetCategoryId) return

    const draggedIndex = reorderCategories.findIndex(
      (c) => c.category_id === draggedCategory
    )
    const targetIndex = reorderCategories.findIndex(
      (c) => c.category_id === targetCategoryId
    )

    if (draggedIndex === -1 || targetIndex === -1) return

    const newCategories = [...reorderCategories]
    const [draggedItem] = newCategories.splice(draggedIndex, 1)
    newCategories.splice(targetIndex, 0, draggedItem)

    // Update sort_order based on new position
    const updatedCategories = newCategories.map((cat, index) => ({
      ...cat,
      sort_order: index + 1,
    }))

    setReorderCategories(updatedCategories)
    setDraggedCategory(null)
  }

  const moveCategoryUp = (index: number) => {
    if (index === 0) return

    const newCategories = [...reorderCategories];
    [newCategories[index - 1], newCategories[index]] = [
      newCategories[index],
      newCategories[index - 1],
    ]

    const updatedCategories = newCategories.map((cat, idx) => ({
      ...cat,
      sort_order: idx + 1,
    }))

    setReorderCategories(updatedCategories)
  }

  const moveCategoryDown = (index: number) => {
    if (index === reorderCategories.length - 1) return

    const newCategories = [...reorderCategories];
    [newCategories[index], newCategories[index + 1]] = [
      newCategories[index + 1],
      newCategories[index],
    ]

    const updatedCategories = newCategories.map((cat, idx) => ({
      ...cat,
      sort_order: idx + 1,
    }))

    setReorderCategories(updatedCategories)
  }

  const saveCategoryOrder = async () => {
    try {
      await Promise.all(
        reorderCategories.map((cat, index) =>
          api.put(`/admin/categories/${cat.category_id}`, {
            sort_order: index + 1,
          })
        )
      )

      toast.success("Category order saved successfully!")
      setShowCategoryReorder(false)
      queryClient.invalidateQueries({ queryKey: ["categories-all"] })
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to save category order"
      )
    }
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
          Manage Categories
        </h1>
        <div className="flex gap-3">
          <Button
            onClick={handleOpenReorderModal}
            className="bg-gray-700 hover:bg-gray-800 text-white whitespace-nowrap"
            style={{
              fontWeight: 600,
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
            <GripVertical className="h-5 w-5" />
            Reorder Categories
          </Button>
          <Button
            onClick={() => handleAddCategory(false)}
            className="bg-[#0d6efd] hover:bg-[#0b5ed7] text-white whitespace-nowrap"
            style={{
              fontWeight: 600,
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
            Add Main Category
          </Button>
          <Button
            onClick={() => handleAddCategory(true)}
            className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
            style={{
              fontWeight: 600,
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
            Add Subcategory
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          className="px-6 py-2 rounded-full text-sm font-medium transition-colors bg-blue-100 text-[#0d6efd]"
          style={{ fontWeight: 600 }}
        >
          Categories
        </button>
        <Link href="/admin/options">
          <button
            className="px-6 py-2 rounded-full text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            style={{ fontWeight: 600 }}
          >
            Options
          </button>
        </Link>
        <Link href="/admin/products">
          <button
            className="px-6 py-2 rounded-full text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            style={{ fontWeight: 600 }}
          >
            Products
          </button>
        </Link>
      </div>

      {/* Category View Filter */}
      <div className="flex gap-3 mb-6">
        <Button
          variant={categoryView === "all" ? "default" : "outline"}
          onClick={() => setCategoryView("all")}
          className={categoryView === "all" ? "bg-[#0d6efd] text-white" : ""}
          style={{ fontWeight: 600 }}
        >
          All Categories
        </Button>
        <Button
          variant={categoryView === "main" ? "default" : "outline"}
          onClick={() => setCategoryView("main")}
          className={categoryView === "main" ? "bg-[#0d6efd] text-white" : ""}
          style={{ fontWeight: 600 }}
        >
          Main Categories Only
        </Button>
        <Button
          variant={categoryView === "sub" ? "default" : "outline"}
          onClick={() => setCategoryView("sub")}
          className={categoryView === "sub" ? "bg-[#0d6efd] text-white" : ""}
          style={{ fontWeight: 600 }}
        >
          Subcategories Only
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
            className="w-[488px] h-[54px] border border-gray-200 bg-white rounded-full focus:ring-2 focus:ring-[#0d6efd] focus:border-[#0d6efd] focus:outline-none"
            style={{ fontFamily: 'Albert Sans', paddingLeft: '44px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
          />
        </div>
        <Button
          onClick={() => printTableData("Categories")}
          className="gap-2 whitespace-nowrap border-0 shadow-none"
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
      <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Category
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Parent Category
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-500">Loading categories...</td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-500">No categories found.</td>
                </tr>
              ) : (
                categories.map((category: Category) => (
                  <tr key={category.category_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                      {category.category_name}
                      {category.parent_category_id && (
                        <span className="ml-2 text-xs text-gray-500">(Subcategory)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                      {category.parent_category_name || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
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



      {/* Add Category Modal */}
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
        <DialogContent className="max-w-md bg-white" style={{ fontFamily: 'Albert Sans' }}>
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              <FolderOpen className="h-6 w-6 text-[#0d6efd]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              {isSubcategory ? "Add New Subcategory" : "Add New Main Category"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <ValidatedInput
              label="Category Name"
              placeholder={isSubcategory ? "Enter subcategory name" : "Enter category name"}
              value={categoryName}
              validationRule={ValidationRules.category.category_name}
              fieldName="Category Name"
              onChange={(value) => setCategoryName(value)}
              className="h-11 border-gray-300 bg-white"
            />

            {isSubcategory && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Parent Category <span className="text-red-500">*</span>
                </Label>
                <select
                  value={parentCategoryId || ""}
                  onChange={(e) => setParentCategoryId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d6efd]"
                  style={{ fontFamily: 'Albert Sans' }}
                  required
                >
                  <option value="">Select Parent Category</option>
                  {mainCategories.map((cat: any) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">Select a parent category for this subcategory</p>
              </div>
            )}

            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-sm font-medium text-gray-700">GST Free</Label>
                <p className="text-xs text-gray-500">Products in this category will be exempt from GST</p>
              </div>
              <button
                type="button"
                onClick={() => setGstFree(!gstFree)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${gstFree ? 'bg-[#0d6efd]' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gstFree ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

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
                onClick={handleSaveCategory}
                disabled={!categoryName.trim() || createCategoryMutation.isPending || (isSubcategory && !parentCategoryId)}
                className="flex-1 bg-[#0d6efd] hover:bg-[#0b5ed7] text-white disabled:opacity-50"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {createCategoryMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Modal */}
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
        <DialogContent className="max-w-md bg-white" style={{ fontFamily: 'Albert Sans' }}>
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              <Edit className="h-6 w-6 text-[#0d6efd]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Edit Category
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <ValidatedInput
              label="Category Name"
              placeholder="Enter category name"
              value={categoryName}
              validationRule={ValidationRules.category.category_name}
              fieldName="Category Name"
              onChange={(value) => setCategoryName(value)}
              className="h-11 border-gray-300 bg-white"
            />

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Parent Category (Optional - Leave empty for main category)
              </Label>
              <select
                value={parentCategoryId || ""}
                onChange={(e) => setParentCategoryId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d6efd]"
                style={{ fontFamily: 'Albert Sans' }}
              >
                <option value="">None (Main Category)</option>
                {mainCategories.filter((cat: any) => cat.category_id !== selectedCategory?.category_id).map((cat: any) => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.category_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">Select a parent category to make this a subcategory</p>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-sm font-medium text-gray-700">GST Free</Label>
                <p className="text-xs text-gray-500">Products in this category will be exempt from GST</p>
              </div>
              <button
                type="button"
                onClick={() => setGstFree(!gstFree)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${gstFree ? 'bg-[#0d6efd]' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gstFree ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

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
                onClick={handleSaveCategory}
                disabled={!categoryName.trim() || updateCategoryMutation.isPending}
                className="flex-1 bg-[#0d6efd] hover:bg-[#0b5ed7] text-white disabled:opacity-50"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {updateCategoryMutation.isPending ? "Updating..." : "Update"}
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
              Delete Category
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Albert Sans' }}>
                  Are you sure you want to permanently delete this category? This action cannot be undone.
                </p>
                <p className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  {selectedCategory?.category_name}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false)
                setSelectedCategory(null)
              }}
              className="border-gray-300"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleteCategoryMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              {deleteCategoryMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Reorder Modal */}
      <Dialog open={showCategoryReorder} onOpenChange={setShowCategoryReorder}>
        <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle
              className="text-xl font-bold text-gray-900"
              style={{ fontFamily: "Albert Sans", fontWeight: 700 }}
            >
              Reorder Categories
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p
              className="text-sm text-gray-600 mb-4"
              style={{ fontFamily: "Albert Sans" }}
            >
              Drag and drop categories to reorder them. The order will be
              reflected in the shop page.
            </p>

            <div className="space-y-2">
              {reorderCategories.map((category, index) => (
                <div
                  key={category.category_id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                  draggable
                  onDragStart={(e) => handleDragStart(e, category.category_id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleCategoryDrop(e, category.category_id)}
                >
                  <div className="cursor-move text-gray-400 hover:text-gray-600">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <span
                      className="text-sm font-medium text-gray-700"
                      style={{ fontFamily: "Albert Sans" }}
                    >
                      {category.category_name}
                    </span>
                    {category.sort_order !== undefined && (
                      <span
                        className="text-xs text-gray-500 ml-2"
                        style={{ fontFamily: "Albert Sans" }}
                      >
                        (Current order: {category.sort_order})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveCategoryUp(index)}
                      disabled={index === 0}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveCategoryDown(index)}
                      disabled={index === reorderCategories.length - 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCategoryReorder(false)}
                className="flex-1"
                style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                onClick={saveCategoryOrder}
                className="flex-1 bg-[#0d6efd] hover:bg-[#0b5ed7] text-white"
                style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
              >
                Save Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
