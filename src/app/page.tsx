import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  
  // If authenticated, redirect to dashboard
  if (user) {
    redirect('/dashboard')
  }

  // Landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-16">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Welcome to{' '}
              <span className="text-blue-600 dark:text-blue-400">EarlyShift</span>{' '}
              Portal
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8">
              Your AI-powered business assistant platform
            </p>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Connect with intelligent AI agents tailored to your business needs. 
              Each company gets their own branded experience with specialized chatbots.
            </p>
          </div>

          {/* CTA Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  For Companies
                </CardTitle>
                <CardDescription>
                  Get your own branded portal with AI assistants
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Custom subdomain, company branding, and specialized AI agents 
                  that understand your business domain.
                </p>
                <Button asChild className="w-full">
                  <Link href="/auth/sign-up">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-green-600" />
                  Existing Users
                </CardTitle>
                <CardDescription>
                  Access your company's AI assistants
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
              Sign in to access your personalized dashboard and chat with 
              your company&apos;s AI agents.
                </p>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/auth/login">
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Features */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
              Powered by Advanced AI
            </h2>
            <div className="grid md:grid-cols-3 gap-6 text-left max-w-3xl mx-auto">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Multi-Tenant Architecture
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Each company gets isolated data and customized experiences.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  n8n Integration
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Powered by sophisticated workflows and AI agents.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Secure & Scalable
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Enterprise-grade security with row-level data isolation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
