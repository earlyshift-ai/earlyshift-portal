import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  // Redirect to dashboard instead of showing a basic protected page
  redirect('/dashboard')
}
