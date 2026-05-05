'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MailQuestion, Loader2, PawPrint } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { getPostAuthDestination } from '@/lib/auth-routing'
import { DEV_MODE } from '@/lib/constants'

type Status = 'checking' | 'unconfirmed' | 'dev-mode'

const RESEND_COOLDOWN_SECONDS = 60
const POLL_INTERVAL_MS = 3000

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>(DEV_MODE ? 'dev-mode' : 'checking')
  const [email, setEmail] = useState<string>('')
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Keep the latest handler in a ref so the polling effect doesn't need to
  // re-subscribe every time `email` changes.
  const confirmedHandlerRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (DEV_MODE) return

    const supabase = createClient()
    let unmounted = false

    async function handleConfirmed() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError) {
        console.error('[verify-email] getUser (post-confirmation) failed:', authError.message)
        window.location.href = '/login'
        return
      }
      const dest = user ? await getPostAuthDestination(supabase, user.id) : '/login'
      // Hard nav so the session cookie is propagated to the next request.
      window.location.href = dest
    }
    confirmedHandlerRef.current = handleConfirmed

    // Initial check
    supabase.auth.getUser().then(({ data: { user }, error: authError }) => {
      if (unmounted) return
      if (authError) {
        console.error('[verify-email] initial getUser failed:', authError.message)
        toast.error('Could not check your sign-in status. Please sign in again.')
        window.location.href = '/login'
        return
      }
      if (!user) {
        window.location.href = '/signup'
        return
      }
      if (user.email_confirmed_at) {
        confirmedHandlerRef.current()
        return
      }
      setEmail(user.email ?? '')
      setStatus('unconfirmed')
    })

    // Poll — catches confirmation completed in another tab. Poll errors
    // are logged once and otherwise swallowed (the user sees the stale
    // unconfirmed page; the next tick or a manual reload recovers).
    let pollErrorLogged = false
    const pollId = window.setInterval(async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (unmounted) return
      if (authError) {
        if (!pollErrorLogged) {
          console.error('[verify-email] poll getUser failed:', authError.message)
          pollErrorLogged = true
        }
        return
      }
      if (!user) return
      if (user.email_confirmed_at) {
        window.clearInterval(pollId)
        confirmedHandlerRef.current()
      }
    }, POLL_INTERVAL_MS)

    return () => {
      unmounted = true
      window.clearInterval(pollId)
    }
  }, [])

  // Countdown tick for the resend button.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  async function handleResend() {
    if (cooldown > 0 || resending || !email) return
    setResending(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resend({ type: 'signup', email })

    if (error) {
      console.error('[verify-email] resend error:', error.message)
      toast.error('Could not resend the verification email. Please try again in a minute.')
      setResending(false)
      return
    }

    toast.success('Verification email sent. Check your inbox.')
    setCooldown(RESEND_COOLDOWN_SECONDS)
    setResending(false)
  }

  async function handleUseDifferentAccount() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/signup'
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            {status === 'dev-mode' ? (
              <PawPrint className="h-8 w-8 text-primary" />
            ) : (
              <MailQuestion className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle>
            {status === 'dev-mode' ? 'Email verification' : 'Verify your email'}
          </CardTitle>
          <CardDescription>
            {status === 'checking' && 'Looking up your account…'}
            {status === 'dev-mode' &&
              'Email verification is not available in dev mode. You can continue to onboarding.'}
            {status === 'unconfirmed' && (
              <>
                We sent a verification link to{' '}
                <span className="font-medium text-foreground">{email || 'your email'}</span>. Click
                the link in that email to continue to Fostr Find. This page will refresh
                automatically once you&apos;re verified.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'checking' && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {status === 'dev-mode' && (
            <Button asChild className="w-full">
              <Link href="/onboarding">Continue to onboarding</Link>
            </Button>
          )}

          {status === 'unconfirmed' && (
            <>
              <Button
                onClick={handleResend}
                className="w-full"
                disabled={resending || cooldown > 0 || !email}
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : cooldown > 0 ? (
                  `Resend in ${cooldown}s`
                ) : (
                  'Resend verification email'
                )}
              </Button>

              <button
                type="button"
                onClick={handleUseDifferentAccount}
                className="block w-full text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                Use a different account
              </button>
            </>
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
