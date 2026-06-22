"use client"

import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"

export default function PaymentErrorPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")
  const error = searchParams.get("error") || "Payment was declined"

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
            <svg
              className="h-10 w-10 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Payment Failed
        </h1>
        
        <p className="text-gray-600 mb-2">
          Your payment for Order #{orderId || "N/A"} could not be processed.
        </p>
        
        <p className="text-sm text-red-600 mb-8">
          {error}
        </p>
        
        <p className="text-sm text-gray-500 mb-8">
          Please try again or contact us if the problem persists.
        </p>
        
        <div className="space-y-3">
          {orderId && (
            <Link
              href={`/orders/${orderId}`}
              className="block w-full bg-[#105a9c] text-white py-2 px-4 rounded-md hover:bg-[#0d4a82] transition-colors"
            >
              Try Payment Again
            </Link>
          )}
          <Link
            href="/orders"
            className="block w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
          >
            Back to Orders
          </Link>
        </div>
      </div>
    </div>
  )
}

