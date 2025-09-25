#!/usr/bin/env node

/**
 * Script to update Cooke Chile logo URL
 * Usage: node scripts/update-logo.js "https://your-logo-url.com/logo.png"
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateLogo(logoUrl) {
  console.log('🔄 Updating Cooke Chile logo...')
  
  try {
    // Update the tenant logo URL
    const { data, error } = await supabase
      .from('tenants')
      .update({ 
        logo_url: logoUrl,
        updated_at: new Date().toISOString()
      })
      .eq('slug', 'cooke')
      .select()
      .single()

    if (error) {
      throw error
    }

    console.log('✅ Successfully updated logo!')
    console.log(`   Tenant: ${data.name}`)
    console.log(`   Logo URL: ${data.logo_url}`)
    console.log(`   Updated: ${data.updated_at}`)

  } catch (error) {
    console.error('❌ Error updating logo:', error.message)
    process.exit(1)
  }
}

// Get logo URL from command line argument
const logoUrl = process.argv[2]

if (!logoUrl) {
  console.error('❌ Please provide a logo URL')
  console.error('Usage: node scripts/update-logo.js "https://your-logo-url.com/logo.png"')
  process.exit(1)
}

// Validate URL format
try {
  new URL(logoUrl)
} catch (error) {
  console.error('❌ Invalid URL format:', logoUrl)
  process.exit(1)
}

// Run the update
updateLogo(logoUrl)
  .then(() => {
    console.log('🎉 Logo update completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
