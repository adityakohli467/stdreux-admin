"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Calendar, Clock, User, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react"
import { historyAPI } from "@/lib/api"
import { toast } from "sonner"

interface HistoryEntry {
  history_id: number
  request_method: string
  request_url: string
  request_path: string
  request_query: string | null
  request_headers: string | null
  request_body: string | null
  request_ip: string | null
  user_agent: string | null
  response_status: number | null
  response_body: string | null
  response_time_ms: number | null
  user_id: number | null
  username: string | null
  customer_id: number | null
  user_type: string | null
  event_type: string | null
  event_category: string | null
  event_description: string | null
  resource_type: string | null
  resource_id: number | null
  is_successful: boolean
  error_message: string | null
  error_stack: string | null
  created_at: string
}

interface Statistics {
  total: number
  successful: number
  failed: number
  successRate: string
  averageResponseTime: string
  eventTypeStats: Array<{ event_type: string; count: string }>
  eventCategoryStats: Array<{ event_category: string; count: string }>
  methodStats: Array<{ request_method: string; count: string }>
}

export default function HistoryPage() {
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [search, setSearch] = useState("")
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showFilters, setShowFilters] = useState(false) // Collapsible filters
  
  // Filters
  const [eventType, setEventType] = useState<string>("")
  const [eventCategory, setEventCategory] = useState<string>("")
  const [resourceType, setResourceType] = useState<string>("")
  const [userType, setUserType] = useState<string>("")
  const [requestMethod, setRequestMethod] = useState<string>("")
  const [isSuccessful, setIsSuccessful] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  // Fetch history
  const { data: historyData, isLoading, error, refetch } = useQuery({
    queryKey: ["history", page, limit, search, eventType, eventCategory, resourceType, userType, requestMethod, isSuccessful, startDate, endDate],
    queryFn: async () => {
      try {
        const params: any = { page, limit }
        if (search) params.search = search
        if (eventType) params.eventType = eventType
        if (eventCategory) params.eventCategory = eventCategory
        if (resourceType) params.resourceType = resourceType
        if (userType) params.userType = userType
        if (requestMethod) params.requestMethod = requestMethod
        if (isSuccessful !== "") params.isSuccessful = isSuccessful === "true"
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate

        const response = await historyAPI.list(params)
        return response.data
      } catch (error: any) {
        console.error("Error fetching history:", error)
        toast.error(error.response?.data?.message || "Failed to load history")
        throw error
      }
    },
    retry: 1,
  })

  // Fetch statistics
  const { data: statistics } = useQuery({
    queryKey: ["history-statistics", startDate, endDate, userType],
    queryFn: async () => {
      try {
        const params: any = {}
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
        if (userType) params.userType = userType

        const response = await historyAPI.statistics(params)
        return response.data
      } catch (error) {
        console.error("Error fetching statistics:", error)
        return null
      }
    },
  })

  // Fetch filter options
  const { data: eventTypes } = useQuery({
    queryKey: ["history-event-types"],
    queryFn: async () => {
      try {
        const response = await historyAPI.eventTypes()
        return response.data || []
      } catch (error) {
        console.error("Error fetching event types:", error)
        return []
      }
    },
  })

  const { data: eventCategories } = useQuery({
    queryKey: ["history-event-categories"],
    queryFn: async () => {
      try {
        const response = await historyAPI.eventCategories()
        return response.data || []
      } catch (error) {
        console.error("Error fetching event categories:", error)
        return []
      }
    },
  })

  const { data: resourceTypes } = useQuery({
    queryKey: ["history-resource-types"],
    queryFn: async () => {
      try {
        const response = await historyAPI.resourceTypes()
        return response.data || []
      } catch (error) {
        console.error("Error fetching resource types:", error)
        return []
      }
    },
  })

  const history = historyData?.history || []
  const pagination = historyData?.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 }

  const handleViewDetails = (entry: HistoryEntry) => {
    setSelectedEntry(entry)
    setShowDetails(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const getStatusBadge = (entry: HistoryEntry) => {
    if (entry.is_successful) {
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>
    }
    return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
  }

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      GET: "bg-blue-500",
      POST: "bg-green-500",
      PUT: "bg-yellow-500",
      PATCH: "bg-orange-500",
      DELETE: "bg-red-500",
    }
    return <Badge className={colors[method] || "bg-gray-500"}>{method}</Badge>
  }

  const clearFilters = () => {
    setSearch("")
    setEventType("")
    setEventCategory("")
    setResourceType("")
    setUserType("")
    setRequestMethod("")
    setIsSuccessful("")
    setStartDate("")
    setEndDate("")
    setPage(1)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">API History & Audit Log</h1>
        <p className="text-gray-600">Comprehensive audit log of all API calls and events</p>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-1">Total Requests</div>
            <div className="text-2xl font-bold">{(statistics.total || 0).toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-1">Success Rate</div>
            <div className="text-2xl font-bold text-green-600">{statistics.successRate || "0.00"}%</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-1">Failed Requests</div>
            <div className="text-2xl font-bold text-red-600">{(statistics.failed || 0).toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-1">Avg Response Time</div>
            <div className="text-2xl font-bold">{statistics.averageResponseTime || "0.00"}ms</div>
          </Card>
        </div>
      )}

      {/* Compact Filters */}
      <Card className="mb-6">
        <div className="p-4">
          {/* Search and Quick Filters Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search path, description, user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={userType || "all"} onValueChange={(value) => setUserType(value === "all" ? "" : value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="User Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="store">Store</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
              <Select value={requestMethod || "all"} onValueChange={(value) => setRequestMethod(value === "all" ? "" : value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
              <Select value={isSuccessful || "all"} onValueChange={(value) => setIsSuccessful(value === "all" ? "" : value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Success</SelectItem>
                  <SelectItem value="false">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                More Filters
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Advanced Filters (Collapsible) */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Event Type</Label>
                <Select value={eventType || "all"} onValueChange={(value) => setEventType(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {eventTypes?.map((type: string) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Event Category</Label>
                <Select value={eventCategory || "all"} onValueChange={(value) => setEventCategory(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {eventCategories?.map((cat: string) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Resource Type</Label>
                <Select value={resourceType || "all"} onValueChange={(value) => setResourceType(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Resources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Resources</SelectItem>
                    {resourceTypes?.map((type: string) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Clear All
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* History Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">Time</th>
                <th className="text-left p-4">Method</th>
                <th className="text-left p-4">Path</th>
                <th className="text-left p-4">Event</th>
                <th className="text-left p-4">User</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Response Time</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-[#0d6efd]" />
                      <span>Loading history...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-6 w-6 text-red-500" />
                      <p className="text-red-500 font-medium">Error loading history</p>
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
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-6 w-6 text-gray-400" />
                      <p className="text-gray-500 font-medium">
                        {search || eventType || eventCategory || resourceType || userType || requestMethod || isSuccessful || startDate || endDate
                          ? "No history matches your filters"
                          : "No history found"}
                      </p>
                      <p className="text-sm text-gray-400">
                        {search || eventType || eventCategory || resourceType || userType || requestMethod || isSuccessful || startDate || endDate
                          ? "Try adjusting your filters or clearing them"
                          : "API calls will appear here once they are logged"}
                      </p>
                      {(search || eventType || eventCategory || resourceType || userType || requestMethod || isSuccessful || startDate || endDate) && (
                        <Button
                          onClick={clearFilters}
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
                history.map((entry: HistoryEntry) => (
                  <tr key={entry.history_id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <div className="text-sm">{formatDate(entry.created_at)}</div>
                    </td>
                    <td className="p-4">{getMethodBadge(entry.request_method)}</td>
                    <td className="p-4">
                      <div className="text-sm font-mono max-w-xs truncate" title={entry.request_path}>
                        {entry.request_path}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="font-medium">{entry.event_description || entry.event_type}</div>
                        {entry.event_category && (
                          <Badge variant="outline" className="text-xs mt-1">{entry.event_category}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        {entry.username && <div>{entry.username}</div>}
                        {entry.user_type && (
                          <Badge variant="outline" className="text-xs">{entry.user_type}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(entry)}
                        {entry.response_status && (
                          <span className="text-sm text-gray-500">{entry.response_status}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {entry.response_time_ms && (
                        <div className="text-sm">{entry.response_time_ms}ms</div>
                      )}
                    </td>
                    <td className="p-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(entry)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pagination.page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page === pagination.totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>History Entry Details</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>History ID</Label>
                  <div className="text-sm">{selectedEntry.history_id}</div>
                </div>
                <div>
                  <Label>Created At</Label>
                  <div className="text-sm">{formatDate(selectedEntry.created_at)}</div>
                </div>
                <div>
                  <Label>Request Method</Label>
                  <div>{getMethodBadge(selectedEntry.request_method)}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div>{getStatusBadge(selectedEntry)}</div>
                </div>
                <div>
                  <Label>Response Status</Label>
                  <div className="text-sm">{selectedEntry.response_status || "N/A"}</div>
                </div>
                <div>
                  <Label>Response Time</Label>
                  <div className="text-sm">{selectedEntry.response_time_ms ? `${selectedEntry.response_time_ms}ms` : "N/A"}</div>
                </div>
                <div>
                  <Label>User</Label>
                  <div className="text-sm">{selectedEntry.username || "N/A"}</div>
                </div>
                <div>
                  <Label>User Type</Label>
                  <div className="text-sm">{selectedEntry.user_type || "N/A"}</div>
                </div>
                <div>
                  <Label>Event Type</Label>
                  <div className="text-sm">{selectedEntry.event_type || "N/A"}</div>
                </div>
                <div>
                  <Label>Event Category</Label>
                  <div className="text-sm">{selectedEntry.event_category || "N/A"}</div>
                </div>
                <div>
                  <Label>Resource Type</Label>
                  <div className="text-sm">{selectedEntry.resource_type || "N/A"}</div>
                </div>
                <div>
                  <Label>Resource ID</Label>
                  <div className="text-sm">{selectedEntry.resource_id || "N/A"}</div>
                </div>
                <div>
                  <Label>IP Address</Label>
                  <div className="text-sm font-mono">{selectedEntry.request_ip || "N/A"}</div>
                </div>
                <div>
                  <Label>User Agent</Label>
                  <div className="text-sm text-xs break-all">{selectedEntry.user_agent || "N/A"}</div>
                </div>
              </div>

              <div>
                <Label>Request Path</Label>
                <div className="text-sm font-mono bg-gray-100 p-2 rounded">{selectedEntry.request_path}</div>
              </div>

              <div>
                <Label>Event Description</Label>
                <div className="text-sm">{selectedEntry.event_description || "N/A"}</div>
              </div>

              {selectedEntry.request_query && (
                <div>
                  <Label>Query Parameters</Label>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(JSON.parse(selectedEntry.request_query), null, 2)}
                  </pre>
                </div>
              )}

              {selectedEntry.request_body && (
                <div>
                  <Label>Request Body</Label>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-40">
                    {JSON.stringify(JSON.parse(selectedEntry.request_body), null, 2)}
                  </pre>
                </div>
              )}

              {selectedEntry.response_body && (
                <div>
                  <Label>Response Body</Label>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-40">
                    {JSON.stringify(JSON.parse(selectedEntry.response_body), null, 2)}
                  </pre>
                </div>
              )}

              {selectedEntry.error_message && (
                <div>
                  <Label className="text-red-600">Error Message</Label>
                  <div className="text-sm text-red-600">{selectedEntry.error_message}</div>
                </div>
              )}

              {selectedEntry.error_stack && (
                <div>
                  <Label className="text-red-600">Error Stack</Label>
                  <pre className="text-xs bg-red-50 p-2 rounded overflow-x-auto max-h-40">
                    {selectedEntry.error_stack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

