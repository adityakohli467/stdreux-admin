import { create } from "zustand"
import { persist } from "zustand/middleware"
import axios from "axios"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://ec2-13-55-72-162.ap-southeast-2.compute.amazonaws.com:9000"

interface User {
  user_id: number
  email: string
  username: string
  auth_level: number
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        try {
          const response = await axios.post(`${API_URL}/admin/auth/login`, {
            username,
            password,
          })

          const { token, user } = response.data

          // Store in state and localStorage
          set({
            user,
            token,
            isAuthenticated: true,
          })

          // Also set a cookie for middleware (4 hours expiration to match JWT)
          if (typeof document !== 'undefined') {
            document.cookie = `caterly-auth=${token}; path=/; max-age=${60 * 60 * 4}; SameSite=Lax`
          }
        } catch (error: any) {
          const message = error.response?.data?.message || "Login failed"
          throw new Error(message)
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })

        // Clear the cookie
        if (typeof document !== 'undefined') {
          document.cookie = 'caterly-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        }
      },

      checkAuth: async () => {
        const { token } = get()

        if (!token) {
          set({ isAuthenticated: false })
          return
        }

        try {
          const response = await axios.get(`${API_URL}/admin/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: 5000, // 5 second timeout
          })

          set({
            user: response.data.user,
            isAuthenticated: true,
          })
        } catch (error) {
          // Handle network errors differently
          if (axios.isAxiosError(error)) {
            if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
              // Backend is down - silently keep user authenticated (don't logout on network errors)
              set({ isAuthenticated: true })
              return
            }
            
            // Clear auth on 401 (token expired/invalid)
            if (error.response?.status === 401) {
              set({
                user: null,
                token: null,
                isAuthenticated: false,
              })
              
              // Clear storage
              if (typeof window !== 'undefined') {
                localStorage.removeItem('caterly-auth')
                localStorage.removeItem('token')
                document.cookie = 'caterly-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
              }
              return
            }
          }
          
          // Other errors - clear auth to be safe
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          })
          
          if (typeof window !== 'undefined') {
            localStorage.removeItem('caterly-auth')
            localStorage.removeItem('token')
            document.cookie = 'caterly-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
          }
        }
      },
    }),
    {
      name: "caterly-auth",
    }
  )
)

