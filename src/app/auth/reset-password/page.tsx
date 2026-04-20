'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PawPrint, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { DEV_MODE } from '@/lib/constants'
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/schemas'

type RecoveryStatus = 'waiting' | 'ready' | 'expired' | 'dev-mode'

const WAIT_FOR_RECOVERY_MS = 5000

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<RecoveryStatus>(DEV_MODE ? 'dev-mode' : 'waiting')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  useEffect(() => {
    if (DEV_MODE) return

    const supabase = createClient()

    // Supabase parses the magic-link hash on first client render and
    // emits PASSWORD_RECOVERY when it establishes the recovery session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('ready')
      }
    })

    // Fall-through: if the event hasn't fired after a short grace period
    // the link is either missing or expired. Show the "request a new
    // one" state so the user isn't stuck on the spinner.
    const timer = setTimeout(() => {
      setStatus((current) => (current === 'waiting' ? 'expired' : current))
    }, WAIT_FOR_RECOVERY_MS)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function onSubmit(values: ResetPasswordInput) {
    if (status !== 'ready') return

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: values.newPassword })

    if (error) {
      console.error('[reset-password] updateUser error:', error.message)
      toast.error('Could not update your password. Please try again.')
      setLoading(false)
      return
    }

    toast.success('Password updated. Please sign in with your new password.')
    // Hard nav so the new session is propagated via cookies to the
    // server on the next request (same pattern as login/signup).
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            {status === 'expired' ? (
              <AlertCircle className="h-8 w-8 text-destructive" />
            ) : (
              <PawPrint className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle>
            {status === 'expired'
              ? 'Reset link expired'
              : status === 'dev-mode'
                ? 'Password reset'
                : 'Set a new password'}
          </CardTitle>
          <CardDescription>
            {status === 'expired'
              ? 'This reset link is invalid or has expired. Request a new one to continue.'
              : status === 'dev-mode'
                ? 'Password reset requires a live Supabase project — not available in dev mode.'
                : status === 'waiting'
                  ? 'Verifying your reset link…'
                  : 'Choose a strong password to finish signing in again.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'waiting' && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {status === 'expired' && (
            <Button asChild className="w-full">
              <Link href="/auth/forgot-password">Request a new link</Link>
            </Button>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
              <div className="space-y-1">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={errors.newPassword ? 'true' : undefined}
                  autoFocus
                  {...register('newPassword')}
                />
                {errors.newPassword && (
                  <p className="text-xs text-destructive">{errors.newPassword.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Reset Password'
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
