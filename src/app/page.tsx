import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default function RootPage() {
  const cookieStore = cookies()
  const authCookie = cookieStore.get('caterly-auth')
  
  if (authCookie) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
