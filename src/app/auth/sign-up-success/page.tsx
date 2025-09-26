import { redirect } from 'next/navigation'

export default function Page() {
  // Registration is disabled - redirect to login
  redirect('/auth/login')
}