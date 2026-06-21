"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Calendar, Mail, Printer, MapPin, CheckCircle } from "lucide-react"
import { format } from "date-fns"
import { printTableData } from "@/lib/print-utils"

interface ReminderOrder {
  order_id: string
  customer_name: string
  company: string
  email: string
  delivery_date: string
  mail_status: "Sent" | "Not Sent"
}

const sampleReminderOrders: ReminderOrder[] = [
  {
    order_id: "#150",
    customer_name: "John Doe",
    company: "Airtel Vodafone",
    email: "jondoe@gmail.com",
    delivery_date: "06-08-2024",
    mail_status: "Not Sent"
  },
  {
    order_id: "#150",
    customer_name: "John Doe",
    company: "Airtel Vodafone",
    email: "jondoe@gmail.com",
    delivery_date: "06-08-2024",
    mail_status: "Sent"
  },
  {
    order_id: "#150",
    customer_name: "John Doe",
    company: "Airtel Vodafone",
    email: "jondoe@gmail.com",
    delivery_date: "06-08-2024",
    mail_status: "Not Sent"
  },
  {
    order_id: "#150",
    customer_name: "John Doe",
    company: "Airtel Vodafone",
    email: "jondoe@gmail.com",
    delivery_date: "06-08-2024",
    mail_status: "Sent"
  },
  {
    order_id: "#150",
    customer_name: "John Doe",
    company: "Airtel Vodafone",
    email: "jondoe@gmail.com",
    delivery_date: "06-08-2024",
    mail_status: "Not Sent"
  },
  {
    order_id: "#150",
    customer_name: "John Doe",
    company: "Airtel Vodafone",
    email: "jondoe@gmail.com",
    delivery_date: "06-08-2024",
    mail_status: "Sent"
  },
  {
    order_id: "#150",
    customer_name: "John Doe",
    company: "Airtel Vodafone",
    email: "jondoe@gmail.com",
    delivery_date: "06-08-2024",
    mail_status: "Not Sent"
  },
  {
    order_id: "#150",
    customer_name: "John Doe",
    company: "Airtel Vodafone",
    email: "jondoe@gmail.com",
    delivery_date: "06-08-2024",
    mail_status: "Sent"
  },
]

const locationTabs = [
  { id: "box-hill", name: "Box Hill" },
  { id: "green-ville", name: "Green Ville" },
  { id: "maroondah", name: "Maroondah" },
  { id: "box-hill-2", name: "Box Hill" },
  { id: "box-hill-3", name: "Box Hill" },
]

export default function ReminderOrdersPage() {
  const [activeMainTab, setActiveMainTab] = useState<"past" | "future" | "reminder">("reminder")
  const [activeLocationTab, setActiveLocationTab] = useState("maroondah")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDate, setSelectedDate] = useState("06-08-2024")
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)

  const orders = sampleReminderOrders

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(orders.map(order => order.order_id))
    } else {
      setSelectedOrders([])
    }
  }

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId])
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId))
    }
  }

  const handleSendReminderEmail = () => {
    setShowSuccessMessage(true)
    setTimeout(() => {
      setShowSuccessMessage(false)
    }, 3000)
  }

  const handleSendIndividualEmail = (orderId: string) => {
    setShowSuccessMessage(true)
    setTimeout(() => {
      setShowSuccessMessage(false)
    }, 3000)
  }

  return (
    <div className="bg-gray-50 " style={{ fontFamily: 'Albert Sans' }}>
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <CheckCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Reminder Email successfully sent!</span>
        </div>
      )}

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
          Reminder Orders
        </h1>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeMainTab === "past" ? "default" : "outline"}
          onClick={() => setActiveMainTab("past")}
          className={`rounded-full px-8 py-2 ${
            activeMainTab === "past"
              ? "bg-blue-100 text-blue-700 border-blue-300"
              : "bg-white text-gray-700 border-gray-300"
          }`}
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          Past Orders
        </Button>
        <Button
          variant={activeMainTab === "future" ? "default" : "outline"}
          onClick={() => setActiveMainTab("future")}
          className={`rounded-full px-8 py-2 ${
            activeMainTab === "future"
              ? "bg-blue-100 text-blue-700 border-blue-300"
              : "bg-white text-gray-700 border-gray-300"
          }`}
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          Future Orders
        </Button>
        <Button
          variant={activeMainTab === "reminder" ? "default" : "outline"}
          onClick={() => setActiveMainTab("reminder")}
          className={`rounded-full px-8 py-2 ${
            activeMainTab === "reminder"
              ? "bg-blue-100 text-blue-700 border-blue-300"
              : "bg-white text-gray-700 border-gray-300"
          }`}
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          Reminder Orders
        </Button>
      </div>

      {/* Search, Date Filter, Clear, and Send Email */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="pl-10 h-11 border-gray-300 bg-white w-full sm:w-40"
            style={{ fontFamily: 'Albert Sans' }}
          />
        </div>
        <Button 
          variant="outline" 
          className="h-11 border-gray-300 bg-white text-blue-600"
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          Clear Filters
        </Button>
        <Button 
          onClick={handleSendReminderEmail}
          disabled={selectedOrders.length === 0}
          className="bg-[#0d6efd] hover:bg-[#0b5ed7] text-white gap-2 h-11 disabled:bg-gray-300"
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          <Mail className="h-5 w-5" />
          Send Reminder Email
        </Button>
        <div className="ml-auto">
          <Button 
            onClick={() => printTableData("Reminder Orders")}
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
      </div>

      {/* Location Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {locationTabs.map((location: any) => (
          <Button
            key={location.id}
            variant="ghost"
            onClick={() => setActiveLocationTab(location.id)}
            className={`gap-2 ${
              activeLocationTab === location.id
                ? "text-blue-600 border-b-2 border-blue-600 rounded-none"
                : "text-gray-600"
            }`}
            style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
          >
            <MapPin className="h-4 w-4" />
            {location.name}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left">
                  <Checkbox
                    checked={selectedOrders.length === orders.length}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Order ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Customer Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Company
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Email
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Delivery Date
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Mail Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={`${order.order_id}-${index}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Checkbox
                      checked={selectedOrders.includes(order.order_id)}
                      onCheckedChange={(checked) => handleSelectOrder(order.order_id, checked as boolean)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-blue-600 font-medium cursor-pointer" style={{ fontFamily: 'Albert Sans' }}>
                      {order.order_id}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                      {order.customer_name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                      {order.company}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                      {order.email}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                      {order.delivery_date}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {order.mail_status === "Sent" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                        Sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
                        Not Sent
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleSendIndividualEmail(order.order_id)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                      style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
                    >
                      <Mail className="h-4 w-4" />
                      Send Reminder Email
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
          Showing 1-26 of 26 Entries
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-gray-300 bg-white">
            Prev
          </Button>
          <Button 
            size="sm" 
            className="bg-[#0d6efd] hover:bg-[#0b5ed7] text-white"
          >
            23
          </Button>
          <Button variant="outline" size="sm" className="border-gray-300 bg-white">
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

