"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, ShoppingCart, Trash2, ChevronLeft, GripVertical, Pencil, Check, X } from "lucide-react"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import api from "@/lib/api"
import { QuoteData } from "../page"
import { toast } from "sonner"

interface ProductsStepProps {
  data: QuoteData
  onUpdate: (data: Partial<QuoteData>) => void
  onNext: () => void
  onBack: () => void
}

interface Product {
  product_id: number
  product_name: string
  product_price: number // Final price with discounts
  original_price?: number // Base customer-type price (wholesale or retail) without additional discounts
  base_retail_price?: number
  base_wholesale_price?: number
  product_status: number
  // Premium pricing fields
  product_price_premium?: number | string
  premium_price_discounted?: number | string
  subscriber_rate?: number | string
  customer_type?: string
  is_wholesale?: boolean
  min_quantity?: number

  categories?: Array<{
    category_id: number
    category_name: string
  }>
  options?: Array<{
    product_option_id: number
    option_id: number
    option_name: string
    option_value_id: number
    option_value_name: string
    option_price: number // Final price with discounts
    option_base_price?: number // Base customer-type price without additional discounts
    original_option_price?: number // Alias for option_base_price
    option_price_prefix: string
    option_required: number
    // Premium option pricing
    wholesale_price_premium?: number | string
    subscriber_price?: number | string
  }>
  subcategory?: {
    category_id: number
    category_name: string
  }
}

interface Category {
  category_id: number
  category_name: string
}

interface CartProduct {
  product_id: number
  name: string
  category: string
  price: number // Display price (final price with discounts) - shown to user
  base_price?: number // Base customer-type price (for backend calculation) - optional, falls back to price
  original_price?: number // Original price before override (for reference)
  quantity: number
  min_quantity?: number
  comment?: string
  add_ons: Array<{
    name: string
    price: number // Display price
    base_price?: number // Base price for backend - optional
    original_price?: number // Original option price before override
    quantity: number
    product_option_id?: number
    option_value_id?: number
    option_name?: string
    option_value?: string
    option_price?: number
  }>
}

// Sortable Item Component
function SortableCartItem({ item, index, onRemove, onQuantityChange, onAddOnQuantityChange, onCommentChange, onPriceChange, onAddonPriceChange }: {
  item: CartProduct
  index: number
  onRemove: (index: number) => void
  onQuantityChange: (index: number, delta: number) => void
  onAddOnQuantityChange: (cartIndex: number, addonIndex: number, delta: number) => void
  onCommentChange: (index: number, comment: string) => void
  onPriceChange: (index: number, newPrice: number) => void
  onAddonPriceChange: (cartIndex: number, addonIndex: number, newPrice: number) => void
}) {
  const [isEditingPrice, setIsEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState(item.price.toFixed(2))
  const [editingAddonIndex, setEditingAddonIndex] = useState<number | null>(null)
  const [addonPriceInput, setAddonPriceInput] = useState("")

  const hasOptions = item.add_ons.length > 0

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `cart-item-${index}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handlePriceConfirm = () => {
    const newPrice = parseFloat(priceInput)
    if (!isNaN(newPrice) && newPrice >= 0) {
      onPriceChange(index, newPrice)
      setIsEditingPrice(false)
    }
  }

  const handlePriceCancel = () => {
    setPriceInput(item.price.toFixed(2))
    setIsEditingPrice(false)
  }

  const handleAddonPriceConfirm = (addonIndex: number) => {
    const newPrice = parseFloat(addonPriceInput)
    if (!isNaN(newPrice) && newPrice >= 0) {
      onAddonPriceChange(index, addonIndex, newPrice)
      setEditingAddonIndex(null)
      setAddonPriceInput("")
    }
  }

  const handleAddonPriceCancel = () => {
    setEditingAddonIndex(null)
    setAddonPriceInput("")
  }

  const isOverridden = item.original_price !== undefined && item.original_price !== item.price

  return (
    <div ref={setNodeRef} style={style} className="border-b border-gray-100 pb-4">
      <div className="flex items-start gap-2 mb-2">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing mt-1"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                {item.name}
              </p>
              {hasOptions && (
                <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: 'Albert Sans' }}>
                  Add ons: {item.add_ons.map(a => a.name).join(", ")}
                </p>
              )}
            </div>
            <button
              onClick={() => onRemove(index)}
              className="text-blue-600 hover:text-red-600 ml-2"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mb-2">
            {item.price > 0 && (
              <div className="flex items-center gap-2 bg-gray-100 rounded-md">
                <button
                  onClick={() => onQuantityChange(index, -1)}
                  className="px-2 py-1 text-gray-600 hover:text-gray-900"
                >
                  -
                </button>
                <span className="text-sm font-medium" style={{ fontFamily: 'Albert Sans' }}>
                  {item.quantity}
                </span>
                <button
                  onClick={() => onQuantityChange(index, 1)}
                  className="px-2 py-1 text-gray-600 hover:text-gray-900"
                >
                  +
                </button>
              </div>
            )}
            {/* Show price with edit icon only if NO options */}
            {!hasOptions && (
              <div className="flex items-center gap-1">
                {isEditingPrice ? (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-500">$</span>
                    <input
                      type="text"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value.replace(/[^0-9.]/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handlePriceConfirm()
                        if (e.key === 'Escape') handlePriceCancel()
                      }}
                      className="w-20 text-sm font-medium text-gray-900 border border-blue-400 rounded px-1 py-0.5 outline-none focus:border-blue-600"
                      style={{ fontFamily: 'Albert Sans' }}
                      autoFocus
                    />
                    <button onClick={handlePriceConfirm} className="text-green-600 hover:text-green-800">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={handlePriceCancel} className="text-red-500 hover:text-red-700">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    {isOverridden && (
                      <span className="text-xs text-gray-400 line-through mr-1" style={{ fontFamily: 'Albert Sans' }}>
                        ${item.original_price!.toFixed(2)}
                      </span>
                    )}
                    <span className={`text-sm font-medium ${isOverridden ? 'text-orange-600' : 'text-gray-900'}`} style={{ fontFamily: 'Albert Sans' }}>
                      ${item.price.toFixed(2)}
                    </span>
                    <button
                      onClick={() => {
                        setPriceInput(item.price.toFixed(2))
                        setIsEditingPrice(true)
                      }}
                      className="text-gray-400 hover:text-blue-600 ml-1"
                      title="Override price for this order"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            )}
            {/* Show plain price (no edit) if product has options */}
            {hasOptions && (
              <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                ${item.price.toFixed(2)}
              </span>
            )}
          </div>

          {/* Product Comment */}
          <div className="mt-2">
            <Textarea
              placeholder="Add product comment..."
              value={item.comment || ""}
              onChange={(e) => onCommentChange(index, e.target.value)}
              rows={2}
              className="text-xs border-gray-300 resize-none"
              style={{ fontFamily: 'Albert Sans' }}
            />
          </div>

          {item.add_ons.map((addon, addonIndex) => {
            const addonOverridden = addon.original_price !== undefined && addon.original_price !== addon.price
            const isEditingThisAddon = editingAddonIndex === addonIndex

            return (
              <div key={addonIndex} className="flex items-center justify-between mt-2 ml-4">
                <p className="text-xs text-gray-600" style={{ fontFamily: 'Albert Sans' }}>
                  {addon.name}
                </p>
                <div className="flex items-center gap-2">
                  {addon.price > 0 && (
                    <div className="flex items-center gap-1 bg-gray-100 rounded-md">
                      <button
                        onClick={() => onAddOnQuantityChange(index, addonIndex, -1)}
                        className="px-1.5 py-0.5 text-xs text-gray-600 hover:text-gray-900"
                      >
                        -
                      </button>
                      <span className="text-xs font-medium" style={{ fontFamily: 'Albert Sans' }}>
                        {addon.quantity}
                      </span>
                      <button
                        onClick={() => onAddOnQuantityChange(index, addonIndex, 1)}
                        className="px-1.5 py-0.5 text-xs text-gray-600 hover:text-gray-900"
                      >
                        +
                      </button>
                    </div>
                  )}
                  {isEditingThisAddon ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">$</span>
                      <input
                        type="text"
                        value={addonPriceInput}
                        onChange={(e) => setAddonPriceInput(e.target.value.replace(/[^0-9.]/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddonPriceConfirm(addonIndex)
                          if (e.key === 'Escape') handleAddonPriceCancel()
                        }}
                        className="w-16 text-xs font-medium text-gray-900 border border-blue-400 rounded px-1 py-0.5 outline-none focus:border-blue-600"
                        style={{ fontFamily: 'Albert Sans' }}
                        autoFocus
                      />
                      <button onClick={() => handleAddonPriceConfirm(addonIndex)} className="text-green-600 hover:text-green-800">
                        <Check className="h-3 w-3" />
                      </button>
                      <button onClick={handleAddonPriceCancel} className="text-red-500 hover:text-red-700">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      {addonOverridden && (
                        <span className="text-xs text-gray-400 line-through" style={{ fontFamily: 'Albert Sans' }}>
                          +${addon.original_price!.toFixed(2)}
                        </span>
                      )}
                      <span className={`text-xs ${addonOverridden ? 'text-orange-600 font-medium' : 'text-gray-700'}`} style={{ fontFamily: 'Albert Sans' }}>
                        +${addon.price.toFixed(2)}
                      </span>
                      <button
                        onClick={() => {
                          setAddonPriceInput(addon.price.toFixed(2))
                          setEditingAddonIndex(addonIndex)
                        }}
                        className="text-gray-400 hover:text-blue-600"
                        title="Override option price for this order"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ProductsStep({ data, onUpdate, onNext, onBack }: ProductsStepProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<number>(0)
  const [cart, setCart] = useState<CartProduct[]>((data.products || []).map(p => ({ ...p, add_ons: p.add_ons || [], comment: p.comment || "" })))
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [optionQuantities, setOptionQuantities] = useState<Record<string, number>>({})
  const [selectedOptions, setSelectedOptions] = useState<Record<string, boolean>>({})

  // Determine if customer is Premium / Full Service Wholesale
  const isPremiumCustomer = useMemo(() => {
    // Check against the known strings for "Full Service" / "Premium"
    return data.customer_type === "Full Service Wholesale" || data.customer_type === "Wholesale Premium"
  }, [data.customer_type])

  // Determine if customer is a Subscriber
  const isSubscriber = useMemo(() => {
    return data.customer_type === "Subscriber"
  }, [data.customer_type])

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch categories
  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/admin/categories?limit=100')
      return response.data
    }
  })

  const categories = categoriesData?.categories || []

  // Set first category as default when categories load (only if no category is selected)
  useEffect(() => {
    if (categories.length > 0 && selectedCategory === 0 && !searchQuery) {
      // Don't auto-select if user hasn't interacted yet - let them choose "All Categories" first
      // Only auto-select if they've searched or interacted
    }
  }, [categories, selectedCategory, searchQuery])

  // Clear cart when customer changes (prices will be different)
  const prevCustomerIdRef = useRef<number | undefined>(data.customer_id)
  useEffect(() => {
    // Only clear cart if customer_id actually changed (not on initial load)
    if (data.customer_id && prevCustomerIdRef.current !== undefined && prevCustomerIdRef.current !== data.customer_id && cart.length > 0) {
      // Customer changed - clear cart since prices are customer-specific
      setCart([])
      onUpdate({ products: [] })
      toast.info("Cart cleared - prices updated for selected customer")
    }
    prevCustomerIdRef.current = data.customer_id
  }, [data.customer_id, cart.length])

  // Fetch products with customer-based pricing
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['products-for-quote', searchQuery, selectedCategory, data.customer_id],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('status', '1') // Only active products
      params.append('limit', '1000') // Get all products for selection
      if (searchQuery) params.append('search', searchQuery)

      // Include customer_id to get customer-specific pricing (retail vs wholesale)
      if (data.customer_id) {
        params.append('customer_id', data.customer_id.toString())
      }

      // Filter by category_id if a specific category is selected
      if (selectedCategory !== 0) {
        params.append('category_id', selectedCategory.toString())
      }

      // Use products-new endpoint which returns categories and options properly
      const response = await api.get(`/admin/products-new?${params.toString()}`)
      return response.data
    },
    enabled: true
  })

  const allProducts = productsData?.products || []

  // Filter products by selected category and ensure they have valid data
  const products = (selectedCategory === 0
    ? allProducts
    : allProducts.filter((p: Product) =>
      p.categories?.some(cat => cat.category_id == selectedCategory) ||
      p.subcategory?.category_id == selectedCategory
    )
  ).filter((p: Product) => {
    // Ensure product has required fields
    const hasRequiredFields = p.product_id && p.product_name && p.product_price !== undefined && p.product_price !== null
    if (!hasRequiredFields) return false

    // Filter out products that have 0 price AND no options
    const price = parseFloat(p.product_price.toString())
    const hasOptions = p.options && p.options.length > 0
    if (price === 0 && !hasOptions) return false

    return true
  })

  // Pre-initialize quantities with each product's min_quantity when products load
  // This ensures the quantity stepper starts at min_quantity, not 1
  useEffect(() => {
    if (products && products.length > 0) {
      setQuantities(prev => {
        const next = { ...prev }
        products.forEach((p: Product) => {
          if (!(p.product_id in next)) {
            next[p.product_id] = p.min_quantity && p.min_quantity > 0 ? p.min_quantity : 1
          }
        })
        return next
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsData])

  // Helper function to generate a unique key for cart items based on product_id and options
  const generateCartItemKey = (productId: number, addOns: Array<{ product_option_id?: number, option_value_id?: number }>) => {
    if (!addOns || addOns.length === 0) {
      return `product_${productId}_no_options`
    }
    // Sort options by product_option_id and option_value_id to ensure consistent keys
    const sortedOptions = [...addOns]
      .sort((a, b) => {
        const aId = (a.product_option_id || 0) * 10000 + (a.option_value_id || 0)
        const bId = (b.product_option_id || 0) * 10000 + (b.option_value_id || 0)
        return aId - bId
      })
      .map(opt => `${opt.product_option_id}_${opt.option_value_id}`)
      .join('_')
    return `product_${productId}_${sortedOptions}`
  }

  // Helper function to check if two cart items are the same (same product + same options)
  const areCartItemsEqual = (item1: CartProduct, item2: CartProduct) => {
    if (item1.product_id !== item2.product_id) return false

    // Compare options
    const key1 = generateCartItemKey(item1.product_id, item1.add_ons || [])
    const key2 = generateCartItemKey(item2.product_id, item2.add_ons || [])
    return key1 === key2
  }

  const handleAddToCart = (product: Product) => {
    const minQty = product.min_quantity && product.min_quantity > 0 ? product.min_quantity : 1;
    const quantity = quantities[product.product_id] || minQty

    // Get selected options
    // IMPORTANT: option_price is the customer-specific final price (what user sees)
    // option_base_price is the base customer-type price (for backend calculation)
    const selectedOptionsList = product.options
      ?.filter(option => selectedOptions[`${product.product_id}-${option.product_option_id}`])
      .map(option => {
        // Determine the price to use based on customer type
        let finalOptionDisplayPrice = parseFloat(option.option_price.toString())

        if (isPremiumCustomer && option.wholesale_price_premium) {
          finalOptionDisplayPrice = parseFloat(option.wholesale_price_premium.toString())
        } else if (isSubscriber && option.subscriber_price) {
          finalOptionDisplayPrice = parseFloat(option.subscriber_price.toString())
        }

        return {
          name: `${option.option_name}: ${option.option_value_name}`,
          price: finalOptionDisplayPrice,
          quantity: optionQuantities[`${product.product_id}-${option.product_option_id}`] || 1,
          product_option_id: option.product_option_id,
          option_value_id: option.option_value_id,
          option_name: option.option_name,
          option_value: option.option_value_name,
        }
      }) || []

    const categoryName = product.categories && product.categories.length > 0
      ? product.categories[0].category_name
      : 'Uncategorized'

    // Prepare the new cart item
    let newCartItem: CartProduct

    if (selectedOptionsList.length > 0) {
      // Generate a unique name that includes all selected options
      const optionsName = selectedOptionsList.map(opt => opt.name).join(', ')
      const cartItemName = `${product.product_name} (${optionsName})`

      // Calculate prices
      // IMPORTANT: product_price from backend is already customer-specific (wholesale for wholesale customers)
      // Display price: final price with discounts (what user sees) - this should be customer-specific
      let displayPrice = parseFloat(product.product_price.toString())

      // Override price if Premium customer
      if (isPremiumCustomer) {
        if (product.product_price_premium && parseFloat(product.product_price_premium.toString()) > 0) {
          displayPrice = parseFloat(product.product_price_premium.toString())
        } else if (product.premium_price_discounted && parseFloat(product.premium_price_discounted.toString()) > 0) {
          displayPrice = parseFloat(product.premium_price_discounted.toString())
        }
      } else if (isSubscriber && product.subscriber_rate && parseFloat(product.subscriber_rate.toString()) > 0) {
        displayPrice = parseFloat(product.subscriber_rate.toString())
      }

      // Base price: customer-type price without additional discounts (for backend)
      // original_price is the base customer-type price (wholesale base or retail base) without additional discounts
      const basePrice = product.original_price || displayPrice

      // Calculate option prices
      const optionsDisplayTotal = selectedOptionsList.reduce((sum, opt) => {
        // Get display price (final price) for the option
        return sum + (opt.price * opt.quantity)
      }, 0)
      const totalDisplayPrice = displayPrice + optionsDisplayTotal

      // Always use the product quantity selector value (not the option quantity)
      const itemQuantity = quantity

      newCartItem = {
        product_id: product.product_id,
        name: cartItemName,
        category: categoryName,
        price: displayPrice, // Display price (what user sees) - DO NOT BUNDLE OPTION PRICES!
        base_price: basePrice, // Base price for backend discount calculation
        quantity: itemQuantity,
        min_quantity: minQty,
        comment: "",
        add_ons: selectedOptionsList.map(opt => {
          // Find the original option to get base price
          const originalOption = product.options?.find(o => o.option_value_id === opt.option_value_id)
          const optionBasePrice = originalOption?.option_base_price || originalOption?.original_option_price || parseFloat(opt.price.toString())
          return {
            name: opt.name,
            price: parseFloat(opt.price.toString()), // Display price
            base_price: optionBasePrice, // Base price for backend
            quantity: opt.quantity,
            product_option_id: opt.product_option_id,
            option_value_id: opt.option_value_id,
            option_name: opt.option_name,
            option_value: opt.option_value,
            option_price: parseFloat(opt.price.toString()),
          }
        }),
      }
    } else {
      // No options selected, add as regular product
      // Display price: final price with discounts (what user sees)
      let displayPrice = parseFloat(product.product_price.toString())

      // Override price if Premium customer
      if (isPremiumCustomer) {
        if (product.product_price_premium && parseFloat(product.product_price_premium.toString()) > 0) {
          displayPrice = parseFloat(product.product_price_premium.toString())
        } else if (product.premium_price_discounted && parseFloat(product.premium_price_discounted.toString()) > 0) {
          displayPrice = parseFloat(product.premium_price_discounted.toString())
        }
      } else if (isSubscriber && product.subscriber_rate && parseFloat(product.subscriber_rate.toString()) > 0) {
        displayPrice = parseFloat(product.subscriber_rate.toString())
      }

      // Base price: customer-type price without additional discounts (for backend)
      const basePrice = product.original_price || displayPrice

      newCartItem = {
        product_id: product.product_id,
        name: product.product_name,
        category: categoryName,
        price: displayPrice, // Display price (what user sees)
        base_price: basePrice, // Base price for backend discount calculation
        quantity,
        min_quantity: minQty,
        comment: "",
        add_ons: [],
      }
    }

    // Check if an item with the same product_id and options already exists in cart
    const existingItemIndex = cart.findIndex(item => areCartItemsEqual(item, newCartItem))

    if (existingItemIndex !== -1) {
      // Item already exists, increase quantity
      const updatedCart = [...cart]
      updatedCart[existingItemIndex].quantity += newCartItem.quantity
      setCart(updatedCart)
      onUpdate({ products: updatedCart })
      toast.success(selectedOptionsList.length > 0
        ? "Product quantity increased in cart"
        : "Product quantity increased in cart")
    } else {
      // New item, add to cart
      setCart(prevCart => {
        const updatedCart = [...prevCart, newCartItem]
        onUpdate({ products: updatedCart })
        return updatedCart
      })
      toast.success(selectedOptionsList.length > 0
        ? "Product with options added to cart"
        : "Product added to cart")
    }

    setQuantities({ ...quantities, [product.product_id]: minQty })
    setExpandedProduct(null)

    // Reset options selection
    if (product.options) {
      const resetOptions: Record<string, boolean> = {}
      const resetQuantities: Record<string, number> = {}
      product.options.forEach(option => {
        const key = `${product.product_id}-${option.product_option_id}`
        resetOptions[key] = false
        resetQuantities[key] = 1
      })
      setSelectedOptions({ ...selectedOptions, ...resetOptions })
      setOptionQuantities({ ...optionQuantities, ...resetQuantities })
    }
  }

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index))
  }

  const handleQuantityChange = (productId: number, delta: number) => {
    const product = products.find((p: Product) => p.product_id === productId)
    const minQty = product?.min_quantity && product.min_quantity > 0 ? product.min_quantity : 1;
    const current = quantities[productId] || minQty
    const newValue = Math.max(minQty, current + delta)
    setQuantities({ ...quantities, [productId]: newValue })
  }

  const handleOptionQuantityChange = (key: string, delta: number) => {
    const current = optionQuantities[key] || 1
    const newValue = Math.max(1, current + delta)
    setOptionQuantities({ ...optionQuantities, [key]: newValue })
  }

  const handleCartItemQuantityChange = (index: number, delta: number) => {
    const newCart = [...cart]
    const minQty = newCart[index].min_quantity || 1
    newCart[index].quantity = Math.max(minQty, newCart[index].quantity + delta)
    setCart(newCart)
  }

  const handleCartAddOnQuantityChange = (cartIndex: number, addonIndex: number, delta: number) => {
    const newCart = [...cart]
    newCart[cartIndex].add_ons[addonIndex].quantity = Math.max(1, newCart[cartIndex].add_ons[addonIndex].quantity + delta)
    setCart(newCart)
  }

  const handleCartCommentChange = (index: number, comment: string) => {
    const newCart = [...cart]
    newCart[index].comment = comment
    setCart(newCart)
    onUpdate({ products: newCart })
  }

  const handleCartPriceChange = (index: number, newPrice: number) => {
    const newCart = [...cart]
    // Store original price on first override
    if (newCart[index].original_price === undefined) {
      newCart[index].original_price = newCart[index].price
    }
    newCart[index].price = newPrice
    // Clear base_price so the overridden price is used directly
    newCart[index].base_price = undefined
    setCart(newCart)
    onUpdate({ products: newCart })
  }

  const handleAddonPriceChange = (cartIndex: number, addonIndex: number, newPrice: number) => {
    const newCart = [...cart]
    const addon = newCart[cartIndex].add_ons[addonIndex]
    // Store original price on first override
    if (addon.original_price === undefined) {
      addon.original_price = addon.price
    }
    addon.price = newPrice
    addon.option_price = newPrice
    // Clear base_price so the overridden price is used directly
    addon.base_price = undefined
    setCart(newCart)
    onUpdate({ products: newCart })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setCart((items) => {
        const oldIndex = parseInt(active.id.toString().replace('cart-item-', ''))
        const newIndex = parseInt(over.id.toString().replace('cart-item-', ''))
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const itemTotal = Number(item.price || 0) * Number(item.quantity || 0)
      const addOnsTotal = (item.add_ons || []).reduce((addonSum, addon) => {
        return addonSum + (Number(addon.price || 0) * Number(addon.quantity || 0))
      }, 0) * Number(item.quantity || 1) // Options are per-unit, multiply by product qty
      return sum + itemTotal + addOnsTotal
    }, 0)
  }

  const handleProceed = () => {
    if (cart.length === 0) {
      alert("Please add at least one product to the quote")
      return
    }

    onUpdate({ products: cart })
    onNext()
  }

  const handleExpandProduct = (product: Product) => {
    if (expandedProduct === product.product_id) {
      setExpandedProduct(null)
      return
    }

    setExpandedProduct(product.product_id)

    // If product price is 0 and has options, pre-select the first option
    let price = product.product_price ? parseFloat(product.product_price.toString()) : 0

    // Override price for Premium customer
    if (isPremiumCustomer) {
      if (product.product_price_premium && parseFloat(product.product_price_premium.toString()) > 0) {
        price = parseFloat(product.product_price_premium.toString())
      } else if (product.premium_price_discounted && parseFloat(product.premium_price_discounted.toString()) > 0) {
        price = parseFloat(product.premium_price_discounted.toString())
      }
    } else if (isSubscriber && product.subscriber_rate && parseFloat(product.subscriber_rate.toString()) > 0) {
      price = parseFloat(product.subscriber_rate.toString())
    }

    if (price === 0 && product.options && product.options.length > 0) {
      const firstOption = product.options[0]
      const key = `${product.product_id}-${firstOption.product_option_id}`

      if (!selectedOptions[key]) {
        setSelectedOptions(prev => ({
          ...prev,
          [key]: true
        }))
        setOptionQuantities(prev => ({
          ...prev,
          [key]: 1
        }))
      }
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Products List */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="p-6 bg-white border-gray-200">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="h-5 w-5" />
            <span style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>Back</span>
          </button>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search for Products.."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 border-gray-300"
              style={{ fontFamily: 'Albert Sans' }}
            />
          </div>

          {/* Category Tabs */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Albert Sans' }}>
              Select Categories
            </p>
            {loadingCategories ? (
              <p className="text-sm text-gray-500">Loading categories...</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    setSelectedCategory(0)
                    setSearchQuery("") // Clear search when selecting all
                  }}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-all ${selectedCategory === 0
                    ? "bg-[#0d6efd] text-white border-[#0d6efd] shadow-sm"
                    : "bg-white text-gray-700 border-gray-300 hover:border-[#0d6efd] hover:bg-gray-50"
                    }`}
                  style={{ fontFamily: 'Albert Sans', fontWeight: 500 }}
                >
                  All Categories
                </button>
                {categories.map((category: Category) => (
                  <button
                    key={category.category_id}
                    onClick={() => {
                      setSelectedCategory(category.category_id)
                      setSearchQuery("") // Clear search when selecting category
                    }}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-all ${selectedCategory === category.category_id
                      ? "bg-[#0d6efd] text-white border-[#0d6efd] shadow-sm"
                      : "bg-white text-gray-700 border-gray-300 hover:border-[#0d6efd] hover:bg-gray-50"
                      }`}
                    style={{ fontFamily: 'Albert Sans', fontWeight: 500 }}
                  >
                    {category.category_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Products Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                    Product Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: 'Albert Sans' }}>

                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingProducts ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Loading products...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No products found. Please try a different category or search term.
                    </td>
                  </tr>
                ) : (
                  products.map((product: Product) => (
                    <>
                      <tr key={product.product_id} className="border-b border-gray-100">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                              {product.product_name}
                            </span>
                            {product.options && product.options.length > 0 && (
                              <span className="text-xs text-blue-600 cursor-help" title="Has options">ℹ️</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                            {product.categories && Array.isArray(product.categories) && product.categories.length > 0
                              ? product.categories.map((cat: any) => cat.category_name).join(', ')
                              : 'Uncategorized'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-900 font-medium" style={{ fontFamily: 'Albert Sans' }}>
                            ${(() => {
                              let basePrice = product.product_price ? parseFloat(product.product_price.toString()) : 0

                              // Override price if Premium customer
                              if (isPremiumCustomer) {
                                if (product.product_price_premium && parseFloat(product.product_price_premium.toString()) > 0) {
                                  basePrice = parseFloat(product.product_price_premium.toString())
                                } else if (product.premium_price_discounted && parseFloat(product.premium_price_discounted.toString()) > 0) {
                                  basePrice = parseFloat(product.premium_price_discounted.toString())
                                }
                              } else if (isSubscriber && product.subscriber_rate && parseFloat(product.subscriber_rate.toString()) > 0) {
                                basePrice = parseFloat(product.subscriber_rate.toString())
                              }

                              // Calculate total from selected options
                              let optionsTotal = 0
                              let isAnyOptionSelected = false

                              if (product.options && product.options.length > 0) {
                                product.options.forEach((option: any) => {
                                  const key = `${product.product_id}-${option.product_option_id}`
                                  if (selectedOptions[key]) {
                                    isAnyOptionSelected = true
                                    let optionPrice = parseFloat(option.option_price.toString())

                                    // Override option price for Premium or Subscriber customer
                                    if (isPremiumCustomer && option.wholesale_price_premium) {
                                      optionPrice = parseFloat(option.wholesale_price_premium.toString())
                                    } else if (isSubscriber && option.subscriber_price) {
                                      optionPrice = parseFloat(option.subscriber_price.toString())
                                    }

                                    const quantity = optionQuantities[key] || 1
                                    optionsTotal += optionPrice * quantity
                                  }
                                })
                              }

                              if (isAnyOptionSelected) {
                                return (basePrice + optionsTotal).toFixed(2)
                              }

                              // Fallback for no selection (preview)
                              if (basePrice === 0 && product.options && product.options.length > 0) {
                                let firstOptionPrice = parseFloat(product.options[0].option_price.toString())

                                // Override first option preview price
                                if (isPremiumCustomer && product.options[0].wholesale_price_premium) {
                                  firstOptionPrice = parseFloat(product.options[0].wholesale_price_premium.toString())
                                } else if (isSubscriber && product.options[0].subscriber_price) {
                                  firstOptionPrice = parseFloat(product.options[0].subscriber_price.toString())
                                }

                                return firstOptionPrice.toFixed(2)
                              }
                              return basePrice.toFixed(2)
                            })()}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {(parseFloat(product.product_price.toString()) > 0 || (isPremiumCustomer && ((product.product_price_premium && parseFloat(product.product_price_premium.toString()) > 0) || (product.premium_price_discounted && parseFloat(product.premium_price_discounted.toString()) > 0))) || (isSubscriber && product.subscriber_rate && parseFloat(product.subscriber_rate.toString()) > 0)) && (
                            <div className="flex items-center gap-2 bg-gray-100 rounded-md w-fit">
                              <button
                                onClick={() => handleQuantityChange(product.product_id, -1)}
                                className="px-3 py-1 text-gray-600 hover:text-gray-900"
                              >
                                -
                              </button>
                              <span className="text-sm font-medium" style={{ fontFamily: 'Albert Sans' }}>
                                {quantities[product.product_id] || (product.min_quantity && product.min_quantity > 0 ? product.min_quantity : 1)}
                              </span>
                              <button
                                onClick={() => handleQuantityChange(product.product_id, 1)}
                                className="px-3 py-1 text-gray-600 hover:text-gray-900"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {product.options && product.options.length > 0 ? (
                            <button
                              onClick={() => handleExpandProduct(product)}
                              className="text-[#0d6efd] hover:text-[#0b5ed7] text-sm font-medium flex items-center gap-1"
                              style={{ fontFamily: 'Albert Sans' }}
                            >
                              <ShoppingCart className="h-4 w-4" />
                              {expandedProduct === product.product_id ? "Close" : "Add"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAddToCart(product)}
                              className="text-[#0d6efd] hover:text-[#0b5ed7] text-sm font-medium flex items-center gap-1"
                              style={{ fontFamily: 'Albert Sans' }}
                            >
                              <ShoppingCart className="h-4 w-4" />
                              Add
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedProduct === product.product_id && product.options && product.options.length > 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-4 bg-gray-50">
                            <div className="border border-gray-200 rounded-lg p-4">
                              <p className="text-sm font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Albert Sans' }}>
                                Select Options
                              </p>
                              <div className="grid grid-cols-2 gap-4">
                                {product.options.map((option: any) => {
                                  const key = `${product.product_id}-${option.product_option_id}`
                                  let price = parseFloat(option.option_price.toString())

                                  // Override option price for Premium customer
                                  if (isPremiumCustomer && option.wholesale_price_premium) {
                                    price = parseFloat(option.wholesale_price_premium.toString())
                                  } else if (isSubscriber && option.subscriber_price) {
                                    price = parseFloat(option.subscriber_price.toString())
                                  }
                                  return (
                                    <div key={key} className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Checkbox
                                          checked={selectedOptions[key] || false}
                                          onCheckedChange={(checked) =>
                                            setSelectedOptions({ ...selectedOptions, [key]: checked as boolean })
                                          }
                                        />
                                        <span className="text-sm text-gray-700" style={{ fontFamily: 'Albert Sans' }}>
                                          {option.option_name}: {option.option_value_name}{' '}
                                          <span className="text-gray-500">
                                            {option.option_price_prefix}${price.toFixed(2)}
                                          </span>
                                        </span>
                                      </div>
                                      {price > 0 && (
                                        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-md">
                                          <button
                                            onClick={() => handleOptionQuantityChange(key, -1)}
                                            className="px-2 py-1 text-gray-600 hover:text-gray-900"
                                          >
                                            -
                                          </button>
                                          <span className="text-sm font-medium" style={{ fontFamily: 'Albert Sans' }}>
                                            {optionQuantities[key] || 1}
                                          </span>
                                          <button
                                            onClick={() => handleOptionQuantityChange(key, 1)}
                                            className="px-2 py-1 text-gray-600 hover:text-gray-900"
                                          >
                                            +
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                              <div className="mt-4 flex justify-end">
                                <button
                                  onClick={() => handleAddToCart(product)}
                                  className="text-[#0d6efd] hover:text-[#0b5ed7] text-sm font-medium flex items-center gap-1"
                                  style={{ fontFamily: 'Albert Sans' }}
                                >
                                  <ShoppingCart className="h-4 w-4" />
                                  Add to Cart
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Right: Order Summary */}
      <div className="lg:col-span-1">
        <Card className="p-6 bg-white border-gray-200 sticky top-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
            Order Summary
          </h3>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={cart.map((_, index) => `cart-item-${index}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4 mb-6">
                {cart.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8" style={{ fontFamily: 'Albert Sans' }}>
                    No products added yet
                  </p>
                ) : (
                  cart.map((item, index) => (
                    <SortableCartItem
                      key={`cart-item-${index}`}
                      item={item}
                      index={index}
                      onRemove={handleRemoveFromCart}
                      onQuantityChange={handleCartItemQuantityChange}
                      onAddOnQuantityChange={handleCartAddOnQuantityChange}
                      onCommentChange={handleCartCommentChange}
                      onPriceChange={handleCartPriceChange}
                      onAddonPriceChange={handleAddonPriceChange}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>

          <div className="border-t border-gray-200 pt-4 space-y-2 mb-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600" style={{ fontFamily: 'Albert Sans' }}>Subtotal</span>
                <span className="font-medium text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                  ${calculateSubtotal().toFixed(2)}
                </span>
              </div>

              {data.delivery_fee !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600" style={{ fontFamily: 'Albert Sans' }}>Delivery Fee</span>
                  <span className="font-medium text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                    ${(data.delivery_fee || 0).toFixed(2)}
                  </span>
                </div>
              )}

              {((data.products || []).some(item => {
                const cat = (item.category || '').toUpperCase();
                return cat === 'ANCILLARIES' || cat === 'PACKAGING';
              })) && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600" style={{ fontFamily: 'Albert Sans' }}>GST (10%)</span>
                  <span className="font-medium text-gray-900" style={{ fontFamily: 'Albert Sans' }}>
                    ${((data.products || []).reduce((sum, item) => {
                      const cat = (item.category || '').toUpperCase();
                      if (cat === 'ANCILLARIES' || cat === 'PACKAGING') {
                        const itemPrice = Number(item.price || 0)
                        const itemQty = Number(item.quantity || 0)
                        const itemTotal = itemPrice * itemQty
                        const addOnsTotal = (item.add_ons || []).reduce((addOnSum, addOn) => {
                          const addonPrice = Number(addOn.price || 0)
                          const addonQty = Number(addOn.quantity || 0)
                          return addOnSum + (addonPrice * addonQty)
                        }, 0) * itemQty // Options are per-unit, multiply by product qty
                        return sum + itemTotal + addOnsTotal
                      }
                      return sum;
                    }, 0) * 0.1).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-lg font-semibold border-t pt-2 mt-2">
                <span className="text-gray-900" style={{ fontFamily: 'Albert Sans' }}>Total</span>
                <span className="text-[#0d6efd]" style={{ fontFamily: 'Albert Sans' }}>
                  ${(calculateSubtotal() + Number(data.delivery_fee || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleProceed}
            disabled={cart.length === 0}
            className="w-full bg-[#0d6efd] hover:bg-[#0b5ed7] text-white rounded-full disabled:opacity-50"
            style={{
              fontFamily: 'Albert Sans',
              fontWeight: 600,
              height: '50px'
            }}
          >
            Proceed
          </Button>
        </Card>
      </div>
    </div>
  )
}

