"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Plus, Edit, Trash2, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"

interface Role {
  role_id: number
  role_name: string
  role_description: string
  is_system_role: boolean
  user_count: number
  permission_count: number
  created_at: string
  updated_at: string
}

interface Permission {
  permission_id: number
  permission_key: string
  permission_name: string
  permission_description: string
  permission_category: string
  granted?: boolean
}

export default function RolesPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState({
    role_name: "",
    role_description: "",
    permissions: [] as Permission[],
  })
  const [localPermissions, setLocalPermissions] = useState<Record<number, boolean>>({})
  const permissionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isUpdatingPermissionsRef = useRef(false)
  const localPermissionsRef = useRef<Record<number, boolean>>({})

  // Fetch roles
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["roles", searchQuery],
    queryFn: async () => {
      const response = await api.get("/admin/roles", {
        params: { search: searchQuery || undefined, limit: 100 },
      })
      return response.data
    },
  })

  // Fetch all permissions
  const { data: permissionsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const response = await api.get("/admin/roles/permissions")
      return response.data
    },
  })

  // Fetch role with permissions
  const { data: rolePermissionsData, refetch: refetchRolePermissions, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ["role-permissions", selectedRole?.role_id],
    queryFn: async () => {
      if (!selectedRole) return null
      const response = await api.get(`/admin/roles/${selectedRole.role_id}`)
      return response.data
    },
    enabled: !!selectedRole && showPermissionsModal,
    refetchOnMount: true, // Always refetch when modal opens
    staleTime: 0, // Always consider data stale to force refetch
  })

  // Initialize local permissions when modal opens and data loads
  useEffect(() => {
    if (rolePermissionsData?.permissions && showPermissionsModal) {
      const initialPermissions: Record<number, boolean> = {}
      rolePermissionsData.permissions.forEach((p: Permission) => {
        initialPermissions[p.permission_id] = p.granted || false
      })
      setLocalPermissions(initialPermissions)
      localPermissionsRef.current = initialPermissions
    }
  }, [rolePermissionsData, showPermissionsModal])

  // Refetch permissions when modal opens (only when modal state changes from closed to open)
  useEffect(() => {
    if (showPermissionsModal && selectedRole?.role_id) {
      // Small delay to ensure modal is fully mounted
      const timer = setTimeout(() => {
        refetchRolePermissions()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showPermissionsModal, selectedRole?.role_id]) // Only depend on modal state and role ID

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (permissionUpdateTimeoutRef.current) {
        clearTimeout(permissionUpdateTimeoutRef.current)
      }
    }
  }, [])

  // Create role mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post("/admin/roles", data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] })
      setShowAddModal(false)
      setFormData({ role_name: "", role_description: "", permissions: [] })
      toast.success("Role created successfully")
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create role")
    },
  })

  // Update role mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await api.put(`/admin/roles/${id}`, data)
      return response.data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roles"] })
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] })
      
      // Only close modals if updating role details, not permissions
      if (!variables.data.permissions) {
        setShowEditModal(false)
        setSelectedRole(null)
        setFormData({ role_name: "", role_description: "", permissions: [] })
      } else {
        // Permissions were updated - refetch to get the latest state
        // Wait for refetch to complete before resetting local state
        if (selectedRole) {
          refetchRolePermissions().then((result) => {
            // Reset local state after refetch completes with fresh data
            if (result.data?.permissions) {
              const freshPermissions: Record<number, boolean> = {}
              result.data.permissions.forEach((p: Permission) => {
                freshPermissions[p.permission_id] = p.granted || false
              })
              setLocalPermissions(freshPermissions)
              localPermissionsRef.current = freshPermissions
            } else {
              // If no data, reset to empty so it reloads
              setLocalPermissions({})
              localPermissionsRef.current = {}
            }
          }).catch((error) => {
            console.error("Error refetching permissions after update:", error)
            // Reset anyway to force reload
            setLocalPermissions({})
            localPermissionsRef.current = {}
          })
        }
      }
      
      isUpdatingPermissionsRef.current = false
      toast.success("Permissions updated successfully")
    },
    onError: (error: any) => {
      isUpdatingPermissionsRef.current = false
      const errorMessage = error.response?.data?.message || error.message || "Failed to update role"
      toast.error(errorMessage)
      console.error("Permission update error:", error)
      
      // Revert local permissions on error by refetching from server
      if (selectedRole) {
        refetchRolePermissions().then(() => {
          // Reset local state after refetch
          if (rolePermissionsData?.permissions) {
            const revertedPermissions: Record<number, boolean> = {}
            rolePermissionsData.permissions.forEach((p: Permission) => {
              revertedPermissions[p.permission_id] = p.granted || false
            })
            setLocalPermissions(revertedPermissions)
            localPermissionsRef.current = revertedPermissions
          }
        })
      }
    },
  })

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/roles/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] })
      toast.success("Role deleted successfully")
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete role")
    },
  })

  const handleAdd = () => {
    // Prevent opening if another modal is open or mutation is pending
    if (showEditModal || showPermissionsModal || createMutation.isPending || updateMutation.isPending || isUpdatingPermissionsRef.current) {
      return
    }
    setFormData({ role_name: "", role_description: "", permissions: [] })
    setSelectedRole(null)
    setShowAddModal(true)
  }

  const handleEdit = (role: Role) => {
    // Prevent opening if another modal is open, mutation is pending, or role is system role
    if (showAddModal || showPermissionsModal || updateMutation.isPending || createMutation.isPending || isUpdatingPermissionsRef.current || role.is_system_role) {
      return
    }
    setSelectedRole(role)
    setFormData({
      role_name: role.role_name,
      role_description: role.role_description || "",
      permissions: [],
    })
    setShowEditModal(true)
  }

  const handleManagePermissions = (role: Role) => {
    // Prevent opening if another modal is open or mutation is pending
    if (showAddModal || showEditModal || updateMutation.isPending || isUpdatingPermissionsRef.current) {
      return
    }
    // Reset state before opening
    setLocalPermissions({})
    localPermissionsRef.current = {}
    setSelectedRole(role)
    setShowPermissionsModal(true)
  }

  const handleTogglePermission = useCallback((permission: Permission) => {
    if (!rolePermissionsData || !selectedRole || isUpdatingPermissionsRef.current || updateMutation.isPending) {
      return
    }

    // Get current state from ref (always up-to-date)
    const currentGranted = localPermissionsRef.current[permission.permission_id] ?? 
      (rolePermissionsData.permissions.find((p: Permission) => p.permission_id === permission.permission_id)?.granted || false)
    const newGranted = !currentGranted
    
    // Update ref immediately
    localPermissionsRef.current = {
      ...localPermissionsRef.current,
      [permission.permission_id]: newGranted
    }
    
    // Update state for UI
    setLocalPermissions({ ...localPermissionsRef.current })

    // Clear any pending timeout
    if (permissionUpdateTimeoutRef.current) {
      clearTimeout(permissionUpdateTimeoutRef.current)
    }

    // Debounce the API call
    isUpdatingPermissionsRef.current = true
    permissionUpdateTimeoutRef.current = setTimeout(() => {
      if (!selectedRole || !rolePermissionsData) {
        isUpdatingPermissionsRef.current = false
        return
      }

      // Build permissions array from current ref state
      const updatedPermissions = rolePermissionsData.permissions.map((p: Permission) => ({
        ...p,
        granted: localPermissionsRef.current[p.permission_id] ?? p.granted ?? false
      }))

      // Only include granted permissions with proper structure
      const grantedPermissions = updatedPermissions
        .filter((p: Permission) => p.granted)
        .map((p: Permission) => ({
          permission_id: p.permission_id,
          granted: true // Backend requires this field
        }))

      const updateData = {
        role_name: rolePermissionsData.role.role_name,
        role_description: rolePermissionsData.role.role_description,
        permissions: grantedPermissions, // Send empty array if no permissions granted
      }

      updateMutation.mutate({ id: selectedRole.role_id, data: updateData })
    }, 300) // 300ms debounce
  }, [rolePermissionsData, selectedRole, updateMutation])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.role_name.trim()) {
      toast.error("Role name is required")
      return
    }

    const submitData = {
      role_name: formData.role_name.trim(),
      role_description: formData.role_description.trim() || null,
      permissions: formData.permissions.filter((p) => p.granted).map((p) => ({
        permission_id: p.permission_id,
        granted: true
      })),
    }

    if (selectedRole) {
      updateMutation.mutate({ id: selectedRole.role_id, data: submitData })
    } else {
      createMutation.mutate(submitData)
    }
  }

  const handleDelete = (role: Role) => {
    if (role.is_system_role) {
      toast.error("Cannot delete system roles")
      return
    }

    if (confirm(`Are you sure you want to delete role "${role.role_name}"?`)) {
      deleteMutation.mutate(role.role_id)
    }
  }

  const roles = rolesData?.roles || []
  const permissions = permissionsData?.permissions || []
  const groupedPermissions = permissionsData?.grouped || {}

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "Albert Sans" }}>
          Roles & Permissions
        </h1>
        <Button 
          onClick={handleAdd} 
          className="flex items-center gap-2"
          disabled={showAddModal || showEditModal || showPermissionsModal || updateMutation.isPending || createMutation.isPending || isUpdatingPermissionsRef.current}
        >
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
        </div>
      </Card>

      {/* Roles List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-[#105a9c]">
                <th className="p-4 text-left font-semibold">Role Name</th>
                <th className="p-4 text-left font-semibold">Description</th>
                <th className="p-4 text-left font-semibold">Users</th>
                <th className="p-4 text-left font-semibold">Permissions</th>
                <th className="p-4 text-left font-semibold">Type</th>
                <th className="p-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No roles found
                  </td>
                </tr>
              ) : (
                roles.map((role: Role) => (
                  <tr key={role.role_id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium">{role.role_name}</td>
                    <td className="p-4 text-gray-600">
                      {role.role_description || "-"}
                    </td>
                    <td className="p-4">{role.user_count}</td>
                    <td className="p-4">{role.permission_count}</td>
                    <td className="p-4">
                      {role.is_system_role ? (
                        <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                          System
                        </span>
                      ) : (
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-800">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManagePermissions(role)}
                          disabled={showAddModal || showEditModal || updateMutation.isPending || createMutation.isPending || isUpdatingPermissionsRef.current}
                        >
                          Permissions
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(role)}
                          disabled={role.is_system_role}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(role)}
                          disabled={role.is_system_role}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Role Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowAddModal(false)
          setShowEditModal(false)
          setSelectedRole(null)
          setFormData({ role_name: "", role_description: "", permissions: [] })
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRole ? "Edit Role" : "Create New Role"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="role_name">Role Name *</Label>
              <Input
                id="role_name"
                value={formData.role_name}
                onChange={(e) =>
                  setFormData({ ...formData, role_name: e.target.value })
                }
                required
                disabled={selectedRole?.is_system_role}
              />
            </div>
            <div>
              <Label htmlFor="role_description">Description</Label>
              <Input
                id="role_description"
                value={formData.role_description}
                onChange={(e) =>
                  setFormData({ ...formData, role_description: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false)
                  setShowEditModal(false)
                  setSelectedRole(null)
                  setFormData({ role_name: "", role_description: "", permissions: [] })
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Permissions Modal */}
      <Dialog open={showPermissionsModal} onOpenChange={(open) => {
        if (!open) {
          // Clear timeout if modal is closed
          if (permissionUpdateTimeoutRef.current) {
            clearTimeout(permissionUpdateTimeoutRef.current)
            permissionUpdateTimeoutRef.current = null
          }
          isUpdatingPermissionsRef.current = false
          setShowPermissionsModal(false)
          setSelectedRole(null)
          setLocalPermissions({})
          localPermissionsRef.current = {}
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Permissions - {selectedRole?.role_name}
            </DialogTitle>
          </DialogHeader>
          {isLoadingPermissions ? (
            <div className="text-center py-8 text-gray-500">Loading permissions...</div>
          ) : rolePermissionsData ? (
            <div className="space-y-6">
              {Object.entries(groupedPermissions).map(([category, perms]: [string, any]) => (
                <div key={category}>
                  <h3 className="mb-3 font-semibold text-lg capitalize">{category}</h3>
                  <div className="space-y-2">
                    {perms.map((perm: Permission) => {
                      // Find the permission in rolePermissionsData (source of truth)
                      const rolePerm = rolePermissionsData.permissions.find(
                        (p: Permission) => p.permission_id === perm.permission_id
                      )
                      
                      // Use localPermissions only if we've made changes (localPermissions has this specific permission)
                      // Otherwise, always use rolePermissionsData to show saved state
                      const hasLocalChange = localPermissions[perm.permission_id] !== undefined
                      const isGranted = hasLocalChange
                        ? localPermissions[perm.permission_id]
                        : (rolePerm?.granted || false)
                      
                      const isDisabled = updateMutation.isPending || isUpdatingPermissionsRef.current
                      
                      return (
                        <div
                          key={perm.permission_id}
                          className={`flex items-center gap-3 rounded border p-3 hover:bg-gray-50 ${
                            isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <Checkbox
                            checked={isGranted}
                            onCheckedChange={() => handleTogglePermission(perm)}
                            disabled={isDisabled}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{perm.permission_name}</div>
                            {perm.permission_description && (
                              <div className="text-sm text-gray-500">
                                {perm.permission_description}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {updateMutation.isPending && (
                <div className="text-center text-sm text-gray-500 py-2">
                  Saving permissions...
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No permissions data available</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

