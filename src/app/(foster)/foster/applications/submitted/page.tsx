import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check } from 'lucide-react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'

export const metadata: Metadata = { title: 'Application Submitted' }

interface PageProps {
  searchParams: Promise<{ id?: string }>
}

interface SubmittedApplicationRow {
  id: string
  dog: { name: string } | null
  shelter: { name: string } | null
}

/**
 * Post-application confirmation. Reached via redirect from the apply
 * dialog with `?id={applicationId}`; ownership-scoped so a foster can
 * only see their own application. Any lookup failure falls back quietly
 * to the applications list rather than a 404.
 */
export default async function ApplicationSubmittedPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await searchParams

  let dogName = 'Buddy'
  let shelterName = 'Happy Paws Rescue'

  if (!DEV_MODE) {
    // Validate before querying — a malformed id would raise a uuid-cast
    // error (22P02) instead of a clean empty result.
    if (!id || !z.string().uuid().safeParse(id).success) {
      redirect('/foster/applications')
    }

    let lookupFailed = false
    try {
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!user) {
        redirect('/login')
      }

      const { data: fosterRow, error: fosterError } = await supabase
        .from('foster_parents')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fosterError) throw fosterError
      if (!fosterRow) {
        redirect('/onboarding')
      }

      const { data: application, error } = await supabase
        .from('applications')
        .select('id, dog:dogs(name), shelter:shelters(name)')
        .eq('id', id)
        .eq('foster_id', fosterRow.id)
        .maybeSingle()

      if (error) throw error
      const row = application as SubmittedApplicationRow | null
      if (!row) {
        // No owned application with this id — nothing to confirm.
        lookupFailed = true
      } else {
        // The application exists and is the user's own; a null join
        // (e.g. anonymized shelter) degrades to generic copy rather
        // than bouncing a user whose submit just succeeded.
        dogName = row.dog?.name ?? 'your foster dog'
        shelterName = row.shelter?.name ?? 'the shelter'
      }
    } catch (e) {
      if (isNextControlFlowError(e)) throw e
      console.error(
        '[foster/applications/submitted] load failed:',
        e instanceof Error ? e.message : String(e),
      )
      lookupFailed = true
    }
    if (lookupFailed) {
      redirect('/foster/applications')
    }
  }

  const steps = [
    `${shelterName} reviews your application.`,
    "If you're accepted, you'll get a notification and an email.",
    `Messaging with ${shelterName} opens so you can plan the placement together.`,
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      <div className="space-y-3 text-center">
        {/* Peach, not warm/sage — a submitted application is a pending
            state in the palette semantics; sage is reserved for
            completed placements. */}
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-peach/40">
          <Check aria-hidden className="h-7 w-7 text-foreground/80" />
        </span>
        <h1 className="text-3xl font-display font-semibold">Application submitted</h1>
        <p className="text-muted-foreground">
          Your application to foster {dogName} is on its way to {shelterName}.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 font-semibold">What happens next</h2>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-peach/40 text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground/90">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/foster/applications">View My Applications</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/foster/browse">Keep Browsing</Link>
        </Button>
      </div>
    </div>
  )
}
