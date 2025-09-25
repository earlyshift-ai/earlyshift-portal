import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  // Redirect to company selection instead of showing a basic protected page
  redirect('/select-company')
}
