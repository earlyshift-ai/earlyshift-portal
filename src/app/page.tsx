import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  
  // If authenticated, redirect to dashboard
  if (user) {
    redirect('/dashboard')
  }
  
  // For unauthenticated users, redirect to login
  redirect('/auth/login')
}
