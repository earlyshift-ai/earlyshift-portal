/**
 * Tenant branding utilities for applying company-specific theming
 */

export interface TenantBranding {
  id: string
  slug: string
  name: string
  logo_url: string | null
  primary_color: string
  settings: Record<string, any>
}

/**
 * Apply tenant branding to the document
 * This function dynamically updates CSS custom properties for theming
 */
export function applyTenantBranding(tenant: TenantBranding) {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  // Set CSS custom properties for tenant branding
  root.style.setProperty('--tenant-primary', tenant.primary_color)
  root.style.setProperty('--tenant-primary-rgb', hexToRgb(tenant.primary_color))
  
  // Generate lighter and darker variants
  const hsl = hexToHsl(tenant.primary_color)
  root.style.setProperty('--tenant-primary-light', hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 10, 95)))
  root.style.setProperty('--tenant-primary-dark', hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 10, 5)))
  
  // Set opacity variants
  root.style.setProperty('--tenant-primary-50', tenant.primary_color + '0D') // 5%
  root.style.setProperty('--tenant-primary-100', tenant.primary_color + '1A') // 10%
  root.style.setProperty('--tenant-primary-200', tenant.primary_color + '33') // 20%
  root.style.setProperty('--tenant-primary-500', tenant.primary_color + '80') // 50%

  // Update page title
  document.title = `${tenant.name} Portal`
  
  // Update favicon if tenant has a logo (you might want to generate a favicon from the logo)
  updateFavicon(tenant.logo_url)
}

/**
 * Generate CSS classes for tenant-specific styling
 */
export function getTenantStyles(tenant: TenantBranding) {
  return {
    primaryColor: tenant.primary_color,
    primaryBg: `bg-[${tenant.primary_color}]`,
    primaryText: `text-[${tenant.primary_color}]`,
    primaryBorder: `border-[${tenant.primary_color}]`,
    primaryHover: `hover:bg-[${tenant.primary_color}]`,
  }
}

/**
 * Get tenant logo with fallback
 */
export function getTenantLogo(tenant: TenantBranding, fallbackText?: string) {
  return {
    src: tenant.logo_url,
    alt: `${tenant.name} logo`,
    fallback: fallbackText || tenant.name.charAt(0).toUpperCase()
  }
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0, 0, 0'
  
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  
  return `${r}, ${g}, ${b}`
}

/**
 * Convert hex color to HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { h: 0, s: 0, l: 0 }

  let r = parseInt(result[1], 16) / 255
  let g = parseInt(result[2], 16) / 255
  let b = parseInt(result[3], 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h: number, s: number, l: number

  l = (max + min) / 2

  if (max === min) {
    h = s = 0 // achromatic
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
      default: h = 0
    }

    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

/**
 * Convert HSL to hex
 */
function hslToHex(h: number, s: number, l: number): string {
  l /= 100
  const a = s * Math.min(l, 1 - l) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Update favicon
 */
function updateFavicon(logoUrl: string | null) {
  if (!logoUrl) return

  // Find existing favicon
  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  
  if (!favicon) {
    favicon = document.createElement('link')
    favicon.rel = 'icon'
    document.head.appendChild(favicon)
  }
  
  // For now, just use the logo as favicon
  // In production, you might want to generate a proper favicon
  favicon.href = logoUrl
}

/**
 * Generate a color palette from the tenant's primary color
 */
export function generateColorPalette(primaryColor: string) {
  const hsl = hexToHsl(primaryColor)
  
  return {
    50: hslToHex(hsl.h, hsl.s, 95),
    100: hslToHex(hsl.h, hsl.s, 90),
    200: hslToHex(hsl.h, hsl.s, 80),
    300: hslToHex(hsl.h, hsl.s, 70),
    400: hslToHex(hsl.h, hsl.s, 60),
    500: primaryColor, // Base color
    600: hslToHex(hsl.h, hsl.s, 45),
    700: hslToHex(hsl.h, hsl.s, 35),
    800: hslToHex(hsl.h, hsl.s, 25),
    900: hslToHex(hsl.h, hsl.s, 15),
  }
}

/**
 * Check if a color is light or dark (for determining text color)
 */
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex).split(', ').map(Number)
  const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
  return brightness > 128
}

/**
 * Get contrasting text color for a background
 */
export function getContrastingTextColor(backgroundColor: string): string {
  return isLightColor(backgroundColor) ? '#000000' : '#FFFFFF'
}
