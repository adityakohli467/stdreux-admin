"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ValidatedInput } from "@/components/ui/validated-input"
import { ValidationRules } from "@/lib/validation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Printer, Plus, Edit, Trash2, AlertCircle, User } from "lucide-react"
import { toast } from "sonner"
import { validateRequired, validateEmail } from "@/lib/validations"
import { printTableData } from "@/lib/print-utils"
import { useAuthStore } from "@/store/auth"

interface User {
  user_id: number
  username: string
  email: string
  auth_level: number
  role_id?: number
  role?: {
    role_id: number
    role_name: string
    role_description?: string
  }
  company_name?: string
  account_email?: string
  created_at: string
  updated_at: string
}

const AUTH_LEVELS: Record<number, string> = {
  1: "Super Admin",
  2: "Admin",
  3: "Manager",
}

// Role permissions configuration (matches backend)
const ROLE_PERMISSIONS: Record<number, {
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canAssignRoles: number[];
  canViewEmail: boolean;
  canViewCompanyName: boolean;
  canViewAccountEmail: boolean;
  canEditEmail: boolean;
  canEditPassword: boolean;
  canEditRole: boolean;
  canEditCompanyName: boolean;
  canEditAccountEmail: boolean;
}> = {
  1: { // Super Admin
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canAssignRoles: [1, 2, 3],
    canViewEmail: true,
    canViewCompanyName: true,
    canViewAccountEmail: true,
    canEditEmail: true,
    canEditPassword: true,
    canEditRole: true,
    canEditCompanyName: true,
    canEditAccountEmail: true,
  },
  2: { // Admin
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canAssignRoles: [2, 3],
    canViewEmail: true,
    canViewCompanyName: true,
    canViewAccountEmail: true,
    canEditEmail: true,
    canEditPassword: true,
    canEditRole: true,
    canEditCompanyName: true,
    canEditAccountEmail: true,
  },
  3: { // Manager
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canAssignRoles: [],
    canViewEmail: true,
    canViewCompanyName: true,
    canViewAccountEmail: false,
    canEditEmail: false,
    canEditPassword: false,
    canEditRole: false,
    canEditCompanyName: false,
    canEditAccountEmail: false,
  },
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isClosingModal, setIsClosingModal] = useState(false)

  // Get current user's permissions
  const currentUserLevel = currentUser?.auth_level || 3
  const permissions = ROLE_PERMISSIONS[currentUserLevel] || ROLE_PERMISSIONS[3]

  // Get available roles for dropdown (roles this user can assign)
  const availableRoles = useMemo(() => {
    return permissions.canAssignRoles.map(level => ({
      value: level.toString(),
      label: AUTH_LEVELS[level]
    }))
  }, [permissions.canAssignRoles])

  // Fetch roles for dropdown
  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const response = await api.get("/admin/roles", { params: { limit: 100 } })
      return response.data
    },
  })

  const roles = rolesData?.roles || []

  // Form state
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authLevel, setAuthLevel] = useState("3")
  const [roleId, setRoleId] = useState<string>("")
  const [companyName, setCompanyName] = useState("")
  const [accountEmail, setAccountEmail] = useState("")



  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["users", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      params.append("limit", "1000") // Fetch all users
      const response = await api.get(`/admin/users?${params.toString()}`)
      return response.data
    },
  })

  const users = usersData?.users || []

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await api.post("/admin/users", userData)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success("User created successfully!")
      setShowAddModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create user")
    },
  })

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...userData }: any) => {
      const response = await api.put(`/admin/users/${id}`, userData)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success("User updated successfully!")
      setShowEditModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update user")
    },
  })

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/admin/users/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success("User deleted successfully!")
      setShowDeleteModal(false)
      setSelectedUser(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete user")
    },
  })

  const handleAddUser = () => {
    resetForm()
    setShowAddModal(true)
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setUsername(user.username)
    setEmail(user.email)
    setAuthLevel(user.auth_level.toString())
    setRoleId(user.role_id?.toString() || "")
    setCompanyName(user.company_name || "")
    setAccountEmail(user.account_email || "")
    setPassword("") // Leave password empty for edit
    setShowEditModal(true)
  }

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.user_id)
    }
  }

  // Validation errors state
  const [errors, setErrors] = useState<{
    username?: string
    email?: string
    password?: string
    auth_level?: string
    account_email?: string
  }>({})

  const handleSaveUser = () => {
    const newErrors: typeof errors = {}

    // Validate username (required, max 50 chars per DB schema)
    const usernameValidation = validateRequired(username, "Username", 50)
    if (!usernameValidation.valid) {
      newErrors.username = usernameValidation.error || "Username is required"
    }

    // Validate email only if user can edit email
    if (permissions.canEditEmail) {
      const emailValidation = validateEmail(email, 255)
      if (!emailValidation.valid) {
        newErrors.email = emailValidation.error || "Email is required"
      } else if (!email || email.trim() === '') {
        newErrors.email = "Email is required"
      }
    }

    // Validate password only if user can edit password
    if (permissions.canEditPassword) {
      if (!selectedUser) {
        // New user - password is required
        if (!password || password.trim() === '') {
          newErrors.password = "Password is required"
        } else if (password.length < 6) {
          newErrors.password = "Password must be at least 6 characters"
        } else if (password.length > 255) {
          newErrors.password = "Password must be 255 characters or less"
        }
      } else if (password && password.trim() !== '') {
        // Edit mode - optional password update
        if (password.length < 6) {
          newErrors.password = "Password must be at least 6 characters"
        } else if (password.length > 255) {
          newErrors.password = "Password must be 255 characters or less"
        }
      }
    }

    // Validate role only if user can edit role
    if (permissions.canEditRole) {
      if (!roleId || roleId === '') {
        newErrors.auth_level = "Role is required"
      }
    }

    // Validate account email only if user can edit account email
    if (permissions.canEditAccountEmail && accountEmail && accountEmail.trim() !== '') {
      const accountEmailValidation = validateEmail(accountEmail, 150)
      if (!accountEmailValidation.valid) {
        newErrors.account_email = accountEmailValidation.error || "Please enter a valid account email"
      }
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0]
      if (firstError) toast.error(firstError)
      return
    }

    const userData: any = {
      username: username.trim(),
    }

    // Only include fields user has permission to edit
    if (permissions.canEditEmail) {
      userData.email = email.trim()
    }
    if (permissions.canEditRole) {
      userData.auth_level = Number.parseInt(authLevel, 10)
      if (roleId) {
        userData.role_id = Number.parseInt(roleId, 10)
      }
    }
    if (permissions.canEditCompanyName) {
      userData.company_name = companyName.trim() || null
    }
    if (permissions.canEditAccountEmail) {
      userData.account_email = accountEmail.trim() || null
    }

    if (selectedUser) {
      // Edit mode
      if (permissions.canEditPassword && password && password.trim() !== '') {
        userData.password = password
      }
      updateUserMutation.mutate({
        id: selectedUser.user_id,
        ...userData
      })
    } else {
      // Add mode - password is required if user can edit password
      if (permissions.canEditPassword) {
        userData.password = password.trim()
      }
      createUserMutation.mutate(userData)
    }
  }

  const resetForm = () => {
    setUsername("")
    setEmail("")
    setPassword("")
    setAuthLevel("3")
    setRoleId("")
    setCompanyName("")
    setAccountEmail("")
    setSelectedUser(null)
    setErrors({}) // Clear all validation errors
  }

  const getRoleDisplay = (user: User) => {
    if (user.role?.role_name) {
      return user.role.role_name
    }
    return AUTH_LEVELS[user.auth_level] || "Unknown"
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
          Manage Users
        </h1>
        {permissions.canCreateUsers && (
          <Button
            onClick={handleAddUser}
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
            Add New User
          </Button>
        )}
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
          onClick={() => printTableData("Users")}
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
              <tr className="bg-[#105a9c] border-b border-[#0d4a82]">
                <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  First Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Last Name
                </th>
                {permissions.canViewEmail && (
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Email
                  </th>
                )}
                {permissions.canViewCompanyName && (
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Company
                  </th>
                )}
                <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Role
                </th>
                {(permissions.canEditUsers || permissions.canDeleteUsers) && (
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={permissions.canViewEmail && permissions.canViewCompanyName ? 6 : permissions.canViewEmail || permissions.canViewCompanyName ? 5 : 4} className="text-center py-8 text-gray-500">Loading users...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={permissions.canViewEmail && permissions.canViewCompanyName ? 6 : permissions.canViewEmail || permissions.canViewCompanyName ? 5 : 4} className="text-center py-8 text-gray-500">No users found.</td>
                </tr>
              ) : (
                users.map((user: User) => {
                  const nameParts = user.username.split(' ')
                  const firstName = nameParts[0] || user.username
                  const lastName = nameParts.slice(1).join(' ') || ''

                  return (
                    <tr key={user.user_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                        {firstName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                        {lastName}
                      </td>
                      {permissions.canViewEmail && (
                        <td className="px-6 py-4 text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          {user.email || 'N/A'}
                        </td>
                      )}
                      {permissions.canViewCompanyName && (
                        <td className="px-6 py-4 text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          {user.company_name || 'N/A'}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {getRoleDisplay(user)}
                        </span>
                      </td>
                      {(permissions.canEditUsers || permissions.canDeleteUsers) && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {permissions.canEditUsers && (
                              <button
                                onClick={() => handleEditUser(user)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                            {permissions.canDeleteUsers && (
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>



      {/* Add User Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => {
        if (!open) {
          // Immediately set closing flag and clear errors to prevent validation
          setIsClosingModal(true)
          setErrors({})
          // Blur active element to prevent validation on blur
          if (document.activeElement && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          resetForm() // Clear form and errors when closing
          setShowAddModal(false)
          // Reset flag after modal closes
          setTimeout(() => setIsClosingModal(false), 200)
        } else {
          setShowAddModal(open)
        }
      }}>
        <DialogContent
          className="max-w-md bg-white max-h-[90vh] overflow-y-auto"
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
              <User className="h-6 w-6 text-[#105a9c]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Add New User
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <ValidatedInput
              label="Username"
              placeholder="Enter username"
              value={username}
              validationRule={ValidationRules.user.username}
              fieldName="Username"
              onChange={(value) => setUsername(value)}
              skipValidation={isClosingModal}
              className="h-11 border-gray-300 bg-white"
            />

            {permissions.canViewEmail && (
              <ValidatedInput
                label="Email"
                type="email"
                placeholder="Enter email"
                value={email}
                validationRule={ValidationRules.user.email}
                fieldName="Email"
                onChange={(value) => setEmail(value)}
                skipValidation={isClosingModal}
                className="h-11 border-gray-300 bg-white"
              />
            )}

            {permissions.canEditPassword && (
              <ValidatedInput
                label="Password"
                type="password"
                placeholder="Enter password"
                value={password}
                validationRule={ValidationRules.user.password}
                fieldName="Password"
                onChange={(value) => setPassword(value)}
                skipValidation={isClosingModal}
                className="h-11 border-gray-300 bg-white"
              />
            )}

            {permissions.canEditRole && (
              <div className="space-y-2">
                <Label htmlFor="roleId" className="text-sm font-medium text-gray-700">
                  Role <span className="text-red-500">*</span>
                </Label>
                <select
                  id="roleId"
                  value={roleId}
                  onChange={(e) => {
                    setRoleId(e.target.value)
                    // Also set auth_level for backward compatibility
                    const selectedRole = roles.find((r: any) => r.role_id.toString() === e.target.value)
                    if (selectedRole) {
                      // Map role to auth_level (Super Admin=1, Admin=2, Manager=3)
                      if (selectedRole.role_name === 'Super Admin') setAuthLevel('1')
                      else if (selectedRole.role_name === 'Admin') setAuthLevel('2')
                      else setAuthLevel('3')
                    }
                  }}
                  className="w-full h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#105a9c]"
                  style={{ fontFamily: 'Albert Sans' }}
                  required
                >
                  <option value="">Select a role</option>
                  {roles.map((role: any) => (
                    <option key={role.role_id} value={role.role_id.toString()}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {permissions.canEditCompanyName && (
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-sm font-medium text-gray-700">
                  Company Name
                </Label>
                <Input
                  id="companyName"
                  placeholder="Enter company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-11 border-gray-300 bg-white"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
            )}

            {permissions.canEditAccountEmail && (
              <div className="space-y-2">
                <Label htmlFor="accountEmail" className="text-sm font-medium text-gray-700">
                  Account Email
                </Label>
                <Input
                  id="accountEmail"
                  type="email"
                  placeholder="Enter account email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  className="h-11 border-gray-300 bg-white"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
            )}

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
                onClick={handleSaveUser}
                disabled={!username || (permissions.canViewEmail && !email) || (permissions.canEditPassword && !password) || createUserMutation.isPending}
                className="flex-1 bg-[#105a9c] hover:bg-[#0d4a82] text-white disabled:opacity-50"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        if (!open) {
          // Immediately set closing flag and clear errors to prevent validation
          setIsClosingModal(true)
          setErrors({})
          // Blur active element to prevent validation on blur
          if (document.activeElement && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          resetForm() // Clear form and errors when closing
          setShowEditModal(false)
          // Reset flag after modal closes
          setTimeout(() => setIsClosingModal(false), 200)
        } else {
          setShowEditModal(open)
        }
      }}>
        <DialogContent
          className="max-w-md bg-white max-h-[90vh] overflow-y-auto"
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
              <Edit className="h-6 w-6 text-[#105a9c]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Edit User
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editUsername" className="text-sm font-medium text-gray-700">
                Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="editUsername"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 border-gray-300 bg-white"
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>

            {permissions.canEditEmail && (
              <div className="space-y-2">
                <Label htmlFor="editEmail" className="text-sm font-medium text-gray-700">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="editEmail"
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 border-gray-300 bg-white"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
            )}

            {permissions.canEditPassword && (
              <div className="space-y-2">
                <Label htmlFor="editPassword" className="text-sm font-medium text-gray-700">
                  New Password (leave blank to keep current)
                </Label>
                <Input
                  id="editPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 border-gray-300 bg-white"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
            )}

            {permissions.canEditRole && (
              <div className="space-y-2">
                <Label htmlFor="editRoleId" className="text-sm font-medium text-gray-700">
                  Role <span className="text-red-500">*</span>
                </Label>
                <select
                  id="editRoleId"
                  value={roleId}
                  onChange={(e) => {
                    setRoleId(e.target.value)
                    // Also set auth_level for backward compatibility
                    const selectedRole = roles.find((r: any) => r.role_id.toString() === e.target.value)
                    if (selectedRole) {
                      // Map role to auth_level (Super Admin=1, Admin=2, Manager=3)
                      if (selectedRole.role_name === 'Super Admin') setAuthLevel('1')
                      else if (selectedRole.role_name === 'Admin') setAuthLevel('2')
                      else setAuthLevel('3')
                    }
                  }}
                  className="w-full h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#105a9c]"
                  style={{ fontFamily: 'Albert Sans' }}
                  required
                >
                  <option value="">Select a role</option>
                  {roles.map((role: any) => (
                    <option key={role.role_id} value={role.role_id.toString()}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {permissions.canEditCompanyName && (
              <div className="space-y-2">
                <Label htmlFor="editCompanyName" className="text-sm font-medium text-gray-700">
                  Company Name
                </Label>
                <Input
                  id="editCompanyName"
                  placeholder="Enter company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-11 border-gray-300 bg-white"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
            )}

            {permissions.canEditAccountEmail && (
              <div className="space-y-2">
                <Label htmlFor="editAccountEmail" className="text-sm font-medium text-gray-700">
                  Account Email
                </Label>
                <Input
                  id="editAccountEmail"
                  type="email"
                  placeholder="Enter account email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  className="h-11 border-gray-300 bg-white"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
            )}

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
                onClick={handleSaveUser}
                disabled={!username || (permissions.canEditEmail && !email) || updateUserMutation.isPending}
                className="flex-1 bg-[#105a9c] hover:bg-[#0d4a82] text-white disabled:opacity-50"
                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
              >
                {updateUserMutation.isPending ? "Updating..." : "Update User"}
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
              Delete User
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Albert Sans' }}>
                  Are you sure you want to permanently delete this user? This action cannot be undone.
                </p>
                <p className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  {selectedUser?.username} ({selectedUser?.email})
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false)
                setSelectedUser(null)
              }}
              className="border-gray-300"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleteUserMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
