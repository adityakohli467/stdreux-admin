import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define public routes that don't require authentication
const publicRoutes = ['/login']

// Define protected routes that require authentication
const protectedRoutes = ['/dashboard']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )
  
  // Check if the route is public
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route)
  )
  
  // Get the auth token from cookies
  const authCookie = request.cookies.get('caterly-auth')
  
  // If trying to access any non-public route without authentication cookie, redirect to login
  if (!isPublicRoute && !authCookie) {
    const host = request.headers.get('x-forwarded-host')
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const loginUrl = host
      ? new URL('/login', `${proto}://${host}`)
      : new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
  
  // If trying to access login while already authenticated
  if (pathname === '/login' && authCookie) {
    // Use x-forwarded-host (set by reverse proxy) to build the correct public URL
    // Falls back to request.url for local dev
    const host = request.headers.get('x-forwarded-host')
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    if (host) {
      return NextResponse.redirect(new URL('/dashboard', `${proto}://${host}`))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  return NextResponse.next()
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|assets).*)',
  ],
}

