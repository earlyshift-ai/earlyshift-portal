'use client'

import { useTenantBranding } from '@/components/tenant-provider'
import { Building } from 'lucide-react'
import Image from 'next/image'

interface TenantLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showName?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
}

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
}

export function TenantLogo({ size = 'md', showName = false, className = '' }: TenantLogoProps) {
  const { logoUrl, name, primaryColor } = useTenantBranding()

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo */}
      <div className={`${sizeClasses[size]} flex-shrink-0 relative`}>
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={`${name} logo`}
            fill
            className="object-contain rounded-lg"
            priority
          />
        ) : (
          <div 
            className={`${sizeClasses[size]} rounded-lg flex items-center justify-center`}
            style={{ backgroundColor: primaryColor + '20' }}
          >
            <Building 
              className={`${
                size === 'sm' ? 'w-4 h-4' : 
                size === 'md' ? 'w-6 h-6' : 
                size === 'lg' ? 'w-8 h-8' : 'w-12 h-12'
              }`}
              style={{ color: primaryColor }}
            />
          </div>
        )}
      </div>

      {/* Company Name */}
      {showName && (
        <span 
          className={`font-semibold ${textSizeClasses[size]} truncate`}
          style={{ color: primaryColor }}
        >
          {name}
        </span>
      )}
    </div>
  )
}

/**
 * Compact logo variant for headers/navigation
 */
export function TenantLogoCompact({ className = '' }: { className?: string }) {
  return (
    <TenantLogo 
      size="sm" 
      showName={true} 
      className={`min-w-0 ${className}`}
    />
  )
}

/**
 * Large logo variant for landing pages
 */
export function TenantLogoHero({ className = '' }: { className?: string }) {
  return (
    <TenantLogo 
      size="xl" 
      showName={true} 
      className={`flex-col text-center gap-4 ${className}`}
    />
  )
}
