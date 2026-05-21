'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const queryEmail = searchParams.get('email') ?? ''

  // If the user just signed up (email in query string), there is no session yet —
  // Supabase requires email confirmation before issuing one. Skip the "checking"
  // phase and show the inbox prompt immediately.
  const [status, setStatus] = useState<Status>(
    DEV_MODE ? 'dev-mode' : queryEmail ? 'unconfirmed' : 'checking'
  )
  const [email, setEmail] = useState<string>(queryEmail)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

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
      window.location.href = dest
    }
    confirmedHandlerRef.current = handleConfirmed

    supabase.auth.getUser().then(({ data: { user }, error: authError }) => {
      if (unmounted) return
      if (authError) {
        console.error('[verify-email] initial getUser failed:', authError.message)
        toast.error('Could not check your sign-in status. Please sign in again.')
        window.location.href = '/login'
        return
      }
      if (!user) {
        // No session — expected right after email/password signup (confirmation required).
        // If we have an email from the query string, stay on the page and show the prompt.
        // Otherwise the user navigated here directly with no context; send them to signup.
        if (!queryEmail) {
          window.location.href = '/signup'
        }
        return
      }
      if (user.email_confirmed_at) {
        confirmedHandlerRef.current()
        return
      }
      setEmail(user.email ?? '')
      setStatus('unconfirmed')
    })

    // Poll every 3 s. Once the user clicks the confirmation link (in any tab),
    // /auth/callback exchanges the code and creates a session. The next poll
    // tick will detect the confirmed user and redirect automatically.
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
  }, [queryEmail])

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
            {status === 'dev-mode' ? 'Email verification' : 'Check your inbox'}
          </CardTitle>
          <CardDescription>
            {status === 'checking' && 'Looking up your account…'}
            {status === 'dev-mode' &&
              'Email verification is not available in dev mode. You can continue to onboarding.'}
            {status === 'unconfirmed' && (
              <>
                We sent a verification link to{' '}
                <span className="font-medium text-foreground">{email || 'your email address'}</span>
                . Open that email and click the link to continue. This page will advance
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

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}
