'use client'

import { ReactNode } from 'react'
import dynamic from 'next/dynamic'

interface ClientDropdownProps {
  children: ReactNode
}

function ClientDropdownComponent({ children }: ClientDropdownProps) {
  return <>{children}</>
}

// Export as dynamic component with ssr disabled to prevent hydration issues
export const ClientDropdown = dynamic(
  () => Promise.resolve(ClientDropdownComponent),
  { 
    ssr: false,
    loading: () => <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
  }
)