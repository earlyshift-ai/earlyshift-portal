'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TenantSelectorModal } from '@/components/tenant-selector-modal'

interface TenantMembership {
  tenant_id: string
  tenant_slug: string
  tenant_name: string
  role: 'owner' | 'admin' | 'member'
  status: string
}

interface TenantSelectorClientProps {
  memberships: TenantMembership[]
  userEmail: string
}

export function TenantSelectorClient({ memberships, userEmail }: TenantSelectorClientProps) {
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Auto-redirect if only one membership
  useEffect(() => {
    if (memberships.length === 1 && !isRedirecting) {
      setIsRedirecting(true)
      const tenantSlug = memberships[0].tenant_slug
      
      // For development, redirect to local dashboard
      if (process.env.NODE_ENV === 'development') {
        router.push('/dashboard')
      } else {
        // For production, redirect to tenant subdomain
        window.location.href = `https://${tenantSlug}.earlyshift.ai/dashboard`
      }
    }
  }, [memberships, router, isRedirecting])

  const handleTenantSelect = (tenantSlug: string) => {
    setIsRedirecting(true)
    
    // For development, store selected tenant and redirect to dashboard
    if (process.env.NODE_ENV === 'development') {
      // Store selected tenant in localStorage for development
      localStorage.setItem('selectedTenant', tenantSlug)
      router.push('/dashboard')
    } else {
      // For production, redirect to tenant subdomain
      window.location.href = `https://${tenantSlug}.earlyshift.ai/dashboard`
    }
  }

  // Show loading state during auto-redirect
  if (memberships.length === 1 && isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Redirecting to {memberships[0].tenant_name}...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Taking you to your dashboard
          </p>
        </div>
      </div>
    )
  }

  // Show selection modal for multiple memberships
  return (
    <TenantSelectorModal 
      memberships={memberships}
      userEmail={userEmail}
      onSelect={handleTenantSelect}
    />
  )
}
