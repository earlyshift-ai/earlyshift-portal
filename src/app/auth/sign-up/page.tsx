import { redirect } from 'next/navigation'

export default function Page() {
  // Registration is disabled for internal portal
  // Redirect to login page
  redirect('/auth/login')
}
