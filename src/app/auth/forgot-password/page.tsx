import { redirect } from 'next/navigation'

export default function Page() {
  // For password resets, contact administrator
  // Redirect to login page
  redirect('/auth/login')
}
