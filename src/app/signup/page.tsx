'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PawPrint, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { DEV_MODE } from '@/lib/constants'
import { signupSchema, type SignupInput } from '@/lib/schemas'
import { describeAuthError } from '@/lib/auth-errors'

function SignUpForm() {
  const searchParams = useSearchParams()
  const role = searchParams.get('role')

  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  })

  const acceptTerms = watch('acceptTerms')

  async function onSubmit(values: SignupInput) {
    setSubmitError(null)
    setLoading(true)

    if (DEV_MODE) {
      window.location.href = '/onboarding'
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { intended_role: role },
      },
    })

    if (error) {
      console.error('[signup] signUp failed:', error.message)
      const copy = describeAuthError(error, 'Could not create your account. Please try again.')
      setSubmitError(copy)
      toast.error(copy)
      setLoading(false)
      return
    }

    // Supabase sends a confirmation email automatically on signUp; route
    // the user to the interstitial so they can't poke at /onboarding until
    // their email is verified. (OAuth path stays direct — providers return
    // pre-confirmed emails.)
    window.location.href = '/auth/verify-email'
  }

  async function handleGoogleSignUp() {
    if (!acceptTerms) {
      setSubmitError('You must agree to the Terms of Service and Privacy Policy.')
      return
    }
    if (DEV_MODE) {
      window.location.href = '/onboarding'
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
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            {role === 'shelter'
              ? 'Register your shelter or rescue'
              : role === 'foster'
              ? 'Sign up to start fostering'
              : 'Join Fostr Fix today'}
          </CardDescription>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={errors.password ? 'true' : undefined}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={errors.confirmPassword ? 'true' : undefined}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
            <div className="flex items-start gap-2 pt-1">
              <Controller
                name="acceptTerms"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="accept-terms"
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    className="mt-0.5"
                    aria-required="true"
                    aria-invalid={errors.acceptTerms ? 'true' : undefined}
                  />
                )}
              />
              <Label
                htmlFor="accept-terms"
                className="text-xs font-normal leading-snug text-muted-foreground"
              >
                I agree to the{' '}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-primary hover:underline font-medium"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-primary hover:underline font-medium"
                >
                  Privacy Policy
                </Link>
                .
              </Label>
            </div>
            {errors.acceptTerms && (
              <p className="text-xs text-destructive">{errors.acceptTerms.message}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !acceptTerms}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : 'Create Account'}
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

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignUp}
            disabled={!acceptTerms}
          >
            Continue with Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  )
}
