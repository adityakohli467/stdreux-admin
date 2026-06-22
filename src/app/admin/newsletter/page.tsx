"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { newsletterAPI } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Trash2, MailX, AlertCircle, RefreshCw, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Newsletter {
    subscription_id: number;
    email: string;
    status: 'active' | 'unsubscribed';
    source: string;
    subscribed_at: string;
    unsubscribed_at: string | null;
}

export default function NewsletterPage() {
    const queryClient = useQueryClient()

    // State for pagination, search, and filtering
    const [page, setPage] = useState(1)
    const [limit] = useState(10)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")

    // State for delete modal
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [selectedNewsletter, setSelectedNewsletter] = useState<Newsletter | null>(null)

    // Fetch data
    const { data, isLoading, isError } = useQuery({
        queryKey: ["newsletter", page, limit, search, statusFilter],
        queryFn: async () => {
            const response = await newsletterAPI.list({
                page,
                limit,
                search: search || undefined,
                status: statusFilter !== "all" ? statusFilter : undefined
            })
            return response.data
        },
    })

    // Data from API
    const newsletters = data?.data || []
    const totalPages = data?.totalPages || 1
    const total = data?.total || 0

    // Mutations
    const unsubscribeMutation = useMutation({
        mutationFn: async (id: number) => {
            const response = await newsletterAPI.unsubscribe(id)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["newsletter"] })
            toast.success("Subscriber unsubscribed successfully")
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to unsubscribe")
        }
    })

    const reactivateMutation = useMutation({
        mutationFn: async (id: number) => {
            const response = await newsletterAPI.reactivate(id)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["newsletter"] })
            toast.success("Subscriber reactivated successfully")
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to reactivate")
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const response = await newsletterAPI.delete(id)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["newsletter"] })
            toast.success("Subscription deleted successfully")
            setShowDeleteModal(false)
            setSelectedNewsletter(null)
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to delete subscription")
            setShowDeleteModal(false)
            setSelectedNewsletter(null)
        }
    })

    // Handlers
    const handleUnsubscribe = (id: number) => {
        unsubscribeMutation.mutate(id)
    }

    const handleReactivate = (id: number) => {
        reactivateMutation.mutate(id)
    }

    const handleDeleteClick = (newsletter: Newsletter) => {
        setSelectedNewsletter(newsletter)
        setShowDeleteModal(true)
    }

    const handleConfirmDelete = () => {
        if (selectedNewsletter) {
            deleteMutation.mutate(selectedNewsletter.subscription_id)
        }
    }

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value)
        setPage(1) // Reset to first page on search
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
                    Newsletter Subscriptions
                </h1>
                <Button
                    variant="outline"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["newsletter"] })}
                    className="flex items-center gap-2 border-gray-300"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                        placeholder="Search by email..."
                        value={search}
                        onChange={handleSearchChange}
                        className="w-full h-[48px] border border-gray-200 bg-white rounded-md focus:ring-2 focus:ring-[#105a9c] focus:border-[#105a9c] focus:outline-none"
                        style={{ fontFamily: 'Albert Sans', paddingLeft: '44px' }}
                    />
                </div>

                <div className="w-full sm:w-48">
                    <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                        <SelectTrigger className="w-full h-[48px] bg-white border-gray-200">
                            <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table */}
            <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white mb-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#105a9c] border-b border-[#0d4a82]">
                                <th className="px-6 py-4 text-sm font-semibold text-white whitespace-nowrap">ID</th>
                                <th className="px-6 py-4 text-sm font-semibold text-white whitespace-nowrap">Email</th>
                                <th className="px-6 py-4 text-sm font-semibold text-white whitespace-nowrap">Status</th>
                                <th className="px-6 py-4 text-sm font-semibold text-white whitespace-nowrap">Source</th>
                                <th className="px-6 py-4 text-sm font-semibold text-white whitespace-nowrap">Subscribed At</th>
                                <th className="px-6 py-4 text-sm font-semibold text-white whitespace-nowrap text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500">Loading subscriptions...</td>
                                </tr>
                            ) : isError ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-red-500">Failed to load subscriptions.</td>
                                </tr>
                            ) : newsletters.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500">No subscriptions found.</td>
                                </tr>
                            ) : (
                                newsletters.map((newsletter: Newsletter) => (
                                    <tr key={newsletter.subscription_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-900">{newsletter.subscription_id}</td>
                                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{newsletter.email}</td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {newsletter.status === 'active' ? (
                                                <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 whitespace-nowrap">
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 whitespace-nowrap">
                                                    Unsubscribed
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{newsletter.source || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">
                                            {newsletter.subscribed_at ? format(new Date(newsletter.subscribed_at), "dd/MM/yy") : '-'}
                                        </td>
                                        <td className="px-6 py-4 flex items-center justify-end gap-2">
                                            {newsletter.status === 'active' ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleUnsubscribe(newsletter.subscription_id)}
                                                    disabled={unsubscribeMutation.isPending}
                                                    className="h-8 px-3 text-xs flex items-center gap-1.5"
                                                >
                                                    <MailX className="h-3.5 w-3.5" />
                                                    Unsubscribe
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleReactivate(newsletter.subscription_id)}
                                                    disabled={reactivateMutation.isPending}
                                                    className="h-8 px-3 text-xs flex items-center gap-1.5 border-green-200 text-green-700 hover:bg-green-50 hover:text-black"
                                                >
                                                    <UserCheck className="h-3.5 w-3.5" />
                                                    Reactivate
                                                </Button>
                                            )}

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteClick(newsletter)}
                                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                title="Delete permanently"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Pagination */}
            {!isLoading && !isError && newsletters.length > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                        Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} entries
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="bg-white"
                        >
                            Previous
                        </Button>
                        <div className="text-sm font-medium px-4">
                            Page {page} of {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="bg-white"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <DialogContent className="sm:max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                            Delete Subscription
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-red-100">
                                <AlertCircle className="h-6 w-6 text-red-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-600 mb-2">
                                    Are you sure you want to completely delete the subscription for this email? This action cannot be undone.
                                </p>
                                <p className="text-base font-semibold text-gray-900">
                                    {selectedNewsletter?.email}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowDeleteModal(false)
                                setSelectedNewsletter(null)
                            }}
                            className="border-gray-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmDelete}
                            disabled={deleteMutation.isPending}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
