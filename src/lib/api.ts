import axios from "axios"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://stdreux-api-production.up.railway.app"

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const auth = localStorage.getItem("caterly-auth")
    if (auth) {
      try {
        const { state } = JSON.parse(auth)
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`
        }
      } catch (error) {
        console.error("Error parsing auth token:", error)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle token expiration and unauthorized errors
    if (error.response?.status === 401) {
      const errorMessage = error.response.data?.message || 'Session expired. Please login again.'

      // Clear auth state if token expired
      if (typeof window !== 'undefined') {
        // Clear localStorage
        localStorage.removeItem('caterly-auth')
        localStorage.removeItem('token')

        // Clear cookie
        document.cookie = 'caterly-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'

        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/login')) {
          // Store intended destination
          const currentPath = window.location.pathname + window.location.search
          if (currentPath !== '/login') {
            window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
          }
        }
      }

      // Return error with clear message
      return Promise.reject(new Error(errorMessage))
    }

    // Enhanced error handling
    if (error.response) {
      // Server responded with error status
      const status = error.response.status
      const message = error.response.data?.message || error.message

      // Log error for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ API Error [${status}]:`, {
          url: error.config?.url,
          method: error.config?.method,
          message,
        })
      }

      // Return user-friendly error message
      const userMessage = message || `Request failed with status ${status}`
      return Promise.reject(new Error(userMessage))
    } else if (error.request) {
      // Request was made but no response received
      const userMessage = 'Network error. Please check your connection and try again.'
      return Promise.reject(new Error(userMessage))
    } else {
      // Something else happened
      const userMessage = error.message || 'An unexpected error occurred. Please try again.'
      return Promise.reject(new Error(userMessage))
    }
  }
)

export default api

// API functions
export const authAPI = {
  login: (username: string, password: string) =>
    api.post("/admin/auth/login", { username, password }),
  me: () => api.get("/admin/auth/me"),
}

export const productsAPI = {
  list: (params?: any) => api.get("/admin/products", { params }),
  get: (id: number) => api.get(`/admin/products/${id}`),
  create: (data: any) => api.post("/admin/products", data),
  update: (id: number, data: any) => api.put(`/admin/products/${id}`, data),
  delete: (id: number) => api.delete(`/admin/products/${id}`),
}

export const ordersAPI = {
  list: (params?: any) => api.get("/admin/orders", { params }),
  listWholesale: (params?: any) => api.get("/admin/orders/wholesale", { params }),
  get: (id: number) => api.get(`/admin/orders/${id}`),
  create: (data: any) => api.post("/admin/orders", data),
  update: (id: number, data: any) => api.put(`/admin/orders/${id}`, data),
  updateStatus: (id: number, status: number) =>
    api.put(`/admin/orders/${id}/status`, { order_status: status }),
  delete: (id: number) => api.delete(`/admin/orders/${id}`),
  stats: () => api.get("/admin/orders/stats"),
  sendEmail: (id: number, data?: { email_type?: string; custom_message?: string }) =>
    api.post(`/admin/orders/${id}/send-email`, data || {}),
}

export const customersAPI = {
  list: (params?: any) => api.get("/admin/customers", { params }),
  listWholesale: (params?: any) => api.get("/admin/customers/wholesale", { params }),
  listPendingApproval: (params?: any) => api.get("/admin/customers/pending-approval", { params }),
  get: (id: number) => api.get(`/admin/customers/${id}`),
  create: (data: any) => api.post("/admin/customers", data),
  update: (id: number, data: any) => api.put(`/admin/customers/${id}`, data),
  archive: (id: number) => api.post(`/admin/customers/${id}/archive`),
  restore: (id: number) => api.post(`/admin/customers/${id}/restore`),
  delete: (id: number) => api.delete(`/admin/customers/${id}`),
  approve: (id: number) => api.post(`/admin/customers/${id}/approve`),
  reject: (id: number) => api.post(`/admin/customers/${id}/reject`),
  getProductOptionDiscounts: (id: number) => api.get(`/admin/customers/${id}/product-option-discounts`),
  setProductOptionDiscounts: (id: number, discounts: any[]) => api.post(`/admin/customers/${id}/product-option-discounts`, { discounts }),
}

export const locationsAPI = {
  list: (params?: any) => api.get("/admin/locations", { params }),
  get: (id: number) => api.get(`/admin/locations/${id}`),
}

export const couponsAPI = {
  validate: (code: string) => api.post("/admin/coupons/validate", { code }),
  list: (params?: any) => api.get("/admin/coupons", { params }),
  get: (id: number) => api.get(`/admin/coupons/${id}`),
  create: (data: any) => api.post("/admin/coupons", data),
  update: (id: number, data: any) => api.put(`/admin/coupons/${id}`, data),
  delete: (id: number) => api.delete(`/admin/coupons/${id}`),
}

export const contactInquiriesAPI = {
  list: (params?: any) => api.get("/admin/contact-inquiries", { params }),
  get: (id: number) => api.get(`/admin/contact-inquiries/${id}`),
  update: (id: number, data: any) => api.put(`/admin/contact-inquiries/${id}`, data),
  delete: (id: number) => api.delete(`/admin/contact-inquiries/${id}`),
}

export const wholesaleEnquiriesAPI = {
  list: (params?: any) => api.get("/admin/wholesale-enquiries", { params }),
  get: (id: number) => api.get(`/admin/wholesale-enquiries/${id}`),
  update: (id: number, data: any) => api.put(`/admin/wholesale-enquiries/${id}`, data),
  delete: (id: number) => api.delete(`/admin/wholesale-enquiries/${id}`),
}

export const companiesAPI = {
  list: (params?: any) => api.get("/admin/companies", { params }),
  get: (id: number) => api.get(`/admin/companies/${id}`),
  create: (data: any) => api.post("/admin/companies", data),
  update: (id: number, data: any) => api.put(`/admin/companies/${id}`, data),
  delete: (id: number) => api.delete(`/admin/companies/${id}`),
  getDepartments: (companyId?: number) =>
    api.get("/admin/companies/departments/list", { params: { company_id: companyId } }),
  createDepartment: (data: any) => api.post("/admin/companies/departments", data),
  updateDepartment: (id: number, data: any) => api.put(`/admin/companies/departments/${id}`, data),
  deleteDepartment: (id: number) => api.delete(`/admin/companies/departments/${id}`),
}

export const invoicesAPI = {
  generate: (orderId: number) => api.post("/admin/invoices/generate", { order_id: orderId }),
  get: (orderId: number) => api.get(`/admin/invoices/${orderId}`),
  download: (orderId: number) => api.get(`/admin/invoices/${orderId}/download`, { responseType: 'blob' }),
  send: (orderId: number, customMessage?: string) => api.post(`/admin/invoices/${orderId}/send`, { custom_message: customMessage }),
}

export const settingsAPI = {
  get: (category?: string) => api.get("/admin/settings", { params: category ? { category } : {} }),
  update: (settings: Record<string, any>) => api.put("/admin/settings", settings),
  getSystemHealth: () => api.get("/admin/settings/system/health"),
}

export const paymentsAPI = {
  createIntent: (data: { order_id: number; email?: string }) =>
    api.post("/admin/payments/create-intent", data),
  verify: (data: { payment_intent_id: string; order_id?: number }) =>
    api.post("/store/payment/verify", data),
  refund: (data: { payment_intent_id: string; amount?: number; reason?: string }) =>
    api.post("/admin/payments/stripe-refund", data),
  getStatus: (orderId: number) =>
    api.get(`/admin/payments/order/${orderId}`),
  getHistory: (params?: {
    order_id?: number;
    customer_id?: number;
    payment_status?: string;
    payment_gateway?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number
  }) =>
    api.get("/admin/payments/history", { params }),
  getOrderHistory: (orderId: number) =>
    api.get(`/admin/payments/history/${orderId}`),
  getAuditLog: (transactionId: string) =>
    api.get(`/admin/payments/audit/${transactionId}`),
  getStatistics: (params?: { date_from?: string; date_to?: string }) =>
    api.get("/admin/payments/statistics", { params }),
  syncRecent: () =>
    api.post("/admin/payments/sync-recent"),
}

export const historyAPI = {
  list: (params?: any) => api.get("/admin/history", { params }),
  get: (id: number) => api.get(`/admin/history/${id}`),
  statistics: (params?: any) => api.get("/admin/history/statistics", { params }),
  eventTypes: () => api.get("/admin/history/event-types"),
  eventCategories: () => api.get("/admin/history/event-categories"),
  resourceTypes: () => api.get("/admin/history/resource-types"),
}

export const notificationsAPI = {
  list: (params?: any) => api.get("/admin/notifications", { params }),
  getUnreadCount: () => api.get("/admin/notifications/unread-count"),
  markAsRead: (id: number) => api.put(`/admin/notifications/${id}/read`),
  markAllAsRead: () => api.put("/admin/notifications/mark-all-read"),
}

export const newsletterAPI = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get("/admin/newsletter", { params }),
  unsubscribe: (id: number) => api.put(`/admin/newsletter/${id}/unsubscribe`),
  reactivate: (id: number) => api.put(`/admin/newsletter/${id}/reactivate`),
  delete: (id: number) => api.delete(`/admin/newsletter/${id}`),
}

export const xeroAPI = {
  getAuthUrl: () => api.get("/admin/xero/auth-url"),
  callback: (url: string) => api.get("/admin/xero/callback", { params: { url } }),
  getStatus: () => api.get("/admin/xero/status"),
  disconnect: () => api.post("/admin/xero/disconnect"),
  createInvoice: (orderId: number) => api.post(`/admin/xero/invoice/${orderId}`),
}
