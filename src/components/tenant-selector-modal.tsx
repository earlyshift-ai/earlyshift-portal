'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building, Crown, Shield, User, ArrowRight, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface TenantMembership {
  tenant_id: string
  tenant_slug: string
  tenant_name: string
  role: 'owner' | 'admin' | 'member'
  status: string
}

interface TenantSelectorModalProps {
  memberships: TenantMembership[]
  userEmail: string
  onSelect?: (tenantSlug: string) => void
}

export function TenantSelectorModal({ memberships, userEmail, onSelect }: TenantSelectorModalProps) {
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const router = useRouter()

  const handleTenantSelect = async (tenantSlug: string) => {
    setSelectedTenant(tenantSlug)
    setIsRedirecting(true)

    try {
      // Call the onSelect callback if provided
      if (onSelect) {
        onSelect(tenantSlug)
      } else {
        // Default behavior: redirect to tenant subdomain
        const tenantUrl = `https://${tenantSlug}.earlyshift.ai/dashboard`
        window.location.href = tenantUrl
      }
    } catch (error) {
      console.error('Error selecting tenant:', error)
      setIsRedirecting(false)
      setSelectedTenant(null)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />
      default:
        return <User className="h-4 w-4 text-gray-600" />
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Building className="h-6 w-6" />
            Select Your Company
          </CardTitle>
          <CardDescription>
              Welcome back, {userEmail}! Please select which company you&apos;d like to access.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="overflow-y-auto">
          <div className="space-y-3">
            {memberships.map((membership) => (
              <TenantCard
                key={membership.tenant_id}
                membership={membership}
                isSelected={selectedTenant === membership.tenant_slug}
                isRedirecting={isRedirecting && selectedTenant === membership.tenant_slug}
                onSelect={() => handleTenantSelect(membership.tenant_slug)}
                getRoleIcon={getRoleIcon}
                getRoleBadgeColor={getRoleBadgeColor}
              />
            ))}
          </div>
          
          {memberships.length === 0 && (
            <div className="text-center py-8">
              <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Companies Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                You don&apos;t have access to any companies yet. Please contact your administrator.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface TenantCardProps {
  membership: TenantMembership
  isSelected: boolean
  isRedirecting: boolean
  onSelect: () => void
  getRoleIcon: (role: string) => React.ReactElement
  getRoleBadgeColor: (role: string) => string
}

function TenantCard({ 
  membership, 
  isSelected, 
  isRedirecting, 
  onSelect, 
  getRoleIcon, 
  getRoleBadgeColor 
}: TenantCardProps) {
  return (
    <Button
      variant="outline"
      onClick={onSelect}
      disabled={isRedirecting}
      className={`
        w-full p-4 h-auto justify-start hover:shadow-md transition-all duration-200
        ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}
      `}
    >
      <div className="flex items-center gap-4 w-full">
        {/* Company Logo/Icon */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            {membership.tenant_name.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Company Info */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {membership.tenant_name}
            </h3>
            <Badge className={getRoleBadgeColor(membership.role)}>
              <div className="flex items-center gap-1">
                {getRoleIcon(membership.role)}
                <span className="capitalize">{membership.role}</span>
              </div>
            </Badge>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {membership.tenant_slug}.earlyshift.ai
          </p>
        </div>

        {/* Action Indicator */}
        <div className="flex-shrink-0">
          {isRedirecting ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          ) : (
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          )}
        </div>
      </div>
    </Button>
  )
}
