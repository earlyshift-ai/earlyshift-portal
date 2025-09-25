'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface LogoUploadProps {
  tenantId: string
  tenantSlug: string
  currentLogoUrl?: string | null
  onLogoUpdated?: (newLogoUrl: string) => void
  className?: string
}

export function LogoUpload({ 
  tenantId, 
  tenantSlug, 
  currentLogoUrl, 
  onLogoUpdated,
  className 
}: LogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a PNG, JPEG, WebP, or SVG image')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB')
      return
    }

    setError(null)
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload file
    handleUpload(file)
  }

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setError(null)

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `logo-${Date.now()}.${fileExt}`
      const filePath = `${tenantSlug}/${fileName}`

      // Delete old logo if exists
      if (currentLogoUrl && currentLogoUrl.includes('tenant-logos')) {
        const oldPath = currentLogoUrl.split('/tenant-logos/')[1]
        if (oldPath) {
          await supabase.storage
            .from('tenant-logos')
            .remove([oldPath])
        }
      }

      // Upload new logo
      const { error: uploadError, data } = await supabase.storage
        .from('tenant-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tenant-logos')
        .getPublicUrl(filePath)

      // Update tenant logo URL in database
      const { error: updateError } = await supabase
        .rpc('update_tenant_logo', {
          p_tenant_id: tenantId,
          p_logo_filename: fileName
        })

      if (updateError) {
        // If database update fails, clean up uploaded file
        await supabase.storage
          .from('tenant-logos')
          .remove([filePath])
        throw updateError
      }

      // Success
      setPreviewUrl(publicUrl)
      onLogoUpdated?.(publicUrl)
      
    } catch (err: any) {
      setError(err.message || 'Failed to upload logo')
      setPreviewUrl(currentLogoUrl || null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl) return

    setIsUploading(true)
    setError(null)

    try {
      // Remove from storage
      if (currentLogoUrl.includes('tenant-logos')) {
        const filePath = currentLogoUrl.split('/tenant-logos/')[1]
        if (filePath) {
          await supabase.storage
            .from('tenant-logos')
            .remove([filePath])
        }
      }

      // Update database to remove logo URL
      const { error: updateError } = await supabase
        .from('tenants')
        .update({ logo_url: null })
        .eq('id', tenantId)

      if (updateError) {
        throw updateError
      }

      setPreviewUrl(null)
      onLogoUpdated?.('')

    } catch (err: any) {
      setError(err.message || 'Failed to remove logo')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Company Logo
        </CardTitle>
        <CardDescription>
          Upload your company logo. Supports PNG, JPEG, WebP, and SVG files up to 5MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview Area */}
        <div className="flex items-center justify-center w-full">
          <div className="relative w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-800">
            {previewUrl ? (
              <div className="relative w-full h-full group">
                <Image
                  src={previewUrl}
                  alt="Company logo"
                  fill
                  className="object-contain rounded-lg"
                />
                {!isUploading && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleRemoveLogo}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center">
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">No logo uploaded</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upload Button */}
        <div className="flex flex-col space-y-2">
          <Label htmlFor="logo-upload" className="sr-only">
            Upload logo
          </Label>
          <Input
            id="logo-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileSelect}
            disabled={isUploading}
            ref={fileInputRef}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {previewUrl ? 'Change Logo' : 'Upload Logo'}
              </>
            )}
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Usage Guidelines */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Recommended size: 200x200px or larger</p>
          <p>• Square images work best</p>
          <p>• Transparent backgrounds are supported</p>
        </div>
      </CardContent>
    </Card>
  )
}
