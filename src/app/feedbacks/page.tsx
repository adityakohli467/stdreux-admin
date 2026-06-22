"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Printer, Download, Trash2, Eye, Send, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Textarea } from "@/components/ui/textarea"

interface Feedback {
  feedback_id: number
  order_id: number
  cname: string
  company_name: string
  delivery_date: string
  website_experience: string
  food: number
  pricing: number
  menu: number
  experience: number
  delivery: number
  packaging: number
  service: number
  commenttext: string
  deliveredontime: string
  location_id: number
  suggestions: string
  customer_name?: string
  customer_order_name?: string
  delivery_date_time?: string
}

export default function FeedbacksPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [improvementFilter, setImprovementFilter] = useState("")
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showSendEmailModal, setShowSendEmailModal] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [recipientEmail, setRecipientEmail] = useState("")
  const [customMessage, setCustomMessage] = useState("")

  // Fetch feedbacks
  const { data: feedbacksData, isLoading, error, refetch } = useQuery({
    queryKey: ["feedbacks", improvementFilter],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()
        if (improvementFilter) params.append("improvement_on", improvementFilter)
        params.append("limit", "1000") // Get more records
        params.append("offset", "0")
        
        const response = await api.get(`/admin/feedbacks?${params}`)
        return response.data
      } catch (error: any) {
        console.error("Error fetching feedbacks:", error)
        toast.error(error.response?.data?.message || "Failed to load feedbacks")
        throw error
      }
    },
    retry: 1,
  })

  // Delete feedback mutation
  const deleteFeedbackMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/admin/feedbacks/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedbacks"] })
      toast.success("Feedback deleted successfully!")
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete feedback")
    },
  })

  // Fetch single feedback for view
  const { data: feedbackDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["feedback", selectedFeedback?.feedback_id],
    queryFn: async () => {
      if (!selectedFeedback?.feedback_id) return null
      const response = await api.get(`/admin/feedbacks/${selectedFeedback.feedback_id}`)
      return response.data.feedback
    },
    enabled: !!selectedFeedback?.feedback_id && showViewModal,
  })

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async ({ id, email, message }: { id: number; email?: string; message?: string }) => {
      const response = await api.post(`/admin/feedbacks/${id}/send-email`, {
        recipient_email: email,
        custom_message: message,
      })
      return response.data
    },
    onSuccess: (data) => {
      if (data.email_sent) {
        toast.success("Feedback email sent successfully!", {
          description: `Sent to: ${data.recipient}`,
        })
      } else {
        toast.info("Email prepared (email service not configured)", {
          description: data.note || "Email service not configured",
        })
      }
      setShowSendEmailModal(false)
      setRecipientEmail("")
      setCustomMessage("")
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to send email")
    },
  })

  const feedbacks = feedbacksData?.feedbacks || []

  // Filter feedbacks by search query
  const filteredFeedbacks = feedbacks.filter((feedback: Feedback) => {
    if (!searchQuery) return true
    
    const query = searchQuery.toLowerCase()
    return (
      feedback.cname?.toLowerCase().includes(query) ||
      feedback.customer_name?.toLowerCase().includes(query) ||
      feedback.company_name?.toLowerCase().includes(query) ||
      feedback.order_id?.toString().includes(query) ||
      feedback.website_experience?.toLowerCase().includes(query) ||
      feedback.commenttext?.toLowerCase().includes(query) ||
      feedback.suggestions?.toLowerCase().includes(query) ||
      feedback.deliveredontime?.toLowerCase().includes(query) ||
      (feedback.delivery_date && new Date(feedback.delivery_date).toLocaleDateString().includes(query))
    )
  })

  const handleView = (feedback: Feedback) => {
    setSelectedFeedback(feedback)
    setShowViewModal(true)
  }

  const handleSendEmail = async (feedback: Feedback) => {
    setSelectedFeedback(feedback)
    setCustomMessage("")
    
    // Try to fetch order details to get customer email
    try {
      const orderResponse = await api.get(`/admin/orders/${feedback.order_id}`)
      const order = orderResponse.data.order
      const email = order?.customer_order_email || order?.email || order?.customer_email || ""
      setRecipientEmail(email)
    } catch (error) {
      // If order fetch fails, just leave email empty
      setRecipientEmail("")
    }
    
    setShowSendEmailModal(true)
  }

  const handleDelete = (feedback: Feedback) => {
    setSelectedFeedback(feedback)
    setShowConfirmModal(true)
  }

  const handleConfirmDelete = () => {
    if (selectedFeedback) {
      deleteFeedbackMutation.mutate(selectedFeedback.feedback_id)
    }
    setShowConfirmModal(false)
    setSelectedFeedback(null)
  }

  const handleCancelDelete = () => {
    setShowConfirmModal(false)
    setSelectedFeedback(null)
  }

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    // The query will automatically refetch when improvementFilter changes
    // due to the queryKey dependency
    refetch()
  }

  const handleReset = () => {
    setImprovementFilter("")
    setSearchQuery("")
    // Refetch without filter
    setTimeout(() => {
      refetch()
    }, 100)
  }

  const handleDownloadReport = () => {
    if (filteredFeedbacks.length === 0) {
      toast.error("No feedbacks to download")
      return
    }

    try {
      // Export to CSV with proper escaping
      const escapeCSV = (value: any) => {
        if (value === null || value === undefined) return ''
        const stringValue = String(value)
        // If contains comma, quote, or newline, wrap in quotes and escape quotes
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }

      const csv = [
        ['Order ID', 'Customer', 'Company', 'Website Experience', 'Delivered On Time', 'Improvement On', 'Suggestions', 'Delivery Date'],
        ...filteredFeedbacks.map((f: Feedback) => [
          f.order_id || '',
          escapeCSV(f.cname || f.customer_name || ''),
          escapeCSV(f.company_name || ''),
          escapeCSV(f.website_experience || ''),
          escapeCSV(f.deliveredontime || ''),
          escapeCSV(f.commenttext || ''),
          escapeCSV(f.suggestions || ''),
          f.delivery_date ? format(new Date(f.delivery_date), 'yyyy-MM-dd') : ''
        ])
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `feedbacks_${format(new Date(), 'yyyy-MM-dd')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success(`Downloaded ${filteredFeedbacks.length} feedback(s)`)
    } catch (error) {
      console.error("Error downloading report:", error)
      toast.error("Failed to download report")
    }
  }

  const getRatingDisplay = (rating: number) => {
    if (!rating || rating === 0) return '-'
    return `${rating}/5`
  }

  return (
    <div className="bg-gray-50 min-h-screen overflow-x-hidden" style={{ fontFamily: 'Albert Sans' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-gray-900 text-2xl sm:text-3xl lg:text-4xl" style={{ 
          fontFamily: 'Albert Sans',
          fontWeight: 600,
          fontStyle: 'normal',
          lineHeight: '1.2',
          letterSpacing: '0%'
        }}>
          View Customer Feedbacks
        </h1>
      </div>

      {/* Filters Card */}
      <Card className="mb-6 border border-gray-200 shadow-sm">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filters</h3>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="gap-2 w-full sm:w-auto border-gray-300"
                disabled={isLoading}
                style={{ fontWeight: 600 }}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={handleDownloadReport}
                className="bg-[#105a9c] hover:bg-[#0d4a82] text-white gap-2 w-full sm:w-auto"
                disabled={filteredFeedbacks.length === 0}
                style={{ fontWeight: 600 }}
              >
                <Download className="h-4 w-4" />
                Download Report
              </Button>
            </div>
          </div>
          
          <form onSubmit={handleFilter}>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
              <div className="flex-1 w-full sm:min-w-[200px]">
                <Input
                  placeholder="Improvement On"
                  value={improvementFilter}
                  onChange={(e) => setImprovementFilter(e.target.value)}
                  className="h-11 border-gray-300 w-full"
                  style={{ fontFamily: 'Albert Sans' }}
                />
              </div>
              <Button
                type="submit"
                className="bg-[#105a9c] hover:bg-[#0d4a82] text-white h-11 w-full sm:w-auto"
                style={{ fontWeight: 600 }}
              >
                Filter
              </Button>
              <Button
                type="button"
                onClick={handleReset}
                variant="outline"
                className="h-11 border-gray-300 w-full sm:w-auto"
                style={{ fontWeight: 600 }}
              >
                Reset
              </Button>
            </div>
          </form>
        </div>
      </Card>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search Order ID, Customer ID, Status etc."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-[488px] h-[54px] border border-gray-200 bg-white rounded-full focus:ring-2 focus:ring-[#105a9c] focus:border-[#105a9c] focus:outline-none"
            style={{ fontFamily: 'Albert Sans', paddingLeft: '44px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
          />
        </div>
      </div>

      {/* Table */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-[#105a9c] border-b border-[#0d4a82]">
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Order
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Customer
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap hidden md:table-cell" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Company
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap hidden lg:table-cell" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Website Experience
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Delivered On Time?
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap hidden xl:table-cell" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Improvement On
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap hidden lg:table-cell" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Suggestions
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                    Action
                  </th>
                </tr>
              </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-[#105a9c]" />
                      <span>Loading feedbacks...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-red-500 font-medium">Error loading feedbacks</p>
                      <p className="text-sm text-gray-500">
                        {error instanceof Error ? error.message : "An error occurred"}
                      </p>
                      <Button
                        onClick={() => refetch()}
                        variant="outline"
                        size="sm"
                        className="mt-2"
                      >
                        Retry
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : filteredFeedbacks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <p className="font-medium">
                        {feedbacks.length === 0 
                          ? "No feedbacks found in the system" 
                          : searchQuery || improvementFilter
                          ? "No feedbacks match your search criteria"
                          : "No feedbacks found"}
                      </p>
                      {(searchQuery || improvementFilter) && (
                        <Button
                          onClick={handleReset}
                          variant="outline"
                          size="sm"
                          className="mt-2"
                        >
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFeedbacks.map((feedback: Feedback) => (
                  <tr key={feedback.feedback_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-3 sm:px-4 py-3">
                      <span className="text-gray-900 text-xs sm:text-sm" style={{ 
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>
                        #{feedback.order_id}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <span className="text-gray-700 text-xs sm:text-sm" style={{ 
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>
                        {feedback.cname || feedback.customer_name || '-'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
                      <span className="text-gray-700 text-xs sm:text-sm" style={{ 
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>
                        {feedback.company_name || '-'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 hidden lg:table-cell">
                      <span className="text-gray-700 text-xs sm:text-sm" style={{ 
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>
                        {feedback.website_experience || '-'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <span className={`inline-flex items-center px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium ${
                        feedback.deliveredontime?.toLowerCase() === 'yes' 
                          ? 'bg-green-50 text-green-700'
                          : feedback.deliveredontime?.toLowerCase() === 'no'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {feedback.deliveredontime || '-'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 hidden xl:table-cell">
                      <span className="text-gray-700 text-xs sm:text-sm" style={{ 
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>
                        {feedback.commenttext || '-'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 hidden lg:table-cell max-w-xs">
                      <span className="text-gray-700 line-clamp-2 text-xs sm:text-sm" style={{ 
                        fontFamily: 'Albert Sans',
                        fontWeight: 400,
                        fontStyle: 'normal',
                        lineHeight: '20px',
                        letterSpacing: '0%'
                      }}>
                        {feedback.suggestions || '-'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button
                          onClick={() => handleView(feedback)}
                          className="p-1.5 sm:p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleSendEmail(feedback)}
                          className="p-1.5 sm:p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                          title="Send Email"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(feedback)}
                          className="p-1.5 sm:p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
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
        </div>
      </Card>

      {/* Summary */}
      <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="text-xs sm:text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
          {isLoading ? (
            "Loading..."
          ) : (
            <>
              Showing <span className="font-semibold text-gray-900">{filteredFeedbacks.length}</span> of{" "}
              <span className="font-semibold text-gray-900">{feedbacks.length}</span> feedback
              {feedbacks.length !== 1 ? "s" : ""}
              {(searchQuery || improvementFilter) && filteredFeedbacks.length < feedbacks.length && (
                <span className="text-gray-500 ml-1">
                  (filtered from {feedbacks.length} total)
                </span>
              )}
            </>
          )}
        </div>
        {feedbacks.length > 0 && (
          <div className="text-xs text-gray-500" style={{ fontFamily: 'Albert Sans' }}>
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* View Feedback Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 700 }}>
              Feedback Details - Order #{selectedFeedback?.order_id}
            </DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="py-8 text-center">
              <p className="text-gray-500">Loading feedback details...</p>
            </div>
          ) : feedbackDetail ? (
            <div className="space-y-6 py-4">
              {/* Customer Information */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Albert Sans' }}>
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Customer Name</p>
                    <p className="text-sm text-gray-900">{feedbackDetail.cname || feedbackDetail.customer_name || '-'}</p>
                  </div>
                  {feedbackDetail.company_name && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Company</p>
                      <p className="text-sm text-gray-900">{feedbackDetail.company_name}</p>
                    </div>
                  )}
                  {feedbackDetail.delivery_date && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Delivery Date</p>
                      <p className="text-sm text-gray-900">{new Date(feedbackDetail.delivery_date).toLocaleDateString()}</p>
                    </div>
                  )}
                  {feedbackDetail.deliveredontime && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Delivered On Time</p>
                      <p className={`text-sm ${feedbackDetail.deliveredontime.toLowerCase() === 'yes' ? 'text-green-600' : 'text-red-600'}`}>
                        {feedbackDetail.deliveredontime}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ratings */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Albert Sans' }}>
                  Ratings
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {feedbackDetail.food > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Food</p>
                      <p className="text-sm text-gray-900">{feedbackDetail.food}/5</p>
                    </div>
                  )}
                  {feedbackDetail.pricing > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pricing</p>
                      <p className="text-sm text-gray-900">{feedbackDetail.pricing}/5</p>
                    </div>
                  )}
                  {feedbackDetail.menu > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Menu</p>
                      <p className="text-sm text-gray-900">{feedbackDetail.menu}/5</p>
                    </div>
                  )}
                  {feedbackDetail.experience > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Experience</p>
                      <p className="text-sm text-gray-900">{feedbackDetail.experience}/5</p>
                    </div>
                  )}
                  {feedbackDetail.delivery > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Delivery</p>
                      <p className="text-sm text-gray-900">{feedbackDetail.delivery}/5</p>
                    </div>
                  )}
                  {feedbackDetail.packaging > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Packaging</p>
                      <p className="text-sm text-gray-900">{feedbackDetail.packaging}/5</p>
                    </div>
                  )}
                  {feedbackDetail.service > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Service</p>
                      <p className="text-sm text-gray-900">{feedbackDetail.service}/5</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Comments */}
              {feedbackDetail.website_experience && (
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: 'Albert Sans' }}>
                    Website Experience
                  </h3>
                  <p className="text-sm text-gray-700">{feedbackDetail.website_experience}</p>
                </div>
              )}

              {feedbackDetail.commenttext && (
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: 'Albert Sans' }}>
                    Comments
                  </h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{feedbackDetail.commenttext}</p>
                </div>
              )}

              {feedbackDetail.suggestions && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: 'Albert Sans' }}>
                    Suggestions
                  </h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{feedbackDetail.suggestions}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-red-500">Failed to load feedback details</p>
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button
              onClick={() => setShowViewModal(false)}
              variant="outline"
              className="border-gray-300"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Email Modal */}
      <Dialog open={showSendEmailModal} onOpenChange={setShowSendEmailModal}>
        <DialogContent className="w-[95vw] sm:w-full max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 700 }}>
              Send Feedback Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block" style={{ fontFamily: 'Albert Sans' }}>
                Recipient Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                placeholder="customer@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full h-11"
                style={{ fontFamily: 'Albert Sans' }}
              />
              <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Albert Sans' }}>
                {selectedFeedback?.customer_order_name || selectedFeedback?.cname ? 
                  `Customer: ${selectedFeedback.customer_order_name || selectedFeedback.cname}` : 
                  'Email will be retrieved from order if not provided'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block" style={{ fontFamily: 'Albert Sans' }}>
                Custom Message (Optional)
              </label>
              <Textarea
                placeholder="Add a custom message to include in the email..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={4}
                className="w-full"
                style={{ fontFamily: 'Albert Sans' }}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <Button
              onClick={() => {
                setShowSendEmailModal(false)
                setRecipientEmail("")
                setCustomMessage("")
              }}
              variant="outline"
              className="border-gray-300"
              disabled={sendEmailMutation.isPending}
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedFeedback) return
                if (!recipientEmail.trim()) {
                  toast.error("Please enter recipient email")
                  return
                }
                sendEmailMutation.mutate({
                  id: selectedFeedback.feedback_id,
                  email: recipientEmail.trim(),
                  message: customMessage.trim() || undefined,
                })
              }}
              disabled={sendEmailMutation.isPending || !recipientEmail.trim()}
              className="bg-[#105a9c] hover:bg-[#0d4a82] text-white"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              {sendEmailMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="w-[95vw] sm:w-full max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 700 }}>
              Delete Feedback
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Albert Sans' }}>
                  Are you sure you want to permanently delete this feedback? This action cannot be undone.
                </p>
                <p className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Order #{selectedFeedback?.order_id}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              className="border-gray-300 w-full sm:w-auto"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

