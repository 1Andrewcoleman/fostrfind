'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PawPrint, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { getPostAuthDestination } from '@/lib/auth-routing'
import { DEV_MODE } from '@/lib/constants'
import { loginSchema, type LoginInput } from '@/lib/schemas'
import { describeAuthError } from '@/lib/auth-errors'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginInput) {
    setSubmitError(null)
    setLoading(true)

    if (DEV_MODE) {
      window.location.href = '/shelter/dashboard'
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      console.error('[login] signInWithPassword failed:', error.message)
      const copy = describeAuthError(error, 'Could not sign you in. Please try again.')
      setSubmitError(copy)
      toast.error(copy)
      setLoading(false)
      return
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.error('[login] getUser after sign-in failed:', authError.message)
      toast.error('Signed in, but we could not load your profile. Please try again.')
      setLoading(false)
      return
    }
    const dest = user ? await getPostAuthDestination(supabase, user.id) : '/onboarding'
    window.location.href = dest
  }

  async function handleGoogleSignIn() {
    if (DEV_MODE) {
      window.location.href = '/shelter/dashboard'
      return
    }
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <PawPrint className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your Fostr Fix account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitError && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {submitError}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={errors.email ? 'true' : undefined}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={errors.password ? 'true' : undefined}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : 'Sign In'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            Continue with Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
