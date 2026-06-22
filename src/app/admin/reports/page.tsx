"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { Search, FileDown, FileText, Printer, Calendar as CalendarIcon, Filter } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { printTableData } from "@/lib/print-utils"

interface Report {
  order_id: number
  order_date: string
  delivery_date_time: string
  customer_name: string
  company_name: string
  department_name: string
  location_name: string
  order_status: number
  subtotal: number
  delivery_fee: number
  discount: number
  gst: number
  total: number
  standing_order: number
}

export default function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState("")

  // Filter state
  const [orderDateFrom, setOrderDateFrom] = useState<Date | null>(null)
  const [orderDateTo, setOrderDateTo] = useState<Date | null>(null)
  const [selectedStatus, setSelectedStatus] = useState("")

  // Applied filters (for API call)
  const [appliedFilters, setAppliedFilters] = useState({
    order_date_from: "",
    order_date_to: "",
    status: "",
    search: ""
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10000 // Fetch all records (effectively disabling pagination)

  // Fetch reports
  const { data: reportsData, isLoading } = useQuery({
    queryKey: ["reports", appliedFilters, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (appliedFilters.order_date_from) params.append("order_date_from", appliedFilters.order_date_from)
      if (appliedFilters.order_date_to) params.append("order_date_to", appliedFilters.order_date_to)
      if (appliedFilters.status) params.append("status", appliedFilters.status)
      if (appliedFilters.search) params.append("search", appliedFilters.search)
      params.append("limit", itemsPerPage.toString())
      params.append("offset", "0")

      // Fetch reports and subscriptions in parallel to check for standing orders
      const [reportsResponse, activeSubsResponse, inactiveSubsResponse] = await Promise.all([
        api.get(`/admin/reports?${params.toString()}`),
        api.get('/admin/subscriptions?limit=1000&status=active'),
        api.get('/admin/subscriptions?limit=1000&status=inactive')
      ])

      const reports = reportsResponse.data.reports || []
      const activeSubs = activeSubsResponse.data.subscriptions || []
      const inactiveSubs = inactiveSubsResponse.data.subscriptions || []

      const allSubs = [...activeSubs, ...inactiveSubs]

      // Create a map of order_id -> standing_order from subscriptions
      const subscriptionMap = new Map(allSubs.map((s: any) => [s.order_id, s.standing_order]))

      // Merge standing_order into reports
      // If the report already has it, use it. If not, check the map.
      const mergedReports = reports.map((r: any) => ({
        ...r,
        standing_order: r.standing_order || subscriptionMap.get(r.order_id) || 0
      }))


      return {
        ...reportsResponse.data,
        reports: mergedReports
      }
    },
  })

  const reports = reportsData?.reports || []
  const totalCount = reportsData?.count || 0
  const totalPages = Math.ceil(totalCount / itemsPerPage)

  const handleApplyFilters = () => {
    setAppliedFilters({
      order_date_from: orderDateFrom ? format(orderDateFrom as Date, "yyyy-MM-dd") : "",
      order_date_to: orderDateTo ? format(orderDateTo as Date, "yyyy-MM-dd") : "",
      status: selectedStatus,
      search: searchQuery
    })
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setOrderDateFrom(null)
    setOrderDateTo(null)
    setSelectedStatus("")
    setSearchQuery("")
    setAppliedFilters({
      order_date_from: "",
      order_date_to: "",
      status: "",
      search: ""
    })
    setCurrentPage(1)
  }

  const handleDownloadCSV = async () => {
    try {
      const params = new URLSearchParams()
      if (appliedFilters.order_date_from) params.append("order_date_from", appliedFilters.order_date_from)
      if (appliedFilters.order_date_to) params.append("order_date_to", appliedFilters.order_date_to)
      if (appliedFilters.status) params.append("status", appliedFilters.status)
      if (appliedFilters.search) params.append("search", appliedFilters.search)
      params.append("limit", "10000") // Fetch all records

      // Fetch data from list endpoint instead of download endpoint
      // Also fetch subscriptions to map standing orders
      const [reportsResponse, activeSubsResponse, inactiveSubsResponse] = await Promise.all([
        api.get(`/admin/reports?${params.toString()}`),
        api.get('/admin/subscriptions?limit=10000&status=active'),
        api.get('/admin/subscriptions?limit=10000&status=inactive')
      ])

      const reportsList = reportsResponse.data.reports || []
      const activeSubs = activeSubsResponse.data.subscriptions || []
      const inactiveSubs = inactiveSubsResponse.data.subscriptions || []

      const allSubs = [...activeSubs, ...inactiveSubs]
      const subscriptionMap = new Map(allSubs.map((s: any) => [s.order_id, s.standing_order]))

      const reports = reportsList.map((r: any) => ({
        ...r,
        standing_order: r.standing_order || subscriptionMap.get(r.order_id) || 0
      }))

      // Define Headers
      const headers = [
        "Order ID",
        "Order Date",
        "Type",
        "Customer",
        "Company",
        "Department",
        "Location",
        "Status",
        "Subtotal",
        "Delivery Fee",
        "Discount",
        "Total"
      ]

      // Map Data
      const rows = reports.map((report: Report) => [
        report.order_id,
        report.order_date ? format(new Date(report.order_date), "yyyy-MM-dd") : "",
        report.standing_order > 0 ? "Subscription" : "One Time",
        `"${(report.customer_name || "").replace(/"/g, '""')}"`,
        `"${(report.company_name || "").replace(/"/g, '""')}"`,
        `"${(report.department_name || "").replace(/"/g, '""')}"`,
        `"${(report.location_name || "").replace(/"/g, '""')}"`,
        getStatusBadge(report.order_status).label,
        report.subtotal.toFixed(2),
        report.delivery_fee.toFixed(2),
        report.discount.toFixed(2),
        (report.total - report.gst).toFixed(2) // Total excluding GST
      ])

      // Generate CSV Content
      const csvContent = [
        headers.join(","),
        ...rows.map((row: any[]) => row.join(","))
      ].join("\n")

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'orders_report.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()

      toast.success("CSV report downloaded successfully!")
    } catch (error: any) {
      console.error("Download CSV error:", error)
      toast.error(error.response?.data?.message || "Failed to download CSV")
    }
  }

  const handleDownloadExcel = () => {
    // For now, use CSV format for Excel
    handleDownloadCSV()
    toast.success("Excel report downloaded successfully!")
  }

  const handlePrint = () => {
    printTableData("Reports")
  }

  const getStatusBadge = (status: number) => {
    const statusMap: { [key: number]: { label: string; class: string } } = {
      0: { label: "Cancelled", class: "bg-gray-100 text-gray-600" },
      1: { label: "New", class: "bg-blue-50 text-blue-700" },
      2: { label: "Paid", class: "bg-blue-50 text-blue-700" },
      3: { label: "Completed", class: "bg-green-50 text-green-700" },
      4: { label: "Awaiting Approval", class: "bg-yellow-50 text-yellow-700" },
      5: { label: "Processing", class: "bg-purple-50 text-purple-700" },
      6: { label: "Production", class: "bg-indigo-50 text-indigo-700" },
      7: { label: "Approved", class: "bg-green-50 text-green-700" },
      8: { label: "Rejected", class: "bg-red-50 text-red-700" },
    }
    return statusMap[status] || { label: "Unknown", class: "bg-gray-100 text-gray-600" }
  }

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden" style={{ fontFamily: 'Albert Sans' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-gray-900" style={{
          fontFamily: 'Albert Sans',
          fontWeight: 600,
          fontStyle: 'normal',
          fontSize: '40px',
          lineHeight: '20px',
          letterSpacing: '0%'
        }}>
          Reports
        </h1>
      </div>

      {/* Filters Section */}
      <Card className="border border-gray-200 shadow-sm mb-6 p-6 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Order Date From/To */}
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-2.5 bg-white">
            <CalendarIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
            <div className="flex flex-col flex-1">
              <span className="text-xs text-gray-600 mb-1">Order Date</span>
              <DatePicker
                {...({ selected: orderDateFrom || undefined } as any)}
                onChange={(date) => setOrderDateFrom(date)}
                dateFormat="dd/MM/yyyy"
                placeholderText="From Date"
                className="text-sm text-gray-900 border-none outline-none w-full cursor-pointer"
                style={{ fontFamily: 'Albert Sans' }}
                wrapperClassName="w-full"
              />
            </div>
            <div className="flex flex-col flex-1 border-l pl-2">
              <span className="text-xs text-gray-600 mb-1">To Date</span>
              <DatePicker
                {...({ selected: orderDateTo || undefined } as any)}
                onChange={(date) => setOrderDateTo(date)}
                dateFormat="dd/MM/yyyy"
                placeholderText="To Date"
                className="text-sm text-gray-900 border-none outline-none w-full cursor-pointer"
                style={{ fontFamily: 'Albert Sans' }}
                wrapperClassName="w-full"
              />
            </div>
          </div>



          {/* Select Statuses */}
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-2.5 bg-white">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex-1 text-sm bg-transparent border-none p-0 focus:outline-none"
              style={{ fontFamily: 'Albert Sans' }}
            >
              <option value="">Select Statuses</option>
              <option value="7">Approved</option>
              <option value="90">All minus paid</option>
              <option value="91">All minus cancelled</option>
              <option value="8">Rejected</option>
              <option value="0">Cancelled</option>
              <option value="2">Paid</option>
              <option value="4">Waiting for Approval</option>
            </select>
          </div>
        </div>

        {/* Filter Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            onClick={handleApplyFilters}
            className="bg-[#105a9c] hover:bg-[#0d4a82] text-white shadow-sm transition-all hover:shadow-md"
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
          >
            <Filter className="h-4 w-4 mr-2" />
            Apply Filters
          </Button>
          <Button
            onClick={handleClearFilters}
            variant="outline"
            className="border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all text-gray-700 hover:text-gray-900"
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Search and Export */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search Order ID, Customer ID, Status etc."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApplyFilters()
              }
            }}
            className="w-[488px] h-[54px] border border-gray-200 bg-white rounded-full focus:ring-2 focus:ring-[#105a9c] focus:border-[#105a9c] focus:outline-none"
            style={{ fontFamily: 'Albert Sans', paddingLeft: '44px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
          />
        </div>
        <Button
          onClick={handleDownloadCSV}
          variant="outline"
          className="gap-2 h-11 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-400 transition-all"
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          <FileDown className="h-5 w-5" />
          CSV
        </Button>
        <Button
          onClick={handleDownloadExcel}
          variant="outline"
          className="gap-2 h-11 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-400 transition-all"
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          <FileText className="h-5 w-5" />
          Excel
        </Button>
        <Button
          onClick={handlePrint}
          className="gap-2 whitespace-nowrap border-0 shadow-none ml-auto"
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

      {/* Results Count */}
      <p className="text-sm text-gray-600 mb-4" style={{ fontFamily: 'Albert Sans' }}>
        {isLoading ? "Loading..." : `Found ${totalCount} Reports`}
      </p>

      {/* Table */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#105a9c] border-b border-[#0d4a82]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Order ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Order Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Department
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Subtotal
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Delivery Fee
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Discount
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-gray-500">Loading reports...</td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-gray-500">No reports found.</td>
                </tr>
              ) : (
                reports.map((report: Report, index: number) => {
                  const statusInfo = getStatusBadge(report.order_status)
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs text-blue-600 font-medium" style={{ fontFamily: 'Albert Sans' }}>
                          #{report.order_id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          {report.order_date ? format(new Date(report.order_date), "dd-MM-yyyy") : "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${report.standing_order && report.standing_order > 0 ? "bg-purple-50 text-purple-700" : "bg-gray-50 text-gray-700"}`}>
                          {report.standing_order && report.standing_order > 0 ? "Subscription" : "One Time"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          {report.customer_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          {report.company_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          {report.department_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.class}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          ${report.subtotal.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          ${report.delivery_fee.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                          ${report.discount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-900 font-semibold" style={{ fontFamily: 'Albert Sans' }}>
                          ${(report.total - report.gst).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {/* Results Count */}
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
          Showing {reports.length} of {totalCount} Entries
        </p>
      </div>
    </div>
  )
}
