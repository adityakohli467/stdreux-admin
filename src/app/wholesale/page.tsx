"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Filter, Printer, Edit, Trash2, Save } from "lucide-react"
import { printTableData } from "@/lib/print-utils"

interface WholesalePrice {
  customer_name: string
  customer_type: string
  product_name: string
  option_name: string
  options: { size: string; price: string; discount: string; total: string }[]
  isEditing?: boolean
}

const sampleWholesalePrices: WholesalePrice[] = [
  {
    customer_name: "John Doe",
    customer_type: "Full Service Wholesaler",
    product_name: "Coffee Blend",
    option_name: "Size",
    options: [
      { size: "250g", price: "25", discount: "5%", total: "25" },
      { size: "550g", price: "30", discount: "10%", total: "25" },
      { size: "1000g", price: "35", discount: "15%", total: "25" },
    ],
    isEditing: false
  },
  {
    customer_name: "John Doe",
    customer_type: "Full Service Wholesaler",
    product_name: "Coffee Blend",
    option_name: "Flavour",
    options: [
      { size: "Regular", price: "25", discount: "5%", total: "25" },
      { size: "Hazelnut", price: "30", discount: "10%", total: "25" },
      { size: "Dark Roast", price: "35", discount: "15%", total: "25" },
    ],
    isEditing: false
  },
  {
    customer_name: "Utsav Reddy",
    customer_type: "Full Service Wholesaler",
    product_name: "Coffee Blend",
    option_name: "Size",
    options: [
      { size: "250g", price: "25", discount: "5%", total: "25" },
      { size: "550g", price: "30", discount: "10%", total: "25" },
      { size: "100g", price: "35", discount: "15%", total: "25" },
    ],
    isEditing: false
  },
  {
    customer_name: "Utsav Reddy",
    customer_type: "Full Service Wholesaler",
    product_name: "Coffee Blend",
    option_name: "Flavour",
    options: [
      { size: "Regular", price: "25", discount: "5%", total: "25" },
      { size: "Hazelnut", price: "30", discount: "10%", total: "25" },
      { size: "Dark Roast", price: "35", discount: "15%", total: "25" },
    ],
    isEditing: false
  },
]

export default function WholesalePricingPage() {
  const [activeTab, setActiveTab] = useState<"partial" | "full">("partial")
  const [searchQuery, setSearchQuery] = useState("")
  const [wholesalePrices, setWholesalePrices] = useState(sampleWholesalePrices)

  const handleEdit = (customerName: string, optionName: string) => {
    setWholesalePrices(wholesalePrices.map(price => 
      price.customer_name === customerName && price.option_name === optionName
        ? { ...price, isEditing: true }
        : price
    ))
  }

  const handleSave = (customerName: string, optionName: string) => {
    setWholesalePrices(wholesalePrices.map(price => 
      price.customer_name === customerName && price.option_name === optionName
        ? { ...price, isEditing: false }
        : price
    ))
  }

  const handleDeleteListing = (customerName: string, optionName: string) => {
    if (confirm("Are you sure you want to delete this listing?")) {
      setWholesalePrices(wholesalePrices.filter(
        price => !(price.customer_name === customerName && price.option_name === optionName)
      ))
    }
  }

  const handleDeleteRow = (customerName: string, optionName: string, rowIndex: number) => {
    setWholesalePrices(wholesalePrices.map(price => {
      if (price.customer_name === customerName && price.option_name === optionName) {
        return {
          ...price,
          options: price.options.filter((_, index) => index !== rowIndex)
        }
      }
      return price
    }))
  }

  const updateOptionValue = (customerName: string, optionName: string, rowIndex: number, field: string, value: string) => {
    setWholesalePrices(wholesalePrices.map(price => {
      if (price.customer_name === customerName && price.option_name === optionName) {
        const newOptions = [...price.options]
        newOptions[rowIndex] = { ...newOptions[rowIndex], [field]: value }
        return { ...price, options: newOptions }
      }
      return price
    }))
  }

  return (
    <div className="bg-gray-50 " style={{ fontFamily: 'Albert Sans' }}>
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
          Wholesale Pricing List
        </h1>
      </div>

      {/* Search, Filter, and Print */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center">
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
          variant="outline" 
          className="gap-2 h-11 border-gray-300 bg-white"
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          <Filter className="h-5 w-5" />
          Filter by
        </Button>
        <div className="ml-auto">
          <Button 
            onClick={() => printTableData("Wholesale Pricing")}
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
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === "partial" ? "default" : "outline"}
          onClick={() => setActiveTab("partial")}
          className={`rounded-full px-8 py-2 ${
            activeTab === "partial"
              ? "bg-blue-100 text-blue-700 border-blue-300"
              : "bg-white text-gray-700 border-gray-300"
          }`}
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          Partial Service Wholesalers
        </Button>
        <Button
          variant={activeTab === "full" ? "default" : "outline"}
          onClick={() => setActiveTab("full")}
          className={`rounded-full px-8 py-2 ${
            activeTab === "full"
              ? "bg-blue-100 text-blue-700 border-blue-300"
              : "bg-white text-gray-700 border-gray-300"
          }`}
          style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
        >
          Full Service Wholesalers
        </Button>
      </div>

      {/* Table */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#105a9c] border-b border-[#0d4a82] text-white">
                <th className="px-4 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Customer Name
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Customer Type
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Customer Type
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Option Name
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Options
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Product Price
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Discount (%)
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Total
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-white" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {wholesalePrices.map((priceItem, priceIndex) => {
                const totalRows = priceItem.options.length
                
                return priceItem.options.map((option, optionIndex) => {
                  const isFirstRow = optionIndex === 0
                  const rowSpan = isFirstRow ? totalRows : 0

                  return (
                    <tr key={`${priceIndex}-${optionIndex}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      {isFirstRow && (
                        <>
                          <td className="px-4 py-3 align-top" rowSpan={rowSpan}>
                            <span className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                              {priceItem.customer_name}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top" rowSpan={rowSpan}>
                            <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                              {priceItem.customer_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top" rowSpan={rowSpan}>
                            <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                              {priceItem.product_name}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top" rowSpan={rowSpan}>
                            <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                              {priceItem.option_name}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        {priceItem.isEditing ? (
                          <Input
                            value={option.size}
                            onChange={(e) => updateOptionValue(priceItem.customer_name, priceItem.option_name, optionIndex, 'size', e.target.value)}
                            className="h-8 text-sm border-gray-300"
                          />
                        ) : (
                          <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                            {option.size}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {priceItem.isEditing ? (
                          <Input
                            value={option.price}
                            onChange={(e) => updateOptionValue(priceItem.customer_name, priceItem.option_name, optionIndex, 'price', e.target.value)}
                            className="h-8 text-sm border-gray-300"
                          />
                        ) : (
                          <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                            ${option.price}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {priceItem.isEditing ? (
                          <Input
                            value={option.discount}
                            onChange={(e) => updateOptionValue(priceItem.customer_name, priceItem.option_name, optionIndex, 'discount', e.target.value)}
                            className="h-8 text-sm border-gray-300"
                          />
                        ) : (
                          <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                            {option.discount}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {priceItem.isEditing ? (
                          <Input
                            value={option.total}
                            onChange={(e) => updateOptionValue(priceItem.customer_name, priceItem.option_name, optionIndex, 'total', e.target.value)}
                            className="h-8 text-sm border-gray-300"
                          />
                        ) : (
                          <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                            ${option.total}
                          </span>
                        )}
                      </td>
                      {isFirstRow ? (
                        <td className="px-4 py-3 align-top" rowSpan={rowSpan}>
                          <div className="flex flex-col gap-2">
                            {priceItem.isEditing ? (
                              <button
                                onClick={() => handleSave(priceItem.customer_name, priceItem.option_name)}
                                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
                              >
                                <Save className="h-4 w-4" />
                                Save
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEdit(priceItem.customer_name, priceItem.option_name)}
                                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                                style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
                              >
                                <Edit className="h-4 w-4" />
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteListing(priceItem.customer_name, priceItem.option_name)}
                              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800 font-medium"
                              style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Listing
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td className="px-4 py-3">
                          {priceItem.isEditing && (
                            <button
                              onClick={() => handleDeleteRow(priceItem.customer_name, priceItem.option_name, optionIndex)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

