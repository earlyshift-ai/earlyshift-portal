'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { TenantBranding, applyTenantBranding } from '@/lib/tenant-branding'

interface TenantContextType {
  tenant: TenantBranding | null
  setTenant: (tenant: TenantBranding | null) => void
  isLoading: boolean
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  setTenant: () => {},
  isLoading: true,
})

interface TenantProviderProps {
  children: ReactNode
  initialTenant?: TenantBranding | null
}

export function TenantProvider({ children, initialTenant }: TenantProviderProps) {
  const [tenant, setTenant] = useState<TenantBranding | null>(initialTenant || null)
  const [isLoading, setIsLoading] = useState(!initialTenant)

  // Apply tenant branding when tenant changes
  useEffect(() => {
    if (tenant) {
      applyTenantBranding(tenant)
      setIsLoading(false)
    }
  }, [tenant])

  const value: TenantContextType = {
    tenant,
    setTenant,
    isLoading,
  }

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}

/**
 * Hook to access tenant context
 */
export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}

/**
 * Hook to get tenant branding utilities
 */
export function useTenantBranding() {
  const { tenant } = useTenant()
  
  if (!tenant) {
    return {
      primaryColor: '#3B82F6',
      logoUrl: null,
      name: 'Portal',
      isLoading: true,
    }
  }

  return {
    primaryColor: tenant.primary_color,
    logoUrl: tenant.logo_url,
    name: tenant.name,
    slug: tenant.slug,
    settings: tenant.settings,
    isLoading: false,
  }
}

/**
 * Component to conditionally render based on tenant loading state
 */
interface TenantGateProps {
  children: ReactNode
  fallback?: ReactNode
}

export function TenantGate({ children, fallback }: TenantGateProps) {
  const { tenant, isLoading } = useTenant()

  if (isLoading) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )
    )
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tenant Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            The requested tenant could not be found.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
