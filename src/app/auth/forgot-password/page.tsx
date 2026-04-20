'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PawPrint, Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { DEV_MODE } from '@/lib/constants'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/schemas'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: ForgotPasswordInput) {
    setLoading(true)

    if (DEV_MODE) {
      toast.info('Password reset requires a live Supabase project — not available in dev mode.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      // The target page must be listed in Supabase Dashboard →
      // Authentication → URL Configuration → Redirect URLs. Using
      // window.location.origin lets the flow work in local dev and
      // production without changing code.
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    // Intentionally show the same success state on error too, so the
    // page does not leak whether an account exists for the entered
    // email. Any real error is logged to the console for debugging.
    if (error) {
      console.error('[forgot-password] resetPasswordForEmail error:', error.message)
    }

    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            {submitted ? (
              <MailCheck className="h-8 w-8 text-primary" />
            ) : (
              <PawPrint className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle>{submitted ? 'Check your inbox' : 'Forgot your password?'}</CardTitle>
          <CardDescription>
            {submitted
              ? 'If an account exists for that email, a reset link is on its way. The link expires in about an hour.'
              : "Enter your email and we'll send you a link to set a new password."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!submitted && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={errors.email ? 'true' : undefined}
                  autoFocus
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline font-medium">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
