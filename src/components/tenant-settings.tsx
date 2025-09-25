'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LogoUpload } from '@/components/logo-upload'
import { Loader2, Save, Palette, Building } from 'lucide-react'

interface Tenant {
  id: string
  slug: string
  name: string
  logo_url: string | null
  primary_color: string
  settings: Record<string, any>
}

interface TenantSettingsProps {
  tenant: Tenant
  onTenantUpdated?: (tenant: Tenant) => void
  className?: string
}

export function TenantSettings({ tenant, onTenantUpdated, className }: TenantSettingsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: tenant.name,
    primary_color: tenant.primary_color,
    logo_url: tenant.logo_url
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = createClient()

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleLogoUpdated = (newLogoUrl: string) => {
    setFormData(prev => ({ ...prev, logo_url: newLogoUrl }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required'
    } else if (formData.name.length < 2) {
      newErrors.name = 'Company name must be at least 2 characters'
    } else if (formData.name.length > 100) {
      newErrors.name = 'Company name must be less than 100 characters'
    }

    if (!formData.primary_color.match(/^#[0-9A-Fa-f]{6}$/)) {
      newErrors.primary_color = 'Please enter a valid hex color (e.g., #3B82F6)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await supabase
        .from('tenants')
        .update({
          name: formData.name.trim(),
          primary_color: formData.primary_color,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenant.id)
        .select()
        .single()

      if (error) throw error

      // Update local state
      const updatedTenant = { ...tenant, ...formData, ...data }
      onTenantUpdated?.(updatedTenant)

      // Show success message (you might want to use a toast library)
      console.log('Tenant settings updated successfully')

    } catch (err: any) {
      setErrors({ submit: err.message || 'Failed to update settings' })
    } finally {
      setIsLoading(false)
    }
  }

  const colorPresets = [
    '#3B82F6', // Blue
    '#8B5CF6', // Purple
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#6B7280', // Gray
    '#EC4899', // Pink
    '#14B8A6'  // Teal
  ]

  return (
    <div className={className}>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Logo Upload */}
        <LogoUpload
          tenantId={tenant.id}
          tenantSlug={tenant.slug}
          currentLogoUrl={tenant.logo_url}
          onLogoUpdated={handleLogoUpdated}
        />

        {/* Basic Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Company Information
            </CardTitle>
            <CardDescription>
              Update your company details and branding
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter company name"
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.name}</p>
                )}
              </div>

              {/* Primary Color */}
              <div className="space-y-2">
                <Label htmlFor="primary-color" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Primary Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="primary-color"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => handleInputChange('primary_color', e.target.value)}
                    className="w-20 h-10 p-1 rounded cursor-pointer"
                    disabled={isLoading}
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => handleInputChange('primary_color', e.target.value)}
                    placeholder="#3B82F6"
                    className="flex-1"
                    disabled={isLoading}
                  />
                </div>
                {errors.primary_color && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.primary_color}</p>
                )}

                {/* Color Presets */}
                <div className="grid grid-cols-8 gap-2 mt-2">
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 ${
                        formData.primary_color === color 
                          ? 'border-gray-900 dark:border-white' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => handleInputChange('primary_color', color)}
                      disabled={isLoading}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>

              {errors.submit && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                  {errors.submit}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Preview Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            See how your branding will look in the portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
            <div className="flex items-center gap-4">
              {formData.logo_url ? (
                <img
                  src={formData.logo_url}
                  alt="Company logo"
                  className="w-12 h-12 object-contain rounded-lg"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                  <Building className="h-6 w-6 text-gray-500" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold">{formData.name}</h3>
                <p 
                  className="text-sm font-medium"
                  style={{ color: formData.primary_color }}
                >
                  Welcome to your portal
                </p>
              </div>
            </div>
            <div 
              className="mt-4 h-2 rounded-full"
              style={{ backgroundColor: formData.primary_color + '40' }}
            >
              <div 
                className="h-full w-1/3 rounded-full"
                style={{ backgroundColor: formData.primary_color }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
