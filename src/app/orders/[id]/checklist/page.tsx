"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Printer } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { printTableData } from "@/lib/print-utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface ChecklistData {
  // Order Confirmation Call
  catering_location: boolean
  catering_time: boolean
  catering_people: boolean
  catering_delivery_instructions: boolean
  catering_dietary_req: boolean

  // Day Before Delivery
  day_before_location: boolean
  day_before_time: boolean
  day_before_people: boolean
  day_before_delivery_instructions: boolean
  day_before_dietary_req: boolean

  // On the Day of Delivery (9 items)
  delivery_day_check_everything: boolean
  delivery_day_cutlery: boolean
  delivery_day_cups: boolean
  delivery_day_coffee_tea: boolean
  delivery_day_sugar: boolean
  delivery_day_plates: boolean
  delivery_day_signs: boolean
  delivery_day_hot_cold: boolean
  delivery_day_safety_pins: boolean

  // Delivering the Order (8 items)
  delivering_check_right_order: boolean
  delivering_greet_introduce: boolean
  delivering_ask_setup_area: boolean
  delivering_introduce_service: boolean
  delivering_setup_specifications: boolean
  delivering_cover_everything: boolean
  delivering_remind_questions: boolean
  delivering_wish_great_day: boolean
}

interface OrderDetails {
  order_id: number
  customer_id?: number
  customer_order_name: string
  customer_order_email: string
  customer_order_telephone: string
  delivery_date_time: string
  pickup_delivery_notes: string
  shipping_method: number
  company_name: string
  delivery_address: string
  postcode: string
  delivery_phone: string
}

export default function OrderChecklistPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const orderId = params.id
  const [checklist, setChecklist] = useState<ChecklistData>({
    catering_location: false,
    catering_time: false,
    catering_people: false,
    catering_delivery_instructions: false,
    catering_dietary_req: false,
    day_before_location: false,
    day_before_time: false,
    day_before_people: false,
    day_before_delivery_instructions: false,
    day_before_dietary_req: false,
    delivery_day_check_everything: false,
    delivery_day_cutlery: false,
    delivery_day_cups: false,
    delivery_day_coffee_tea: false,
    delivery_day_sugar: false,
    delivery_day_plates: false,
    delivery_day_signs: false,
    delivery_day_hot_cold: false,
    delivery_day_safety_pins: false,
    delivering_check_right_order: false,
    delivering_greet_introduce: false,
    delivering_ask_setup_area: false,
    delivering_introduce_service: false,
    delivering_setup_specifications: false,
    delivering_cover_everything: false,
    delivering_remind_questions: false,
    delivering_wish_great_day: false,
  })

  // Fetch order details
  const { data: orderData, isLoading: orderLoading } = useQuery<{ order: OrderDetails }>({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const response = await api.get(`/admin/orders/${orderId}`)
      return response.data
    },
  })

  // Fetch checklist data
  const { data: checklistData, isLoading: checklistLoading } = useQuery<{ checklist: ChecklistData }>({
    queryKey: ["orderChecklist", orderId],
    queryFn: async () => {
      const response = await api.get(`/admin/orders/${orderId}/checklist`)
      return response.data
    },
  })

  // Set checklist when data loads
  useEffect(() => {
    if (checklistData?.checklist) {
      setChecklist(checklistData.checklist)
    }
  }, [checklistData])

  // Save checklist mutation
  const saveChecklistMutation = useMutation({
    mutationFn: async (data: ChecklistData) => {
      return api.put(`/admin/orders/${orderId}/checklist`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orderChecklist", orderId] })
      alert("Checklist saved successfully!")
    },
  })

  const handleCheckboxChange = (field: keyof ChecklistData, value: boolean) => {
    setChecklist((prev) => ({ ...prev, [field]: value }))
  }

  const handleTextChange = (field: keyof ChecklistData, value: string) => {
    setChecklist((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    saveChecklistMutation.mutate(checklist)
  }

  const handlePrint = () => {
    printTableData("Order Checklist")
  }

  if (orderLoading || checklistLoading) {
    return <div className="text-center py-10" style={{ fontFamily: 'Albert Sans' }}>Loading checklist...</div>
  }

  const order = orderData?.order

  return (
    <div className="flex gap-6 bg-gray-50 " style={{ fontFamily: 'Albert Sans' }}>
      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full w-10 h-10 border border-gray-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontWeight: 700 }}>
              Order Checklist
            </h1>
            <p className="text-lg text-blue-600" style={{ fontWeight: 600 }}>
              Order #{orderId}
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handlePrint}
            style={{ fontWeight: 600 }}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            className="bg-[#105a9c] hover:bg-[#0d4a82] text-white gap-2"
            onClick={() => router.push(`/orders/${orderId}/edit`)}
            style={{ fontWeight: 600 }}
          >
            Edit Order
          </Button>
        </div>

        {/* Checklist Accordions */}
        <Accordion type="single" collapsible className="space-y-4">
          {/* Order Confirmation Call */}
          <AccordionItem value="item-1" className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-base font-semibold text-gray-900" style={{ fontWeight: 600 }}>
                Order Confirmation Call
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-0">
                {[
                  { key: "catering_location" as keyof ChecklistData, label: "Location", num: 1 },
                  { key: "catering_time" as keyof ChecklistData, label: "Time", num: 2 },
                  { key: "catering_people" as keyof ChecklistData, label: "Number of people", num: 3 },
                  { key: "catering_delivery_instructions" as keyof ChecklistData, label: "Delivery instructions -Eg Enter gate 4, left uphill etc", num: 4 },
                  { key: "catering_dietary_req" as keyof ChecklistData, label: "Confirm all dietary requirements", num: 5 },
                ].map(({ key, label, num }) => (
                  <div key={key} className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600 font-medium w-6 flex-shrink-0">{num}</span>
                    <span className="text-sm text-gray-700 flex-1">{label}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Checkbox
                        checked={checklist[key] as boolean}
                        onCheckedChange={(checked) => handleCheckboxChange(key, checked as boolean)}
                        className="h-5 w-5"
                      />
                      <span className="text-sm text-gray-600">Completed</span>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Day Before Delivery */}
          <AccordionItem value="item-2" className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-base font-semibold text-gray-900" style={{ fontWeight: 600 }}>
                Day Before Delivery - Confirm Order with Customer
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-0">
                {[
                  { key: "day_before_location" as keyof ChecklistData, label: "Location", num: 1 },
                  { key: "day_before_time" as keyof ChecklistData, label: "Time", num: 2 },
                  { key: "day_before_people" as keyof ChecklistData, label: "Number of people", num: 3 },
                  { key: "day_before_delivery_instructions" as keyof ChecklistData, label: "Delivery instructions -Eg Enter gate 4, left uphill etc", num: 4 },
                  { key: "day_before_dietary_req" as keyof ChecklistData, label: "Confirm all dietary requirements", num: 5 },
                ].map(({ key, label, num }) => (
                  <div key={key} className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600 font-medium w-6 flex-shrink-0">{num}</span>
                    <span className="text-sm text-gray-700 flex-1">{label}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Checkbox
                        checked={checklist[key] as boolean}
                        onCheckedChange={(checked) => handleCheckboxChange(key, checked as boolean)}
                        className="h-5 w-5"
                      />
                      <span className="text-sm text-gray-600">Completed</span>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* On the Day of Delivery */}
          <AccordionItem value="item-3" className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-base font-semibold text-gray-900" style={{ fontWeight: 600 }}>
                On the Day of Delivery - Check the following
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-0">
                {[
                  { key: "delivery_day_check_everything" as keyof ChecklistData, label: "Double check everything on catering form before going to deliver", num: 1 },
                  { key: "delivery_day_cutlery" as keyof ChecklistData, label: "Cutlery, Napkins, Tongs etc.", num: 2 },
                  { key: "delivery_day_cups" as keyof ChecklistData, label: "Cups", num: 3 },
                  { key: "delivery_day_coffee_tea" as keyof ChecklistData, label: "Coffee / Tea Supplies", num: 4 },
                  { key: "delivery_day_sugar" as keyof ChecklistData, label: "Sugar / Honey / Milk", num: 5 },
                  { key: "delivery_day_plates" as keyof ChecklistData, label: "Plates", num: 6 },
                  { key: "delivery_day_signs" as keyof ChecklistData, label: "Signs - Gluten free, Dairy Free Etc.", num: 7 },
                  { key: "delivery_day_hot_cold" as keyof ChecklistData, label: "Hot / Cold Holding", num: 8 },
                  { key: "delivery_day_safety_pins" as keyof ChecklistData, label: "Safety Pins", num: 9 },
                ].map(({ key, label, num }) => (
                  <div key={key} className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600 font-medium w-6 flex-shrink-0">{num}</span>
                    <span className="text-sm text-gray-700 flex-1">{label}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Checkbox
                        checked={checklist[key] as boolean}
                        onCheckedChange={(checked) => handleCheckboxChange(key, checked as boolean)}
                        className="h-5 w-5"
                      />
                      <span className="text-sm text-gray-600">Completed</span>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Delivering the Order */}
          <AccordionItem value="item-4" className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-base font-semibold text-gray-900" style={{ fontWeight: 600 }}>
                Delivering the Order
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-0">
                {[
                  { key: "delivering_check_right_order" as keyof ChecklistData, label: "Double check that you are leaving with the right order", num: 1 },
                  { key: "delivering_greet_introduce" as keyof ChecklistData, label: "When you arrive, greet and introduce yourself to the host", num: 2 },
                  { key: "delivering_ask_setup_area" as keyof ChecklistData, label: "Ask them to take you to the area where you will be setting up", num: 3 },
                  { key: "delivering_introduce_service" as keyof ChecklistData, label: "Introduce yourself to the service staff, let them know you are delivering for \"COMPANY NAME\", in case they have any questions", num: 4 },
                  { key: "delivering_setup_specifications" as keyof ChecklistData, label: "Set up order based on customer's specifications, refer to contract", num: 5 },
                  { key: "delivering_cover_everything" as keyof ChecklistData, label: "Make sure to cover everything in the checklist and final touchups, e.g. flowers", num: 6 },
                  { key: "delivering_remind_questions" as keyof ChecklistData, label: "Remind them you are only delivering, if they have any questions, please direct them to \"Manager Name\"", num: 7 },
                  { key: "delivering_wish_great_day" as keyof ChecklistData, label: "Wish them a great day and thank them for their business", num: 8 },
                ].map(({ key, label, num }) => (
                  <div key={key} className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600 font-medium w-6 flex-shrink-0">{num}</span>
                    <span className="text-sm text-gray-700 flex-1">{label}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Checkbox
                        checked={checklist[key] as boolean}
                        onCheckedChange={(checked) => handleCheckboxChange(key, checked as boolean)}
                        className="h-5 w-5"
                      />
                      <span className="text-sm text-gray-600">Completed</span>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Save Button */}
        <div className="flex justify-center py-6">
          <Button
            onClick={handleSave}
            disabled={saveChecklistMutation.isPending}
            className="bg-[#105a9c] hover:bg-[#0d4a82] text-white px-12 py-3 text-base rounded-full"
            style={{ fontWeight: 600 }}
          >
            {saveChecklistMutation.isPending ? "Saving..." : "Save Checklist"}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 space-y-6 hidden lg:block">
        {/* Order Details */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-200 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold" style={{ fontWeight: 700 }}>
                Order Details
              </CardTitle>
              {order?.customer_id && (
                <Link
                  href={`/customers/${order.customer_id}`}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  style={{ fontWeight: 600 }}
                >
                  View Customer
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-gray-500 text-sm">👤</span>
              <div>
                <p className="text-sm font-medium text-gray-900">{order?.customer_order_name}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-500 text-sm">📞</span>
              <p className="text-sm text-gray-700">{order?.customer_order_telephone}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-500 text-sm">✉️</span>
              <p className="text-sm text-gray-700">{order?.customer_order_email}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-500 text-sm">📅</span>
              <p className="text-sm text-gray-700">
                {order?.delivery_date_time ? format(new Date(order.delivery_date_time), 'dd-MM-yyyy') : 'N/A'}
              </p>
            </div>
            {order?.pickup_delivery_notes && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-semibold text-blue-600 mb-2" style={{ fontWeight: 600 }}>
                  Approval Comments
                </p>
                <p className="text-sm text-gray-600">{order.pickup_delivery_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Details */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-200 pb-4">
            <CardTitle className="text-base font-bold" style={{ fontWeight: 700 }}>
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1" style={{ fontWeight: 600 }}>
                📅 Delivery Date & Time
              </p>
              <p className="text-sm text-gray-700">
                {order?.delivery_date_time
                  ? format(new Date(order.delivery_date_time), 'EEEE, do MMMM yyyy, hh:mm a')
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1" style={{ fontWeight: 600 }}>
                🏢 Company Details
              </p>
              <p className="text-sm text-gray-700">
                Company Name : {order?.company_name || 'N/A'}
              </p>
              <p className="text-sm text-gray-700">
                Department : {order?.company_name || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1" style={{ fontWeight: 600 }}>
                📍 Delivery Address
              </p>
              <p className="text-sm text-gray-700">{order?.delivery_address || 'Order Date'}</p>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm font-semibold text-blue-600 mb-2" style={{ fontWeight: 600 }}>
                Delivery Notes
              </p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Time:</p>
                <p>Location:</p>
                <p>Number:</p>
                <p>Name:</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

